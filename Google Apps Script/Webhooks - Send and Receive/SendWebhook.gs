function sendWebhook() {
  var scriptProperties = PropertiesService.getScriptProperties();
  var url = scriptProperties.getProperty("WEBHOOK_URL");
  var payload = {
    email: "user@example.com",
    event_id: 123,
    category: "test.",
    details: {
      day: "Monday",
      month: "January",
      year: "2025",
      shortDate: "1/13/2025"
    }
  };

  var options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload)
  };

  var response = UrlFetchApp.fetch(url, options);
  Logger.log(response.getContentText());
}