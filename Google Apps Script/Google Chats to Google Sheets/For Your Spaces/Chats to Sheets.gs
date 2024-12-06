function getAccessToken() {
  return ScriptApp.getOAuthToken(); // Directly fetch the OAuth token for the script
}

function getOrganizationSpaces(limit = 100) {
  const accessToken = getAccessToken();

  const url = `https://chat.googleapis.com/v1/spaces:search?useAdminAccess=true&query=${encodeURIComponent('customer="customers/my_customer" AND spaceType="SPACE"')}&pageSize=${limit}`;

  const response = UrlFetchApp.fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
    muteHttpExceptions: true,
  });

  const data = JSON.parse(response.getContentText());
  if (data.error) {
    Logger.log(`Error retrieving spaces: ${data.error.message}`);
    throw new Error(`Error retrieving spaces: ${data.error.message}`);
  }

  return data.spaces || [];
}

function getOrgSpaceMembers(spaceId, limit = 100) {
  const accessToken = getAccessToken();

  const url = `https://chat.googleapis.com/v1/spaces/${spaceId}/members?useAdminAccess=true&pageSize=${limit}`;

  const response = UrlFetchApp.fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
    muteHttpExceptions: true,
  });

  const data = JSON.parse(response.getContentText());
  if (data.error) {
    Logger.log(`Error retrieving members: ${data.error.message}`);
    throw new Error(`Error retrieving members: ${data.error.message}`);
  }

  return data.memberships || [];
}

function getMessagesForSpace(spaceId, lookBackHours = 24) {
  const accessToken = getAccessToken();

  const lookBackTime = new Date(Date.now() - lookBackHours * 60 * 60 * 1000).toISOString();
  const encodedFilter = encodeURIComponent(`createTime>"${lookBackTime}"`);

  const url = `https://chat.googleapis.com/v1/spaces/${spaceId}/messages?filter=${encodedFilter}`;

  Logger.log(`Fetching messages from URL: ${url}`);

  const response = UrlFetchApp.fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
    muteHttpExceptions: true,
  });

  const content = response.getContentText();
  Logger.log(`Response Content: ${content}`);

  const data = JSON.parse(content);

  if (data.error) {
    Logger.log(`Error retrieving messages for spaceId: ${spaceId}`);
    Logger.log(`Error Details: ${JSON.stringify(data.error)}`);
    throw new Error(`Error retrieving messages: ${data.error.message}`);
  }

  return data.messages || [];
}

function saveMessagesToSheet(spaceId, spaceName, messages) {
  // Get the active spreadsheet that the Apps Script is attached to
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  
  // Get the "Sheet1" or create it if it doesn't exist
  const sheet = spreadsheet.getSheetByName("Sheet1") || spreadsheet.insertSheet("Sheet1");

  // If the sheet is empty, add headers
  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      "Message ID", "Space ID", "Space Name", "Text", "Message Sent DateTime",
    ]);
  }

  // Append each message to the sheet
  messages.forEach(message => {
    sheet.appendRow([
      message.name,
      spaceId,
      spaceName,
      message.text || message.formattedText,
      message.createTime,
    ]);
  });
}

function main() {
  const spaces = getOrganizationSpaces();

  spaces.forEach(space => {
    const spaceId = space.name.split('/')[1];
    const spaceName = space.displayName || "Unnamed Space";
    Logger.log(`Processing space: ${spaceName} (spaceId: ${spaceId})`);

    try {
      const messages = getMessagesForSpace(spaceId);
      if (messages.length > 0) {
        saveMessagesToSheet(spaceId, spaceName, messages);
      } else {
        Logger.log(`No messages found for space: ${spaceName}`);
      }
    } catch (error) {
      Logger.log(`Skipping space: ${spaceName} (spaceId: ${spaceId}) due to error: ${error.message}`);
    }
  });
}