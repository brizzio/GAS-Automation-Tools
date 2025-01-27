/**
 * This script optionally requires an API key (stored in Script Properties) to authorize incoming POST requests.
 * - Set the property "API_KEY" to a secret value if you want to use API key authorization.
 * - Set the property "REQUIRE_API_KEY" to "true" if you want to enforce API key checking.
 *   Otherwise, if "REQUIRE_API_KEY" is not set or is set to "false", requests won't be checked for an API key.
 *
 * To configure these:
 * 1. In the Apps Script editor, go to File > Project properties.
 * 2. Select the Script properties tab.
 * 3. (Optional) Add a new property named "API_KEY" with your desired secret key.
 * 4. (Optional) Add a new property named "REQUIRE_API_KEY" and set it to "true" if you'd like to enforce the API key.
 *    If you leave it out or set it to "false", then no key will be required.
 * 5. Save and deploy your script as a web app.
 * 6. If requiring an API key, make sure to send it in the JSON body (e.g., {"apiKey": "your-secret-key"}).
 */

function doPost(e) {
  const scriptProperties = PropertiesService.getScriptProperties();
  const apiKey = scriptProperties.getProperty("API_KEY");                // The stored API key (if any)
  const requireApiKey = scriptProperties.getProperty("REQUIRE_API_KEY"); // "true" or "false" or undefined

  try {
    // Log the incoming request data
    Logger.log('Request received: ' + e.postData.contents);

    // Parse the incoming JSON data
    var inputData = JSON.parse(e.postData.contents);

    // If we require an API key, enforce checking
    if (requireApiKey === "true") {
      // Check if the incoming request has the correct API key
      if (!inputData.apiKey || inputData.apiKey !== apiKey) {
        // Return an error response if the key is invalid or missing
        return ContentService
          .createTextOutput(JSON.stringify({ "error": "Invalid or missing API key." }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }

    // If the API key is valid (or not required), proceed with data transformation
    var outputData = transformData(inputData);

    // Return the transformed data as a JSON response
    return ContentService
      .createTextOutput(JSON.stringify(outputData))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    // Log the error
    Logger.log('Error: ' + error);

    // Return the error as a JSON response
    var errorMessage = {
      "error": error.toString()
    };
    return ContentService
      .createTextOutput(JSON.stringify(errorMessage))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function transformData(inputData) {
  // If "apiKey" exists in the data, remove it before transformation to avoid confusion
  if (inputData.apiKey) {
    delete inputData.apiKey;
  }

  // Initialize the result array and total length counter
  var resultArray = [];
  var totalLength = 0;

  // Determine if inputData is an array or an object
  if (!Array.isArray(inputData)) {
    inputData = [inputData];
  }

  // Loop through each item in the inputData
  inputData.forEach(function(item) {
    // Get the keys of the current item
    var keys = Object.keys(item);

    // Identify the key that contains an array (child IDs) and the key that contains the parent ID
    var parentKey = null;
    var childKey = null;

    keys.forEach(function(key) {
      if (Array.isArray(item[key])) {
        childKey = key;
      } else {
        parentKey = key;
      }
    });

    // If both keys are found, proceed
    if (parentKey && childKey) {
      var parentId = item[parentKey];
      var childIds = item[childKey];

      // Loop through each child ID within the current item
      childIds.forEach(function(childId) {
        // Create a new object with dynamically generated field names
        var obj = {};
        obj[parentKey + childKey + "Id"] = parentId + "." + childId;
        obj[parentKey] = parentId;
        obj[childKey.slice(0, -1) + "Id"] = childId; // Remove the 's' at the end if plural

        // Add the object to the result array
        resultArray.push(obj);
        // Increment the total length counter
        totalLength++;
      });
    }
  });

  // Construct the final output array
  var output = [
    {
      "array": resultArray,
      "__IMTAGGLENGTH__": totalLength
    }
  ];

  // Return the transformed data
  return output;
}
