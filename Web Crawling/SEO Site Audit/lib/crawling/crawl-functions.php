<?php 

function CreateUserWebsiteCrawl($UserWebsiteId, $BaseUrl, $TestMode) {
    // Assuming $conn is accessible as a global variable or through some singleton pattern
    global $conn;

    $sql = "SELECT UserId FROM UserWebsite WHERE UserWebsiteId ='$UserWebsiteId'";

    $result = $conn->query($sql);
    if ($result->num_rows > 0) {
        while($row = $result->fetch_assoc()) {
            $UserId = $row["UserId"];
        }
    } else {
        throw new Exception("No results");
    }

    if ($UserId == 0){
        $IsFromFrontEnd = TRUE;
    } else {
        $IsFromFrontEnd = FALSE;
    }

    if (strtolower($BaseUrl) == "https://www.Example.com"){
        $IsOmit = TRUE;
    } else {
        $IsOmit = FALSE;
    }

    // Insert into UserWebsiteCrawl and get the last inserted id
    $sql = "INSERT INTO UserWebsiteCrawl (UserWebsiteId, IsFromFrontEnd, IsTest, IsOmit) VALUES ('$UserWebsiteId', '$IsFromFrontEnd', '$TestMode', '$IsOmit')";
    if ($conn->query($sql) === TRUE) {
        $UserWebsiteCrawlId = $conn->insert_id; // Get the last inserted id
        // Optionally, you can echo the success message, but it's usually not recommended to echo inside a function
        // echo "New record created successfully. Last inserted ID is: " . $UserWebsiteCrawlId;
        return $UserWebsiteCrawlId;
    } else {
        // Handle error - you might want to throw an exception or return a specific value indicating failure
        // echo "Error: " . $sql . "<br>" . $conn->error;
        throw new Exception("Error: " . $sql . "<br>" . $conn->error);
    }
}


function CreateAutoWebsiteUserWebsiteCrawl($UserWebsiteId, $TestMode) {
    // Assuming $conn is accessible as a global variable or through some singleton pattern
    global $conn;

    $IsFromFrontEnd = FALSE;
    $IsAuto = TRUE;
    $IsAutoWebsite = TRUE;

    // Insert into UserWebsiteCrawl and get the last inserted id
    $sql = "INSERT INTO UserWebsiteCrawl (UserWebsiteId, IsFromFrontEnd, IsAuto, IsAutoWebsite, IsTest) VALUES ('$UserWebsiteId', '$IsFromFrontEnd', '$IsAuto', '$IsAutoWebsite', '$TestMode')";
    if ($conn->query($sql) === TRUE) {
        $UserWebsiteCrawlId = $conn->insert_id; // Get the last inserted id
        // Optionally, you can echo the success message, but it's usually not recommended to echo inside a function
        // echo "New record created successfully. Last inserted ID is: " . $UserWebsiteCrawlId;
        return $UserWebsiteCrawlId;
    } else {
        // Handle error - you might want to throw an exception or return a specific value indicating failure
        // echo "Error: " . $sql . "<br>" . $conn->error;
        throw new Exception("Error: " . $sql . "<br>" . $conn->error);
    }
}


function GetUserWebsiteBaseUrl($UserWebsiteId) {
    // Assuming $conn is accessible as a global variable or through some singleton pattern
    global $conn;

    // Insert into UserWebsiteCrawl and get the last inserted id
    $sql = "SELECT BaseUrl FROM UserWebsite WHERE UserWebsiteId ='$UserWebsiteId'";

    $result = $conn->query($sql);
    if ($result->num_rows > 0) {
        while($row = $result->fetch_assoc()) {
            $BaseUrl = $row["BaseUrl"];
            
        }
        return $BaseUrl;
    } else {
        throw new Exception("No results");
    }
}

function GetUserWebsiteWebsiteId($UserWebsiteId) {
    // Assuming $conn is accessible as a global variable or through some singleton pattern
    global $conn;

    // Insert into UserWebsiteCrawl and get the last inserted id
    $sql = "SELECT WebsiteId FROM UserWebsite WHERE UserWebsiteId ='$UserWebsiteId'";

    $result = $conn->query($sql);
    if ($result->num_rows > 0) {
        while($row = $result->fetch_assoc()) {
            $WebsiteId = $row["WebsiteId"];
            
        }
        return $WebsiteId;
    } else {
        throw new Exception("No results");
    }
}

function InsertPageCrawl($UserWebsiteCrawlId, $UserWebsiteId, $BaseUrl, $url){
    // Assuming $conn is accessible as a global variable or through some singleton pattern
    global $conn;

    // Insert into UserWebsiteCrawl and get the last inserted id
    $sql = "INSERT INTO PageCrawl (UserWebsiteCrawlId, UserWebsiteId, BaseUrl, Url) VALUES ('$UserWebsiteCrawlId', '$UserWebsiteId', '$BaseUrl', '$url')";
    if ($conn->query($sql) === TRUE) {
        $PageCrawlId = $conn->insert_id; // Get the last inserted id
        // Optionally, you can echo the success message, but it's usually not recommended to echo inside a function
        // echo "New record created successfully. Last inserted ID is: " . $UserWebsiteCrawlId;
        return $PageCrawlId;
    } else {
        // Handle error - you might want to throw an exception or return a specific value indicating failure
        // echo "Error: " . $sql . "<br>" . $conn->error;
        throw new Exception("Error: " . $sql . "<br>" . $conn->error);
    }
//Return PageCrawlId
}



function GetPageCrawlItemTypeId($TypeName){
    // Assuming $conn is accessible as a global variable or through some singleton pattern
    global $conn;

    // Insert into UserWebsiteCrawl and get the last inserted id
    $sql = "SELECT PageCrawlItemTypeId FROM PageCrawlItemType WHERE TypeName LIKE '%$TypeName%'";

    $result = $conn->query($sql);
    if ($result->num_rows > 0) {
        while($row = $result->fetch_assoc()) {
            $PageCrawlItemTypeId = $row["PageCrawlItemTypeId"];
            
        }
        return $PageCrawlItemTypeId;
    } else {
        $PageCrawlItemTypeId = 21;
        return $PageCrawlItemTypeId;
    }

    return $TypeName;
    //return $PageCrawlItemTypeId
}

function InsertPageCrawlItem($PageCrawlId, $PageCrawlItemTypeId, $CrawlItemNote, $CrawlItemDetails){
    // Assuming $conn is accessible as a global variable or through some singleton pattern
    global $conn;

    // Insert into UserWebsiteCrawl and get the last inserted id
    $sql = "INSERT INTO PageCrawlItem (PageCrawlId, CrawlItemTypeId, Note, Detail) VALUES ('$PageCrawlId', '$PageCrawlItemTypeId', '$CrawlItemNote', '$CrawlItemDetails')";
    if ($conn->query($sql) === TRUE) {
        $PageCrawlItemId = $conn->insert_id; // Get the last inserted id
        // Optionally, you can echo the success message, but it's usually not recommended to echo inside a function
        // echo "New record created successfully. Last inserted ID is: " . $UserWebsiteCrawlId;
        return $PageCrawlItemId;
    } else {
        // Handle error - you might want to throw an exception or return a specific value indicating failure
        // echo "Error: " . $sql . "<br>" . $conn->error;
        throw new Exception("Error: " . $sql . "<br>" . $conn->error);
    }
}



function UpdateUserWebsiteCrawlPages($UserWebsiteCrawlId, $currentUrlCount) {
    // Assuming $conn is accessible as a global variable or through some singleton pattern
    global $conn;

    // Prepare an UPDATE SQL statement
    $sql = "UPDATE UserWebsiteCrawl SET PagesCrawled = ? WHERE UserWebsiteCrawlId = ?";
    
    // Prepare the SQL statement for execution
    $stmt = $conn->prepare($sql);
    if ($stmt === false) {
        throw new Exception("Error preparing statement: " . $conn->error);
    }

    // Bind the parameters to the SQL statement
    $stmt->bind_param("ii", $currentUrlCount, $UserWebsiteCrawlId);

    // Execute the statement
    if ($stmt->execute()) {
        // Check if any row was actually updated
        if ($stmt->affected_rows > 0) {
            // Optionally, you can return true to indicate success
            return true;
        } else {
            // If no row was updated, it might mean the UserWebsiteCrawlId was not found
            throw new Exception("No record updated. Please check the UserWebsiteCrawlId.");
        }
    } else {
        // Handle error - you might want to throw an exception or return a specific value indicating failure
        throw new Exception("Error executing update: " . $stmt->error);
    }

    // Close the prepared statement
    $stmt->close();
}


function UpdateUserWebsiteCrawlCompletionStatus($UserWebsiteCrawlId, $CompletionStatus) {
    // Assuming $conn is accessible as a global variable or through some singleton pattern
    global $conn;

    // Prepare an UPDATE SQL statement
    $sql = "UPDATE UserWebsiteCrawl SET Complete = ? WHERE UserWebsiteCrawlId = ?";
    
    // Prepare the SQL statement for execution
    $stmt = $conn->prepare($sql);
    if ($stmt === false) {
        throw new Exception("Error preparing statement: " . $conn->error);
    }

    // Bind the parameters to the SQL statement
    $stmt->bind_param("ii", $CompletionStatus, $UserWebsiteCrawlId);

    // Execute the statement
    if ($stmt->execute()) {
        // Check if any row was actually updated
        if ($stmt->affected_rows > 0) {
            // Optionally, you can return true to indicate success
            return true;
        } else {
            // If no row was updated, it might mean the UserWebsiteCrawlId was not found
            throw new Exception("No record updated. Please check the UserWebsiteCrawlId.");
        }
    } else {
        // Handle error - you might want to throw an exception or return a specific value indicating failure
        throw new Exception("Error executing update: " . $stmt->error);
    }

    // Close the prepared statement
    $stmt->close();
}


function UpdateUserWebsiteCrawlSiteScore($UserWebsiteCrawlId, $SiteScore) {
    // Assuming $conn is accessible as a global variable or through some singleton pattern
    global $conn;

    // Prepare an UPDATE SQL statement
    $sql = "UPDATE UserWebsiteCrawl SET SiteScore = ? WHERE UserWebsiteCrawlId = ?";
    
    // Prepare the SQL statement for execution
    $stmt = $conn->prepare($sql);
    if ($stmt === false) {
        throw new Exception("Error preparing statement: " . $conn->error);
    }

    // Bind the parameters to the SQL statement
    $stmt->bind_param("di", $SiteScore, $UserWebsiteCrawlId);

    // Execute the statement
    if ($stmt->execute()) {
        // Check if any row was actually updated
        if ($stmt->affected_rows > 0) {
            // Close the prepared statement.
            $stmt->close();
            // Return true to indicate success
            return true;
        } else {
            // Close the prepared statement.
            $stmt->close();
            // If no row was updated, return false
            return false;
        }
    } else {
        // Close the prepared statement.
        $stmt->close();
        // Handle error - you might want to return false or throw an exception
        return false;
    }
}


function UpdateWebsiteSiteScore($WebsiteId, $SiteScore) {
    // Assuming $conn is accessible as a global variable or through some singleton pattern
    global $conn;

    // Prepare an UPDATE SQL statement
    $sql = "UPDATE Website SET SiteScore = ? WHERE WebsiteId = ?";
    
    // Prepare the SQL statement for execution
    $stmt = $conn->prepare($sql);
    if ($stmt === false) {
        throw new Exception("Error preparing statement: " . $conn->error);
    }

    // Bind the parameters to the SQL statement
    $stmt->bind_param("di", $SiteScore, $WebsiteId);

    // Execute the statement
    if ($stmt->execute()) {
        // Check if any row was actually updated
        if ($stmt->affected_rows > 0) {
            // Close the prepared statement.
            $stmt->close();
            // Return true to indicate success
            return true;
        } else {
            // Close the prepared statement.
            $stmt->close();
            // If no row was updated, return false
            return false;
        }
    } else {
        // Close the prepared statement.
        $stmt->close();
        // Handle error - you might want to return false or throw an exception
        return false;
    }
}

function UpdatePageCrawlLinks($PageCrawlId, $AllPageCrawlLinks) {
    global $conn; // Assuming $conn is your database connection

    // Convert the array to JSON format
    $AllPageCrawlLinksJson = json_encode($AllPageCrawlLinks);

    // Calculate the counts of internal and external links
    $internalLinkCount = 0;
    $externalLinkCount = 0;

    foreach ($AllPageCrawlLinks as $link) {
        if ($link->IsInternal) {
            $internalLinkCount++;
        } else {
            $externalLinkCount++;
        }
    }

    // Prepare the SQL statement for update
    $sql = "UPDATE PageCrawl 
            SET AllPageCrawlLinks = ?, ExternalLinkCount = ?, InternalLinkCount = ? 
            WHERE PageCrawlId = ?";
    $stmt = $conn->prepare($sql);

    // Check if prepare() failed
    if ($stmt === false) {
        die("Prepare failed: " . $conn->error);
    }

    // Bind parameters
    if (!$stmt->bind_param("siii", $AllPageCrawlLinksJson, $externalLinkCount, $internalLinkCount, $PageCrawlId)) {
        die("Binding parameters failed: " . $stmt->error);
    }

    // Execute the statement
    if (!$stmt->execute()) {
        die("Execute failed: " . $stmt->error);
    }

    echo "Record updated successfully";

    $stmt->close();
}


class SiteCrawlLink {
    public $URL;
    public $IsInternal;
    public $IsExternal;
    public $IsValid;
    public $StatusCode;
    public $IsAnalyzed;

    public function __construct($URL, $IsInternal, $IsExternal, $IsValid, $StatusCode, $IsAnalyzed) {
        $this->URL = $URL;
        $this->IsInternal = $IsInternal;
        $this->IsExternal = $IsExternal;
        $this->IsValid = $IsValid;
        $this->StatusCode = $StatusCode;
        $this->IsAnalyzed = $IsAnalyzed;
    }
}

function CreateAllSiteCrawlLinks() {
    // Initialize an empty array for AllSiteCrawlLinks
    $AllSiteCrawlLinks = [];

    // List of URLs to initialize - replace with actual initialization logic
    $urls = [
        'http://example.com',
        'http://example.com/about',
        'http://external.com',
        'http://example.com/contact',
        'http://example.com' // Duplicate URL for testing
    ];

    // Add URLs to the AllSiteCrawlLinks array with initial values
    foreach ($urls as $url) {
        // Check if URL is already in the array
        $urlExists = false;
        foreach ($AllSiteCrawlLinks as $link) {
            if ($link->URL === $url) {
                $urlExists = true;
                break;
            }
        }
        
        // If URL doesn't exist, add it to the array
        if (!$urlExists) {
            $isInternal = strpos($url, 'http://example.com') === 0;
            $isExternal = !$isInternal;
            $isValid = true; // Initial value, replace with actual validation logic
            $statusCode = 0; // Initial value, replace with actual status code logic
            $isAnalyzed = false; // Initial value, replace with actual analysis status

            $AllSiteCrawlLinks[] = new SiteCrawlLink($url, $isInternal, $isExternal, $isValid, $statusCode, $isAnalyzed);
        }
    }

    return $AllSiteCrawlLinks;
}


function CheckAddAllSiteCrawlLinks($AllPageCrawlLinks, &$AllSiteCrawlLinks) {
    foreach ($AllPageCrawlLinks as $pageLink) {
        $urlExists = false;

        foreach ($AllSiteCrawlLinks as $siteLink) {
            if ($siteLink->URL === $pageLink->URL) {
                $urlExists = true;
                break;
            }
        }

        if (!$urlExists) {
            $newLink = new SiteCrawlLink(
                $pageLink->URL,
                $pageLink->IsInternal,
                $pageLink->IsExternal,
                false, // IsValid
                0,     // StatusCode
                false  // IsAnalyzed
            );
            $AllSiteCrawlLinks[] = $newLink;
        }
    }
}



function UpdateAllSiteCrawlLinks($UserWebsiteCrawlId, $AllSiteCrawlLinks) {
    global $conn; // Assuming $conn is your database connection

    // Convert the array to JSON format
    $AllSiteCrawlLinksJson = json_encode($AllSiteCrawlLinks);

    // Count the number of links
    $AllSiteCrawlLinkCount = count($AllSiteCrawlLinks);

    // Prepare the SQL statement for update
    $sql = "UPDATE UserWebsiteCrawl 
            SET AllSiteCrawlLinks = ?, AllSiteCrawlLinkCount = ? 
            WHERE UserWebsiteCrawlId = ?";
    $stmt = $conn->prepare($sql);

    // Check if prepare() failed
    if ($stmt === false) {
        die("Prepare failed: " . $conn->error);
    }

    // Bind parameters
    if (!$stmt->bind_param("sii", $AllSiteCrawlLinksJson, $AllSiteCrawlLinkCount, $UserWebsiteCrawlId)) {
        die("Binding parameters failed: " . $stmt->error);
    }

    // Execute the statement
    if (!$stmt->execute()) {
        die("Execute failed: " . $stmt->error);
    }

    echo "Record updated successfully";

    $stmt->close();
}


function EditAllSiteCrawlLinkValidity($SiteCrawlLinkUrl, $StatusCode, $IsAnalyzed, &$AllSiteCrawlLinks) {
    $validStatusCodes = [200, 301, 302, 400, 403]; // Add more valid status codes as needed

    // Check if the URL is an image link or a mailto link
    $isImageLink = preg_match('/\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i', $SiteCrawlLinkUrl);
    $isMailtoLink = preg_match('/mailto:/i', $SiteCrawlLinkUrl);

    // Determine validity based on status code or if it's an image/mailto link
    $isValid = in_array($StatusCode, $validStatusCodes) || $isImageLink || $isMailtoLink;

    foreach ($AllSiteCrawlLinks as $siteCrawlLink) {
        if ($siteCrawlLink->URL === $SiteCrawlLinkUrl) {
            $siteCrawlLink->IsValid = $isValid;
            $siteCrawlLink->StatusCode = $StatusCode;
            $siteCrawlLink->IsAnalyzed = $IsAnalyzed;

            echo "<br><br>URL found in AllSiteCrawlLinks. Updated status code and validity.<br><br>";
            echo "URL: " . $siteCrawlLink->URL . "<br>";
            echo "Status Code: " . $siteCrawlLink->StatusCode . "<br>";
            echo "IsImageLink: " . ($isImageLink ? 'true' : 'false') . "<br>";
            echo "IsValid" . $isValid;
            echo "<br> Is Valid: " . ($siteCrawlLink->IsValid ? 'true' : 'false') . "<br>";
            echo "Is Analyzed: " . ($siteCrawlLink->IsAnalyzed ? 'true' : 'false') . "<br>";
            echo "<br><br>";
            echo "---------------------";
            echo "<br>";

            return; // Exit the function once the URL is found and updated
        }
    }

    echo "URL not found in AllSiteCrawlLinks.";
}


function ValidateRemainingLinks(&$AllSiteCrawlLinks) {
    // Limit the number of URLs to analyze to 500
    $maxUrlsToAnalyze = 500;

    // Collect URLs to analyze
    $urlsToAnalyze = [];
    foreach ($AllSiteCrawlLinks as $siteCrawlLink) {
        if (!$siteCrawlLink->IsAnalyzed) {
            $urlsToAnalyze[] = $siteCrawlLink->URL;
            // Break the loop if we reach the max limit
            if (count($urlsToAnalyze) >= $maxUrlsToAnalyze) {
                break;
            }
        }
    }

    // If there are no URLs to analyze, return early
    if (empty($urlsToAnalyze)) {
        return;
    }

    // Initialize cURL multi handler
    $mh = curl_multi_init();
    $handles = [];

    // Initialize individual cURL handles
    foreach ($urlsToAnalyze as $url) {
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_NOBODY, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 10);
        $handles[$url] = $ch;
        curl_multi_add_handle($mh, $ch);
    }

    // Execute the multi-cURL handler
    $running = null;
    do {
        curl_multi_exec($mh, $running);
        curl_multi_select($mh);
    } while ($running > 0);

    // Collect the status codes and update the $AllSiteCrawlLinks
    foreach ($handles as $url => $ch) {
        $statusCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        EditAllSiteCrawlLinkValidity($url, $statusCode, true, $AllSiteCrawlLinks);
        curl_multi_remove_handle($mh, $ch);
        curl_close($ch);
    }

    // Close the multi handler
    curl_multi_close($mh);
}


function checkPageCrawlBrokenLinks($UserWebsiteCrawlId, $AllSiteCrawlLinks) {
    global $conn; // Assuming $conn is your database connection

    // Prepare the SQL statement to fetch PageCrawl records
    $sql = "SELECT PageCrawlId, AllPageCrawlLinks FROM PageCrawl WHERE UserWebsiteCrawlId = ?";
    $stmt = $conn->prepare($sql);

    // Check if prepare() failed
    if ($stmt === false) {
        die("Prepare failed: " . $conn->error);
    }

    // Bind parameters
    if (!$stmt->bind_param("i", $UserWebsiteCrawlId)) {
        die("Binding parameters failed: " . $stmt->error);
    }

    // Execute the statement
    if (!$stmt->execute()) {
        die("Execute failed: " . $stmt->error);
    }

    // Bind the result to variables
    $stmt->bind_result($PageCrawlId, $AllPageCrawlLinksJson);

    // Fetch the results and store them in an array
    $pageCrawlResults = [];
    while ($stmt->fetch()) {
        $AllPageCrawlLinks = json_decode($AllPageCrawlLinksJson);
        $pageCrawlResults[] = ['PageCrawlId' => $PageCrawlId, 'AllPageCrawlLinks' => $AllPageCrawlLinks];
    }

    $stmt->close();

    // Process each PageCrawl result
    foreach ($pageCrawlResults as $result) {
        $PageCrawlId = $result['PageCrawlId'];
        $AllPageCrawlLinks = $result['AllPageCrawlLinks'];
        $insertedUrls = [];

        foreach ($AllPageCrawlLinks as $pageLink) {
            $url = $pageLink->URL;

            // Check if StatusCode property exists and set it, otherwise set a default value
            $urlStatusCode = isset($pageLink->StatusCode) ? $pageLink->StatusCode : 'Unknown';
            $urlStatusCode = strval($urlStatusCode); // Convert to string for comparison (e.g., '200' instead of 200)

            // Skip already inserted URLs for this PageCrawlId
            if (isset($insertedUrls[$url])) {
                continue;
            }

            $isBrokenLink = false;

            // Check if the URL exists in AllSiteCrawlLinks and its validity
            foreach ($AllSiteCrawlLinks as $siteCrawlLink) {
                if ($siteCrawlLink->URL === $url && !$siteCrawlLink->IsValid) {
                    $isBrokenLink = true;
                    $urlStatusCode = $siteCrawlLink->StatusCode;
                    break;
                }
            }

            // If it's a broken link, insert a page crawl item and mark the URL as inserted
            if ($isBrokenLink) {
                $issue = 'Broken Link';
                $flag = 1;
                $PageCrawlItemTypeId = GetPageCrawlItemTypeId($issue);
                if ($flag == 1) { // Assuming status code check is not needed here as it's already checked in the condition
                    try{
                        InsertPageCrawlItem($PageCrawlId, $PageCrawlItemTypeId, $urlStatusCode, $url);
                    } catch (Exception $e) {
                        // Handle the exception, log the error, or display a message
                        echo "Error: " . $e->getMessage();
                    }
                    $insertedUrls[$url] = true; // Mark this URL as inserted for this PageCrawlId
                }
                // echo "<br>----------------<br>";
                // echo $url;
                // echo "<br>";
                // echo $urlStatusCode;
                // echo "<br>----------------<br>";
            }
        }
    }
}
?>