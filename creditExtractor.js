/**
 * This module contains the specific logic to extract credit information from the aisensy dashboard
 */

/**
 * Extracts the credit value from the dashboard page
 * @param {Page} page - Playwright page object
 * @returns {Promise<string|null>} - The extracted credit value or null if not found
 */
async function extractCreditValue(page) {
  try {
    // First method: Try to find specific elements with credit information
    const creditValue = await page.evaluate(() => {
      // Look for specific elements containing credit data
      // Based on dashboard.html, we need to find where the credit value is displayed
      
      // Method 1: Look for elements with specific CSS classes related to credits
      const creditElements = document.querySelectorAll('.credit-balance, .credits-remaining, .balance-display');
      for (const element of creditElements) {
        if (element && element.textContent) {
          const match = element.textContent.match(/[\d,]+(\.\d+)?/);
          if (match) return match[0].replace(/,/g, '');
        }
      }
      
      // Method 2: Look for text containing "Credits" and extract nearby numbers
      const elements = Array.from(document.querySelectorAll('*'));
      for (const element of elements) {
        const text = element.textContent || '';
        if (text.includes('Credits') || text.includes('credits')) {
          const match = text.match(/[\d,]+(\.\d+)?/);
          if (match) return match[0].replace(/,/g, '');
        }
      }
      
      // Method 3: Look for specific patterns in the page content
      const pageText = document.body.textContent || '';
      const creditsPattern = /Credits\s*:?\s*([\d,]+(\.\d+)?)/i;
      const creditsMatch = pageText.match(creditsPattern);
      if (creditsMatch && creditsMatch[1]) {
        return creditsMatch[1].replace(/,/g, '');
      }
      
      return null;
    });
    
    if (creditValue) {
      return creditValue;
    }
    
    // Fallback: If we couldn't find the credit value using the above methods,
    // take a screenshot of the dashboard for manual inspection
    await page.screenshot({ path: 'dashboard-screenshot.png' });
    console.log('Took screenshot of dashboard for manual inspection');
    
    return null;
  } catch (error) {
    console.error('Error extracting credit value:', error);
    return null;
  }
}

module.exports = {
  extractCreditValue
}; 