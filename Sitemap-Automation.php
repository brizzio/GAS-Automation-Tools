<?php

function multiCurlRequest($urls) {
    $multiCurl = curl_multi_init();
    $curlArray = [];
    $results = [];

    foreach ($urls as $i => $url) {
        $curlArray[$i] = curl_init($url);
        curl_setopt($curlArray[$i], CURLOPT_RETURNTRANSFER, true);
        curl_setopt($curlArray[$i], CURLOPT_FOLLOWLOCATION, true);
        curl_setopt($curlArray[$i], CURLOPT_HTTPHEADER, [
            'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.150 Safari/537.36',
            'Accept-Language: en-US,en;q=0.9',
        ]);
        curl_multi_add_handle($multiCurl, $curlArray[$i]);
    }

    // Execute all requests simultaneously
    $running = null;
    do {
        curl_multi_exec($multiCurl, $running);
        curl_multi_select($multiCurl);
    } while ($running > 0);

    // Collect the results
    foreach ($urls as $i => $url) {
        $results[$url] = curl_multi_getcontent($curlArray[$i]);
        curl_multi_remove_handle($multiCurl, $curlArray[$i]);
        curl_close($curlArray[$i]);
    }

    curl_multi_close($multiCurl);
    return $results;
}

function GetCurrentPageLinks($html, $baseUrl) {
    $doc = new DOMDocument();
    @$doc->loadHTML($html);
    $links = $doc->getElementsByTagName('a');
    $linkData = [];

    foreach ($links as $link) {
        $rel = $link->getAttribute('rel');
        if ($rel !== 'nofollow') {
            $href = $link->getAttribute('href');
            if (!empty($href)) {
                $absoluteUrl = resolveUrl($href, $baseUrl);
                $linkData[] = $absoluteUrl;
            }
        }
    }

    return array_unique($linkData); // Return unique links
}

function resolveUrl($relativeUrl, $baseUrl) {
    // If the URL is already absolute, return it
    if (parse_url($relativeUrl, PHP_URL_SCHEME) != '') {
        return normalizeUrl(rtrim($relativeUrl, '/'));
    }

    // Parse base URL components
    $baseParts = parse_url($baseUrl);
    $base = $baseParts['scheme'] . '://www.' . preg_replace('/^www\./', '', $baseParts['host']); // Ensure 'www' is added

    // Normalize the base path
    $basePath = isset($baseParts['path']) ? $baseParts['path'] : '';
    $basePath = rtrim($basePath, '/'); // Remove trailing slash from base path

    // Handle relative URLs starting with "/"
    if (strpos($relativeUrl, '/') === 0) {
        $absoluteUrl = $base . $relativeUrl; // Relative to the domain root
    } else {
        // Resolve relative paths, avoiding repeated segments
        $absoluteUrl = $base . '/' . trim(dirname($basePath), '/') . '/' . $relativeUrl;
    }

    // Normalize the URL path to remove any './' or '../' references
    $absoluteUrl = normalizePath($absoluteUrl);

    return normalizeUrl(rtrim($absoluteUrl, '/')); // Normalize to preferred format
}

function normalizeUrl($url) {
    // Normalize URL to use 'www' and ensure it is lowercased
    $parsedUrl = parse_url($url);
    $host = preg_replace('/^www\./', '', strtolower($parsedUrl['host'])); // Remove any existing 'www' and lowercase
    $normalizedUrl = $parsedUrl['scheme'] . '://www.' . $host; // Add 'www' consistently

    if (isset($parsedUrl['path'])) {
        $normalizedUrl .= $parsedUrl['path'];
    }

    return $normalizedUrl;
}

function normalizePath($url) {
    // Parse URL components
    $parsedUrl = parse_url($url);
    $path = isset($parsedUrl['path']) ? $parsedUrl['path'] : '';

    // Explode the path into segments and handle '.' and '..'
    $segments = explode('/', $path);
    $resolvedSegments = [];

    foreach ($segments as $segment) {
        if ($segment == '' || $segment == '.') {
            continue; // Skip empty or current directory references
        }
        if ($segment == '..') {
            if (!empty($resolvedSegments)) {
                array_pop($resolvedSegments); // Navigate up one directory level
            }
        } else {
            $resolvedSegments[] = $segment; // Add valid segment
        }
    }

    // Reconstruct the normalized path
    $normalizedPath = implode('/', $resolvedSegments);

    // Rebuild the complete URL
    $normalizedUrl = $parsedUrl['scheme'] . '://' . $parsedUrl['host'] . '/' . $normalizedPath;

    return $normalizedUrl;
}

function calculatePriority($depth) {
    // Calculate priority dynamically using a logarithmic function
    $minPriority = 0.1;
    $maxPriority = 1.0;
    // Smaller base makes the curve MORE steep (try 2, 2.5, etc.)
    $priority = $maxPriority - log($depth + 1, 50); // Use logarithm base 10 
    $priority = max($minPriority, min($priority, $maxPriority)); // Clamp priority within range

    return number_format($priority, 4); // Format to 4 decimal places for sitemap standard
}

$BaseSite = "example.com";
$BaseUrl = "https://www.example.com";
$maxIterations = 500;
$iteration = 0;
$UrlsToCrawl = [$BaseUrl];
$Visited = [];
$IncludedOnSitemap = [];
$DepthMap = [$BaseUrl => 0]; // Store depth of each URL

$sitemap = new DOMDocument('1.0', 'UTF-8');
$sitemap->formatOutput = true;
$urlset = $sitemap->createElement('urlset');
$urlset->setAttribute('xmlns', 'http://www.sitemaps.org/schemas/sitemap/0.9');
$urlset->setAttribute('xmlns:xhtml', 'http://www.w3.org/1999/xhtml');
$sitemap->appendChild($urlset);

while (!empty($UrlsToCrawl) && $iteration < $maxIterations) {
    $CurrentBatch = array_slice($UrlsToCrawl, 0, 5); // Process 5 URLs at a time
    $responses = multiCurlRequest($CurrentBatch);

    foreach ($responses as $CurrentUrl => $html) {
        echo "Current: " . $iteration . "<br>";
        echo "Visiting: " . $CurrentUrl . "<br><br>";

        $NewLinks = GetCurrentPageLinks($html, $CurrentUrl);
        $NewLinks = array_diff($NewLinks, $Visited);
        $NewLinks = array_values($NewLinks);

        foreach ($NewLinks as $New) {
            $New = normalizeUrl($New); // Normalize to preferred format
            echo "Found: " . $New . "<br>";

            // Check if URL is valid
            if (!filter_var($New, FILTER_VALIDATE_URL)) {
                echo "Invalid URL format: " . $New . "<br>";
                continue;
            }

            // Check if URL matches the base site
            if (strpos(parse_url($New, PHP_URL_HOST), $BaseSite) === false) {
                echo "External URL, not adding: " . $New . "<br>";
                continue;
            }

            // Check if URL already visited or queued
            if (in_array($New, $UrlsToCrawl) || in_array($New, $Visited)) {
                echo "Already in crawl queue or visited: " . $New . "<br>";
                continue;
            }

            // Add to crawl queue
            $UrlsToCrawl[] = $New;
            $DepthMap[$New] = $DepthMap[$CurrentUrl] + 1; // Increment depth
            echo "Added to Crawl: " . $New . " at depth " . $DepthMap[$New] . "<br>";
        }

        // Process canonical URLs (if needed) and update sitemap
        $CanUrl = NULL; // Replace with canonical URL retrieval logic if required

        echo "Include on Sitemap:<br>";
        $SitemapUrl = normalizeUrl($CurrentUrl); // Normalize to preferred format
        if ($CanUrl !== NULL) {
            $SitemapUrl = normalizeUrl($CanUrl);
        }

        if (in_array($SitemapUrl, $IncludedOnSitemap)) {
            echo "**Already on Sitemap** " . $SitemapUrl . "<br>";
        } else {
            echo $SitemapUrl . "<br>";
            $IncludedOnSitemap[] = $SitemapUrl;

            // Calculate priority based on depth
            $depth = isset($DepthMap[$SitemapUrl]) ? $DepthMap[$SitemapUrl] : 0;
            $priority = calculatePriority($depth);

            // Create <url> element for the sitemap
            $urlElement = $sitemap->createElement('url');
            $locElement = $sitemap->createElement('loc', $SitemapUrl);
            $urlElement->appendChild($locElement);

            $dateTime = new DateTime();
            $dateTimeString = $dateTime->format('Y-m-d\TH:i:sP');
            $lastModElement = $sitemap->createElement('lastmod', $dateTimeString);
            $urlElement->appendChild($lastModElement);

            $changeFreqElement = $sitemap->createElement('changefreq', 'daily');
            $urlElement->appendChild($changeFreqElement);

            $priorityElement = $sitemap->createElement('priority', $priority);
            $urlElement->appendChild($priorityElement);

            $urlset->appendChild($urlElement);
        }

        $Visited[] = $CurrentUrl;
        echo "<br>--------------<br><br>";

        $iteration++;
    }

    $UrlsToCrawl = array_diff($UrlsToCrawl, $Visited);
    $UrlsToCrawl = array_values($UrlsToCrawl);
}

if ($sitemap->save(__DIR__ . '/sitemap.xml')) {
    echo "Sitemap saved successfully.";
} else {
    echo "Failed to save sitemap.";
}


echo "--------------" . PHP_EOL . PHP_EOL;
echo "--------------" . PHP_EOL . PHP_EOL;

?>
