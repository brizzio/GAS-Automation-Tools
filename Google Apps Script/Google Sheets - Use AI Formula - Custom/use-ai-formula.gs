/**
 * Custom function to analyze cell content with OpenAI's API.
 *
 * @param {string} content The text content you want to analyze (e.g., a cell reference).
 * @param {string} prompt The instruction/prompt for the AI (e.g., "Extract phone numbers").
 * @return {string} The AI's response.
 *
 * Usage in Sheet: =UseAI(A2, "Extract phone numbers from this text")
 */
function UseAI(content, prompt) {
  // 1. Insert your OpenAI API Key here (or use Script Properties for security in production).
  var apiKey = 'OPEN AI API KEY';
  
  // 2. Construct the message for the AI. You can customize as needed:
  var userMessage = `${prompt}\n\nHere is the content:\n${content}`;

  // 3. Set up the request payload for the Chat API (gpt-3.5-turbo or your model of choice).
  var requestData = {
    model: 'gpt-3.5-turbo',
    messages: [
      { role: 'user', content: userMessage }
    ],
    temperature: 0.7,        // Adjust creativity as needed
    max_tokens: 1000         // Adjust or omit based on your needs
  };

  // 4. Set up UrlFetchApp options.
  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'Authorization': 'Bearer ' + apiKey
    },
    payload: JSON.stringify(requestData),
    muteHttpExceptions: true // so the script doesn't throw on 4XX/5XX
  };

  try {
    // 5. Make the POST request to the OpenAI API.
    var response = UrlFetchApp.fetch('https://api.openai.com/v1/chat/completions', options);
    
    // 6. Parse the JSON response to extract the answer.
    var json = JSON.parse(response.getContentText());
    if (json.choices && json.choices.length > 0) {
      var reply = json.choices[0].message.content.trim();
      return reply;
    } else {
      // Fallback if we don't get a proper response.
      return "Unknown.";
    }
  } catch (e) {
    // 7. Catch any errors (e.g., timeouts, API errors) and return a message instead of throwing.
    return "Error: " + e;
  }
}
