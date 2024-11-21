<?php

date_default_timezone_set('America/Chicago');
set_time_limit(60); // 1 minute limit

echo date('Y-m-d H:i:s'); // Output the current date and time

function initCurlHandle($url, $userAgent) {
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_USERAGENT, $userAgent);
    curl_setopt($ch, CURLOPT_COOKIEFILE, ''); // Enable cookie handling
    curl_setopt($ch, CURLOPT_COOKIEJAR, '');  // Store cookies in the specified file
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language: en-US,en;q=0.5',
        'Referer: ' . $url // Optional: Set the referer to the URL itself
    ]);
    return $ch;
}

function multiRequest($urls, $userAgent) {
    $channel = curl_multi_init();
    $channelArray = [];
    foreach ($urls as $id => $url) {
        $ch = initCurlHandle($url, $userAgent);
        $channelArray[$id] = $ch;
        curl_multi_add_handle($channel, $ch);
    }

    $active = null;
    do {
        curl_multi_exec($channel, $active);
        curl_multi_select($channel);
    } while ($active);

    $res = [];
    foreach ($channelArray as $id => $ch) {
        $html = curl_multi_getcontent($ch);
        $res[$id] = [$urls[$id], getLinksFromHTML($html, $urls[$id])]; // Include URL in results
        curl_multi_remove_handle($channel, $ch);
        curl_close($ch);
    }

    curl_multi_close($channel);
    return $res;
}

function getLinksFromHTML($html, $base_url) {
    $internalLinks = [];
    $externalLinks = [];

    if (!$html) return [[], []];

    $doc = new DOMDocument();
    @$doc->loadHTML($html);
    $baseDomain = parse_url($base_url, PHP_URL_HOST); // Get host from base URL
    $parsedUrl = parse_url($base_url);
    $hostParts = explode('.', $parsedUrl['host']);
    $baseDomainText = $hostParts[count($hostParts) - 2];

    foreach ($doc->getElementsByTagName('a') as $link) {
        $href = $link->getAttribute('href');
        if (strpos($href, 'http') === false) {
            $href = rtrim($base_url, '/') . '/' . ltrim($href, '/');
        }

        $linkDomain = parse_url($href, PHP_URL_HOST); // Get host from href

        if ($linkDomain == $baseDomain) {
            $internalLinks[] = $href; // If domains match, it's internal
        } else if (strpos($href, $baseDomainText) !== false){
            
        } else {
            $externalLinks[] = $href; // Otherwise, it's external
        }
    }

    return [$internalLinks, $externalLinks];
}

function crawl($baseUrl, $WebsiteId) {
    $userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3';
    $visited = [];
    $internalLinks = [];
    $externalLinks = [];

    $toCrawl = [$baseUrl];

    while (!empty($toCrawl) && count($externalLinks) < 50) {
        $url = array_shift($toCrawl);
        if (in_array($url, $visited)) continue;
        $visited[] = $url;
        $result = multiRequest([$url], $userAgent);

        foreach ($result as $res) {
            list($sourceUrl, list($internal, $external)) = $res;

            foreach ($internal as $iLink) {
                if (!in_array($iLink, $internalLinks) && count($internalLinks) < 20) {
                    $internalLinks[] = $iLink;
                    if (!in_array($iLink, $toCrawl)) {
                        $toCrawl[] = $iLink;
                    }
                }
            }

            foreach ($external as $eLink) {
                if (!in_array($eLink, $externalLinks) && count($externalLinks) < 50) {
                    $externalLinks[] = $eLink;
                    // Insert into database with source URL
                    insertExternalLink($WebsiteId, $eLink, $url);
                }
            }
        }
    }

    return ['internalLinks' => $internalLinks, 'externalLinks' => $externalLinks];
}

function insertExternalLink($websiteId, $linkUrl, $sourceUrl) {
    global $conn;
    // Extract domain name and domain extension
    $parsedUrl = parse_url($linkUrl);
    $hostParts = explode('.', $parsedUrl['host']);
    $extDomainName = $hostParts[count($hostParts) - 2];
    $extDomainExt = $hostParts[count($hostParts) - 1];
    $extBaseUrl = "https://www." . $extDomainName . "." . $extDomainExt;

    // Check if the external website exists in the database
    $sql = "SELECT WebsiteId FROM Website WHERE DomainName = '$extDomainName' AND DomainExt = '$extDomainExt'";
    $result = $conn->query($sql);

    $extWebsiteId = 0;
    if ($result->num_rows > 0) {
        // If the website exists, fetch its WebsiteId
        $row = $result->fetch_assoc();
        $extWebsiteId = $row["WebsiteId"];
    } else {
        // If the website does not exist, create a new record
        $insertSql = "INSERT INTO Website (DomainName, DomainExt) VALUES ('$extDomainName', '$extDomainExt')";
        if ($conn->query($insertSql) === TRUE) {
            $extWebsiteId = $conn->insert_id;
        } else {
            echo "Error creating website record: " . $conn->error . "<br>";
            return;  // Exit if cannot create a website
        }
    }

    $LinkBaseUrl = "https://www." . $extDomainName . "." . $extDomainExt;
    // Insert the external link with all the necessary details
    $insertLinkSql = "INSERT INTO WebsiteExternalLink (WebsiteId, LinkUrl, LinkDomainName, LinkDomainExt, WebsitePageUrl, LinkBaseUrl, LinkWebsiteId) VALUES ('$websiteId', '$linkUrl', '$extDomainName', '$extDomainExt', '$sourceUrl', '$LinkBaseUrl', '$extWebsiteId')";
    if ($conn->query($insertLinkSql) === TRUE) {
        echo "New external link record created successfully.<br>";
    } else {
        echo "Error inserting external link record: " . $conn->error . "<br>";
    }

    $currentDateTime = date('Y-m-d H:i:s');
    $sql = "UPDATE Website SET LastExternalLinkCrawlDate='$currentDateTime' WHERE WebsiteId=$extWebsiteId";

    if ($conn->query($sql) === TRUE) {
    echo "Record updated successfully";
    } else {
    echo "Error updating record: " . $conn->error;
    }

}








$ConnectionsfilePath = realpath(__DIR__ . '/../db/connections/ExampleConnection.php');
echo "Resolved Connections file path: $ConnectionsfilePath<br>";
include $ConnectionsfilePath;

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

$sql = "SELECT 
            WebsiteId
            ,CONCAT(CONCAT('https://www.', DomainName), '.', DomainExt) AS BaseUrl
            ,DomainName
        FROM Website 
        ORDER BY RAND()
        LIMIT 1";
$result = $conn->query($sql);

if ($result->num_rows > 0) {
  
  // output data of each row
  while($row = $result->fetch_assoc()) {
      $WebsiteId = $row["WebsiteId"];
      $cBaseUrl = $row["BaseUrl"];
      $cDomainName = $row["DomainName"];
      
      echo "<br><br>";
      echo $WebsiteId;
      echo "<br>";
      echo $cBaseUrl;
      echo "<br><br>";
}
} else {
}

// Example usage
$baseUrl = $cBaseUrl;
$result = crawl($baseUrl, $WebsiteId);

echo "<br><br>";
echo "Internal Links:\n";
$InternalLinkCount = 0;
foreach ($result['internalLinks'] as $link) {
    echo "<br>";
    echo $InternalLinkCount.": ".$link . "\n";
    echo $InternalLinkCount ++;
}
echo "<br><br>";

echo "\nExternal Links:\n";
$ExternalLinkCount = 0;
foreach ($result['externalLinks'] as $eelink) {
    echo "<br>";
    echo $eelink;
    echo "<br><br>";
}


$stmt->close();
$conn->close();

?>