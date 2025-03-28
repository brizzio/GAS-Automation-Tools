/**
 * Custom function to combine column headers + row values + a prompt, then
 * analyze via OpenAI.
 *
 * @param {Range} headerRange - A 1-row range containing the column headers (e.g. A1:D1).
 * @param {Range} dataRange - A 1-row range containing the row data (e.g. A2:D2).
 * @param {string} prompt - The instruction/question for the AI.
 * @return {string} - The AI's response.
 */
function AIAnalyzeRow(headerRange, dataRange, prompt) {
  // 1. Retrieve your OpenAI API key from Script Properties.
  var apiKey = PropertiesService.getScriptProperties().getProperty('OPEN_AI_API_KEY');
  if (!apiKey) {
    return 'Error: No API key found in script properties (OPEN_AI_API_KEY).';
  }

  // 2. Convert the range arguments to 2D arrays.
  var headers = headerRange;
  var values = dataRange;

  // If you only pass a single row for headers/values, they should be 2D arrays with 1 row each.
  if (headers.length > 0) {
    headers = headers[0];
  }
  if (values.length > 0) {
    values = values[0];
  }

  // 3. Pair each header with its corresponding value, build a textual representation.
  var tableText = '';
  for (var i = 0; i < headers.length; i++) {
    var header = headers[i];
    var value = values[i];
    tableText += `${header}: ${value}\n`;
  }

  // 4. Construct the user message for the AI.
  var userMessage = `
${prompt}

Here are the column-value pairs for the record:
${tableText}
`;

  // 5. Set up the request payload for the Chat Completion API (GPT-3.5-turbo).
  var requestData = {
    model: 'gpt-3.5-turbo',
    messages: [
      { role: 'user', content: userMessage }
    ],
    temperature: 0.7,
    max_tokens: 1000
  };

  // 6. Set up UrlFetchApp options.
  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'Authorization': 'Bearer ' + apiKey
    },
    payload: JSON.stringify(requestData),
    muteHttpExceptions: true
  };

  // 7. Call the OpenAI API.
  try {
    var response = UrlFetchApp.fetch('https://api.openai.com/v1/chat/completions', options);
    var json = JSON.parse(response.getContentText());

    if (json.choices && json.choices.length > 0) {
      return json.choices[0].message.content.trim();
    } else {
      return 'No response from AI.';
    }
  } catch (e) {
    return 'Error: ' + e;
  }
}
