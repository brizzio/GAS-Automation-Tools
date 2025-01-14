// Helper function to call Copper API
function copperApi(endpoint, method, payload) {
  const API_BASE_URL = "https://api.copper.com/developer_api/v1";
  const API_KEY = PropertiesService.getScriptProperties().getProperty('COPPER_API_KEY');
  const USER_EMAIL = "user@example.com"; // Replace with your Copper user email

  const options = {
    method: method,
    headers: {
      "Content-Type": "application/json",
      "X-PW-AccessToken": API_KEY,
      "X-PW-Application": "developer_api",
      "X-PW-UserEmail": USER_EMAIL
    },
    payload: payload ? JSON.stringify(payload) : null,
    muteHttpExceptions: true // Ensure we capture both success and failure responses
  };

  try {
    const response = UrlFetchApp.fetch(`${API_BASE_URL}${endpoint}`, options);
    const statusCode = response.getResponseCode(); // Get HTTP status code
    const body = response.getContentText() ? JSON.parse(response.getContentText()) : null; // Parse response body

    return {
      statusCode: statusCode,
      body: body
    };
  } catch (e) {
    console.error(`Error making API call to ${endpoint}:`, e.message);
    return {
      statusCode: undefined,
      body: null,
      error: e.message
    };
  }
}