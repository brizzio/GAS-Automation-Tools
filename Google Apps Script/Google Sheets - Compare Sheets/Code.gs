/***************************************
 * MASTER SPREADSHEET CONFIG
 ***************************************/
const MASTER_SHEET_ID = '1111111111111111111111';
const MASTER_SHEET_NAME = 'Sheet1';

/***************************************
 * doGet()
 * Entry point for the web app. Renders Dashboard.html.
 ***************************************/
function doGet(e) {
  return HtmlService.createTemplateFromFile('Dashboard')
    .evaluate()
    .setTitle('Discrepancy Dashboard');
}

/**
 * include(filename)
 * Utility for including partial HTML if needed.
 */
function include(filename) {
  return HtmlService.createTemplateFromFile(filename).evaluate().getContent();
}

/***************************************
 * MASTER SHEET I/O
 ***************************************/
function getMasterConfig() {
  const ss = SpreadsheetApp.openById(MASTER_SHEET_ID);
  const sheet = ss.getSheetByName(MASTER_SHEET_NAME);

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  // columns A, B, C (SpreadsheetId, Compare(Y/N), Main(Y/N))
  const range = sheet.getRange(2, 1, lastRow - 1, 3);
  const values = range.getValues();

  const data = values.map(row => {
    const spreadsheetId = row[0];
    let name = '(Unknown)';
    if (spreadsheetId) {
      try {
        name = SpreadsheetApp.openById(spreadsheetId).getName();
      } catch (e) {
        name = '(Error opening ID)';
      }
    }
    return {
      spreadsheetId: spreadsheetId,
      compare: row[1],    // 'Y' or 'N'
      main: row[2],       // 'Y' or 'N'
      spreadsheetName: name
    };
  });

  return data;
}

function saveMasterConfig(records) {
  const ss = SpreadsheetApp.openById(MASTER_SHEET_ID);
  const sheet = ss.getSheetByName(MASTER_SHEET_NAME);

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  // Build a lookup { id -> { compare, main } }
  const lookup = {};
  records.forEach(r => {
    lookup[r.spreadsheetId] = { compare: r.compare, main: r.main };
  });

  const range = sheet.getRange(2, 1, lastRow - 1, 3);
  const values = range.getValues();

  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const id = row[0];
    if (lookup[id]) {
      values[i][1] = lookup[id].compare;
      values[i][2] = lookup[id].main;
    }
  }
  range.setValues(values);
}

/***************************************
 * COMPARISON LOGIC
 ***************************************/
function getDiscrepancies() {
  const config = getMasterConfig();
  
  // 1) Identify the single main SS
  const mainRows = config.filter(item => item.main === 'Y');
  if (mainRows.length !== 1) {
    throw new Error('There must be exactly one Main=Y spreadsheet.');
  }
  const mainRow = mainRows[0];
  if (mainRow.compare !== 'Y') {
    throw new Error('Your main spreadsheet must also have Compare=Y.');
  }

  // 2) All other compare=Y spreadsheets
  const others = config.filter(
    r => r.compare === 'Y' && r.spreadsheetId !== mainRow.spreadsheetId
  );
  if (others.length === 0) {
    throw new Error('No other spreadsheets selected for comparison.');
  }

  // 3) Build data for the main
  const mainSS = SpreadsheetApp.openById(mainRow.spreadsheetId);
  const mainSheetsInfo = buildSheetsData(mainSS); 
  // e.g. mainSheetsInfo[tabName] = { headers: [...], formulas: 2D array }

  const results = [];

  others.forEach(item => {
    const ss = SpreadsheetApp.openById(item.spreadsheetId);
    const spreadsheetName = ss.getName();
    const theirSheetsInfo = buildSheetsData(ss);

    const discrepancies = [];

    // A) Check for tabs missing in the OTHER
    for (let mainTabName in mainSheetsInfo) {
      if (!(mainTabName in theirSheetsInfo)) {
        discrepancies.push({
          tabName: mainTabName,
          type: 'missingTab'
        });
        continue;
      }
      // Tab exists in both → compare columns
      const mainHeaders = mainSheetsInfo[mainTabName].headers;
      const theirHeaders = theirSheetsInfo[mainTabName].headers;

      const mainFormulas = mainSheetsInfo[mainTabName].formulas;  // 2D array: up to 5 rows
      const theirFormulas = theirSheetsInfo[mainTabName].formulas;

      // We'll group each column's mismatches into one "columnGroup" object
      const maxCols = Math.max(mainHeaders.length, theirHeaders.length, 
        mainFormulas[0] ? mainFormulas[0].length : 0, 
        theirFormulas[0] ? theirFormulas[0].length : 0);

      // Build a map: columnLetter -> { headerMismatch?: {...}, formulaMismatches: [...] }
      const columnsMap = {};

      for (let colIndex = 0; colIndex < maxCols; colIndex++) {
        const colLetter = columnNumberToLetter(colIndex);

        // Prepare a place to store this column's issues
        columnsMap[colLetter] = {
          headerMismatch: null,
          formulaMismatches: []
        };
      }

      // 1) Compare headers
      for (let colIndex = 0; colIndex < maxCols; colIndex++) {
        const colLetter = columnNumberToLetter(colIndex);
        const mainHeader = mainHeaders[colIndex] || '(missing)';
        const otherHeader = theirHeaders[colIndex] || '(missing)';
        if (mainHeader !== otherHeader) {
          columnsMap[colLetter].headerMismatch = {
            mainHeader,
            otherHeader
          };
        }
      }

      // 2) Compare first 5 formulas in each column
      // rows 0..4 in the formula arrays => actual sheet rows 2..6
      const rowCount = Math.max(mainFormulas.length, theirFormulas.length);
      const colCountMain = (mainFormulas[0] || []).length;
      const colCountOther = (theirFormulas[0] || []).length;
      const formulaMaxCols = Math.max(colCountMain, colCountOther);

      for (let rowOffset = 0; rowOffset < rowCount; rowOffset++) {
        for (let colOffset = 0; colOffset < formulaMaxCols; colOffset++) {
          const mainFormula = (mainFormulas[rowOffset] && mainFormulas[rowOffset][colOffset]) || '';
          const otherFormula = (theirFormulas[rowOffset] && theirFormulas[rowOffset][colOffset]) || '';

          const mainHasFormula = mainFormula.startsWith('=');
          const otherHasFormula = otherFormula.startsWith('=');

          if (mainHasFormula || otherHasFormula) {
            // Compare them
            if (mainFormula !== otherFormula) {
              const rowNumber = 2 + rowOffset; 
              const colLetter = columnNumberToLetter(colOffset);

              columnsMap[colLetter].formulaMismatches.push({
                rowNumber,
                mainFormula: mainHasFormula ? mainFormula : '(no formula)',
                otherFormula: otherHasFormula ? otherFormula : '(no formula)'
              });
            }
          }
        }
      }

      // Finally, for each column in columnsMap that actually has a mismatch,
      // push a single "columnGroup" discrepancy item
      for (let colLetter in columnsMap) {
        const colData = columnsMap[colLetter];
        const hasHeaderMismatch = !!colData.headerMismatch;
        const formulaCount = colData.formulaMismatches.length;
        if (hasHeaderMismatch || formulaCount > 0) {
          discrepancies.push({
            tabName: mainTabName,
            type: 'columnGroup',
            columnLetter: colLetter,
            headerMismatch: colData.headerMismatch, 
            formulaMismatches: colData.formulaMismatches
          });
        }
      }
    }

    // B) Check for tabs extra in the OTHER
    for (let theirTabName in theirSheetsInfo) {
      if (!(theirTabName in mainSheetsInfo)) {
        discrepancies.push({
          tabName: theirTabName,
          type: 'extraTab'
        });
      }
    }

    // Summaries
    results.push({
      spreadsheetName,
      spreadsheetId: item.spreadsheetId,
      discrepancyCount: discrepancies.length,
      discrepancies
    });
  });

  return results;
}

/**
 * buildSheetsData(spreadsheet)
 * Returns an object:
 * {
 *   'Sheet1': {
 *     headers: [...header row...],
 *     formulas: 2D array of formula strings for rows 2..6 
 *               (or fewer if sheet is short)
 *   },
 *   'Sheet2': {...}, etc.
 * }
 */
function buildSheetsData(spreadsheet) {
  const data = {};
  spreadsheet.getSheets().forEach(sh => {
    const name = sh.getName();
    const lastCol = sh.getLastColumn();
    const lastRow = sh.getLastRow();
    // read headers
    const headerVals = sh.getRange(1, 1, 1, lastCol).getValues()[0] || [];

    // read up to 5 formula rows
    let formulaMatrix = [];
    if (lastRow > 1) {
      const rowCount = Math.min(5, lastRow - 1);
      formulaMatrix = sh
        .getRange(2, 1, rowCount, lastCol)
        .getFormulas();
    }

    data[name] = {
      headers: headerVals,
      formulas: formulaMatrix
    };
  });
  return data;
}

function columnNumberToLetter(colIndex) {
  let s = '';
  let n = colIndex;
  while (true) {
    s = String.fromCharCode((n % 26) + 65) + s;
    n = Math.floor(n / 26) - 1;
    if (n < 0) break;
  }
  return s;
}

/**
 * getMainSpreadsheetInfo()
 * Just returns the single main spreadsheet info
 */
function getMainSpreadsheetInfo() {
  const config = getMasterConfig();
  const mainRows = config.filter(item => item.main === 'Y');
  if (mainRows.length !== 1) {
    return { 
      spreadsheetName: '(No valid main spreadsheet)', 
      spreadsheetId: '' 
    };
  }
  const mainRow = mainRows[0];
  
  let name = '(Unknown)';
  try {
    const ss = SpreadsheetApp.openById(mainRow.spreadsheetId);
    name = ss.getName();
  } catch (e) {
    name = '(Error opening main spreadsheet)';
  }
  return {
    spreadsheetName: name,
    spreadsheetId: mainRow.spreadsheetId
  };
}
