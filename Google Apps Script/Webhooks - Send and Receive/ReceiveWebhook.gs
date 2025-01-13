// Open the Google Apps Script editor at https://script.google.com
// Create a new script and paste the following code:

function doPost(e) {
  try {
    //=======================
    // DETERMINE THE PAYLOAD
    //=======================
    // Parse the incoming data from the webhook (assumes JSON payload)
    var payload = JSON.parse(e.postData.contents);

    //=======================
    // SHEET LOGGING FOR TESTING
    //=======================
    // ID of your Google Sheet
    var scriptProperties = PropertiesService.getScriptProperties();
    var sheetId = scriptProperties.getProperty("SHEET_ID");
    if (!sheetId) throw new Error("Sheet ID not found in Script Properties.");
    var sheet = SpreadsheetApp.openById(sheetId).getSheetByName("Sheet1");

    // Get the next available row
    var lastRow = sheet.getLastRow();
    var nextRow = lastRow + 1;

    // Log the extracted data in separate columns
    sheet.getRange(nextRow, 1).setValue(payload);
    return ContentService.createTextOutput("Success 2").setMimeType(ContentService.MimeType.TEXT);
  } catch (error) {
    // Handle errors and return a response
    return ContentService.createTextOutput("Error: " + error.message).setMimeType(ContentService.MimeType.TEXT);
  }
}

// Deploy the script as a Web App
// 1. Go to "Deploy" > "New deployment".
// 2. Choose "Web app".
// 3. Set "Execute as" to "Me" and "Who has access" to "Anyone".
// 4. Deploy and note the Web App URL.

// Replace YOUR_GOOGLE_SHEET_ID with the ID of your Google Sheet
// The ID is the part of the sheet's URL between /d/ and /edit