function exportCalendarEventsForActiveUser(e) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheetName = "Calendar Data";

  // Ensure the "Calendar Data" sheet exists, or create it
  let sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }

  // Get the currently authenticated user's email
  const activeUserEmail = Session.getActiveUser().getEmail();

  // Fixed lookback/lookforward periods
  const lookbackDays = 7;
  const lookforwardDays = 7;

  // Calculate the date range
  const now = new Date();
  const lookbackDate = new Date(now.getTime() - lookbackDays * 24 * 60 * 60 * 1000);
  const lookforwardDate = new Date(now.getTime() + lookforwardDays * 24 * 60 * 60 * 1000);

  // Check if headers exist, if not, create them
  let dataRange = sheet.getDataRange();
  let data = dataRange.getValues();
  
  if (data.length === 1 && data[0].every(cell => cell === "")) {
    // The sheet is empty, set headers
    const headers = ["Event ID", "Title", "Start Time", "End Time", "Duration (hrs)", "Description", "Location", "CalendarEventOwner"];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    dataRange = sheet.getDataRange();
    data = dataRange.getValues();
  }

  const headers = data[0];
  const ownerColumnIndex = headers.indexOf("CalendarEventOwner");
  const startTimeColumnIndex = headers.indexOf("Start Time");

  if (ownerColumnIndex === -1 || startTimeColumnIndex === -1) {
    throw new Error('"CalendarEventOwner" or "Start Time" column not found in the Calendar Data sheet.');
  }

  // Delete existing rows for this user within the lookback period
  const rowsToDelete = [];
  data.forEach((row, rowIndex) => {
    if (rowIndex === 0) return; // Skip header row
    const eventStartTime = new Date(row[startTimeColumnIndex]);
    if (row[ownerColumnIndex] === activeUserEmail && eventStartTime > lookbackDate) {
      rowsToDelete.push(rowIndex + 1);
    }
  });

  // Delete from bottom to top
  rowsToDelete.reverse().forEach(rowIndex => {
    sheet.deleteRow(rowIndex);
  });

  // Helper function to fetch events from the user's calendar
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

  // Fetch the events and append to the sheet
  const events = fetchEventsForActiveUser(activeUserEmail);
  events.forEach(event => {
    const duration = ((event.endTime - event.startTime) / (1000 * 60 * 60)).toFixed(2);
    const row = [
      event.id,
      event.title,
      event.startTime,
      event.endTime,
      duration,
      event.description,
      event.location,
      event.owner
    ];
    sheet.appendRow(row);
  });

  Logger.log(`${events.length} events exported to the sheet "${sheetName}".`);
}
