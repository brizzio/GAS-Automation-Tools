<?php

//TEST MODE 
//If Test mode == False, then the code will run as normal. If Test mode == True, then the code will run in test mode.
$TestMode = FALSE;
$DisplayAllLinks = FALSE;

echo "Test Mode: $TestMode<br>";
echo "<br>";
if ($TestMode == TRUE){
    echo "Test Mode is enabled. This will only crawl 15 pages.<br>";
    echo "<br>";
}

require_once $_SERVER['DOCUMENT_ROOT'] . '/config.php';

$Current_Environment = getenv('ENV');

// Allowed origins for the development environment
$allowedDevOrigins = [
    'http://localhost',
    'https://dev.Example.com',
    'https://dev-api.Example.com'
];

if ($Current_Environment == 'DEV' || $Current_Environment == 'DEV_API') {
    $origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';

    // Check if the Origin is one of the allowed origins
    if (in_array($origin, $allowedDevOrigins)) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Access-Control-Allow-Methods: POST, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type');
    }

} else if ($Current_Environment == 'STAGE') {
    header('Access-Control-Allow-Origin: https://stage.Example.com');
    header('Access-Control-Allow-Methods: POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');

} else {
    // Production-specific settings
    // Implement more restrictive CORS policy or omit CORS headers entirely if not needed
    // Optionally, you can set other security headers suitable for production environment
    header('Content-Security-Policy: default-src \'self\';');
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: SAMEORIGIN');
    header('X-XSS-Protection: 1; mode=block');
    header('Strict-Transport-Security: max-age=31536000; includeSubDomains');
    // Ensure to use HTTPS in production for all requests
}

session_start();
//header('Content-Type: application/json');

ini_set('display_errors', 1);
error_reporting(E_ALL);



//REQUIRED DATA 
if ($TestMode == TRUE){
    $UserId = 0;
} else {
    $UserId = $_SESSION['UserId'];
}


$UserWebsiteId = $_POST['UserWebsiteId'];

//delete next 2 lines after testing
//  $UserId = 0;
//  $UserWebsiteId = 692;

//REQUIRED DATA

//Basic Connection that will be needed everywhere
include $_SERVER['DOCUMENT_ROOT'] . '/connections/ExampleConnection.php';

//Crawl Functions include SQL functions
if ($TestMode == TRUE){
    include $_SERVER['DOCUMENT_ROOT'] . '/Example-api/lib/crawling/test/functions/crawl-functions.php';
} else {
    include $_SERVER['DOCUMENT_ROOT'] . '/Example-api/lib/crawling/crawl-functions.php';
}


include $_SERVER['DOCUMENT_ROOT'] . '/Example-api/lib/general/functions.php';

$baseUrl = GetUserWebsiteBaseUrl($UserWebsiteId);

$UserWebsiteCrawlId = CreateUserWebsiteCrawl($UserWebsiteId, $baseUrl, $TestMode);

$WebsiteId = GetUserWebsiteWebsiteId($UserWebsiteId);

$AllSiteCrawlLinks = CreateAllSiteCrawlLinks();
$visitedUrls = [];
$urlsToVisit = [$baseUrl];
$maxUrlsToVisit = 500; // Maximum URLs to visit
    if ($TestMode == TRUE){
        $maxUrlsToVisit = $_POST['TestCrawlPages'];
    }
$currentUrlCount = 0;






if ($TestMode == TRUE){
    //Multi-Request
    include $_SERVER['DOCUMENT_ROOT'] . '/Example-api/lib/crawling/test/functions/multi-request.php';

    //Parse Content
    //This is where the html is parsed and the issues are logged
    include $_SERVER['DOCUMENT_ROOT'] . '/Example-api/lib/crawling/test/functions/parse-html-content.php';

    include $_SERVER['DOCUMENT_ROOT'] . '/Example-api/lib/crawling/test/functions/parse-robots-content.php';

    include $_SERVER['DOCUMENT_ROOT'] . '/Example-api/lib/crawling/test/functions/parse-sitemap-content.php';

    // Helper function to normalize URLs
    include $_SERVER['DOCUMENT_ROOT'] . '/Example-api/lib/crawling/test/functions/normalize-url.php';

    //Remove Relative Path Components
    include $_SERVER['DOCUMENT_ROOT'] . '/Example-api/lib/crawling/test/functions/remove-relative-path-components.php';

    //Calculate Site Score
    include $_SERVER['DOCUMENT_ROOT'] . '/Example-api/lib/crawling/test/functions/calculate-site-score.php';
} else {
    //Multi-Request
    include $_SERVER['DOCUMENT_ROOT'] . '/Example-api/lib/crawling/multi-request.php';

    //Parse Content
    //This is where the html is parsed and the issues are logged
    include $_SERVER['DOCUMENT_ROOT'] . '/Example-api/lib/crawling/parse-html-content.php';

    include $_SERVER['DOCUMENT_ROOT'] . '/Example-api/lib/crawling/parse-robots-content.php';

    include $_SERVER['DOCUMENT_ROOT'] . '/Example-api/lib/crawling/parse-sitemap-content.php';

    //Parse Content for Text
    include $_SERVER['DOCUMENT_ROOT'] . '/Example-api/lib/crawling/parse-html-content-for-text.php';

    //Extract Keywords
    include $_SERVER['DOCUMENT_ROOT'] . '/Example-api/lib/keyword-extractor/get-keywords-from-text.php';

    // Helper function to normalize URLs
    include $_SERVER['DOCUMENT_ROOT'] . '/Example-api/lib/crawling/normalize-url.php';

    //Remove Relative Path Components
    include $_SERVER['DOCUMENT_ROOT'] . '/Example-api/lib/crawling/remove-relative-path-components.php';

    //Calculate Site Score
    include $_SERVER['DOCUMENT_ROOT'] . '/Example-api/lib/crawling/calculate-site-score.php';
}

while (!empty($urlsToVisit) and $currentUrlCount < $maxUrlsToVisit) {

    //INITIALIZE KEY PAGES - Robots.txt and Sitemap.xml
    if ($currentUrlCount <= 1){
        $robotsURL = normalizeUrl($baseUrl);
        $robotsURL = $robotsURL . "/robots.txt";
        $urlsToVisit[] = $robotsURL;
        }

    $batchUrls = array_splice($urlsToVisit, 0, 10); // Process 10 URLs at a time
    $responses = multiRequest($batchUrls, $visitedUrls);

    foreach ($responses as $url => $response) {
            echo "<br>Visited: $url<br>";
            $PageCrawlId = InsertPageCrawl($UserWebsiteCrawlId, $UserWebsiteId, $baseUrl, $url);

            //RECORD URL STATUS
            echo "Status: {$response['statusCode']}<br>"; // Echo the status code
            $statusCode = (string) $response['statusCode'];
            $PageCrawlItemTypeId = GetPageCrawlItemTypeId($statusCode);
            InsertPageCrawlItem($PageCrawlId, $PageCrawlItemTypeId, $statusCode, ' ');
            $currentUrlCount++;

            $urlInfo = pathinfo($url);

            if ($url == $robotsURL){
                //PARSE ROBOTS.TXT CONTENT
                if($statusCode == 200){
                        // Parse robots.txt content to find the sitemap URL
                        $sitemapURL = parseRobotsTxtContent($response['content']);
                        if (!empty($sitemapURL)) {
                            echo "Sitemap URL: $sitemapURL<br>";
                            $urlsToVisit[] = $sitemapURL;
                            // You can store or further process the sitemap URL here
                        } else {
                            $PageCrawlItemTypeId = GetPageCrawlItemTypeId("Sitemap Not Indicated in Robots.txt");
                            InsertPageCrawlItem($PageCrawlId, $PageCrawlItemTypeId, $statusCode, ' ');

                            echo "No sitemap URL found in robots.txt<br>";

                            $TrySitemap = normalizeUrl($baseUrl);
                            $TrySitemap = $TrySitemap . "/sitemap.xml";
                            $sitemapURL = $TrySitemap;
                            $urlsToVisit[] = $sitemapURL;
                        }

                    } else {
                        //RECORD ROBOTS.TXT ERRORS
                        $PageCrawlItemTypeId = GetPageCrawlItemTypeId("Robots.txt Not Found");
                        InsertPageCrawlItem($PageCrawlId, $PageCrawlItemTypeId, $statusCode, ' ');
                        echo "Error accessing robots.txt<br>";

                        $TrySitemap = normalizeUrl($baseUrl);
                        $TrySitemap = $TrySitemap . "/sitemap.xml";
                        $sitemapURL = $TrySitemap;
                        $urlsToVisit[] = $sitemapURL;
                    }


            } else if (isset($urlInfo['extension']) && strtolower($urlInfo['extension']) === 'xml'){
                //PARSE SITEMAP.XML CONTENT
                if($statusCode == 200){
                    // Parse robots.txt content to find the sitemap URL
                    $SitemapExtractedUrls = parseSitemapContent($response['content']);
                        // Echo each extracted URL

                        //ADD SITEMAP LINKS
                        foreach ($SitemapExtractedUrls as $SiteUrl) {
                            //echo "URL: $SiteUrl<br>";
                            if (!in_array($SiteUrl, $visitedUrls) && !in_array($SiteUrl, $urlsToVisit)) {
                                $urlsToVisit[] = $SiteUrl;
                            }
                        }

                    } else {
                        //RECORD SITEMAP.XML ERRORS
                        $PageCrawlItemTypeId = GetPageCrawlItemTypeId("Sitemap Not Found");
                        InsertPageCrawlItem($PageCrawlId, $PageCrawlItemTypeId, $statusCode, ' ');
                        echo "Error accessing Sitemap.xml<br>";
                    }


            } else {
                //PARSE HTML CONTENT
                list($internalLinks, $issues, $AllPageCrawlLinks) = parseHtmlContent($response['content'], $baseUrl, $visitedUrls, $DisplayAllLinks);

                // Display issues
                foreach ($issues as $issue => $flag) {
                    echo "$issue: $flag<br>"; // Echo issues with flags
                    
                    $PageCrawlItemTypeId = GetPageCrawlItemTypeId($issue);
                    if ($flag == 1 && $statusCode != 404){
                        InsertPageCrawlItem($PageCrawlId, $PageCrawlItemTypeId, $flag, ' ');
                    }
                }

                // Display the first 3 external links
                $externalCount = 0;
                foreach ($AllPageCrawlLinks as $link) {
                    if ($link->IsExternal) {
                        echo "External Link: " . $link->URL . "<br>";
                        $externalCount++;
                        if ($externalCount >= 3) {
                            break; // Stop after displaying 3 external links
                        }
                    }
                }

                UpdatePageCrawlLinks($PageCrawlId, $AllPageCrawlLinks);

                CheckAddAllSiteCrawlLinks($AllPageCrawlLinks, $AllSiteCrawlLinks);

                UpdateAllSiteCrawlLinks($UserWebsiteCrawlId, $AllSiteCrawlLinks);

                if ($currentUrlCount <= 5){
                    $texts = parseHtmlContentForText($response['content']);

                    // Output the texts
                    foreach ($texts as $index => $text) {
                        echo "ElementId " . ($index + 1) . ": " . htmlspecialchars($text) . "<br>";
                        $PrimaryTextBlob = $PrimaryTextBlob . " " . $text;
                    }
                }
            } 

            EditAllSiteCrawlLinkValidity($url, $statusCode, true, $AllSiteCrawlLinks);
            
            //ADD FOUND LINKS
            foreach ($internalLinks as $link) {
                if (!in_array($link, $visitedUrls) && !in_array($link, $urlsToVisit)) {
                    $urlsToVisit[] = $link;
                }
            }

            

        UpdateUserWebsiteCrawlPages($UserWebsiteCrawlId, $currentUrlCount);
        if ($currentUrlCount >= $maxUrlsToVisit) break;
    }

    

}

ValidateRemainingLinks($AllSiteCrawlLinks);

checkPageCrawlBrokenLinks($UserWebsiteCrawlId, $AllSiteCrawlLinks);

//May need to make the 1 a TRUE depending on data type..
UpdateUserWebsiteCrawlCompletionStatus($UserWebsiteCrawlId, 1);

$SiteScore = CalculateUserWebsiteCrawlSiteScore($UserWebsiteCrawlId);

UpdateUserWebsiteCrawlSiteScore($UserWebsiteCrawlId, $SiteScore, $conn);

UpdateWebsiteSiteScore($WebsiteId, $SiteScore, $conn);

echo "<br>Total visited URLs: $currentUrlCount<br>";









//================================================================
//ADDING RECOMMENDED KEYWORDS BELOW
//================================================================











echo "<br><br><br>";
$PrimaryTextBlob = removeSpecialCharacters($PrimaryTextBlob, true);
$PrimaryTextBlob = mb_substr($PrimaryTextBlob, 0, 2500);
echo "<br><br><br>";
echo "Primary Text Blob Cleaned: " . $PrimaryTextBlob . "<br>";

// Example usage:
$extractedkeywords = extractTerms($PrimaryTextBlob);

// Display the results for debugging
// Iterate over each keyword in the array
$counter = 0; // Initialize a counter variable

foreach ($extractedkeywords as $extractedkeyword) {
    if ($counter >= 15) { // Check if counter has reached 15
        break; // Exit the loop
    }

    $RowNo = $extractedkeyword['KeywordRowNumber'];
    echo "Keyword Row Number: " . $extractedkeyword['KeywordRowNumber'] . "\n";
    echo "Term: " . $extractedkeyword['Term'] . "\n";
    echo "Occurrence: " . $extractedkeyword['Occurrence'] . "\n";
    echo "Word Count: " . $extractedkeyword['WordCount'] . "\n";
    
    $KeywordId = getKeywordId($extractedkeyword['Term']);
    echo "KeywordId: " . $KeywordId . "\n";
    $InsertMessages = InsertRecommendedUserWebsiteKeyword($UserWebsiteId, $KeywordId);
    echo "Insert Messages: " . $InsertMessages . "\n";
    echo "<br>";
    
    $RelatedWebsiteKeywordId = getCreateRelatedWebsiteKeywordId($WebsiteId, $KeywordId, $RowNo);
    echo "RelatedWebsiteKeywordId: " . $RelatedWebsiteKeywordId . "\n";
    echo "<br><br>";
    echo "-----------------------------------<br>";
    echo "<br><br>";

    $counter++; // Increment the counter after processing each keyword
}

?>