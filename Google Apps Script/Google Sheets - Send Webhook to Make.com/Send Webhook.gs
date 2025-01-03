// Simplified Google Apps Script for Sending Data to a Webhook

function onChangeSendWebhook(e) {
  const sheet = e.source.getActiveSheet();

  // Check if the change occurred on the designated tab
  if (sheet.getName() === "DATA_TAB") {
    const range = e.source.getActiveRange();
    if (range.getColumn() === 3) {  // Column C
      const row = range.getRow();
      const dropdownValue = range.getValue(); // Value from the dropdown in column C
      const adjacentValue = sheet.getRange(row, 4).getValue(); // Column D

      // Only proceed if the dropdown is "Trigger" and adjacent cell isn't "Processed"
      if (dropdownValue === "Trigger" && adjacentValue !== "Processed") {

        // Your webhook URL
        const webhookUrl = "https://example.com/webhook";

        // Pull values from the current row
        const date = sheet.getRange(row, 1).getValue(); // Column A
        const amount = sheet.getRange(row, 2).getValue(); // Column B
        const description = sheet.getRange(row, 5).getValue(); // Column E

        // Prepare payload
        const payload = {
          Date: date,
          Amount: amount,
          Description: description,
          RowNumber: row,
        };

        // Configure request
        const options = {
          method: "post",
          contentType: "application/json",
          payload: JSON.stringify(payload),
          muteHttpExceptions: true,
        };

        // Send data to the webhook
        try {
          const response = UrlFetchApp.fetch(webhookUrl, options);
          Logger.log(`Webhook response: ${response.getContentText()}`);
        } catch (error) {
          Logger.log(`Error sending to webhook: ${error.message}`);
        }

      } else {
        SpreadsheetApp.getUi().alert(
          'You have de-selected the "Trigger" option for this record. If you set it to "Trigger" again, a duplicate notification may be sent.'
        );
      }
    }
  }
}

// Note: Set up a trigger for this function to execute on changes in the sheet.
