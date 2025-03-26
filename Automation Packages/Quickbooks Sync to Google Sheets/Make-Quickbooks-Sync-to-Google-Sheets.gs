/**
 * Google Apps Script Web App
 *
 * Required columns: "Date", "Amount", "Split", "Create Date"
 * For any row missing a required cell value, we now default to "" (no error thrown).
 *
 * uniqueIndicator = dateVal + "-" + abs(parseFloat(amountVal) || 0)
 *                  + "-" + splitVal + "-" + createDateVal
 */

/**
 * Returns the Spreadsheet ID from the Script Properties.
 */
function getSpreadSheetId() {
  return PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
}

/**
 * This helper function writes a log message to a "Logs" tab in your spreadsheet.
 * We pass a single string. The sheet gets two columns: [Timestamp, Message].
 */
function logToSheet(msg) {
  try {
    const ss = SpreadsheetApp.openById(getSpreadSheetId());
    let logSheet = ss.getSheetByName("Logs");
    if (!logSheet) {
      logSheet = ss.insertSheet("Logs");
      // Optionally set some header
      logSheet.appendRow(["Timestamp", "Message"]);
    }
    logSheet.appendRow([new Date(), msg]);
  } catch (err) {
    // If logging fails for some reason, there's not much we can do
  }
}

/**
 * Main entry point for POST requests to this Web App.
 */
function doPost(e) {
  logToSheet("doPost invoked.");

  try {
    if (!e.postData || !e.postData.contents) {
      logToSheet("No postData or postData.contents found.");
      return returnJsonOutput({ error: "No post data received" });
    }

    // Parse the incoming JSON
    const data = JSON.parse(e.postData.contents);
    logToSheet("Parsed incoming JSON data: " + JSON.stringify(data));

    // Transform into an array of objects: each object keyed by columnName
    const allObjects = transformDataIntoObjects(data);
    logToSheet("Transformed data into " + allObjects.length + " row-objects.");

    // Upsert into Google Sheets based on uniqueIndicator
    upsertSheetByHeaders(
      getSpreadSheetId(), // Spreadsheet ID from script properties
      "TRANSACTIONS",     // Your sheet/tab name
      allObjects
    );

    logToSheet("Upsert complete in doPost.");
    return returnJsonOutput({
      status: "OK",
      rowCount: allObjects.length
    });

  } catch (err) {
    logToSheet("Error in doPost: " + err.message);
    return returnJsonOutput({ error: err.message });
  }
}

/**
 * Transform the incoming JSON into an array of objects, one object per row.
 * Object keys = the column titles (including "uniqueIndicator").
 *
 * Required columns: "Date", "Amount", "Split", "Create Date".
 * - If the cell is missing in a particular row, we default to "" (no error).
 */
function transformDataIntoObjects(data) {
  const { dateColName, amountColName, accountColName, createDateColName } = getRequiredColumnTitles();

  // Extract column titles from the JSON
  const columns = (data.Columns && data.Columns.Column) || [];
  const columnTitles = columns.map(col => col.ColTitle || "");

  logToSheet("Extracted columnTitles from JSON: " + JSON.stringify(columnTitles));

  // Verify each *required column header* is present
  [dateColName, amountColName, accountColName, createDateColName].forEach(req => {
    if (!columnTitles.includes(req)) {
      throw new Error(`Missing required column "${req}" in JSON data.`);
    }
  });

  // If no Rows, return empty array
  if (!data.Rows || !data.Rows.Row) {
    logToSheet("No rows found in JSON data; returning empty array.");
    return [];
  }

  // Get the index of each required column
  const dateIndex = columnTitles.indexOf(dateColName);
  const amountIndex = columnTitles.indexOf(amountColName);
  const splitIndex = columnTitles.indexOf(accountColName);  // "Split"
  const createDateIndex = columnTitles.indexOf(createDateColName);

  logToSheet(
    `Required col indexes => Date=${dateIndex}, Amount=${amountIndex}, ` +
    `Split=${splitIndex}, CreateDate=${createDateIndex}`
  );

  // We'll accumulate an array of row-objects
  const rowObjects = [];

  // Helper to process a single "Row" or "subRow"
  const processRow = (row) => {
    // Only process if type = "Data"
    if (row.type !== "Data") return;

    const colData = row.ColData || [];

    // 1) Grab required fields (if missing, use "")
    const dateVal = colData[dateIndex]?.value || "";
    const amountVal = colData[amountIndex]?.value || "";
    const splitVal = colData[splitIndex]?.value || "";
    const createDateVal = colData[createDateIndex]?.value || "";

    // 2) Build the uniqueIndicator – even if some fields are blank
    const absAmount = Math.abs(parseFloat(amountVal) || 0);
    const uniqueIndicator = `${dateVal}-${absAmount}-${splitVal}-${createDateVal}`;

    // 3) Build an object keyed by columnTitle (plus uniqueIndicator)
    const rowObj = { uniqueIndicator };
    for (let i = 0; i < columns.length; i++) {
      const title = columnTitles[i];
      rowObj[title] = colData[i]?.value || "";
    }

    logToSheet(
      "Row => uniqueIndicator: " + uniqueIndicator + " => " + JSON.stringify(rowObj)
    );
    rowObjects.push(rowObj);
  };

  // Loop through all data rows
  data.Rows.Row.forEach(row => {
    if (row.type === "Data") {
      processRow(row);
    } else if (row.type === "Section" && row.Rows && row.Rows.Row) {
      // If it's a Section, process subRows
      row.Rows.Row.forEach(subRow => processRow(subRow));
    }
  });

  logToSheet("Finished processing JSON rows => created rowObjects array of length " + rowObjects.length);
  return rowObjects;
}

/**
 * Upserts data into the sheet by matching column headers by name (no full overwrite).
 * 1) Ensures "uniqueIndicator" column exists.
 * 2) Ensures any columns in newObjects also exist (appending to the sheet header if needed).
 * 3) Finds existing row by "uniqueIndicator"; if not found, appends a new row.
 * 4) Updates only the columns present in each object (does NOT clear other columns or formulas).
 */
function upsertSheetByHeaders(spreadsheetId, sheetName, newObjects) {
  const ss = SpreadsheetApp.openById(spreadsheetId);
  let sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);

  // Clear any filtering to ensure we can see all rows
  if (sheet.getFilter()) {
    sheet.getFilter().remove();
  }

  // 1) Get current dimensions
  let dataRange = sheet.getDataRange();
  let lastRow = dataRange.getLastRow();
  let lastCol = dataRange.getLastColumn();

  // 2) Handle empty sheet case
  let headerRowValues = [];
  if (lastRow === 0) {
    headerRowValues = ["uniqueIndicator"];
    sheet.getRange(1, 1).setValue("uniqueIndicator");
    lastRow = 1;
    lastCol = 1;
  } else {
    headerRowValues = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  }

  // 3) Build header map
  let headerMap = {};
  headerRowValues.forEach((name, idx) => {
    if (name) {
      headerMap[name] = idx;
    }
  });

  // Add uniqueIndicator if missing
  if (!headerMap.hasOwnProperty("uniqueIndicator")) {
    headerRowValues.push("uniqueIndicator");
    headerMap["uniqueIndicator"] = headerRowValues.length - 1;
    sheet.getRange(1, headerRowValues.length).setValue("uniqueIndicator");
    lastCol = headerRowValues.length;
  }

  // 4) Add any new columns from objects
  newObjects.forEach(obj => {
    Object.keys(obj).forEach(colName => {
      if (!headerMap.hasOwnProperty(colName)) {
        headerRowValues.push(colName);
        headerMap[colName] = headerRowValues.length - 1;
        sheet.getRange(1, headerRowValues.length).setValue(colName);
        lastCol = headerRowValues.length;
      }
    });
  });

  // 5) Build uniqueIndicator map (existing rows)
  const uniqueColIndex = headerMap["uniqueIndicator"];
  let uniqueIndexMap = {};
  
  if (lastRow > 1) {
    const uniqueValues = sheet.getRange(2, uniqueColIndex + 1, lastRow - 1, 1).getValues();
    uniqueValues.forEach((row, idx) => {
      const val = row[0];
      if (val) {
        uniqueIndexMap[val] = idx + 2; // row number in sheet
      }
    });
  }

  // 6) Process each object - only update cells that are present in our object
  newObjects.forEach(obj => {
    const uniqueId = obj["uniqueIndicator"];
    if (!uniqueId) return;  // If rowObj is missing uniqueIndicator, skip

    let targetRow = uniqueIndexMap[uniqueId];
    let isNewRow = false;

    // If this uniqueIndicator doesn't exist in the sheet, append a new row
    if (!targetRow) {
      lastRow++;
      targetRow = lastRow;
      uniqueIndexMap[uniqueId] = targetRow;
      isNewRow = true;
    }

    // If it's a new row, initialize the uniqueIndicator cell
    if (isNewRow) {
      sheet.getRange(targetRow, uniqueColIndex + 1).setValue(uniqueId);
    }

    // Update only the specific cells that are in our object
    for (const colName in obj) {
      const colIndex = headerMap[colName];
      if (colIndex !== undefined) {
        // Skip uniqueIndicator column if this isn't a new row
        if (!isNewRow && colName === "uniqueIndicator") continue;
        
        const newValue = obj[colName];
        const cell = sheet.getRange(targetRow, colIndex + 1);

        // Only update if the value is different
        if (cell.getValue() !== newValue) {
          cell.setValue(newValue);
        }
      }
    }
  });

  SpreadsheetApp.flush();
}

/**
 * Helper function to validate sheet structure (example only, optional).
 */
function validateSheetStructure(sheet) {
  // Get the true last row with content
  const lastRow = sheet.getLastRow();
  const maxRows = sheet.getMaxRows();
  
  // If there are excess empty rows, delete them
  if (maxRows > lastRow + 1) { // Keep one extra row
    sheet.deleteRows(lastRow + 2, maxRows - (lastRow + 1));
  }
  
  // Return the actual last row
  return sheet.getLastRow();
}

/**
 * These are the required columns for the script.
 * Adjust the column names to match your JSON data.
 *
 * Note: We still require these columns be present in the JSON schema,
 * but missing cell values do not throw errors anymore.
 */
function getRequiredColumnTitles() {
  return {
    dateColName: "Date",
    amountColName: "Amount",
    accountColName: "Split",    // Mapping "Split" → "Account"
    createDateColName: "Create Date"
  };
}

/**
 * Utility: returns JSON response from the web app.
 */
function returnJsonOutput(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Example test function in Apps Script editor (optional).
 * This will upsert two sample rows to your "TRANSACTIONS" tab without error,
 * even if some fields are blank.
 */
function testUpsertByHeaders() {
  logToSheet("[testUpsertByHeaders] Starting...");

  // Example newObjects (some missing columns on purpose)
  const newObjects = [
    {
      // uniqueIndicator includes date, abs(amount), split, createDate
      uniqueIndicator: "2025-02-11-100.5--2025-01-01", // intentionally blank "Split" for illustration
      "Date": "2025-02-11",
      "Amount": "-100.50",
      // "Split" is missing => defaults to "",
      "Create Date": "2025-01-01",
      "Some Extra": "some info"
    },
    {
      uniqueIndicator: "2025-03-01-0--", // everything blank except date
      "Date": "2025-03-01"
      // "Amount", "Split", and "Create Date" are missing => default to ""
    }
  ];

  upsertSheetByHeaders(
    getSpreadSheetId(), // Spreadsheet ID from script properties
    "TRANSACTIONS",
    newObjects
  );

  logToSheet("[testUpsertByHeaders] Done.");
}
