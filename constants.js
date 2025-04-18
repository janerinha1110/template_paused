const path = require('path');

const STORAGE_STATE_PATH = path.join(__dirname, 'auth.json');
const SESSION_EXPIRY_PATH = path.join(__dirname, 'session-expiry.json');

module.exports = {
    STORAGE_STATE_PATH,
    SESSION_EXPIRY_PATH
}; 