function exportCalendarEventsForActiveUser() {
  // Specify the Sheet ID and Sheet Names
  const sheetId = "AAAAAAAAAAAAAAAAAAA"; // Replace with your Google Sheet ID
  const sheetName = "Calendar Data"; // Main data sheet
  const clientsTabName = "Clients"; // Clients tab
  const controlsTabName = "Controls"; // Controls tab to get lookback and lookforward values
  
  const spreadsheet = SpreadsheetApp.openById(sheetId);
  const sheet = spreadsheet.getSheetByName(sheetName);
  const clientsSheet = spreadsheet.getSheetByName(clientsTabName);
  const controlsSheet = spreadsheet.getSheetByName(controlsTabName);

  if (!sheet || !clientsSheet || !controlsSheet) {
    throw new Error(`Required sheets "${sheetName}", "${clientsTabName}" or "${controlsTabName}" are missing.`);
  }

  // Get the currently authenticated user's email
  const activeUserEmail = Session.getActiveUser().getEmail();

  // Detect if the script is being run automatically
  const triggeredEvent = typeof e !== "undefined"; // `e` is defined for auto-triggers
  let lookbackDays, lookforwardDays;

  if (triggeredEvent) {
    // Auto-run: Use default 7 days for lookback and lookforward
    lookbackDays = 7;
    lookforwardDays = 7;
  } else {
    // Manual run: Retrieve values from the Controls sheet
    lookbackDays = parseInt(controlsSheet.getRange("D6").getValue(), 10);
    lookforwardDays = parseInt(controlsSheet.getRange("D8").getValue(), 10);

    // Ensure values are valid
    if (isNaN(lookbackDays) || lookbackDays <= 0) lookbackDays = 7;
    if (isNaN(lookforwardDays) || lookforwardDays <= 0) lookforwardDays = 7;
  }

  // Get the current time and calculate the lookback and lookforward date ranges
  const now = new Date();
  const lookbackDate = new Date(now.getTime() - lookbackDays * 24 * 60 * 60 * 1000); // Convert days to milliseconds
  const lookforwardDate = new Date(now.getTime() + lookforwardDays * 24 * 60 * 60 * 1000);

  // Get the existing data and headers from the sheet
  const dataRange = sheet.getDataRange();
  const data = dataRange.getValues();
  const headers = data[0];

  // Find the column index for "CalendarEventOwner", "Start Time" and "Client Name"
  const ownerColumnIndex = headers.indexOf("CalendarEventOwner");
  const startTimeColumnIndex = headers.indexOf("Start Time");
  const clientNameColumnIndex = headers.indexOf("Client Name");

  if (ownerColumnIndex === -1 || startTimeColumnIndex === -1 || clientNameColumnIndex === -1) {
    throw new Error('"CalendarEventOwner", "Start Time" or "Client Name" column not found in the Calendar Data sheet.');
  }

  // Find rows that match the current user's email and have start time after the script start time
  const rowsToDelete = [];
  data.forEach((row, rowIndex) => {
    const eventStartTime = new Date(row[startTimeColumnIndex]); // Assuming Start Time is in the 3rd column (index 2)
    if (row[ownerColumnIndex] === activeUserEmail && eventStartTime > lookbackDate) {
      rowsToDelete.push(rowIndex + 1); // Store row index (1-based for deleteRow)
    }
  });

  // Delete rows in reverse order to avoid skipping any rows when deleting
  rowsToDelete.reverse().forEach(rowIndex => {
    sheet.deleteRow(rowIndex);
  });

  // Helper to fetch events from the active user's Google Calendar
  function fetchEventsForActiveUser(ownerEmail) {
    const calendar = CalendarApp.getCalendarById(ownerEmail);
    const events = calendar.getEvents(lookbackDate, lookforwardDate);
    
    return events.map(event => ({
      id: event.getId(),
      title: event.getTitle(),
      startTime: event.getStartTime(),
      endTime: event.getEndTime(),
      description: event.getDescription() || "",
      location: event.getLocation() || "",
      owner: ownerEmail
    }));
  }

  // Fetch events for the active user (the one who clicked the button)
  const events = fetchEventsForActiveUser(activeUserEmail);

  // Write events to the sheet
  events.forEach((event, index) => {
    const duration = ((event.endTime - event.startTime) / (1000 * 60 * 60)).toFixed(2); // Duration in hours
    const row = [
      event.id,
      event.title,
      event.startTime,
      event.endTime,
      duration,
      event.description,
      event.location,
      "", // Placeholder for client name
      event.owner
    ];

    // Append the event row and get the last row number after appending
    sheet.appendRow(row);
    const rowIndex = sheet.getLastRow(); // Get the last row after appending

    // Insert the formula into the "Client Name" column
    const clientFormula = `
      =ARRAYFORMULA(
        IFERROR(
          INDEX(Clients!A:A, MATCH(TRUE, ISNUMBER(SEARCH(Clients!B:B, B${rowIndex})), 0)),
          ""
        )
      )
    `;
    sheet.getRange(rowIndex, clientNameColumnIndex + 1).setFormula(clientFormula.trim());
  });

  // Log the number of events exported
  Logger.log(`${events.length} events exported to the sheet "${sheetName}".`);

  // Update the last sync time for the active user
  const controlsRange = controlsSheet.getRange("F6:G10");
  const controlsData = controlsRange.getValues();
  let emailFound = false;

  // Iterate over the range to find the email and update the timestamp
  for (let i = 0; i < controlsData.length; i++) {
    const email = controlsData[i][0];
    if (email === activeUserEmail) {
      controlsSheet.getRange(i + 6, 7).setValue(now); // Set the current time in column G (7th column)
      emailFound = true;
      break;
    }
  }

  // If the email is not found, place the email and the current time in the first empty row
  if (!emailFound) {
    for (let i = 0; i < controlsData.length; i++) {
      if (!controlsData[i][0]) { // If the cell in column F is empty
        controlsSheet.getRange(i + 6, 6).setValue(activeUserEmail); // Set email in column F
        controlsSheet.getRange(i + 6, 7).setValue(now); // Set the current time in column G
        break;
      }
    }
  }
}
