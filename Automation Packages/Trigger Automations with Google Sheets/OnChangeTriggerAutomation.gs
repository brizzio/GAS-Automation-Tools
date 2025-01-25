/**
 * Trigger function to process changes in the "Tasks" tab and send webhook payloads.
 * This should be used with an onEdit trigger.
 */
function onEditProcessStatus(e) {
  const SHEET_NAME = "Tasks"; // Tab to monitor
  const STATUS_COLUMN = "Status"; // Column header to monitor
  const COMPLETED_STATUS = "Completed"; // Status to trigger webhook
  const scriptProperties = PropertiesService.getScriptProperties();
  const WEBHOOK_URL = scriptProperties.getProperty("WEBHOOK_URL");

  if (!WEBHOOK_URL) {
    Logger.log("Webhook URL is not set. Please configure it in the script properties.");
    return;
  }

  const sheet = e.source.getActiveSheet();

  // Only proceed on the specified sheet
  if (sheet.getName() === SHEET_NAME) {
    const range = e.range;
    const headerRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const statusColIndex = headerRow.indexOf(STATUS_COLUMN) + 1;

    // Ensure the edit is in the "Status" column
    if (range.getColumn() === statusColIndex) {
      const row = range.getRow();
      const newValue = range.getValue();

      // Check if the status is "Completed"
      if (newValue === COMPLETED_STATUS) {
        const rowData = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
        const payload = {};

        // Build payload with header names as keys
        headerRow.forEach((header, i) => {
          payload[header] = rowData[i];
        });

        // Send webhook payload
        sendWebhook(WEBHOOK_URL, payload);
      }
    }
  }
}

/**
 * Sends a POST request to the Make.com webhook.
 * @param {string} url The Make.com webhook URL.
 * @param {object} payload The data to send in the webhook.
 */
function sendWebhook(url, payload) {
  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    Logger.log(`Webhook sent successfully: ${response.getContentText()}`);
  } catch (error) {
    Logger.log(`Error sending webhook: ${error.message}`);
  }
}

/**
 * Installs an onEdit trigger automatically if it doesn't exist.
 */
function installTrigger() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const triggers = ScriptApp.getProjectTriggers();
  const triggerExists = triggers.some(
    trigger => trigger.getHandlerFunction() === "onEditProcessStatus"
  );

  if (!triggerExists) {
    // Install the onEdit trigger
    ScriptApp.newTrigger("onEditProcessStatus")
      .forSpreadsheet(ss)
      .onEdit()
      .create();

    // Log the installation in the ChangeLog tab
    logTriggerInstallation();

    Logger.log("onEdit trigger installed successfully.");
  } else {
    Logger.log("onEdit trigger already exists.");
  }
}

/**
 * Logs the trigger installation event in a hidden "ChangeLog" tab.
 */
function logTriggerInstallation() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetName = "ChangeLog";

  // Check if ChangeLog sheet exists; if not, create it
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.hideSheet(); // Hide the ChangeLog tab
    sheet.appendRow(["Timestamp", "Event"]); // Add headers
  }

  // Log the trigger installation
  const timestamp = new Date();
  sheet.appendRow([timestamp.toISOString(), "Trigger Installed"]);
}

/**
 * Adds a custom menu and checks if the trigger is installed by looking at the ChangeLog.
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();

  // Add a custom menu with a "Setup Automation" option
  ui.createMenu("Automation Setup")
    .addItem("Run Setup", "setup")
    .addToUi();

  // Check if the ChangeLog indicates the trigger was installed
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("ChangeLog");

  if (!sheet || !isTriggerLogged(sheet)) {
    ui.alert(
      "Welcome to your automation! 🚀\n\n" +
      "It looks like the automation trigger isn't installed yet.\n" +
      "Click 'Automation Setup' in the menu above, then select 'Run Setup' to configure your webhook and trigger."
    );
  }
}

/**
 * Checks if the ChangeLog tab contains a record of the trigger installation.
 * @param {Sheet} sheet The ChangeLog sheet.
 * @returns {boolean} True if the trigger installation is logged, false otherwise.
 */
function isTriggerLogged(sheet) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === "Trigger Installed") {
      return true;
    }
  }
  return false;
}

/**
 * Run this function manually or from the menu to set up the automation.
 */
function setup() {
  installTrigger();
}
