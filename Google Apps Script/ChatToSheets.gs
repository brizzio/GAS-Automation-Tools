// Global user cache
const userMap = {};

// Main function to execute the script
function main() {
  const spaces = getOrganizationSpaces();
  spaces.forEach(space => {
    const spaceId = space.name.split('/')[1];
    const spaceName = space.displayName || "Unnamed Space";
    Logger.log(`Pulling Data For: ${spaceName}`);

    const members = getOrgSpaceMembers(spaceId);
    members.forEach(member => {
      const userId = member.member.name.split('/')[1];
      const userDetails = getUserDetails(userId);
      const userEmail = userDetails.emailAddresses?.[0]?.value;

      if (userEmail && validateEmail(userEmail)) {
        getMessagesForUserInSpace(spaceId, spaceName, userEmail);
      } else {
        Logger.log(`No valid email found for user ID: ${userId}`);
      }
    });
  });
}

// Function to validate email addresses
function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Function to get an access token for impersonation
function getAccessToken(userToImpersonate) {
  if (!userToImpersonate || !validateEmail(userToImpersonate)) {
    throw new Error(`Invalid user email for impersonation: ${userToImpersonate}`);
  }

  const serviceAccountEmail = PropertiesService.getScriptProperties().getProperty('ServiceAccountEmail'); // Get from script properties

  if (!serviceAccountEmail) {
    throw new Error('ServiceAccountEmail is not set in Script Properties.');
  }

  // Create the signed JWT with impersonation
  const jwt = createJwt(serviceAccountEmail, userToImpersonate);
  Logger.log("Generated JWT: " + jwt);

  const tokenResponse = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
    method: 'post',
    contentType: 'application/x-www-form-urlencoded',
    payload: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    muteHttpExceptions: true
  });

  const tokenData = JSON.parse(tokenResponse.getContentText());
  if (tokenData.error) {
    Logger.log(`Error obtaining access token for ${userToImpersonate}: ${tokenData.error_description}`);
    throw new Error(`Error getting access token: ${tokenData.error_description}`);
  }

  return tokenData.access_token;
}

// Function to create a signed JWT
function createJwt(serviceAccountEmail, userToImpersonate) {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 3600;

  // JWT Claims Set with impersonation
  const payload = {
    "iss": serviceAccountEmail,
    "sub": userToImpersonate,
    "scope": "https://www.googleapis.com/auth/chat.messages https://www.googleapis.com/auth/chat.spaces",
    "aud": "https://oauth2.googleapis.com/token",
    "exp": exp,
    "iat": iat
  };

  const payloadString = JSON.stringify(payload);

  const requestBody = {
    "delegates": [],
    "payload": payloadString
  };

  const url = `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${serviceAccountEmail}:signJwt`;
  const response = UrlFetchApp.fetch(url, {
    method: 'POST',
    contentType: 'application/json',
    headers: { Authorization: `Bearer ${ScriptApp.getOAuthToken()}` },
    payload: JSON.stringify(requestBody),
    muteHttpExceptions: true
  });

  Logger.log("IAM API Response: " + response.getContentText());

  const signedJwtData = JSON.parse(response.getContentText());
  if (signedJwtData.error) {
    Logger.log(signedJwtData);
    throw new Error(`Error signing JWT: ${signedJwtData.error.message}`);
  }

  return signedJwtData.signedJwt;
}

// Function to get organization spaces
function getOrganizationSpaces(limit = 100) {
  const accessToken = ScriptApp.getOAuthToken();

  // Retrieve LookBackHours from Script Properties
  const lookBackHours = parseInt(PropertiesService.getScriptProperties().getProperty('LookBackHours'), 10) || 24;

  const currentTime = new Date();
  const lookBackTime = new Date(currentTime.getTime() - lookBackHours * 60 * 60 * 1000);

  const url = `https://chat.googleapis.com/v1/spaces:search?useAdminAccess=true&query=${encodeURIComponent('customer="customers/my_customer" AND spaceType="SPACE"')}&pageSize=${limit}`;

  const response = UrlFetchApp.fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    muteHttpExceptions: true
  });

  const data = JSON.parse(response.getContentText());
  if (data.error) {
    Logger.log(`Error retrieving spaces: ${data.error.message}`);
    throw new Error(`Error retrieving spaces: ${data.error.message}`);
  }

  const filteredSpaces = data.spaces.filter(space => {
    const lastActiveTime = new Date(space.lastActiveTime);
    return lastActiveTime >= lookBackTime;
  });

  Logger.log("Filtered Organization Spaces:");
  Logger.log(filteredSpaces);
  return filteredSpaces || [];
}

// Function to get members of a space
function getOrgSpaceMembers(spaceId, limit = 100) {
  const accessToken = ScriptApp.getOAuthToken();
  const filter = encodeURIComponent('member.type="HUMAN"'); // Encode the filter parameter

  const url = `https://chat.googleapis.com/v1/spaces/${spaceId}/members?useAdminAccess=true&filter=${filter}&pageSize=${limit}`;

  const response = UrlFetchApp.fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    muteHttpExceptions: true
  });

  const data = JSON.parse(response.getContentText());
  if (data.error) {
    Logger.log(`Error retrieving members: ${data.error.message}`);
    throw new Error(`Error retrieving members: ${data.error.message}`);
  }

  Logger.log("Members in Space:");
  Logger.log(data.memberships);
  return data.memberships || [];
}

// Function to get user details, utilizing caching with "ChatContacts" sheet
function getUserDetails(userId) {
  // Get the Spreadsheet ID from Script Properties or define it directly
  const sheetId = PropertiesService.getScriptProperties().getProperty('SheetId');
  if (!sheetId) {
    throw new Error('SheetId is not set in Script Properties.');
  }

  const spreadsheet = SpreadsheetApp.openById(sheetId);

  // Get or create the ChatContacts sheet
  let contactsSheet = spreadsheet.getSheetByName('ChatContacts');
  if (!contactsSheet) {
    contactsSheet = spreadsheet.insertSheet('ChatContacts');
    // Add headers
    contactsSheet.appendRow(['User ID', 'Display Name', 'Email Address']);
  }

  // If userMap is empty, build it from the sheet
  if (Object.keys(userMap).length === 0) {
    const data = contactsSheet.getDataRange().getValues();
    const headers = data[0];
    const userIdIndex = headers.indexOf('User ID');
    const displayNameIndex = headers.indexOf('Display Name');
    const emailAddressIndex = headers.indexOf('Email Address');

    for (let i = 1; i < data.length; i++) {
      userMap[data[i][userIdIndex]] = {
        displayName: data[i][displayNameIndex],
        emailAddress: data[i][emailAddressIndex]
      };
    }
  }

  // Check if userId exists in the userMap
  if (userMap[userId]) {
    return {
      names: [{ displayName: userMap[userId].displayName }],
      emailAddresses: userMap[userId].emailAddress ? [{ value: userMap[userId].emailAddress }] : []
    };
  }

  // If not found in cache, call the People API
  const accessToken = ScriptApp.getOAuthToken();
  const url = `https://people.googleapis.com/v1/people/${userId}?personFields=names,emailAddresses`;

  const response = UrlFetchApp.fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    muteHttpExceptions: true
  });

  const dataFromApi = JSON.parse(response.getContentText());
  if (dataFromApi.error) {
    Logger.log(`Error retrieving user details: ${dataFromApi.error.message}`);
    // Even if we can't get details, cache that this userId has no details
    userMap[userId] = {
      displayName: null,
      emailAddress: null
    };
    contactsSheet.appendRow([userId, null, null]);
    return {
      names: [],
      emailAddresses: []
    };
  }

  Logger.log("User Details:");
  Logger.log(dataFromApi);

  // Save the data to the ChatContacts sheet
  const displayName = dataFromApi.names?.[0]?.displayName || "Not in Contacts";
  const emailAddress = dataFromApi.emailAddresses?.[0]?.value || null;

  contactsSheet.appendRow([userId, displayName, emailAddress]);

  // Update the userMap cache
  userMap[userId] = {
    displayName: displayName,
    emailAddress: emailAddress
  };

  return dataFromApi;
}

// Function to get messages for a user in a space
function getMessagesForUserInSpace(spaceId, spaceName, userEmail) {
  if (!userEmail || !validateEmail(userEmail)) {
    Logger.log(`Invalid user email for getting messages: ${userEmail}`);
    return;
  }

  const accessToken = getAccessToken(userEmail);

  // Retrieve LookBackHours from Script Properties
  const lookBackHours = parseInt(PropertiesService.getScriptProperties().getProperty('LookBackHours'), 10) || 24;

  const currentTime = new Date();
  const lookBackTime = new Date(currentTime.getTime() - lookBackHours * 60 * 60 * 1000);

  // Format lookBackTime to RFC-3339 format
  const lookBackTimeRFC3339 = lookBackTime.toISOString();

  // Get the Spreadsheet ID from Script Properties or define it directly
  const sheetId = PropertiesService.getScriptProperties().getProperty('SheetId');
  if (!sheetId) {
    throw new Error('SheetId is not set in Script Properties.');
  }

  const spreadsheet = SpreadsheetApp.openById(sheetId);
  const sheetName = PropertiesService.getScriptProperties().getProperty('SheetName') || 'ChatMessages';

  let sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, 15).setValues([
      ["Message ID", "User Email", "Space ID", "Space Name", "Text", "MessageSentDateTime", "MessageSentDate", "MessageSentTime", "Sender ID", "Sender Name", "Sender Email", "Thread ID", "Record Last Updated", "Has Ticket", "Ticket ID"]
    ]);
  }

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const recordLastUpdatedCol = headers.indexOf("Record Last Updated") + 1;

  if (recordLastUpdatedCol === 0) {
    throw new Error('Column with header "Record Last Updated" not found.');
  }

  const existingData = sheet.getDataRange().getValues();
  const existingMessageIds = existingData.map(row => row[0]);

  const currentDate = new Date();

  let nextPageToken = null;
  let rows = [];

  do {
    // Construct API URL with filter and optional nextPageToken
    const filter = encodeURIComponent(`createTime > "${lookBackTimeRFC3339}"`);
    let apiUrl = `https://chat.googleapis.com/v1/spaces/${spaceId}/messages?filter=${filter}`;
    if (nextPageToken) {
      apiUrl += `&pageToken=${nextPageToken}`;
    }

    const response = UrlFetchApp.fetch(apiUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json'
      },
      muteHttpExceptions: true
    });

    const messagesData = JSON.parse(response.getContentText());

    if (messagesData.error) {
      Logger.log(`Error retrieving messages: ${messagesData.error.message}`);
      break; // Exit the loop if there's an error
    }

    if (messagesData.messages) {
      rows = rows.concat(
        messagesData.messages.map(message => {
          const messageId = message.name;
          const messageSentDateTime = new Date(message.createTime);
          const messageSentDate = Utilities.formatDate(messageSentDateTime, Session.getScriptTimeZone(), "yyyy-MM-dd");
          const messageSentTime = Utilities.formatDate(messageSentDateTime, Session.getScriptTimeZone(), "HH:mm:ss");

          const existingRow = existingMessageIds.indexOf(messageId);

          const SenderId = message.sender.name.split('/')[1];
          const SenderDetails = getUserDetails(SenderId);
          const SenderEmail = SenderDetails.emailAddresses?.[0]?.value || '';
          const SenderName = SenderDetails.names?.[0]?.displayName || "Not in Contacts";
          const HasTicket = " ";
          const TicketID = " ";

          if (existingRow > -1) {
            sheet.getRange(existingRow + 1, recordLastUpdatedCol).setValue(currentDate);
            return null;
          } else {
            return [
              messageId,
              userEmail,
              spaceId,
              spaceName,
              message.text || message.formattedText,
              message.createTime,
              messageSentDate,
              messageSentTime,
              message.sender.name,
              SenderName,
              SenderEmail,
              message.thread?.name,
              currentDate,
              HasTicket,
              TicketID
            ];
          }
        }).filter(row => row !== null)
      );
    }

    // Update nextPageToken for pagination
    nextPageToken = messagesData.nextPageToken || null;

  } while (nextPageToken);

  if (rows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
  } else {
    Logger.log(`No new messages found for user ${userEmail} in space ${spaceId}.`);
  }
}