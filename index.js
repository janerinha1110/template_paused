require('dotenv').config();
const { chromium } = require('playwright');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const express = require('express');
const { extractCreditValue } = require('./creditExtractor');

const STORAGE_STATE_PATH = path.join(__dirname, 'auth.json');
const SESSION_EXPIRY_PATH = path.join(__dirname, 'session-expiry.json');
const SLACK_WEBHOOK_URL = 'https://hooks.slack.com/triggers/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';

// Create Express server
const app = express();
const PORT = process.env.PORT || 3000;

// Configure middleware
app.use(express.json());

// Credits API endpoint
app.get('/credits', async (req, res) => {
  console.log('Credits API endpoint called');
  
  try {
    // Check if we need to login first
    if (!isSessionValid()) {
      console.log('No valid session, performing login first');
      // We need to login first, then scrape credits
      const loginPromise = login();
      
      // Set a timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Login and credit scraping timed out')), 60000);
      });
      
      // Wait for login to complete or timeout
      await Promise.race([loginPromise, timeoutPromise]);
      
      // Read the credit value from latest run
      const creditValue = readLatestCreditValue();
      
      if (creditValue !== null) {
        return res.json({ 
          success: true, 
          credits: creditValue,
          timestamp: new Date().toISOString()
        });
      } else {
        return res.status(500).json({ 
          success: false, 
          error: 'Could not retrieve credit value after login' 
        });
      }
    } else {
      // Session is valid, just scrape credits
      const creditValue = await scrapeCredits();
      
      if (creditValue !== null) {
        return res.json({ 
          success: true, 
          credits: creditValue,
          timestamp: new Date().toISOString() 
        });
      } else {
        return res.status(500).json({ 
          success: false, 
          error: 'Failed to retrieve credit value' 
        });
      }
    }
  } catch (error) {
    console.error('Error in credits endpoint:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Function to read latest credit value from file
function readLatestCreditValue() {
  try {
    const creditFilePath = path.join(__dirname, 'latest-credit.json');
    if (fs.existsSync(creditFilePath)) {
      const data = JSON.parse(fs.readFileSync(creditFilePath, 'utf8'));
      return data.credits;
    }
    return null;
  } catch (error) {
    console.error('Error reading latest credit value:', error);
    return null;
  }
}

// Start Express server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Credits API available at http://localhost:${PORT}/credits`);
});

async function login() {
  console.log('Starting login process...');
  const browser = await chromium.launch({ 
    headless: true, 
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--single-process'
    ]
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to login page
    await page.goto(process.env.LOGIN_URL, { waitUntil: 'networkidle' });
    console.log('Navigated to login page');

    // Fill login form
    await page.fill('input[type="email"]', process.env.EMAIL);
    await page.fill('input[type="password"]', process.env.PASSWORD);
    
    // Try multiple selectors to find the login button
    const buttonSelectors = [
      // Try to select the second Continue button specifically
      ':nth-match(button:has-text("Continue"), 2)',
      'button.MuiButton-contained:has-text("Continue")', 
      'button.MuiButton-root:has-text("Continue")',
      'button[type="submit"]',
      'button:has-text("Login")',
      'button:has-text("Sign in")',
      '.login-button',
      'form button',
      'button.MuiButton-contained',
      'button.MuiButton-root'
    ];
    
    // Try each selector until we find a visible button
    let buttonFound = false;
    for (const selector of buttonSelectors) {
      const button = await page.$(selector);
      if (button && await button.isVisible()) {
        console.log(`Found login button with selector: ${selector}`);
        // Click button and wait for navigation
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'networkidle' }),
          button.click()
        ]);
        buttonFound = true;
        break;
      }
    }
    
    if (!buttonFound) {
      // Try to get all Continue buttons and click the second one
      console.log('Trying to click second Continue button...');
      const continueButtons = await page.$$('button:has-text("Continue")');
      if (continueButtons.length >= 2) {
        console.log('Found multiple Continue buttons, clicking the second one');
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'networkidle' }),
          continueButtons[1].click()
        ]);
      } else {
        // As a fallback, try clicking the last button in the form
        console.log('Trying to click the last button in the form...');
        const formButtons = await page.$$('form button');
        if (formButtons.length > 0) {
          const lastButton = formButtons[formButtons.length - 1];
          await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle' }),
            lastButton.click()
          ]);
        } else {
          // If that fails, try taking a screenshot to debug
          await page.screenshot({ path: 'login-debug.png' });
          throw new Error('Could not find the login button with any selector');
        }
      }
    }
    
    console.log('Login successful');

    // Store authentication state
    await context.storageState({ path: STORAGE_STATE_PATH });
    
    // Save session expiry time (24 hours from now)
    const expiryTime = new Date();
    expiryTime.setHours(expiryTime.getHours() + 24);
    fs.writeFileSync(
      SESSION_EXPIRY_PATH,
      JSON.stringify({ expiry: expiryTime.toISOString() })
    );
    
    console.log('Session saved, will expire at:', expiryTime);
    
    // After login, immediately scrape credit information
    await scrapeCredits(context);

  } catch (error) {
    console.error('Login failed:', error);
  } finally {
    await browser.close();
  }
}

async function scrapeCredits(existingContext = null) {
  console.log('Starting credit scraping process...');
  let browser;
  let context;
  
  try {
    if (existingContext) {
      context = existingContext;
    } else {
      // Check if we have a valid session
      if (!isSessionValid()) {
        console.log('Session expired or not found, logging in again...');
        return login();
      }
      
      // Use existing session
      browser = await chromium.launch({ 
        headless: true, 
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--single-process'
        ]
      });
      context = await browser.newContext({
        storageState: STORAGE_STATE_PATH
      });
    }
    
    // Extract cookies and token from stored session
    const storageState = JSON.parse(fs.readFileSync(STORAGE_STATE_PATH, 'utf8'));
    const cookies = storageState.cookies || [];
    
    // Find token cookie
    let token = '';
    for (const cookie of cookies) {
      if (cookie.name === 'token') {
        token = cookie.value;
        break;
      }
    }
    
    if (!token) {
      console.error('Token not found in session cookies');
      return null;
    }
    
    console.log('Found authentication token, making API request...');
    
    try {
      // Make the API call using axios
      const assistantId = process.env.ASSISTANT_ID || "6515621dfe38c80b4d35a1a7";
      const response = await axios({
        method: 'post',
        url: 'https://backend.aisensy.com/client/t1/api/get-wba-details',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Origin': 'https://www.app.aisensy.com',
          'Referer': 'https://www.app.aisensy.com/'
        },
        data: {
          assistantId: assistantId
        }
      });
      
      const responseData = response.data;
      console.log('API response received:', JSON.stringify(responseData, null, 2));
      
      // Extract credit value from response
      let creditValue = null;
      if (responseData && responseData.templateCredit !== undefined) {
        creditValue = responseData.templateCredit;
        console.log(`Credits found: ${creditValue}`);
        
        // Save the credit value to a file
        fs.writeFileSync(
          path.join(__dirname, 'latest-credit.json'),
          JSON.stringify({ 
            credits: creditValue,
            timestamp: new Date().toISOString()
          })
        );
        
        // Send to Slack webhook
        await sendToSlackWebhook(creditValue);
      } else {
        console.log('Could not find credits value in API response');
      }
      
      if (!existingContext && browser) {
        await browser.close();
      }
      
      return creditValue;
    } catch (apiError) {
      console.error('API request failed:', apiError.message);
      if (apiError.response) {
        console.error('Response status:', apiError.response.status);
        console.error('Response data:', apiError.response.data);
        
        // Handle 401 unauthorized error (session expired)
        if (apiError.response.status === 401) {
          console.log('Session expired (401 error). Initiating new login...');
          
          // Close the current browser if it exists
          if (!existingContext && browser) {
            await browser.close();
          }
          
          // Delete the current session files
          try {
            if (fs.existsSync(STORAGE_STATE_PATH)) {
              fs.unlinkSync(STORAGE_STATE_PATH);
              console.log('Removed expired auth.json file');
            }
            if (fs.existsSync(SESSION_EXPIRY_PATH)) {
              fs.unlinkSync(SESSION_EXPIRY_PATH);
              console.log('Removed expired session-expiry.json file');
            }
          } catch (fsError) {
            console.error('Error removing session files:', fsError);
          }
          
          // Start new login process
          console.log('Starting new login process...');
          await login();
          
          // Try to read the latest credit value after login
          return readLatestCreditValue();
        }
      }
      
      if (!existingContext && browser) {
        await browser.close();
      }
      return null;
    }
  } catch (error) {
    console.error('Error during credit scraping:', error);
    if (!existingContext && browser) {
      await browser.close();
    }
    return null;
  }
}

function isSessionValid() {
  try {
    // Check if auth.json exists
    if (!fs.existsSync(STORAGE_STATE_PATH)) {
      return false;
    }
    
    // Check if session-expiry.json exists and session is still valid
    if (fs.existsSync(SESSION_EXPIRY_PATH)) {
      const { expiry } = JSON.parse(fs.readFileSync(SESSION_EXPIRY_PATH, 'utf8'));
      const expiryDate = new Date(expiry);
      const now = new Date();
      return expiryDate > now;
    }
    
    return false;
  } catch (error) {
    console.error('Error checking session validity:', error);
    return false;
  }
}

// Add process error handlers to prevent crashes
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
});

// Schedule to run every hour
console.log('Starting cron job for credit checks every hour...');
cron.schedule('0 * * * *', async () => {
  try {
    console.log('Running scheduled credit check...');
    await scrapeCredits().catch(err => {
      console.error('Error in scheduled credit check:', err);
    });
  } catch (error) {
    console.error('Cron job error:', error);
  }
});

// Initial run on startup
console.log('Server started, initializing first credit check and waiting for API requests at /credits');
(async () => {
  try {
    if (isSessionValid()) {
      console.log('Using existing session for initial check');
      await scrapeCredits().catch(err => {
        console.error('Error in initial credit check:', err);
      });
    } else {
      console.log('No valid session found, logging in...');
      await login().catch(err => {
        console.error('Error during login:', err);
      });
    }
  } catch (error) {
    console.error('Error during startup sequence:', error);
  }
})();

// Endpoint for Vercel cron job integration
app.get('/api/cron-check', async (req, res) => {
  // Optional: verify a secret to ensure only authorized cron jobs can trigger this
  const secretHeader = req.headers['x-vercel-cron-secret'];
  
  if (process.env.CRON_SECRET && secretHeader !== process.env.CRON_SECRET) {
    return res.status(401).json({ 
      success: false, 
      error: 'Unauthorized cron request' 
    });
  }
  
  console.log('Running cron job via API endpoint...');
  try {
    const creditValue = await scrapeCredits();
    
    if (creditValue !== null) {
      return res.json({ 
        success: true, 
        credits: creditValue,
        timestamp: new Date().toISOString()
      });
    } else {
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to retrieve credit value' 
      });
    }
  } catch (error) {
    console.error('Error in cron endpoint:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Initial run on startup - only in non-Vercel environments
// In Vercel, endpoints are only activated when called
if (process.env.VERCEL_ENV === undefined) {
  console.log('Server started, waiting for API requests at /credits');
} else {
  console.log('Server running in Vercel environment, endpoints ready');
}

// Function to send data to Slack webhook
async function sendToSlackWebhook(creditValue) {
  try {
    // Only send notification if credits are below 3000
    if (creditValue < 3000) {
      console.log(`Credits (${creditValue}) below threshold of 3000. Sending to Slack webhook.`);
      
      const response = await axios.post(SLACK_WEBHOOK_URL, {
        WCC: `ALERT: Low credits! Current balance: ${creditValue}`
      });
      
      if (response.status === 200) {
        console.log('Successfully sent to Slack webhook');
      } else {
        console.error(`Failed to send to Slack webhook: Status ${response.status}`);
      }
    } else {
      console.log(`Credits (${creditValue}) above threshold of 3000. No Slack notification needed.`);
    }
  } catch (error) {
    console.error('Error sending to Slack webhook:', error.message);
  }
} 