const axios = require('axios');
require('dotenv').config();

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

        await axios.post(process.env.API_ENDPOINT, message);
        console.log(`Sent Slack notification for template: ${template.name}`);
    } catch (error) {
        console.error(`Error sending Slack notification for template ${template.name}:`, error);
    }
}

module.exports = {
    sendSlackNotification
}; 