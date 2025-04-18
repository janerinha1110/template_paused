require('dotenv').config();
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const express = require('express');
const { getTemplates } = require('./api');
const { login } = require('./auth');

const STORAGE_STATE_PATH = path.join(__dirname, 'auth.json');
const SESSION_EXPIRY_PATH = path.join(__dirname, 'session-expiry.json');
const SLACK_WEBHOOK_URL = 'https://hooks.slack.com/triggers/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';

// Create Express server
const app = express();
const PORT = process.env.PORT || 3001;

// Configure middleware
app.use(express.json());

// Function to send Slack notification
async function sendSlackNotification(template) {
  try {
    // Format the date
    const date = new Date(template.disabledTime);
    const formattedDate = date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    const message = {
      message: `Template: ${template.name}\nStatus: ${template.status}\nRejected Reason: ${template.rejectedReason || 'N/A'}\nDisabled Time: ${formattedDate}`
    };

    await axios.post(SLACK_WEBHOOK_URL, message);
    console.log(`Sent Slack notification for template: ${template.name}`);
  } catch (error) {
    console.error(`Error sending Slack notification for template ${template.name}:`, error);
  }
}

// Function to delay execution
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Login API endpoint
app.post('/login', async (req, res) => {
  console.log('Login API endpoint called');
  
  try {
    const result = await login();
    if (result.success) {
      return res.json({ 
        success: true, 
        message: 'Login successful',
        timestamp: new Date().toISOString()
      });
    } else {
      return res.status(500).json({ 
        success: false, 
        error: 'Login failed' 
      });
    }
  } catch (error) {
    console.error('Error in login endpoint:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// WhatsApp Templates API endpoint
app.get('/fetch-missing-templates', async (req, res) => {
  console.log('Fetch Missing Templates API endpoint called');
  
  try {
    const result = await getTemplates();
    return res.json(result);
  } catch (error) {
    console.error('Error in fetch missing templates endpoint:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Start Express server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Login API available at http://localhost:${PORT}/login`);
  console.log(`Fetch Missing Templates API available at http://localhost:${PORT}/fetch-missing-templates`);
}); 