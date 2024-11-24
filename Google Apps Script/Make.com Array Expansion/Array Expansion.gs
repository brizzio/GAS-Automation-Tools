function doPost(e) {
  try {
    // Log the incoming request data
    Logger.log('Request received: ' + e.postData.contents);

    // Parse the incoming JSON data
    var inputData = JSON.parse(e.postData.contents);

    // Call the transformData function with the input data
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