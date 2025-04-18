const axios = require('axios');

// API call function
async function makeApiCall(token) {
    try {
        console.log('Making API call to fetch templates...');
        const response = await axios({
            method: 'post',
            url: 'https://backend.aisensy.com/client/t1/api/get-templates-by-status',
            headers: {
                'accept': 'application/json, text/plain, */*',
                'content-type': 'application/json;charset=UTF-8',
                'origin': 'https://www.app.aisensy.com',
                'referer': 'https://www.app.aisensy.com/',
                'Authorization': `Bearer ${token}`
            },
            data: {
                statusFilter: "action_required",
                tag: "trending",
                skip: 0,
                timeStamp: new Date().toISOString(),
                rowsPerPage: 100,
                totalCount: null,
                assistantId: "6515621dfe38c80b4d35a1a7"
            }
        });
        console.log(`API call successful. Found ${response.data.templates.length} templates.`);
        return response.data;
    } catch (error) {
        if (error.response && error.response.status === 401) {
            console.log('Authentication failed (401), token might be expired');
            throw new Error('AUTH_FAILED');
        }
        console.error('API call failed:', error.message);
        throw new Error(`API call failed: ${error.message}`);
    }
}

// Template processing functions
function processTemplates(rawTemplates) {
    console.log('Processing raw template data...');
    
    const processed = rawTemplates.map(template => {
        // Get the most recent status change timestamp
        const lastStatusChange = template.statusJourney && template.statusJourney.length > 0 
            ? template.statusJourney[template.statusJourney.length - 1].timestamp 
            : template.updatedAt;

        return {
            name: template.name,
            rejectedReason: template.rejectedReason,
            disabledTime: lastStatusChange,
            status: template.status
        };
    });
    console.log(`Processed ${processed.length} templates.`);
    return processed;
}

function filterRecentTemplates(templates) {
    console.log('Filtering recent templates...');
    const fourHoursAgo = new Date();
    const hours = 4;
    fourHoursAgo.setHours(fourHoursAgo.getHours() - hours);
    
    // Format cutoff date in IST
    const cutoffIST = fourHoursAgo.toLocaleString('en-IN', { 
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    const cutoffTimestamp = fourHoursAgo.getTime();
    console.log(`Cutoff date (IST): ${cutoffIST}, Timestamp: ${cutoffTimestamp}`);
    
    const recent = templates.filter(template => {
        // Skip non-DISABLED templates
        if (template.status !== 'DISABLED') {
            console.log(`Skipping template "${template.name}" - status is ${template.status}`);
            return false;
        }

        // Parse the ISO 8601 date string and convert to Unix timestamp in ms
        const templateDate = new Date(template.disabledTime);
        const templateTimestamp = templateDate.getTime();

        // Format template date in IST
        const templateIST = templateDate.toLocaleString('en-IN', { 
            timeZone: 'Asia/Kolkata',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });

        console.log(`Template: "${template.name}", Last status change (IST): ${templateIST}`);
        
        return templateTimestamp >= cutoffTimestamp;
    });
    console.log(`Found ${recent.length} DISABLED templates from the last ${hours} hours.`);
    return recent;
}

function formatTemplateDates(templates) {
    console.log('Formatting template dates...');
    const formatted = templates.map(template => ({
        ...template,
        disabledTime: new Date(template.disabledTime).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        })
    }));
    return formatted;
}

// Main function to fetch and process templates
async function fetchMissingTemplates(token) {
    try {
        // Make API call
        const apiResponse = await makeApiCall(token);

        // Process templates
        const processedTemplates = processTemplates(apiResponse.templates);

        // Filter recent templates
        const recentTemplates = filterRecentTemplates(processedTemplates);

        // Format and return response
        const result = {
            success: true,
            templates: formatTemplateDates(recentTemplates),
            totalCount: recentTemplates.length
        };
        console.log(`Successfully processed ${result.totalCount} templates.`);
        return result;
    } catch (error) {
        console.error('Error in fetchMissingTemplates:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

module.exports = {
    fetchMissingTemplates
}; 