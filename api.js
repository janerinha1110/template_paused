const { fetchMissingTemplates } = require('./components/fetchMissingTemplates');
const { sendSlackNotification } = require('./components/slack');
const { login } = require('./auth');
const { STORAGE_STATE_PATH } = require('./constants');
const fs = require('fs');

// Function to delay execution
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Function to get token from storage
function getTokenFromStorage() {
    try {
        if (!fs.existsSync(STORAGE_STATE_PATH)) {
            console.log('No auth file found');
            return null;
        }
        const storageState = JSON.parse(fs.readFileSync(STORAGE_STATE_PATH, 'utf8'));
        const cookies = storageState.cookies || [];
        
        // Find token cookie
        for (const cookie of cookies) {
            if (cookie.name === 'token') {
                return cookie.value;
            }
        }
        console.log('No token found in auth file');
        return null;
    } catch (error) {
        console.error('Error reading token from storage:', error);
        return null;
    }
}

// Main function to get templates
async function getTemplates() {
    try {
        // First attempt with existing token
        let token = getTokenFromStorage();
        if (!token) {
            console.log('No token found, attempting initial login...');
            const loginResult = await login();
            if (!loginResult.success) {
                return {
                    success: false,
                    error: 'Initial login failed'
                };
            }
            token = getTokenFromStorage();
            if (!token) {
                return {
                    success: false,
                    error: 'Failed to get token after login'
                };
            }
        }

        try {
            // Try to fetch templates with current token
            const result = await fetchMissingTemplates(token);
            return result;
        } catch (error) {
            if (error.message === 'AUTH_FAILED') {
                console.log('Token expired, attempting re-login...');
                // Try to login again
                const loginResult = await login();
                if (!loginResult.success) {
                    return {
                        success: false,
                        error: 'Re-login failed'
                    };
                }
                
                // Get new token
                token = getTokenFromStorage();
                if (!token) {
                    return {
                        success: false,
                        error: 'Failed to get token after re-login'
                    };
                }
                
                // Retry the template fetch with new token
                const retryResult = await fetchMissingTemplates(token);
                return retryResult;
            }
            throw error;
        }
    } catch (error) {
        console.error('Error in getTemplates:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

module.exports = {
    getTemplates
}; 