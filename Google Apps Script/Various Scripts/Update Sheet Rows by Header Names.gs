/**
 * Google Apps Script web app to update spreadsheet rows via API
 * 
 * HOW TO DEPLOY:
 * 1. Copy this entire script to your Apps Script editor
 * 2. Click Deploy > New deployment
 * 3. Select "Web app" as the deployment type
 * 4. Set "Execute as" to your account
 * 5. Set "Who has access" to "Anyone" 
 * 6. Click "Deploy" and copy the Web app URL
 * 7. Use that URL as your endpoint in Make.com HTTP module
 */

/**
 * Handles POST requests to the web app
 * @param {Object} e - The event object from Apps Script
 * @return {TextOutput} JSON response
 */
function doPost(e) {
  try {
    // Parse the JSON data
    const params = JSON.parse(e.postData.contents);
    
    // Check for required parameters
    const requiredParams = ['spreadsheetId', 'tabId', 'headerRowIndex', 'rowNumber', 'updates'];
    const missingParams = requiredParams.filter(param => params[param] === undefined);
    
    // If any required parameters are missing, return an error
    if (missingParams.length > 0) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        error: `Missing required parameters: ${missingParams.join(', ')}`
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Extract parameters
    const { spreadsheetId, tabId, headerRowIndex, rowNumber, updates } = params;
    
    // Open the target spreadsheet
    const ss = SpreadsheetApp.openById(spreadsheetId);
    
    // Get the target sheet
    let sheet;
    
    // Handle tabId as sheet GID, sheet name, or sheet index
    if (typeof tabId === 'number') {
      // First try to find sheet by GID
      sheet = ss.getSheets().find(s => s.getSheetId() === tabId);
      
      // If not found by GID, try as an index
      if (!sheet) {
        sheet = ss.getSheets()[tabId];
      }
    } else {
      // Try as sheet name
      sheet = ss.getSheetByName(tabId);
    }
    
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        error: `Sheet not found with tabId: ${tabId}`
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Get the header row
    const headerRow = sheet.getRange(headerRowIndex, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    // Process updates
    const appliedUpdates = {};
    for (const [header, value] of Object.entries(updates)) {
      const columnIndex = headerRow.indexOf(header) + 1;
      
      if (columnIndex <= 0) {
        continue; // Skip updates for headers that don't exist
      }
      
      // Apply the update
      sheet.getRange(rowNumber, columnIndex).setValue(value);
      appliedUpdates[header] = value;
    }
    
    // Return success response
    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      message: `Row ${rowNumber} updated successfully on tabId=${tabId}.`,
      updates: appliedUpdates
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    // Handle any unexpected errors
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      error: `Error: ${error.message}`
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Handles GET requests to the web app - provides simple documentation
 * @return {HtmlOutput} HTML documentation page
 */
function doGet() {
  const html = `
  <!DOCTYPE html>
  <html>
    <head>
      <title>Spreadsheet Update API</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        pre { background: #f5f5f5; padding: 10px; border-radius: 5px; overflow-x: auto; }
        .param { font-weight: bold; }
      </style>
    </head>
    <body>
      <h1>Spreadsheet Update API</h1>
      <p>This web app allows you to update specific cells in a Google Sheet via a POST request.</p>
      
      <h2>Required Parameters</h2>
      <ul>
        <li><span class="param">spreadsheetId</span> - The ID of the spreadsheet to update</li>
        <li><span class="param">tabId</span> - Sheet GID (number), sheet name (string), or sheet index (number)</li>
        <li><span class="param">headerRowIndex</span> - The row number containing the headers (1-based)</li>
        <li><span class="param">rowNumber</span> - The row number to update (1-based)</li>
        <li><span class="param">updates</span> - An object with header names as keys and new values as values</li>
      </ul>
      
      <h2>Example Request</h2>
      <pre>
{
  "spreadsheetId": "1WChXFaP-znyRF92OlTkVKPalX2ku00QbQtTvQetuTGY",
  "tabId": 123456789,  // GID from sheet URL
  "headerRowIndex": 1,
  "rowNumber": 5,
  "updates": {
    "Status": "Completed",
    "Last Updated": "2025-02-27"
  }
}
      </pre>
      
      <h2>Example Response</h2>
      <pre>
{
  "status": "success",
  "message": "Row 5 updated successfully on tabId=123456789.",
  "updates": {
    "Status": "Completed", 
    "Last Updated": "2025-02-27"
  }
}
      </pre>
    </body>
  </html>
  `;
  
  return HtmlService.createHtmlOutput(html);
}