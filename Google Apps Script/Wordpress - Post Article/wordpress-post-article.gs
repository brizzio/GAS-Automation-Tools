/**
 * Publishes a random "Article" (custom post type) via the WordPress REST API
 * 
 * Usage:
 * 1. Go to Script.google.com or Tools -> Script Editor in Google Sheets.
 * 2. Paste in this code.
 * 3. Replace credentials and domain with your actual info.
 * 4. Run the "publishRandomArticle" function.
 */

function publishRandomArticle() {
  // 1. Generate some random text for the title and body
  const title = generateRandomHeadline();
  const body = generateRandomBody();

  // 2. Build the JSON payload for WordPress
  const payload = {
    title: title,
    content: body,
    status: 'publish' // or "draft" if you prefer to approve before publishing
  };

  // 3. Make the POST request to your WP REST API endpoint for your CPT "articles"
  // Replace this URL with your site’s domain:
  const url = 'https://example.com/wp-json/wp/v2/articles';

  // Replace with your WP admin user + Application Password 
  // (or normal password if Basic Auth is configured—but recommended is an App Password).
  const props = PropertiesService.getScriptProperties();
  const username = props.getProperty('WP_USERNAME');
  const password = props.getProperty('WP_PASSWORD');

  // 4. Set up the request options with basic authentication
  const headers = {
    'Authorization': 'Basic ' + Utilities.base64Encode(username + ':' + password),
    'Content-Type': 'application/json'
  };
  const options = {
    method: 'post',
    muteHttpExceptions: true,
    headers: headers,
    payload: JSON.stringify(payload)
  };

  // 5. Execute the request
  try {
    const response = UrlFetchApp.fetch(url, options);
    const respCode = response.getResponseCode();
    const respBody = response.getContentText();

    if (respCode === 201 || respCode === 200) {
      // 201 = Created, 200 sometimes if your server is configured differently
      Logger.log('Success! Created new Article: ' + respBody);
    } else {
      Logger.log('Error posting to WordPress. Code: ' + respCode + ' Body: ' + respBody);
    }
  } catch (e) {
    Logger.log('Request failed: ' + e);
  }
}

/**
 * Generate a random "headline"
 */
function generateRandomHeadline() {
  const subjects = ['Dragon', 'Mountain', 'Ocean', 'Galaxy', 'Robot', 'Universe', 'Medieval Kingdom'];
  const verbs = ['Transforms', 'Reveals', 'Explodes', 'Evolves', 'Conquers', 'Discovers'];
  const objects = ['Society', 'Technology', 'Fortune', 'Politics', 'History'];

  // Pick random words
  const randomSubject = subjects[Math.floor(Math.random() * subjects.length)];
  const randomVerb = verbs[Math.floor(Math.random() * verbs.length)];
  const randomObject = objects[Math.floor(Math.random() * objects.length)];

  // Example: "Robot Conquers Fortune" or "Galaxy Reveals Society"
  return randomSubject + ' ' + randomVerb + ' ' + randomObject;
}

/**
 * Generate a random "body" text
 */
function generateRandomBody() {
  const fillerParagraphs = [
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Praesent eleifend...",
    "Duis suscipit felis id erat laoreet, at vestibulum lorem dictum. Cras in felis...",
    "Aenean rutrum, risus ut dapibus efficitur, metus quam sagittis nulla, non semper...",
    "Vivamus interdum urna at massa sollicitudin, eget fermentum arcu pellentesque...",
    "Suspendisse potenti. Nulla at justo eget erat congue auctor. Etiam eu elementum..."
  ];

  // Build a multi-paragraph body from random picks
  let body = '';
  for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) {
    const randomPara = fillerParagraphs[Math.floor(Math.random() * fillerParagraphs.length)];
    body += `<p>${randomPara}</p>\n`;
  }
  return body;
}
