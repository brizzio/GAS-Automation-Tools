<?php

$baseSite = "Example.com";
$baseUrl = "https://www.Example.com";
$concurrencyLevel = 5; // Number of concurrent requests. Adjust based on your server's capability and target site's policy.
$maxIterations = 500;

$urlsToCrawl = [$baseUrl];
$visited = [];
$includedOnSitemap = [];

// Initialize XML sitemap structure
$sitemap = new DOMDocument('1.0', 'UTF-8');
$sitemap->formatOutput = true;
$urlset = $sitemap->createElement('urlset');
$urlset->setAttribute('xmlns', 'http://www.sitemaps.org/schemas/sitemap/0.9');
$sitemap->appendChild($urlset);

$iteration = 0; // Initialize iteration counter
while (!empty($urlsToCrawl) && count($visited) < $maxIterations) {
    $currentBatch = array_splice($urlsToCrawl, 0, $concurrencyLevel);
    $multiCurl = curl_multi_init();
    $curlArray = [];

    // Initialize and add cURL handles for concurrent execution
    foreach ($currentBatch as $url) {
        if (!in_array($url, $visited)) {
            $curl = initCurl($url);
            curl_multi_add_handle($multiCurl, $curl);
            $curlArray[$url] = $curl;
        }
    }

    // Execute the batch of cURL handles
    do {
        curl_multi_exec($multiCurl, $active);
    } while ($active);

    // Process the responses
    foreach ($curlArray as $url => $curl) {
        $response = curl_multi_getcontent($curl);
        if ($response) {
            $newLinks = getCurrentPageLinksFromResponse($response, $url);
            foreach ($newLinks as $newLink) {
                $absoluteUrl = makeAbsoluteUrl($newLink, $baseUrl);
                if (!in_array($absoluteUrl, $visited) && strpos($absoluteUrl, $baseSite) !== false) {
                    $urlsToCrawl[] = $absoluteUrl;
                }
            }
            $visited[] = $url;
            processUrlForSitemap($url, $sitemap, $urlset, $includedOnSitemap, $iteration);
        }
        curl_multi_remove_handle($multiCurl, $curl);
        curl_close($curl);
    }

    curl_multi_close($multiCurl);
    $iteration ++;
}

// Save the sitemap at the end of your script
$sitemapPath = $_SERVER['DOCUMENT_ROOT'] . '/sitemap.xml'; // Define the full path
$sitemap->save($sitemapPath); // Save the sitemap

function initCurl($url) {
    $curl = curl_init($url);
    curl_setopt($curl, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($curl, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($curl, CURLOPT_HTTPHEADER, [
        'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.150 Safari/537.36',
        'Accept-Language: en-US,en;q=0.9',
    ]);
    return $curl;
}

function getCurrentPageLinksFromResponse($response, $baseUrl) {
    $doc = new DOMDocument();
    @$doc->loadHTML($response);

    // Remove script elements from the document
    while (($script = $doc->getElementsByTagName('script')->item(0))) {
        $script->parentNode->removeChild($script);
    }

    $links = $doc->getElementsByTagName('a');
    $linkData = [];

    foreach ($links as $link) {
        $href = $link->getAttribute('href');
        // Continue with your existing logic to filter and process links...
        if ($href && !preg_match('/^(#|javascript:|mailto:|tel:)/i', $href)) {
            $linkData[] = makeAbsoluteUrl($href, $baseUrl);
        }
    }

    return $linkData;
}


function makeAbsoluteUrl($url, $base) {
    // Ensure the base URL uses 'www.'
    $base = ensureWww($base);

    // Check if the URL is already absolute
    if (parse_url($url, PHP_URL_SCHEME) != '') {
        $url = ensureWww($url);
        return rtrim($url, '/');
    }

    // Parse base URL and construct a new absolute URL
    $parsedBase = parse_url($base);

    // Remove any '..' and excessive '/' from the path
    $path = array_filter(explode('/', $url), function($value) { return $value != '..'; });
    $normalizedPath = implode('/', $path);

    // Construct the absolute URL
    $absoluteUrl = $parsedBase['scheme'] . '://' . $parsedBase['host'] . '/' . ltrim($normalizedPath, '/');

    // Normalize the URL to remove the trailing slash if it's not the root
    if ($absoluteUrl != $parsedBase['scheme'] . '://' . $parsedBase['host'] . '/') {
        $absoluteUrl = rtrim($absoluteUrl, '/');
    }

    return $absoluteUrl;
}

function ensureWww($url) {
    $parsedUrl = parse_url($url);

    if (!isset($parsedUrl['host'])) {
        // Handle the case where 'host' is not defined, possibly by logging or skipping the URL
        return $url; // Return the original URL or handle this case as needed
    }

    if (substr($parsedUrl['host'], 0, 4) !== 'www.') {
        $parsedUrl['host'] = 'www.' . $parsedUrl['host'];
    }

    // Rebuild the URL
    $scheme = isset($parsedUrl['scheme']) ? $parsedUrl['scheme'] . '://' : '';
    $host = isset($parsedUrl['host']) ? $parsedUrl['host'] : '';
    $port = isset($parsedUrl['port']) ? ':' . $parsedUrl['port'] : '';
    $user = isset($parsedUrl['user']) ? $parsedUrl['user'] : '';
    $pass = isset($parsedUrl['pass']) ? ':' . $parsedUrl['pass']  : '';
    $pass = ($user || $pass) ? "$pass@" : '';
    $path = isset($parsedUrl['path']) ? $parsedUrl['path'] : '';
    $query = isset($parsedUrl['query']) ? '?' . $parsedUrl['query'] : '';
    $fragment = isset($parsedUrl['fragment']) ? '#' . $parsedUrl['fragment'] : '';

    return "$scheme$user$pass$host$port$path$query$fragment";
}

function processUrlForSitemap($url, $sitemap, $urlset, &$includedOnSitemap, $iteration) {
    if (in_array($url, $includedOnSitemap)) {
        return;
    }

    $includedOnSitemap[] = $url;
    $urlElement = $sitemap->createElement('url');
    $locElement = $sitemap->createElement('loc', htmlspecialchars($url));
    $urlElement->appendChild($locElement);

    // Add lastmod element with the current timestamp
    $lastmodElement = $sitemap->createElement('lastmod', date('c')); // 'c' format will generate the ISO 8601 date
    $urlElement->appendChild($lastmodElement);

    // Add changefreq element
    $changefreqElement = $sitemap->createElement('changefreq', 'daily');
    $urlElement->appendChild($changefreqElement);

    // Calculate and add priority based on the iteration
    $priority = calculatePriority($iteration);
    $priorityElement = $sitemap->createElement('priority', $priority);
    $urlElement->appendChild($priorityElement);

    $urlset->appendChild($urlElement);
}

function calculatePriority($iteration) {
    if ($iteration == 0) { // Assuming the first iteration is for the homepage
        return '1.0000';
    } elseif ($iteration < 10) {
        return '0.9500';
    } elseif ($iteration < 30) {
        return '0.8000';
    } elseif ($iteration < 60) {
        return '0.7500';
    } elseif ($iteration < 100) {
        return '0.6500';
    } elseif ($iteration < 150) {
        return '0.4500';
    } elseif ($iteration < 200) {
        return '0.1550';
    } else {
        return '0.0850';
    }
}

?>