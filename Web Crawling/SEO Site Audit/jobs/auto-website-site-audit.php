<?php
set_time_limit(60); // 1 minute limit
ini_set('display_errors', 1);
error_reporting(E_ALL);
//TEST MODE 
//If Test mode == False, then the code will run as normal. If Test mode == True, then the code will run in test mode.
$TESTMODE = FALSE;
$DISPLAYALLLINKS = FALSE;

echo "Test Mode: $TESTMODE<br>";
echo "<br>";
if ($TESTMODE == TRUE){
    echo "Test Mode is enabled. This will only crawl 15 pages.<br>";
    echo "<br>";
}

// Include the second connection file
$ConnectionsfilePath = realpath(__DIR__ . '/../db/connections/ExampleConnection.php');
echo "Resolved Connections file path: $ConnectionsfilePath<br>";
include $ConnectionsfilePath;


$FunctionsFilePath = realpath(__DIR__ . '/../lib/general/functions.php');
echo "Resolved Functions file path: $FunctionsFilePath<br>";
include $FunctionsFilePath;

//$CreateFunctionsFilePath = realpath(__DIR__ . '/../lib/general/functions.php');
//echo "Resolved Functions file path: $FunctionsFilePath<br>";
//include $CreateFunctionsFilePath;


$CurrentApiEnvironment = getCurrentApiEnvironment();
echo "Current API Environment: $CurrentApiEnvironment<br>";
IF ($CurrentApiEnvironment != 'PROD' && $CurrentApiEnvironment != 'STAGE') {
}



$Current_Environment = $CurrentApiEnvironment;

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
if ($TESTMODE == TRUE){
    $USERID = 0;
} else {
    $USERID = 0;
}
//$USERWEBSITEID = 292;

$WEBSITEID = getRandomWebsiteId();
echo "<br>RandomWebsiteId: $WEBSITEID<br>";

$USERWEBSITEID = getCreateAutoUserWebsite($WEBSITEID);
echo "<br>UserWebsiteId: $USERWEBSITEID<br>";
//$USERWEBSITEID = $_POST['UserWebsiteId'];

//REQUIRED DATA


//Crawl Functions include SQL functions
if ($TESTMODE == TRUE){
    // Include the second connection file
    $CrawlFunctionsfilePath = realpath(__DIR__ . '/../lib/crawling/test/functions/crawl-functions.php');
    echo "Resolved Connections file path: $CrawlFunctionsfilePath<br>";
    include $CrawlFunctionsfilePath;
} else {
    $CrawlFunctionsfilePath = realpath(__DIR__ . '/../lib/crawling/crawl-functions.php');
    echo "Resolved Connections file path: $CrawlFunctionsfilePath<br>";
    include $CrawlFunctionsfilePath;
}

$USERWEBSITECRAWLID = CreateAutoWebsiteUserWebsiteCrawl($USERWEBSITEID, $TESTMODE);
echo "<br>UserWebsiteCrawlId: $USERWEBSITECRAWLID<br>";

$BASEURL = GetUserWebsiteBaseUrl($USERWEBSITEID);
echo "<br>Base URL: $BASEURL<br>";

//$WEBSITEID = GetUserWebsiteWebsiteId($USERWEBSITEID);

$AllSiteCrawlLinks = CreateAllSiteCrawlLinks();
$VISITEDURLS = [];
$URLSTOVISIT = [$BASEURL];
$MAXURLSTOVISIT = 50; // Maximum URLs to visit
    if ($TESTMODE == TRUE){
        $MAXURLSTOVISIT = $_POST['TestCrawlPages'];
    }
$CURRENTURLCOUNT = 0;






if ($TESTMODE == TRUE){
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
    include realpath(__DIR__ . '/../lib/crawling/multi-request.php');

    //Parse Content
    //This is where the html is parsed and the issues are logged
    include realpath(__DIR__ . '/../lib/crawling/parse-html-content.php');

    include realpath(__DIR__ . '/../lib/crawling/parse-robots-content.php');

    include realpath(__DIR__ . '/../lib/crawling/parse-sitemap-content.php');

    //Parse Content for Text
    include realpath(__DIR__ . '/../lib/crawling/parse-html-content-for-text.php');

    //Extract Keywords
    include realpath(__DIR__ . '/../lib/keyword-extractor/get-keywords-from-text.php');

    // Helper function to normalize URLs
    include realpath(__DIR__ . '/../lib/crawling/normalize-url.php');

    //Remove Relative Path Components
    include realpath(__DIR__ . '/../lib/crawling/remove-relative-path-components.php');

    //Calculate Site Score
    include realpath(__DIR__ . '/../lib/crawling/calculate-site-score.php');
}

 while (!empty($URLSTOVISIT) and $CURRENTURLCOUNT < $MAXURLSTOVISIT) {

     //INITIALIZE KEY PAGES - ROBOTS.TXT AND SITEMAP.XML
     IF ($CURRENTURLCOUNT <= 1){
         $ROBOTSURL = NORMALIZEURL($BASEURL);
         $ROBOTSURL = $ROBOTSURL . "/ROBOTS.TXT";
         $URLSTOVISIT[] = $ROBOTSURL;
         }

     $BATCHURLS = ARRAY_SPLICE($URLSTOVISIT, 0, 10); // PROCESS 10 URLS AT A TIME
     $RESPONSES = MULTIREQUEST($BATCHURLS, $VISITEDURLS);

    FOREACH ($RESPONSES AS $URL => $RESPONSE) {
            ECHO "<BR>VISITED: $URL<BR>";
            $PAGECRAWLID = INSERTPAGECRAWL($USERWEBSITECRAWLID, $USERWEBSITEID, $BASEURL, $URL);

            //RECORD URL STATUS
            ECHO "STATUS: {$RESPONSE['statusCode']}<BR>"; // ECHO THE STATUS CODE
            $STATUSCODE = (STRING) $RESPONSE['statusCode'];
            echo "<br>".$STATUSCODE."<br>";
            $PAGECRAWLITEMTYPEID = GETPAGECRAWLITEMTYPEID($STATUSCODE);
            INSERTPAGECRAWLITEM($PAGECRAWLID, $PAGECRAWLITEMTYPEID, $STATUSCODE, ' ');
             $CURRENTURLCOUNT++;

            $URLINFO = PATHINFO($URL);

            IF ($URL == $ROBOTSURL){
                //PARSE ROBOTS.TXT CONTENT
                IF($STATUSCODE == 200){
                        // PARSE ROBOTS.TXT CONTENT TO FIND THE SITEMAP URL
                        $SITEMAPURL = PARSEROBOTSTXTCONTENT($RESPONSE['content']);
                        IF (!EMPTY($SITEMAPURL)) {
                            ECHO "SITEMAP URL: $SITEMAPURL<BR>";
                            $URLSTOVISIT[] = $SITEMAPURL;
                            // YOU CAN STORE OR FURTHER PROCESS THE SITEMAP URL HERE
                        } ELSE {
                            $PAGECRAWLITEMTYPEID = GETPAGECRAWLITEMTYPEID("SITEMAP NOT INDICATED IN ROBOTS.TXT");
                            INSERTPAGECRAWLITEM($PAGECRAWLID, $PAGECRAWLITEMTYPEID, $STATUSCODE, ' ');

                            ECHO "NO SITEMAP URL FOUND IN ROBOTS.TXT<BR>";

                            $TRYSITEMAP = NORMALIZEURL($BASEURL);
                            $TRYSITEMAP = $TRYSITEMAP . "/SITEMAP.XML";
                            $SITEMAPURL = $TRYSITEMAP;
                            $URLSTOVISIT[] = $SITEMAPURL;
                        }
                    } ELSE {
                        //RECORD ROBOTS.TXT ERRORS
                        $PAGECRAWLITEMTYPEID = GETPAGECRAWLITEMTYPEID("ROBOTS.TXT NOT FOUND");
                        INSERTPAGECRAWLITEM($PAGECRAWLID, $PAGECRAWLITEMTYPEID, $STATUSCODE, ' ');
                        ECHO "ERROR ACCESSING ROBOTS.TXT<BR>";

                        $TRYSITEMAP = NORMALIZEURL($BASEURL);
                        $TRYSITEMAP = $TRYSITEMAP . "/SITEMAP.XML";
                        $SITEMAPURL = $TRYSITEMAP;
                        $URLSTOVISIT[] = $SITEMAPURL;
                    }


            } ELSE IF (ISSET($URLINFO['EXTENSION']) && STRTOLOWER($URLINFO['EXTENSION']) === 'XML'){
                //PARSE SITEMAP.XML CONTENT
                IF($STATUSCODE == 200){
                    // PARSE ROBOTS.TXT CONTENT TO FIND THE SITEMAP URL
                    $SITEMAPEXTRACTEDURLS = PARSESITEMAPCONTENT($RESPONSE['content']);
                        // ECHO EACH EXTRACTED URL

                        //ADD SITEMAP LINKS
                        FOREACH ($SITEMAPEXTRACTEDURLS AS $SITEURL) {
                            //ECHO "URL: $SITEURL<BR>";
                            IF (!IN_ARRAY($SITEURL, $VISITEDURLS) && !IN_ARRAY($SITEURL, $URLSTOVISIT)) {
                                $URLSTOVISIT[] = $SITEURL;
                            }
                        }

                    } ELSE {
                        //RECORD SITEMAP.XML ERRORS
                        $PAGECRAWLITEMTYPEID = GETPAGECRAWLITEMTYPEID("SITEMAP NOT FOUND");
                        INSERTPAGECRAWLITEM($PAGECRAWLID, $PAGECRAWLITEMTYPEID, $STATUSCODE, ' ');
                        ECHO "ERROR ACCESSING SITEMAP.XML<BR>";
                    }


            } ELSE {
                //PARSE HTML CONTENT
                LIST($INTERNALLINKS, $ISSUES, $AllPageCrawlLinks) = PARSEHTMLCONTENT($RESPONSE['content'], $BASEURL, $VISITEDURLS, $DISPLAYALLLINKS);

                FOREACH ($ISSUES AS $ISSUE => $FLAG) {
                    ECHO "$ISSUE: $FLAG<BR>"; // ECHO ISSUES WITH FLAGS
                    
                    $PAGECRAWLITEMTYPEID = GETPAGECRAWLITEMTYPEID($ISSUE);
                    IF ($FLAG == 1 && $STATUSCODE != 404){
                    INSERTPAGECRAWLITEM($PAGECRAWLID, $PAGECRAWLITEMTYPEID, $FLAG, ' ');
                    }
                    
                }

                UpdatePageCrawlLinks($PAGECRAWLID, $AllPageCrawlLinks);

                CheckAddAllSiteCrawlLinks($AllPageCrawlLinks, $AllSiteCrawlLinks);

                UpdateAllSiteCrawlLinks($USERWEBSITECRAWLID, $AllSiteCrawlLinks);

                IF ($CURRENTURLCOUNT <= 5){
                    $TEXTS = PARSEHTMLCONTENTFORTEXT($RESPONSE['content']);

                    // OUTPUT THE TEXTS
                    FOREACH ($TEXTS AS $INDEX => $TEXT) {
                        ECHO "ELEMENTID " . ($INDEX + 1) . ": " . HTMLSPECIALCHARS($TEXT) . "<BR>";
                        $PRIMARYTEXTBLOB = $PRIMARYTEXTBLOB . " " . $TEXT;
                    }
                }
            } 
            
            EditAllSiteCrawlLinkValidity($URL, $STATUSCODE, true, $AllSiteCrawlLinks);

            //ADD FOUND LINKS
            FOREACH ($INTERNALLINKS AS $LINK) {
                IF (!IN_ARRAY($LINK, $VISITEDURLS) && !IN_ARRAY($LINK, $URLSTOVISIT)) {
                    $URLSTOVISIT[] = $LINK;
                }
            }

            

        UPDATEUSERWEBSITECRAWLPAGES($USERWEBSITECRAWLID, $CURRENTURLCOUNT);
         IF ($CURRENTURLCOUNT >= $MAXURLSTOVISIT) BREAK;
    }

 }

ValidateRemainingLinks($AllSiteCrawlLinks);

checkPageCrawlBrokenLinks($USERWEBSITECRAWLID, $AllSiteCrawlLinks);

//MAY NEED TO MAKE THE 1 A TRUE DEPENDING ON DATA TYPE.
UPDATEUSERWEBSITECRAWLCOMPLETIONSTATUS($USERWEBSITECRAWLID, 1);

$SITESCORE = CALCULATEUSERWEBSITECRAWLSITESCORE($USERWEBSITECRAWLID);

echo "<br>Site Score:". $SITESCORE."<br>";

UPDATEUSERWEBSITECRAWLSITESCORE($USERWEBSITECRAWLID, $SITESCORE, $conn);

UpdateWebsiteSiteScore($WEBSITEID, $SITESCORE, $conn);

echo "<br>Site Score:". $SITESCORE."<br>";

echo "<br>Total visited URLs: $CURRENTURLCOUNT<br>";

?>