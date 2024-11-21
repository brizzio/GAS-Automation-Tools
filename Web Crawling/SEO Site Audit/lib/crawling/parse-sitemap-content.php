<?php 

// Function to parse sitemap XML content and extract URLs
function parseSitemapContent($sitemapContent) {
    // Attempt to load the XML content
    $Extractedurls = [];

    // Check if the sitemap XML has 'url' elements
    if (isset($sitemapContent->url)) {
        // Iterate over each 'url' element
        foreach ($sitemapContent->url as $urlEntry) {
            // Check if 'loc' element exists within 'url'
            if (isset($urlEntry->loc)) {
                // Cast the SimpleXMLElement to a string to get the URL text
                $Extractedurls[] = (string)$urlEntry->loc;
            }
        }
    }

    return $Extractedurls;
}

?>