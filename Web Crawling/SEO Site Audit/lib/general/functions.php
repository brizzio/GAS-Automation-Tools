<?php  

function getCurrentApiEnvironment() {

    require_once __DIR__ . '/../../config.php'; // Adjust the path to correctly point to config.php
  
    $Current_Api_Environment = getenv('ENV');
  
    return $Current_Api_Environment;
  }

function getApiUrlBase() {
    //set base api url VV
    $Current_Api_Environment = getCurrentApiEnvironment();
    if ($Current_Api_Environment != 'PROD' && $Current_Api_Environment != 'STAGE' && $Current_Api_Environment != 'DEV_API') {
        $apiUrlBase = 'dev.';
    } else if ($Current_Api_Environment == 'DEV_API') {
        $apiUrlBase = 'dev-api.';
    } else if ($Current_Api_Environment == 'STAGE') {
        $apiUrlBase = 'stage.';
    } else if ($Current_Api_Environment == 'PROD') {
        $apiUrlBase = '';
    }
    //set base api url ^^
    return $apiUrlBase;
}

function removeSpecialCharacters($string, $preserveSpaces = false) {
    // Define the pattern for special characters. If spaces are to be preserved, they are excluded from the pattern.
    $pattern = $preserveSpaces ? '/[^a-zA-Z0-9 ]/' : '/[^a-zA-Z0-9]/';
    
    // Use preg_replace to remove any character that does not match the pattern.
    return preg_replace($pattern, '', $string);
}

function getRandomNumberInRange($min, $max) {
    // Ensure $min and $max are integers and $min is less than $max
    $min = (int)$min;
    $max = (int)$max;
    if ($min > $max) {
        // Swap values if $min is greater than $max
        $temp = $min;
        $min = $max;
        $max = $temp;
    }

    // Generate and return a random number between $min and $max
    return rand($min, $max);
}


function getCurrentDateForCentralTime() {
    // Set the time zone to Central Time
    date_default_timezone_set('America/Chicago');

    // Format and return the current date and time
    // 'Y-m-d H:i:s' format for a MySQL datetime field compatible format
    return date('Y-m-d H:i:s');
}


function getRandomWebsiteId() {

    global $conn;

    // SQL to select a random WebsiteId
    $sql = "SELECT WebsiteId FROM Website ORDER BY RAND() LIMIT 1";

    // Execute the query
    $result = $conn->query($sql);

    if ($result && $result->num_rows > 0) {
        // Fetch the randomly selected row
        $row = $result->fetch_assoc();
        //$conn->close(); // Close the database connection
        return $row["WebsiteId"]; // Return just the WebsiteId
    }

    //$conn->close(); // Close the database connection in case of failure
    return null; // Return null if no WebsiteId is found
}


function getWebsiteData($WebsiteId) {

    global $conn;

    // Prepare SQL to prevent SQL injection
    $stmt = $conn->prepare("SELECT WebsiteId, DomainName, DomainExt FROM Website WHERE WebsiteId = ? LIMIT 1");
    if (!$stmt) {
        // Handle error, perhaps log it or echo an error message
        echo "Prepare failed: (" . $conn->errno . ") " . $conn->error;
        return null;
    }
    
    // Bind parameters and execute
    $stmt->bind_param("i", $WebsiteId); // "i" indicates the parameter type is integer
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result && $result->num_rows > 0) {
        // Fetch the selected row
        $row = $result->fetch_assoc();
        $stmt->close(); // Close the statement
        //$conn->close(); // Close the database connection
        return $row; // Return the associative array containing Website data
    }

    $stmt->close(); // Close the statement in case of failure
    //$conn->close(); // Close the database connection in case of failure
    return null; // Return null if no data is found
}



function getKeywordId($Keyword) {
    global $conn;

    // Trim spaces from the beginning and end of the keyword
    $Keyword = strtolower(trim($Keyword));

    // Prepare the SQL statement to prevent SQL injection
    $stmt = $conn->prepare("SELECT KeywordId FROM Keyword WHERE Keyword = ?");
    $stmt->bind_param("s", $Keyword); // 's' specifies the variable type => 'string'

    // Execute the query
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result && $result->num_rows > 0) {
        // Fetch the KeywordId
        $row = $result->fetch_assoc();
        $stmt->close(); // Close the statement
        return $row["KeywordId"]; // Return the KeywordId
    } else {
        // The keyword does not exist, insert new keyword
        $insertStmt = $conn->prepare("INSERT INTO Keyword (Keyword) VALUES (?)");
        $insertStmt->bind_param("s", $Keyword);
        $insertStmt->execute();

        // Get the id of the newly inserted keyword
        $newKeywordId = $insertStmt->insert_id;
        $insertStmt->close(); // Close the statement

        return $newKeywordId; // Return the new KeywordId
    }
}

function getCreateRelatedWebsiteKeywordId($WebsiteId, $KeywordId, $RowNo) {
    global $conn;

    // Return 0 if RowNo is greater than 15
    if ($RowNo > 15) {
        return 0;
    }

    // Check for an existing record
    $selectStmt = $conn->prepare("SELECT WebsiteRelatedKeywordId FROM WebsiteRelatedKeyword WHERE WebsiteId = ? AND RowNo = ?");
    if ($selectStmt === false) {
        die("Prepare failed: " . $conn->error);
    }
    $selectStmt->bind_param("ii", $WebsiteId, $RowNo); // 'i' specifies the variable type => 'integer'
    $selectStmt->execute();
    $result = $selectStmt->get_result();

    if ($result && $result->num_rows > 0) {
        // Record exists, so update it
        $row = $result->fetch_assoc();
        $existingId = $row["RelatedWebsiteKeywordId"];

        $updateStmt = $conn->prepare("UPDATE WebsiteRelatedKeyword SET KeywordId = ? WHERE WebsiteRelatedKeywordId = ?");
        if ($updateStmt === false) {
            die("Prepare failed: " . $conn->error);
        }
        $updateStmt->bind_param("ii", $KeywordId, $existingId);
        $updateStmt->execute();
        $updateStmt->close();

        // Return the existing RelatedWebsiteKeywordId
        return $existingId;
    } else {
        // Record does not exist, so insert a new one
        $insertStmt = $conn->prepare("INSERT INTO WebsiteRelatedKeyword (WebsiteId, KeywordId, RowNo) VALUES (?, ?, ?)");
        if ($insertStmt === false) {
            die("Prepare failed: " . $conn->error);
        }
        $insertStmt->bind_param("iii", $WebsiteId, $KeywordId, $RowNo);
        $insertStmt->execute();
        $newId = $insertStmt->insert_id; // Get the id of the newly inserted record
        $insertStmt->close();

        // Return the new RelatedWebsiteKeywordId
        return $newId;
    }
}


function InsertRecommendedUserWebsiteKeyword($UserWebsiteId, $KeywordId) {
    global $conn;

    // First, check if the record already exists
    $checkStmt = $conn->prepare("SELECT COUNT(*) FROM UserWebsiteKeyword WHERE UserWebsiteId = ? AND KeywordId = ?");
    if ($checkStmt === false) {
        die("Prepare failed: " . $conn->error);
    }

    $checkStmt->bind_param("ii", $UserWebsiteId, $KeywordId);
    $checkStmt->execute();
    $checkStmt->bind_result($count);
    $checkStmt->fetch();
    $checkStmt->close();

    // If the record exists, do nothing and return a message
    if ($count > 0) {
        return "Record already exists. No insertion made.";
    }

    // If the record does not exist, proceed with the insertion
    $insertStmt = $conn->prepare("INSERT INTO UserWebsiteKeyword (UserWebsiteId, KeywordId) VALUES (?, ?)");
    if ($insertStmt === false) {
        die("Prepare failed: " . $conn->error);
    }

    $insertStmt->bind_param("ii", $UserWebsiteId, $KeywordId);
    $insertStmt->execute();
    $insertStmt->close();

    // Return a success message after insertion
    return "Insert Successful";
}


function getCreateWebsiteTextBlob($WebsiteId, $WebsiteTextBlob) {
    global $conn;

    // Check for an existing record
    $selectStmt = $conn->prepare("SELECT WebsiteTextBlobId FROM WebsiteTextBlob WHERE WebsiteId = ?");
    if ($selectStmt === false) {
        return "Error preparing SELECT statement: " . $conn->error;
    }
    $selectStmt->bind_param("i", $WebsiteId); // Corrected the parameter types
    if (!$selectStmt->execute()) {
        return "Error executing SELECT statement: " . $selectStmt->error;
    }
    $result = $selectStmt->get_result();
    $selectStmt->close(); // Close statement to free up the resource

    if ($result && $result->num_rows > 0) {
        // Record exists, so update it
        $row = $result->fetch_assoc();
        $existingWebsiteTextBlobId = $row["WebsiteTextBlobId"];

        $updateStmt = $conn->prepare("UPDATE WebsiteTextBlob SET TextBlob = ? WHERE WebsiteId = ?");
        if ($updateStmt === false) {
            return "Error preparing UPDATE statement: " . $conn->error;
        }
        $updateStmt->bind_param("si", $WebsiteTextBlob, $WebsiteId);
        if (!$updateStmt->execute()) {
            return "Error executing UPDATE statement: " . $updateStmt->error;
        }
        $updateStmt->close();

        return $existingWebsiteTextBlobId;
    } else {
        // Record does not exist, so insert a new one
        $insertStmt = $conn->prepare("INSERT INTO WebsiteTextBlob (WebsiteId, TextBlob) VALUES (?, ?)");
        if ($insertStmt === false) {
            return "Error preparing INSERT statement: " . $conn->error;
        }
        $insertStmt->bind_param("is", $WebsiteId, $WebsiteTextBlob);
        if (!$insertStmt->execute()) {
            return "Error executing INSERT statement: " . $insertStmt->error;
        }
        $newWebsiteTextBlobId = $insertStmt->insert_id;
        $insertStmt->close();

        return $newWebsiteTextBlobId;
    }
}



function getCreateAutoUserWebsite($WebsiteId) {
    global $conn;

    // Check for an existing record
    $selectStmt = $conn->prepare("SELECT DomainName, DomainExt FROM Website WHERE WebsiteId = ?");
    if ($selectStmt === false) {
        return "Error preparing SELECT statement: " . $conn->error;
    }
    $selectStmt->bind_param("i", $WebsiteId);
    if (!$selectStmt->execute()) {
        return "Error executing SELECT statement: " . $selectStmt->error;
    }
    $result = $selectStmt->get_result();
    $selectStmt->close(); // Close statement to free up the resource

    if ($result && $result->num_rows > 0) {
        // Get the first (and should be only) row from the result
        $row = $result->fetch_assoc();
        $ProtocolResource = 'https://www'; // Default value for 'ProtocolResource
        $DomainName = $row['DomainName'];
        $DomainExt = $row['DomainExt'];
        $BaseUrl = $ProtocolResource.".".$DomainName.".".$DomainExt;

        // Insert a new record
        $insertStmt = $conn->prepare("INSERT INTO UserWebsite (UserId, usernm, ProtocolResource, DomainName, DomainExt, BaseUrl, WebsiteId, IsPrimary, IsAuto) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
        if ($insertStmt === false) {
            return "Error preparing INSERT statement: " . $conn->error;
        }
        // Placeholder values for UserId and usernm should be replaced with actual values
        $UserId = 0;  // Example placeholder
        $usernm = ''; // Example placeholder
        $IsPrimary = 1; // true
        $IsAuto = 1;   // true
        $insertStmt->bind_param("isssssiii", $UserId, $usernm, $ProtocolResource, $DomainName, $DomainExt, $BaseUrl, $WebsiteId, $IsPrimary, $IsAuto);
        if (!$insertStmt->execute()) {
            return "Error executing INSERT statement: " . $insertStmt->error;
        }
        $NewUserWebsiteId = $insertStmt->insert_id;
        $insertStmt->close();

        return $NewUserWebsiteId;
    } else {
        // Optionally handle the case where no records are found in the SELECT query
        return "No record found for WebsiteId: $WebsiteId";
    }
}

?>