/*******************************************************
 *  Advanced Google Apps Script: Market-Ready Novel Generator
 *  --------------------------------------------------------
 *
 *  This optimized script creates publishing-quality novels with minimal user intervention
 *  by implementing improved prompt engineering, enhanced narrative memory and consistency checks,
 *  iterative revision loops, and professional document formatting.
 *******************************************************/

/**
 * GLOBAL HELPER FUNCTIONS
 */

/**
 * Logs an event to the "Logs" sheet.
 */
function logEvent(eventTitle, details, status = "Info") {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const logsSheet = ss.getSheetByName("Logs");
  if (!logsSheet) return;
  const now = new Date();
  logsSheet.appendRow([now, eventTitle, details, status]);
  const lastRow = logsSheet.getLastRow();
  if (status === "Error") {
    logsSheet.getRange(lastRow, 4).setBackground("#f4cccc"); // Light red
  } else if (status === "Warning") {
    logsSheet.getRange(lastRow, 4).setBackground("#fce5cd"); // Light orange
  } else if (status === "Complete") {
    logsSheet.getRange(lastRow, 4).setBackground("#d9ead3"); // Light green
  } else if (status === "Processing") {
    logsSheet.getRange(lastRow, 4).setBackground("#d0e0e3"); // Light blue
  }
}

/**
 * Counts the number of sections in a chapter.
 */
function countSectionsInChapter(outlineData, chapterNumber) {
  let count = 0;
  for (let i = 1; i < outlineData.length; i++) {
    if (outlineData[i][1] === chapterNumber) count++;
  }
  return count > 0 ? count : 1;
}

/**
 * Determines if a chapter is climactic or particularly important.
 */
function isImportantChapter(chapterNumber, totalChapters, storyPosition) {
  if (storyPosition && (storyPosition.includes("Climax") || storyPosition.includes("Midpoint") || storyPosition.includes("Resolution"))) {
    return true;
  }
  if (chapterNumber === 1 || chapterNumber === totalChapters) return true;
  if (chapterNumber === Math.floor(totalChapters * 0.25) || chapterNumber === Math.floor(totalChapters * 0.25) + 1) return true;
  if (chapterNumber === Math.floor(totalChapters * 0.75) || chapterNumber === Math.floor(totalChapters * 0.75) + 1) return true;
  if (chapterNumber === Math.floor(totalChapters * 0.5) || chapterNumber === Math.floor(totalChapters * 0.5) + 1) return true;
  return false;
}

/**
 * Returns true if this is the last section in a chapter.
 */
function isLastSectionInChapter(outlineData, currentRow) {
  if (currentRow >= outlineData.length - 1) return true;
  const currentChapter = outlineData[currentRow][1];
  const nextChapter = outlineData[currentRow + 1][1];
  return currentChapter !== nextChapter;
}

/**
 * Returns character details for a list of character names.
 */
function getCharacterDetails(characterData, characterNames) {
  let details = "";
  if (!characterData || characterData.length <= 1) return "Character details not available.";
  for (let i = 1; i < characterData.length; i++) {
    const name = characterData[i][0];
    if (!name) continue;
    if (characterNames.some(charName => name.toLowerCase().includes(charName.toLowerCase()))) {
      details += `${name} (${characterData[i][1] || 'Role Unknown'}): ${characterData[i][2] || 'No description'}\n`;
      details += `  - Motivation: ${characterData[i][3] || 'Not specified'}\n`;
      details += `  - Arc: ${characterData[i][4] || 'Not specified'}\n\n`;
    }
  }
  return details || "Character details not available.";
}

/**
 * Returns a string containing the text from the last "count" sections in the Content sheet for continuity.
 */
function getLastSectionsForChapter(contentSheet, chapterNumber, count) {
  const data = contentSheet.getDataRange().getValues();
  if (data.length <= 1) return "No prior sections yet for this chapter.";
  const rows = data.slice(1);
  const matching = [];
  for (let i = rows.length - 1; i >= 0 && matching.length < count; i--) {
    const row = rows[i];
    if (row[1] === chapterNumber && row[3]) matching.unshift(row[3]);
  }
  return matching.length ? matching.join("\n\n---\n\n") : "No prior sections yet for this chapter.";
}

/**
 * Counts words in a given text.
 */
function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Calculates a quality score for generated text.
 */
function calculateQualityScore(text, targetWordCount, actualWordCount) {
  let score = 80;
  const ratio = actualWordCount / targetWordCount;
  if (ratio >= 0.9 && ratio <= 1.1) score += 10;
  else if (ratio >= 0.8 && ratio <= 1.2) score += 5;
  else if (ratio < 0.7 || ratio > 1.3) score -= 10;
  // Check for dialogue and varied paragraph structure.
  if (text.indexOf('"') !== -1) score += 5;
  const paragraphs = text.split("\n").filter(p => p.trim().length > 0);
  if (paragraphs.length >= 5) score += 5;
  if (paragraphs.some(p => p.length > 1000)) score -= 5;
  // Sensory details bonus (up to 10 points).
  const sensoryPatterns = [/saw|see|look|vision|sight|appear/i, /heard|hear|sound|noise|listen/i, /feel|felt|touch|texture|smooth|rough/i, /smell|scent|aroma|odor/i, /taste|flavor|sweet|sour|bitter/i];
  let sensoryCount = 0;
  sensoryPatterns.forEach(pattern => { if (pattern.test(text)) sensoryCount++; });
  score += Math.min(sensoryCount * 2, 10);
  return Math.max(0, Math.min(100, score));
}

/**
 * Calculates the average quality score from the Content sheet.
 */
function calculateAverageQualityScore(contentSheet) {
  const data = contentSheet.getDataRange().getValues();
  if (data.length <= 1) return 0;
  let total = 0, count = 0;
  for (let i = 1; i < data.length; i++) {
    if (typeof data[i][5] === 'number') {
      total += data[i][5];
      count++;
    }
  }
  return count ? Math.round(total / count) : 0;
}

/**
 * Performs a consistency check on a few recent sections.
 */
function checkConsistency(contentSheet, rowIndex, rangeCount) {
  const firstRow = Math.max(2, rowIndex - rangeCount + 1);
  const rowsToCheck = Math.min(rowIndex - firstRow + 1, contentSheet.getLastRow() - firstRow + 1);
  if (rowsToCheck <= 0) return "---";
  const data = contentSheet.getRange(firstRow, 4, rowsToCheck, 1).getValues();
  let combinedText = "";
  data.forEach(r => { combinedText += r[0] + "\n\n"; });
  const messages = [
    { role: "system", content: "You are an experienced editor checking narrative consistency." },
    { role: "user", content: "Review these consecutive sections for abrupt transitions or inconsistencies:\n\n" + combinedText + "\nIf all is consistent, reply with '---'." }
  ];
  return callChatGPTAPI(messages, 0.3, 500);
}

/**
 * Performs a full consistency check across chapters.
 */
function performFullConsistencyCheck(contentSheet) {
  const data = contentSheet.getDataRange().getValues();
  if (data.length <= 1) return false;
  const chapters = {};
  for (let i = 1; i < data.length; i++) {
    const chapterNum = data[i][1];
    if (!chapters[chapterNum]) chapters[chapterNum] = [];
    chapters[chapterNum].push({ row: i+1, seq: data[i][0], section: data[i][2], content: data[i][3] });
  }
  let foundIssues = false;
  Object.keys(chapters).forEach(chapterNum => {
    const sections = chapters[chapterNum].sort((a, b) => a.seq - b.seq);
    let chapterText = "";
    sections.forEach(s => { chapterText += s.content + "\n\n"; });
    const check = checkChapterConsistency(chapterNum, chapterText);
    if (check && check !== "---") {
      foundIssues = true;
      logEvent("Full Consistency Check", `Issues in Chapter ${chapterNum}: ${check}`, "Warning");
      sections.forEach(s => {
        contentSheet.getRange(s.row, 7).setValue("Needs Review");
        contentSheet.getRange(s.row, 7).setBackground("#fce5cd");
      });
    }
  });
  return foundIssues;
}

/**
 * Checks a full chapter for narrative inconsistencies.
 */
function checkChapterConsistency(chapterNum, chapterText) {
  const messages = [
    { role: "system", content: "You are a professional editor specializing in narrative consistency." },
    { role: "user", content: "Review Chapter " + chapterNum + " for inconsistencies in character behavior, setting, timeline, and plot. If everything is consistent, reply with '---'." + "\n\nCHAPTER TEXT:\n" + chapterText }
  ];
  return callChatGPTAPI(messages, 0.3, 500);
}

/**
 * Cleans a JSON response by removing extra text and common formatting issues.
 */
function cleanJsonResponse(response) {
  let cleaned = response.replace(/```json/g, '').replace(/```/g, '');
  const firstBrace = cleaned.indexOf('{');
  if (firstBrace > 0) cleaned = cleaned.substring(firstBrace);
  const lastBrace = cleaned.lastIndexOf('}');
  if (lastBrace !== -1 && lastBrace < cleaned.length - 1) cleaned = cleaned.substring(0, lastBrace + 1);
  cleaned = cleaned.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  cleaned = cleaned.replace(/,(\s*[\]}])/g, '$1');
  return cleaned;
}

/**
 * Attempts to fix common JSON syntax issues.
 */
function fixJsonSyntax(jsonString) {
  let fixed = jsonString;
  fixed = fixed.replace(/"([^"]+)"(\s+)(?=[{["'])/g, '"$1"$2:');
  fixed = fixed.replace(/([{,]\s*)([a-zA-Z0-9_]+)(\s*:)/g, '$1"$2"$3');
  fixed = fixed.replace(/,(\s*[\]}])/g, '$1');
  return fixed;
}

/**
 * Returns context around a JSON parsing error.
 */
function getErrorContext(jsonString, error) {
  if (!error.message) return "No error context available";
  const match = error.message.match(/position (\d+)/);
  if (!match) return "No position found in error message";
  const pos = parseInt(match[1]);
  const start = Math.max(0, pos - 20);
  const end = Math.min(jsonString.length, pos + 20);
  return jsonString.substring(start, end) + " [ERROR HERE] " + jsonString.substring(pos, pos + 20);
}

/**
 * Logs full API responses that fail JSON parsing to a dedicated sheet.
 */
function logFullResponse(logsSheet, title, response) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "_");
  const sheetName = "JSON_Error_" + timestamp;
  try {
    const errorSheet = ss.insertSheet(sheetName);
    errorSheet.getRange("A1").setValue(title + " - " + new Date());
    errorSheet.getRange("A2").setValue(response);
    errorSheet.getRange("A2").setWrap(true);
    errorSheet.setColumnWidth(1, 1000);
    logEvent("JSON Debug", `Full response logged to sheet: ${sheetName}`, "Info");
  } catch (e) {
    logEvent("JSON Debug", response.substring(0,5000), "Info");
  }
}

/**
 * Calls the OpenAI ChatGPT API with a messages array.
 */
function callChatGPTAPI(messages, temperature = 0.7, maxTokens = 4000) {
  const apiKey = PropertiesService.getScriptProperties().getProperty("OPENAI_API_KEY");
  if (!apiKey) throw new Error("API key not set.");
  const url = "https://api.openai.com/v1/chat/completions";
  const payload = {
    model: "gpt-4",  // Using GPT-4 for enhanced quality
    messages: messages,
    max_tokens: maxTokens,
    temperature: temperature
  };
  const options = {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + apiKey },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  const response = UrlFetchApp.fetch(url, options);
  const json = JSON.parse(response.getContentText());
  if (json.error) throw new Error("ChatGPT API Error: " + JSON.stringify(json.error));
  return json.choices && json.choices[0] && json.choices[0].message ? json.choices[0].message.content : "";
}

/**
 * Updates narrative memory with key details (world-building, character arcs, etc.).
 */
function updateNarrativeMemory(key, details) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let memorySheet = ss.getSheetByName("Narrative Memory");
  if (!memorySheet) {
    memorySheet = ss.insertSheet("Narrative Memory");
    memorySheet.getRange("A1:B1").setValues([["Key", "Details"]]);
    memorySheet.setColumnWidth(1, 200);
    memorySheet.setColumnWidth(2, 600);
  }
  memorySheet.appendRow([key, details]);
}

/**
 * Retrieves all narrative memory entries as a context string.
 */
function getNarrativeMemoryContext() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const memorySheet = ss.getSheetByName("Narrative Memory");
  if (!memorySheet) return "";
  const data = memorySheet.getDataRange().getValues();
  let context = "";
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] && data[i][1]) {
      context += `${data[i][0]}: ${data[i][1]}\n`;
    }
  }
  return context;
}

/**
 * onOpen() sets up a custom menu.
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu("Novel Publisher")
    .addItem("1. Generate Complete Outline", "generateOutline")
    .addItem("2. Generate Novel Content", "generateNovel")
    .addItem("3. Publish Final Book", "publishFinalNovel")
    .addSeparator()
    .addItem("Reset All Sheets", "resetAllSheets")
    .addToUi();
  setupSheets();
}

/**
 * Sets up API key via prompt.
 */
function setupApiKey() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt("OpenAI API Key Setup", "Enter your OpenAI API key (starts with 'sk-'):", ui.ButtonSet.OK_CANCEL);
  if (response.getSelectedButton() === ui.Button.OK) {
    const key = response.getResponseText().trim();
    if (key && key.startsWith('sk-')) {
      PropertiesService.getScriptProperties().setProperty("OPENAI_API_KEY", key);
      ui.alert("API Key saved successfully!");
      try {
        const testMessage = [
          { role: "system", content: "You are a helpful assistant." },
          { role: "user", content: "Say 'API connection successful'." }
        ];
        const result = callChatGPTAPI(testMessage, 0.7, 20);
        if (result.includes("successful")) {
          logEvent("API Setup", "API key verified successfully", "Complete");
          ui.alert("API connection test successful!");
        } else {
          logEvent("API Setup", "Unexpected API response: " + result, "Warning");
          ui.alert("API key saved, but received an unexpected response.");
        }
      } catch (e) {
        logEvent("API Setup", "API verification error: " + e.message, "Error");
        ui.alert("Error testing API key: " + e.message);
      }
    } else {
      ui.alert("Invalid API key format.");
    }
  }
}

/**
 * Sets up all necessary sheets.
 */
function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Project Setup
  let setupSheet = ss.getSheetByName("Project Setup");
  if (!setupSheet) {
    setupSheet = ss.insertSheet("Project Setup");
    setupSheet.getRange("A1:B1").merge().setValue("NOVEL PROJECT CONFIGURATION").setFontWeight("bold").setBackground("#f3f3f3");
    setupSheet.getRange("A2").setValue("Target Word Count:");
    setupSheet.getRange("A3").setValue("Number of Chapters:");
    setupSheet.getRange("A4").setValue("Words per Chapter:");
    setupSheet.getRange("B4").setFormula("=IF(AND(B2>0,B3>0),B2/B3,\"\")");
    setupSheet.getRange("A6:B6").merge().setValue("NOVEL DETAILS").setFontWeight("bold").setBackground("#f3f3f3");
    setupSheet.getRange("A7").setValue("Title:");
    setupSheet.getRange("A8").setValue("Genre:");
    setupSheet.getRange("A9").setValue("Target Audience:");
    setupSheet.getRange("A10").setValue("Setting:");
    setupSheet.getRange("A11").setValue("Time Period:");
    setupSheet.getRange("A13:B13").merge().setValue("BOOK CONCEPT").setFontWeight("bold").setBackground("#f3f3f3");
    setupSheet.getRange("A14:B14").merge().setValue("Enter your novel premise (include main characters, plot arc, themes):");
    setupSheet.getRange("A15:B20").merge();
    setupSheet.getRange("A22:B22").merge().setValue("STYLE GUIDELINES").setFontWeight("bold").setBackground("#f3f3f3");
    setupSheet.getRange("A23:B23").merge().setValue("Writing style, tone, voice, etc.:");
    setupSheet.getRange("A24:B28").merge();
    setupSheet.setColumnWidth(1, 150);
    setupSheet.setColumnWidth(2, 400);
  }

  // Outline
  let outlineSheet = ss.getSheetByName("Outline");
  if (!outlineSheet) {
    outlineSheet = ss.insertSheet("Outline");
    outlineSheet.getRange("A1").setValue("Sequence");
    outlineSheet.getRange("B1").setValue("Chapter");
    outlineSheet.getRange("C1").setValue("Section");
    outlineSheet.getRange("D1").setValue("Section Summary");
    outlineSheet.getRange("E1").setValue("Characters Present");
    outlineSheet.getRange("F1").setValue("Key Plot Points");
    outlineSheet.getRange("G1").setValue("Setting/Location");
    outlineSheet.getRange("H1").setValue("Story Arc Position");
    outlineSheet.getRange("A1:H1").setBackground("#f3f3f3").setFontWeight("bold");
    outlineSheet.setColumnWidth(1, 80);
    outlineSheet.setColumnWidth(2, 80);
    outlineSheet.setColumnWidth(3, 80);
    outlineSheet.setColumnWidth(4, 350);
    outlineSheet.setColumnWidth(5, 150);
    outlineSheet.setColumnWidth(6, 200);
    outlineSheet.setColumnWidth(7, 150);
    outlineSheet.setColumnWidth(8, 120);
  }

  // Content
  let contentSheet = ss.getSheetByName("Content");
  if (!contentSheet) {
    contentSheet = ss.insertSheet("Content");
    contentSheet.getRange("A1").setValue("Sequence");
    contentSheet.getRange("B1").setValue("Chapter");
    contentSheet.getRange("C1").setValue("Section");
    contentSheet.getRange("D1").setValue("Content");
    contentSheet.getRange("E1").setValue("Word Count");
    contentSheet.getRange("F1").setValue("Quality Score");
    contentSheet.getRange("G1").setValue("Status");
    contentSheet.getRange("A1:G1").setBackground("#f3f3f3").setFontWeight("bold");
    contentSheet.setColumnWidth(1, 80);
    contentSheet.setColumnWidth(2, 80);
    contentSheet.setColumnWidth(3, 80);
    contentSheet.setColumnWidth(4, 500);
    contentSheet.setColumnWidth(5, 100);
    contentSheet.setColumnWidth(6, 100);
    contentSheet.setColumnWidth(7, 100);
  }

  // Characters (expanded to include more detailed profiles)
  let charactersSheet = ss.getSheetByName("Characters");
  if (!charactersSheet) {
    charactersSheet = ss.insertSheet("Characters");
    charactersSheet.getRange("A1").setValue("Character Name");
    charactersSheet.getRange("B1").setValue("Role");
    charactersSheet.getRange("C1").setValue("Description");
    charactersSheet.getRange("D1").setValue("Motivation");
    charactersSheet.getRange("E1").setValue("Arc");
    charactersSheet.getRange("F1").setValue("Backstory");
    charactersSheet.getRange("G1").setValue("First Appearance");
    charactersSheet.getRange("A1:G1").setBackground("#f3f3f3").setFontWeight("bold");
    charactersSheet.setColumnWidth(1, 150);
    charactersSheet.setColumnWidth(2, 100);
    charactersSheet.setColumnWidth(3, 250);
    charactersSheet.setColumnWidth(4, 200);
    charactersSheet.setColumnWidth(5, 250);
    charactersSheet.setColumnWidth(6, 300);
    charactersSheet.setColumnWidth(7, 120);
  }

  // Published Books
  let booksSheet = ss.getSheetByName("Published Books");
  if (!booksSheet) {
    booksSheet = ss.insertSheet("Published Books");
    booksSheet.getRange("A1").setValue("Title");
    booksSheet.getRange("B1").setValue("Genre");
    booksSheet.getRange("C1").setValue("Summary");
    booksSheet.getRange("D1").setValue("Word Count");
    booksSheet.getRange("E1").setValue("Document URL");
    booksSheet.getRange("F1").setValue("Publication Date");
    booksSheet.getRange("G1").setValue("Author");
    booksSheet.getRange("A1:G1").setBackground("#f3f3f3").setFontWeight("bold");
    booksSheet.setColumnWidth(1, 200);
    booksSheet.setColumnWidth(2, 100);
    booksSheet.setColumnWidth(3, 350);
    booksSheet.setColumnWidth(4, 100);
    booksSheet.setColumnWidth(5, 250);
    booksSheet.setColumnWidth(6, 150);
    booksSheet.setColumnWidth(7, 150);
  }

  // Logs
  let logsSheet = ss.getSheetByName("Logs");
  if (!logsSheet) {
    logsSheet = ss.insertSheet("Logs");
    logsSheet.getRange("A1").setValue("Timestamp");
    logsSheet.getRange("B1").setValue("Event");
    logsSheet.getRange("C1").setValue("Details");
    logsSheet.getRange("D1").setValue("Status");
    logsSheet.getRange("A1:D1").setBackground("#f3f3f3").setFontWeight("bold");
    logsSheet.setColumnWidth(1, 200);
    logsSheet.setColumnWidth(2, 150);
    logsSheet.setColumnWidth(3, 400);
    logsSheet.setColumnWidth(4, 100);
  }
}

/**
 * Sets up project details and populates the Characters sheet using an enhanced prompt.
 */
function setupProject() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const setupSheet = ss.getSheetByName("Project Setup");
  const charactersSheet = ss.getSheetByName("Characters");
  if (!setupSheet || !charactersSheet) {
    SpreadsheetApp.getUi().alert("Setup sheets not found. Please run setup first.");
    return;
  }
  const novelPremise = setupSheet.getRange("A15:B20").getValue();
  if (!novelPremise || novelPremise.trim() === "") {
    SpreadsheetApp.getUi().alert("Please enter your novel premise in the Project Setup sheet.");
    return;
  }
  try {
    const apiKey = PropertiesService.getScriptProperties().getProperty("OPENAI_API_KEY");
    if (!apiKey) {
      const ui = SpreadsheetApp.getUi();
      const response = ui.prompt("OpenAI API Key Required", "Enter your OpenAI API key:", ui.ButtonSet.OK_CANCEL);
      if (response.getSelectedButton() === ui.Button.OK) {
        const newKey = response.getResponseText().trim();
        if (newKey) {
          PropertiesService.getScriptProperties().setProperty("OPENAI_API_KEY", newKey);
          ui.alert("API Key saved successfully!");
        } else {
          ui.alert("No API key provided.");
        }
      }
    }
  } catch (e) { console.error("Error setting API key:", e); }
  charactersSheet.getRange(2, 1, charactersSheet.getLastRow(), charactersSheet.getLastColumn()).clear();
  const title = setupSheet.getRange("B7").getValue() || "Untitled Novel";
  const genre = setupSheet.getRange("B8").getValue() || "Unknown";
  const audience = setupSheet.getRange("B9").getValue() || "General";
  const setting = setupSheet.getRange("B10").getValue() || "Unspecified";
  const timePeriod = setupSheet.getRange("B11").getValue() || "Unspecified";
  const styleGuidelines = setupSheet.getRange("A24:B28").getValue() || "Standard literary style";
  logEvent("Setup Project", "Starting character generation", "Processing");
  const messages = [
    {
      role: "system",
      content: "You are a professional literary development assistant specializing in deep character creation. Provide a set of main and supporting characters with detailed profiles including backstory and personality."
    },
    {
      role: "user",
      content: `Based on the following novel premise and details, generate character profiles in valid JSON with keys: name, role, description, motivation, arc, and backstory.

NOVEL DETAILS:
Title: ${title}
Genre: ${genre}
Target Audience: ${audience}
Setting: ${setting}
Time Period: ${timePeriod}
Style Guidelines: ${styleGuidelines}

NOVEL PREMISE:
${novelPremise}

Return your response in the following JSON format:
{
  "characters": [
    {
      "name": "Character Name",
      "role": "Protagonist/Antagonist/Supporting",
      "description": "Physical traits and background",
      "motivation": "Core drive",
      "arc": "How they change",
      "backstory": "Brief backstory"
    }
  ]
}`
    }
  ];
  try {
    const response = callChatGPTAPI(messages);
    let characterData;
    try {
      characterData = JSON.parse(response);
    } catch (e) {
      const match = response.match(/\{[\s\S]*\}/);
      if (match) {
        try { characterData = JSON.parse(match[0]); }
        catch (e2) { logEvent("Setup Project", "Failed to parse JSON: " + e2.message, "Error"); SpreadsheetApp.getUi().alert("Failed to parse character data."); return; }
      } else {
        logEvent("Setup Project", "No valid JSON found", "Error");
        SpreadsheetApp.getUi().alert("No characters found in response.");
        return;
      }
    }
    if (characterData && characterData.characters && characterData.characters.length > 0) {
      characterData.characters.forEach((character, index) => {
        const row = index + 2;
        charactersSheet.getRange(row, 1).setValue(character.name);
        charactersSheet.getRange(row, 2).setValue(character.role);
        charactersSheet.getRange(row, 3).setValue(character.description);
        charactersSheet.getRange(row, 4).setValue(character.motivation);
        charactersSheet.getRange(row, 5).setValue(character.arc);
        charactersSheet.getRange(row, 6).setValue(character.backstory);
      });
      // Simple conditional coloring
      const lastRow = charactersSheet.getLastRow();
      for (let i = 2; i <= lastRow; i++) {
        const role = charactersSheet.getRange(i, 2).getValue().toLowerCase();
        if (role.includes("protagonist")) {
          charactersSheet.getRange(i, 1, 1, 7).setBackground("#d9ead3");
        } else if (role.includes("antagonist")) {
          charactersSheet.getRange(i, 1, 1, 7).setBackground("#f4cccc");
        }
      }
      logEvent("Setup Project", `Generated ${characterData.characters.length} characters successfully`, "Complete");
      SpreadsheetApp.getUi().alert(`Project setup complete! ${characterData.characters.length} characters generated.`);
    } else {
      logEvent("Setup Project", "No characters found", "Error");
      SpreadsheetApp.getUi().alert("No characters were generated. Check your novel premise.");
    }
  } catch (error) {
    logEvent("Setup Project", "Error: " + error.message, "Error");
    SpreadsheetApp.getUi().alert("Error during project setup: " + error.message);
  }
}

/**
 * Generates an enhanced novel outline with detailed chapter summaries and structure.
 */
function generateOutline() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const setupSheet = ss.getSheetByName("Project Setup");
  const outlineSheet = ss.getSheetByName("Outline");
  const charactersSheet = ss.getSheetByName("Characters");
  const logsSheet = ss.getSheetByName("Logs");
  if (!setupSheet || !outlineSheet || !charactersSheet) {
    SpreadsheetApp.getUi().alert("Required sheets not found. Run setup first.");
    return;
  }
  const targetWordCount = setupSheet.getRange("B2").getValue() || 80000;
  const chapterCount = setupSheet.getRange("B3").getValue() || 20;
  const title = setupSheet.getRange("B7").getValue() || "Untitled Novel";
  const genre = setupSheet.getRange("B8").getValue() || "Fiction";
  const audience = setupSheet.getRange("B9").getValue() || "General";
  const setting = setupSheet.getRange("B10").getValue() || "";
  const timePeriod = setupSheet.getRange("B11").getValue() || "";
  const novelPremise = setupSheet.getRange("A15:B20").getValue();
  const styleGuidelines = setupSheet.getRange("A24:B28").getValue();
  if (!novelPremise || novelPremise.trim() === "") {
    SpreadsheetApp.getUi().alert("Enter your novel premise in the Project Setup sheet.");
    return;
  }
  // Get character context
  const charData = charactersSheet.getDataRange().getValues();
  let charactersContext = "";
  if (charData.length > 1) {
    charactersContext = "CHARACTERS:\n";
    for (let i = 1; i < charData.length; i++) {
      if (charData[i][0]) {
        charactersContext += `- ${charData[i][0]} (${charData[i][1]}): ${charData[i][2]}\n`;
      }
    }
  }
  // Clear previous outline (except header)
  if (outlineSheet.getLastRow() > 1) {
    outlineSheet.getRange(2, 1, outlineSheet.getLastRow()-1, outlineSheet.getLastColumn()).clear();
  }
  logEvent("Generate Outline", "Creating novel structure", "Processing");
  // Build a prompt for high-level novel structure including narrative memory
  const narrativeContext = getNarrativeMemoryContext();
  const novelStructurePrompt = [
    {
      role: "system",
      content: "You are a seasoned novelist and editor. Create a complete three-act novel outline in valid JSON (no extra text) for a novel with the provided details."
    },
    {
      role: "user",
      content: `Create a comprehensive outline for a ${chapterCount}-chapter novel following a three-act structure.
      
NOVEL DETAILS:
Title: ${title}
Genre: ${genre}
Target Audience: ${audience}
Setting: ${setting}
Time Period: ${timePeriod}
Word Count: Approximately ${targetWordCount} words

NOVEL PREMISE:
${novelPremise}

${charactersContext}

STYLE GUIDELINES:
${styleGuidelines}

NARRATIVE MEMORY:
${narrativeContext}

For each act, provide key story beats, emotional arc for the protagonist(s), and major plot developments.
Then, for each chapter (total ${chapterCount}), provide a 1-2 sentence summary, a list of key characters, and the story's position (e.g., Act 1 - Setup).

Return valid JSON using the following structure:
{
  "novel_structure": {
    "act1": { "chapters": [1,2,...], "key_beats": [...], "emotional_arc": "...", "plot_developments": [...] },
    "act2": { "chapters": [...], "key_beats": [...], "emotional_arc": "...", "plot_developments": [...] },
    "act3": { "chapters": [...], "key_beats": [...], "emotional_arc": "...", "plot_developments": [...] }
  },
  "chapter_summaries": [
    {
      "chapter_number": 1,
      "summary": "Chapter 1 summary",
      "key_characters": ["Character1", "Character2"],
      "setting": "Location details",
      "story_position": "Act 1 - Setup"
    }
  ]
}`
    }
  ];
  
  let novelStructure = null;
  let attempts = 0;
  const maxAttempts = 4;
  let lastResponse = "";
  while (attempts < maxAttempts && novelStructure === null) {
    attempts++;
    try {
      if (attempts > 1) {
        SpreadsheetApp.getActiveSpreadsheet().toast(`Retry attempt ${attempts}/${maxAttempts} for outline...`, "Retrying");
        logEvent("Generate Outline", `Retry attempt ${attempts}`, "Processing");
      }
      const response = callChatGPTAPI(novelStructurePrompt, 0.3, 4000);
      lastResponse = response;
      const cleaned = cleanJsonResponse(response);
      try {
        novelStructure = JSON.parse(cleaned);
        if (!novelStructure.novel_structure || !novelStructure.chapter_summaries) {
          logEvent("Generate Outline", "Missing fields in structure", "Warning");
          novelStructure = null;
          continue;
        }
      } catch (e) {
        logEvent("Generate Outline", "JSON parse error: " + e.message, "Warning");
        const match = cleaned.match(/\{[\s\S]*\}/);
        if (match) {
          try {
            novelStructure = JSON.parse(fixJsonSyntax(match[0]));
            if (!novelStructure.novel_structure || !novelStructure.chapter_summaries) {
              logEvent("Generate Outline", "Extracted JSON missing fields", "Warning");
              novelStructure = null;
              continue;
            }
          } catch (e2) {
            logEvent("Generate Outline", "Extracted JSON parse error: " + e2.message, "Warning");
            novelStructure = null;
          }
        }
      }
    } catch (error) {
      logEvent("Generate Outline", "API error: " + error.message, "Warning");
      novelStructure = null;
    }
  }
  
  if (novelStructure === null) {
    logEvent("Generate Outline", "Failed to generate outline after maximum attempts", "Error");
    logFullResponse(logsSheet, "Final Outline Response", lastResponse);
    SpreadsheetApp.getUi().alert("Failed to create a valid novel structure. Check Logs for details.");
    return;
  }
  
  logEvent("Generate Outline", "Novel structure created successfully", "Complete");
  
  // Generate detailed chapter outlines
  let globalSequence = 0;
  for (let chapterNum = 1; chapterNum <= chapterCount; chapterNum++) {
    logEvent("Generate Outline", `Generating outline for Chapter ${chapterNum}`, "Processing");
    const chapterSummary = novelStructure.chapter_summaries.find(ch => ch.chapter_number === chapterNum) || {};
    const chapterContext = chapterSummary.summary || "No context available.";
    const storyPosition = chapterSummary.story_position || "Unknown";
    let actContext = "";
    if (novelStructure.novel_structure.act1.chapters.includes(chapterNum)) {
      actContext = "Act 1 - Setup: " + novelStructure.novel_structure.act1.key_beats.join(", ");
    } else if (novelStructure.novel_structure.act2.chapters.includes(chapterNum)) {
      actContext = "Act 2 - Confrontation: " + novelStructure.novel_structure.act2.key_beats.join(", ");
    } else if (novelStructure.novel_structure.act3.chapters.includes(chapterNum)) {
      actContext = "Act 3 - Resolution: " + novelStructure.novel_structure.act3.key_beats.join(", ");
    }
    const prevChapters = [];
    for (let i = Math.max(1, chapterNum - 2); i < chapterNum; i++) {
      const prev = novelStructure.chapter_summaries.find(ch => ch.chapter_number === i);
      if (prev) prevChapters.push(`Chapter ${i}: ${prev.summary}`);
    }
    const prevContext = prevChapters.length ? "Previous Chapters:\n" + prevChapters.join("\n") : "This is the first chapter.";
    const chapterPrompt = [
      {
        role: "system",
        content: "You are a meticulous novelist creating detailed chapter outlines. Return ONLY valid JSON with no extra text."
      },
      {
        role: "user",
        content: `Create a detailed outline for Chapter ${chapterNum} with 3-5 sections.

NOVEL DETAILS:
Title: ${title}
Genre: ${genre}
Target Audience: ${audience}

CHAPTER CONTEXT:
${chapterContext}

STORY POSITION:
${storyPosition}
${actContext}

${prevContext}

KEY CHARACTERS:
${(chapterSummary.key_characters || []).join(", ")}

Include for each section:
1. A 200-300 word detailed summary (include sensory details and continuity cues)
2. Characters present
3. Key plot developments
4. Setting details
5. How it connects to the overall narrative

Return JSON using the structure:
{
  "chapter_number": ${chapterNum},
  "sections": [
    {
      "section_number": 1,
      "summary": "Detailed section summary...",
      "characters_present": ["Character1", "Character2"],
      "key_plot_points": ["Plot point 1", "Plot point 2"],
      "setting": "Location details",
      "story_arc_position": "${storyPosition}"
    }
  ]
}`
      }
    ];
    let chapterData = null;
    let chapAttempts = 0;
    const maxChapAttempts = 4;
    let lastChapResponse = "";
    while (chapAttempts < maxChapAttempts && chapterData === null) {
      chapAttempts++;
      try {
        if (chapAttempts > 1) {
          SpreadsheetApp.getActiveSpreadsheet().toast(`Retry ${chapAttempts}/${maxChapAttempts} for Chapter ${chapterNum}`, "Retrying");
          logEvent("Generate Outline", `Retry attempt ${chapAttempts} for Chapter ${chapterNum}`, "Processing");
        }
        const chapResponse = callChatGPTAPI(chapterPrompt, 0.3, 4000);
        lastChapResponse = chapResponse;
        const cleanedChap = cleanJsonResponse(chapResponse);
        try {
          chapterData = JSON.parse(cleanedChap);
          if (!chapterData.chapter_number || !chapterData.sections || !Array.isArray(chapterData.sections) || chapterData.sections.length === 0) {
            logEvent("Generate Outline", `Missing fields for Chapter ${chapterNum}`, "Warning");
            chapterData = null;
            continue;
          }
        } catch (e) {
          logEvent("Generate Outline", `Chapter ${chapterNum} JSON parse error: ${e.message}`, "Warning");
          const match = cleanedChap.match(/\{[\s\S]*\}/);
          if (match) {
            try {
              chapterData = JSON.parse(fixJsonSyntax(match[0]));
              if (!chapterData.chapter_number || !chapterData.sections || !Array.isArray(chapterData.sections) || chapterData.sections.length === 0) {
                logEvent("Generate Outline", `Extracted JSON missing fields for Chapter ${chapterNum}`, "Warning");
                chapterData = null;
                continue;
              }
            } catch (e2) {
              logEvent("Generate Outline", `Extracted JSON error for Chapter ${chapterNum}: ${e2.message}`, "Warning");
              chapterData = null;
            }
          }
        }
      } catch (error) {
        logEvent("Generate Outline", `API error for Chapter ${chapterNum}: ${error.message}`, "Warning");
        chapterData = null;
      }
    }
    if (chapterData === null) {
      logEvent("Generate Outline", `Failed to generate Chapter ${chapterNum} outline after max attempts`, "Error");
      logFullResponse(logsSheet, `Chapter ${chapterNum} Final Response`, lastChapResponse);
      SpreadsheetApp.getUi().alert(`Chapter ${chapterNum} outline generation failed. Check Logs. Continuing.`);
      continue;
    }
    // Write each section into the Outline sheet.
    chapterData.sections.forEach(section => {
      if (!section || !section.summary) return;
      globalSequence++;
      const rowIndex = outlineSheet.getLastRow() + 1;
      outlineSheet.getRange(rowIndex, 1).setValue(globalSequence);
      outlineSheet.getRange(rowIndex, 2).setValue(chapterData.chapter_number);
      outlineSheet.getRange(rowIndex, 3).setValue(section.section_number);
      outlineSheet.getRange(rowIndex, 4).setValue(section.summary);
      outlineSheet.getRange(rowIndex, 5).setValue(Array.isArray(section.characters_present) ? section.characters_present.join(", ") : section.characters_present);
      outlineSheet.getRange(rowIndex, 6).setValue(Array.isArray(section.key_plot_points) ? section.key_plot_points.join("; ") : section.key_plot_points);
      outlineSheet.getRange(rowIndex, 7).setValue(section.setting);
      outlineSheet.getRange(rowIndex, 8).setValue(section.story_arc_position);
    });
    logEvent("Generate Outline", `Chapter ${chapterNum} with ${chapterData.sections.length} sections added`, "Complete");
  }
  // Optional: Apply conditional formatting (e.g., alternate row shading)
  const lastRow = outlineSheet.getLastRow();
  for (let i = 2; i <= lastRow; i++) {
    const chapterVal = outlineSheet.getRange(i, 2).getValue();
    if (chapterVal && chapterVal % 2 === 0) {
      outlineSheet.getRange(i, 1, 1, 8).setBackground("#f3f3f3");
    }
  }
  logEvent("Generate Outline", `Complete outline generated with ${globalSequence} sections`, "Complete");
  SpreadsheetApp.getUi().alert(`Outline generation complete! ${globalSequence} sections across ${chapterCount} chapters.`);
}

/**
 * Generates the novel content with iterative revision and enhanced memory.
 */
function generateNovel() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const setupSheet = ss.getSheetByName("Project Setup");
  const outlineSheet = ss.getSheetByName("Outline");
  const contentSheet = ss.getSheetByName("Content");
  const charactersSheet = ss.getSheetByName("Characters");
  if (!setupSheet || !outlineSheet || !contentSheet || !charactersSheet) {
    SpreadsheetApp.getUi().alert("Required sheets not found. Run setup first.");
    return;
  }
  const apiKey = PropertiesService.getScriptProperties().getProperty("OPENAI_API_KEY");
  if (!apiKey) {
    SpreadsheetApp.getUi().alert("API key not found. Set it up first.");
    return;
  }
  const targetWordCount = setupSheet.getRange("B2").getValue() || 80000;
  const chapterCount = setupSheet.getRange("B3").getValue() || 20;
  const wordsPerChapter = Math.floor(targetWordCount / chapterCount);
  const title = setupSheet.getRange("B7").getValue() || "Untitled Novel";
  const genre = setupSheet.getRange("B8").getValue() || "Fiction";
  const audience = setupSheet.getRange("B9").getValue() || "General";
  const setting = setupSheet.getRange("B10").getValue() || "";
  const timePeriod = setupSheet.getRange("B11").getValue() || "";
  const novelPremise = setupSheet.getRange("A15:B20").getValue();
  const styleGuidelines = setupSheet.getRange("A24:B28").getValue();
  const outlineData = outlineSheet.getDataRange().getValues();
  if (outlineData.length <= 1) {
    SpreadsheetApp.getUi().alert("Outline is empty. Generate the Outline first.");
    return;
  }
  // Get character context.
  const charData = charactersSheet.getDataRange().getValues();
  let charactersContext = "";
  if (charData.length > 1) {
    for (let i = 1; i < charData.length; i++) {
      if (charData[i][0]) {
        charactersContext += `- ${charData[i][0]} (${charData[i][1]}): ${charData[i][2]}\n`;
      }
    }
  }
  // Also add narrative memory context.
  const narrativeContext = getNarrativeMemoryContext();
  // Clear previous content (except header).
  if (contentSheet.getLastRow() > 1) {
    contentSheet.getRange(2, 1, contentSheet.getLastRow()-1, contentSheet.getLastColumn()).clear();
  }
  let totalWordCount = 0;
  let sectionsComplete = 0;
  let currentChapter = 0;
  for (let i = 1; i < outlineData.length; i++) {
    const seq = outlineData[i][0];
    const chapterNumber = outlineData[i][1];
    const sectionNumber = outlineData[i][2];
    const outlineSummary = outlineData[i][3];
    const charactersPresent = outlineData[i][4];
    const keyPlotPoints = outlineData[i][5];
    const sectionSetting = outlineData[i][6];
    const storyArcPosition = outlineData[i][7];
    if (!seq || !chapterNumber || !sectionNumber || !outlineSummary) continue;
    logEvent("Generate Novel", `Processing Chapter ${chapterNumber}, Section ${sectionNumber} (${sectionsComplete+1}/${outlineData.length-1})`, "Processing");
    const isNewChapter = chapterNumber !== currentChapter;
    currentChapter = chapterNumber;
    const sectionsInChapter = countSectionsInChapter(outlineData, chapterNumber);
    let targetSectionWords = Math.floor(wordsPerChapter / sectionsInChapter);
    if (isImportantChapter(chapterNumber, chapterCount, storyArcPosition)) {
      targetSectionWords = Math.floor(targetSectionWords * 1.2);
    }
    if (sectionNumber === 1) {
      targetSectionWords = Math.floor(targetSectionWords * 1.1);
    } else if (sectionNumber === sectionsInChapter) {
      targetSectionWords = Math.floor(targetSectionWords * 0.9);
    }
    const recentSectionsText = getLastSectionsForChapter(contentSheet, chapterNumber, 2);
    let characterDetails = "";
    if (charactersPresent) {
      const charNames = charactersPresent.split(",").map(c => c.trim());
      characterDetails = getCharacterDetails(charData, charNames);
    }
    // Build enhanced prompt with explicit sensory and continuity instructions.
    const userMessage = `
Write polished, commercial-quality prose for Chapter ${chapterNumber}, Section ${sectionNumber} of "${title}".

SECTION OUTLINE:
${outlineSummary}

KEY DETAILS:
- Characters: ${charactersPresent}
- Setting: ${sectionSetting}
- Plot Points: ${keyPlotPoints}
- Story Position: ${storyArcPosition}

CHARACTER DETAILS:
${characterDetails}

STYLE GUIDELINES:
${styleGuidelines}

TARGET WORD COUNT: Approximately ${targetSectionWords} words

CONTINUITY CONTEXT:
Previous Sections:
${recentSectionsText}

Narrative Memory:
${narrativeContext}

Additional requirements:
1. Include vivid sensory details (sight, sound, touch, smell, taste).
2. Ensure continuity in character voices and plot.
3. Provide natural transitions and immersive descriptions.
4. Do NOT include explicit headers like "Chapter X" or "Section Y".

Write publishing-quality prose suitable for ${audience} readers of ${genre}.`;
    const messages = [
      { role: "system", content: "You are a bestselling author who writes engaging, immersive fiction with rich sensory details and flawless continuity." },
      { role: "user", content: userMessage }
    ];
    let sectionText = callChatGPTAPI(messages, 0.7, 4000);
    let wordCount = countWords(sectionText);
    totalWordCount += wordCount;
    let qualityScore = calculateQualityScore(sectionText, targetSectionWords, wordCount);
    // If quality score is low, do an iterative revision.
    if (qualityScore < 70) {
      const revisionPrompt = [
        { role: "system", content: "You are an expert fiction editor." },
        { role: "user", content: `Revise the following text to add richer sensory details, improve continuity, and ensure clarity in character voices. Do not change the narrative structure. Text:\n\n${sectionText}` }
      ];
      const revisedText = callChatGPTAPI(revisionPrompt, 0.7, 4000);
      const revisedWordCount = countWords(revisedText);
      const revisedScore = calculateQualityScore(revisedText, targetSectionWords, revisedWordCount);
      // Accept revision if quality improves.
      if (revisedScore > qualityScore) {
        sectionText = revisedText;
        wordCount = revisedWordCount;
        qualityScore = revisedScore;
      }
    }
    // Write the section to the Content sheet.
    const nextRow = contentSheet.getLastRow() + 1;
    contentSheet.getRange(nextRow, 1).setValue(seq);
    contentSheet.getRange(nextRow, 2).setValue(chapterNumber);
    contentSheet.getRange(nextRow, 3).setValue(sectionNumber);
    contentSheet.getRange(nextRow, 4).setValue(sectionText);
    contentSheet.getRange(nextRow, 5).setValue(wordCount);
    contentSheet.getRange(nextRow, 6).setValue(qualityScore);
    contentSheet.getRange(nextRow, 7).setValue("Complete");
    // Color-code word count cell.
    if (wordCount < targetSectionWords * 0.8) {
      contentSheet.getRange(nextRow, 5).setBackground("#f4cccc");
    } else if (wordCount > targetSectionWords * 1.2) {
      contentSheet.getRange(nextRow, 5).setBackground("#fce5cd");
    } else {
      contentSheet.getRange(nextRow, 5).setBackground("#d9ead3");
    }
    // Color-code quality score cell.
    if (qualityScore < 70) {
      contentSheet.getRange(nextRow, 6).setBackground("#f4cccc");
    } else if (qualityScore >= 90) {
      contentSheet.getRange(nextRow, 6).setBackground("#d9ead3");
    } else {
      contentSheet.getRange(nextRow, 6).setBackground("#fff2cc");
    }
    // Run consistency check every 3 sections or at chapter end.
    sectionsComplete++;
    if (sectionsComplete % 3 === 0 || isLastSectionInChapter(outlineData, i)) {
      const checkResult = checkConsistency(contentSheet, nextRow, 3);
      if (checkResult && checkResult !== "---") {
        logEvent("Consistency Check", `Issues found: ${checkResult}`, "Warning");
        contentSheet.getRange(nextRow, 7).setValue("Needs Review");
        contentSheet.getRange(nextRow, 7).setBackground("#f4cccc");
      }
    }
    // Update narrative memory with key plot points from this section.
    updateNarrativeMemory(`Chapter ${chapterNumber} - Section ${sectionNumber}`, `Plot Points: ${keyPlotPoints}. Setting: ${sectionSetting}. Characters: ${charactersPresent}`);
    // Update progress.
    const progressPercent = Math.round((sectionsComplete / (outlineData.length - 1)) * 100);
    SpreadsheetApp.getActiveSpreadsheet().toast(`Completed ${sectionsComplete} of ${outlineData.length - 1} sections (${progressPercent}%). Total words: ${totalWordCount}`, `Generating Novel`);
  }
  const fullCheck = performFullConsistencyCheck(contentSheet);
  logEvent("Generate Novel", `Novel generation complete. Total words: ${totalWordCount}`, "Complete");
  SpreadsheetApp.getUi().alert(`Novel generation complete!
Total word count: ${totalWordCount} words
Average quality score: ${calculateAverageQualityScore(contentSheet)}
${fullCheck ? "Final consistency check noted issues. Some sections need review." : "Final consistency check passed."}`);
}

/**
 * Publishes the novel to a Google Doc and logs it in Published Books.
 */
function publishFinalNovel() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const setupSheet = ss.getSheetByName("Project Setup");
  const outlineSheet = ss.getSheetByName("Outline");
  const contentSheet = ss.getSheetByName("Content");
  const booksSheet = ss.getSheetByName("Published Books");
  const logsSheet = ss.getSheetByName("Logs");
  if (!setupSheet || !outlineSheet || !contentSheet || !booksSheet || !logsSheet) {
    SpreadsheetApp.getUi().alert("Required sheets not found. Run setup first.");
    return;
  }
  const apiKey = PropertiesService.getScriptProperties().getProperty("OPENAI_API_KEY");
  if (!apiKey) {
    SpreadsheetApp.getUi().alert("API key not found. Set it up first.");
    return;
  }
  logEvent("Publish Novel", "Starting publication process", "Processing");
  const title = setupSheet.getRange("B7").getValue() || "Untitled Novel";
  const genre = setupSheet.getRange("B8").getValue() || "Fiction";
  const novelName = title || "Generated Novel";
  const doc = DocumentApp.create(novelName);
  const docBody = doc.getBody();
  // Title page
  docBody.appendParagraph(title)
    .setHeading(DocumentApp.ParagraphHeading.TITLE)
    .setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  const now = new Date();
  docBody.appendParagraph(`Generated on ${now.toLocaleDateString()}`)
    .setHeading(DocumentApp.ParagraphHeading.SUBTITLE)
    .setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  docBody.appendPageBreak();
  // Table of Contents
  docBody.appendParagraph("TABLE OF CONTENTS")
    .setHeading(DocumentApp.ParagraphHeading.HEADING1)
    .setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  docBody.appendParagraph(" ");
  const chapters = [];
  const data = contentSheet.getDataRange().getValues();
  if (data.length <= 1) {
    SpreadsheetApp.getUi().alert("Content is empty. Nothing to publish.");
    return;
  }
  const uniqueChapters = new Set();
  for (let i = 1; i < data.length; i++) {
    const chapterNum = data[i][1];
    if (chapterNum && !uniqueChapters.has(chapterNum)) {
      uniqueChapters.add(chapterNum);
      chapters.push(chapterNum);
    }
  }
  chapters.sort((a, b) => a - b);
  chapters.forEach(ch => {
    docBody.appendParagraph(`Chapter ${ch}`)
      .setHeading(DocumentApp.ParagraphHeading.NORMAL)
      .setAlignment(DocumentApp.HorizontalAlignment.LEFT);
  });
  docBody.appendPageBreak();
  let rows = data.slice(1).sort((a, b) => a[0] - b[0]);
  let totalWordCount = 0;
  let lastChapter = -1;
  rows.forEach(row => {
    const seq = row[0], ch = row[1], sec = row[2], content = row[3];
    if (!seq || !ch || !sec || !content) return;
    if (ch !== lastChapter) {
      if (lastChapter !== -1) docBody.appendPageBreak();
      const chPara = docBody.appendParagraph(`Chapter ${ch}`);
      chPara.setHeading(DocumentApp.ParagraphHeading.HEADING1);
      chPara.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
      docBody.appendParagraph("");
      lastChapter = ch;
    }
    if (ch === lastChapter && sec > 1) {
      docBody.appendParagraph("* * *").setAlignment(DocumentApp.HorizontalAlignment.CENTER);
      docBody.appendParagraph("");
    }
    content.split("\n").forEach(par => {
      const trimmed = par.trim();
      if (trimmed) {
        const p = docBody.appendParagraph(trimmed);
        p.setHeading(DocumentApp.ParagraphHeading.NORMAL);
        p.setLineSpacing(1.5);
        p.setIndentFirstLine(36);
        totalWordCount += countWords(trimmed);
      }
    });
  });
  // Generate a book blurb
  const bookBlurb = generateBookBlurb(setupSheet, outlineSheet);
  docBody.appendPageBreak();
  docBody.appendParagraph("About This Book")
    .setHeading(DocumentApp.ParagraphHeading.HEADING2)
    .setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  docBody.appendParagraph(bookBlurb)
    .setHeading(DocumentApp.ParagraphHeading.NORMAL)
    .setLineSpacing(1.5);
  docBody.appendParagraph("");
  const userEmail = Session.getActiveUser().getEmail() || "Novel Generator";
  docBody.appendParagraph(`Generated by: ${userEmail}`)
    .setHeading(DocumentApp.ParagraphHeading.NORMAL)
    .setItalic(true)
    .setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  doc.saveAndClose();
  const userEmail2 = Session.getActiveUser().getEmail() || "unknown";
  booksSheet.appendRow([title, genre, bookBlurb, totalWordCount, doc.getUrl(), now, userEmail2]);
  logEvent("Publish Novel", `Novel "${title}" published. Doc URL: ${doc.getUrl()}`, "Complete");
  SpreadsheetApp.getUi().alert(`Novel "${title}" published!
Word Count: ${totalWordCount} words
Doc URL: ${doc.getUrl()}`);
  const response = SpreadsheetApp.getUi().alert("Reset sheets for a new novel?", SpreadsheetApp.getUi().ButtonSet.YES_NO);
  if (response === SpreadsheetApp.getUi().Button.YES) resetAllSheets();
}

/**
 * Generates a compelling book blurb for marketing.
 */
function generateBookBlurb(setupSheet, outlineSheet) {
  const title = setupSheet.getRange("B7").getValue() || "Untitled Novel";
  const genre = setupSheet.getRange("B8").getValue() || "Fiction";
  const audience = setupSheet.getRange("B9").getValue() || "General";
  const setting = setupSheet.getRange("B10").getValue() || "";
  const timePeriod = setupSheet.getRange("B11").getValue() || "";
  const novelPremise = setupSheet.getRange("A15:B20").getValue();
  const outlineData = outlineSheet.getDataRange().getValues();
  let firstChapterSummary = "";
  let lastChapterSummary = "";
  if (outlineData.length > 1) {
    for (let i = 1; i < outlineData.length; i++) {
      if (outlineData[i][1] === 1 && outlineData[i][2] === 1) { firstChapterSummary = outlineData[i][3]; break; }
    }
    let maxChapter = 1;
    for (let i = 1; i < outlineData.length; i++) {
      if (outlineData[i][1] > maxChapter) maxChapter = outlineData[i][1];
    }
    for (let i = 1; i < outlineData.length; i++) {
      if (outlineData[i][1] === maxChapter && outlineData[i][2] === 1) { lastChapterSummary = outlineData[i][3]; break; }
    }
  }
  const messages = [
    { role: "system", content: "You are a skilled copywriter for book marketing." },
    { role: "user", content: `Write a 2-3 paragraph compelling book blurb for the following novel details. 
BOOK DETAILS:
Title: ${title}
Genre: ${genre}
Target Audience: ${audience}
Setting: ${setting}
Time Period: ${timePeriod}

NOVEL PREMISE:
${novelPremise}

FIRST CHAPTER CONTEXT:
${firstChapterSummary}

FINAL CHAPTER CONTEXT:
${lastChapterSummary}

Guidelines:
- Start with a hook.
- Focus on the protagonist's journey and central conflict.
- Hint at stakes without revealing plot twists.
- End with a question or statement that invites curiosity.
- Aim for 150-200 words.
Return only the blurb in plain text.` }
  ];
  try {
    return callChatGPTAPI(messages, 0.7, 1000);
  } catch (error) {
    logEvent("Generate Blurb", "Error: " + error.message, "Error");
    return "A captivating tale of adventure and discovery awaits. Join the journey through challenges and triumphs in this engaging novel.";
  }
}

/**
 * Resets all sheets for a new novel project.
 */
function resetAllSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const setupSheet = ss.getSheetByName("Project Setup");
  const outlineSheet = ss.getSheetByName("Outline");
  const contentSheet = ss.getSheetByName("Content");
  const charactersSheet = ss.getSheetByName("Characters");
  if (!setupSheet || !outlineSheet || !contentSheet || !charactersSheet) {
    SpreadsheetApp.getUi().alert("One or more required sheets are missing. Run setup first.");
    return;
  }
  logEvent("Reset Sheets", "Resetting sheets for a new novel project", "Processing");
  setupSheet.getRange("B2").clear();
  setupSheet.getRange("B3").clear();
  setupSheet.getRange("B7").clear();
  setupSheet.getRange("B8").clear();
  setupSheet.getRange("B9").clear();
  setupSheet.getRange("B10").clear();
  setupSheet.getRange("B11").clear();
  setupSheet.getRange("A15:B20").clear();
  setupSheet.getRange("A15:B20").merge();
  setupSheet.getRange("A24:B28").clear();
  setupSheet.getRange("A24:B28").merge();
  if (outlineSheet.getLastRow() > 1) {
    outlineSheet.getRange(2, 1, outlineSheet.getLastRow()-1, outlineSheet.getLastColumn()).clear();
  }
  if (contentSheet.getLastRow() > 1) {
    contentSheet.getRange(2, 1, contentSheet.getLastRow()-1, contentSheet.getLastColumn()).clear();
  }
  if (charactersSheet.getLastRow() > 1) {
    charactersSheet.getRange(2, 1, charactersSheet.getLastRow()-1, charactersSheet.getLastColumn()).clear();
  }
  logEvent("Reset Sheets", "All sheets have been reset", "Complete");
  SpreadsheetApp.getUi().alert("All sheets have been reset. You can now start a new novel project!");
}
