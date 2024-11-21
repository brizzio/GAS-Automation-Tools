
<?php
// Function to parse robots.txt content
function parseRobotsTxtContent($content) {
    $sitemapURL = '';

    // Check if the content is not empty
    if (!empty($content)) {
        // Split the content into lines
        $lines = explode("\n", $content);

        // Iterate through each line to find the sitemap URL
        foreach ($lines as $line) {
            $line = trim($line);
            if (strpos($line, 'Sitemap:') === 0) {
                // Extract the sitemap URL
                $sitemapURL = trim(substr($line, strlen('Sitemap:')));
                break; // Exit the loop once sitemap URL is found
            }
        }
    }

    return $sitemapURL;
}

?>