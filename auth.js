const { chromium } = require('playwright');
const fs = require('fs');
const { STORAGE_STATE_PATH, SESSION_EXPIRY_PATH } = require('./constants');
require('dotenv').config();

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
        await page.goto(process.env.LOGIN_URL, { waitUntil: 'domcontentloaded' });
        console.log('Navigated to login page');

        // Fill login form
        await page.fill('input[type="email"]', process.env.EMAIL);
        await page.fill('input[type="password"]', process.env.PASSWORD);
        
        // Try multiple selectors to find the login button
        const buttonSelectors = [
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
        
        return { success: true };

    } catch (error) {
        console.error('Login failed:', error);
        return { success: false, error: error.message };
    } finally {
        await browser.close();
    }
}

module.exports = {
    login
}; 