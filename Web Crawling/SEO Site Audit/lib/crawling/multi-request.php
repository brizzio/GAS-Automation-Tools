<?php

function multiRequest($urls, &$visitedUrls) {

    require_once realpath(__DIR__ . '/../../config.php');

    $Current_Environment = getenv('ENV');

    // Allowed origins for the development environment
    $allowedDevOrigins = [
        'http://localhost',
        'https://dev.Example.com',
        'https://dev-api.Example.com'
    ];

    if ($Current_Environment == 'DEV') {
        $origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';

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
        header('Content-Security-Policy: default-src \'self\';');
        header('X-Content-Type-Options: nosniff');
        header('X-Frame-Options: SAMEORIGIN');
        header('X-XSS-Protection: 1; mode=block');
        header('Strict-Transport-Security: max-age=31536000; includeSubDomains');
    }

    $mh = curl_multi_init();
    $curlArray = [];
    $responseInformation = [];
    $responseHeaders = [];

    foreach ($urls as $url) {
        if (!in_array($url, $visitedUrls)) {
            $visitedUrls[] = $url;
            $curl = curl_init($url);
            
            // Set cURL options to mimic a real browser
            // Set cURL options to mimic a real browser
            $headers = [
                'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3',
                'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language: en-US,en;q=0.9',
                'Cache-Control: no-cache',
                'Upgrade-Insecure-Requests: 1',
            ];
            curl_setopt($curl, CURLOPT_HTTPHEADER, $headers);
            curl_setopt($curl, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($curl, CURLOPT_FOLLOWLOCATION, true);
            curl_setopt($curl, CURLOPT_HEADER, false);
            curl_setopt($curl, CURLOPT_MAXREDIRS, 5);

            // Handle headers separately
            curl_setopt($curl, CURLOPT_HEADERFUNCTION, function($curl, $header) use (&$responseHeaders, $url) {
                $len = strlen($header);
                $headerParts = explode(':', $header, 2);
                if (count($headerParts) < 2) return $len;

                $responseHeaders[$url][strtolower(trim($headerParts[0]))][] = trim($headerParts[1]);
                return $len;
            });

            curl_multi_add_handle($mh, $curl);
            $curlArray[$url] = $curl;
        }
    }

    $running = null;
    do {
        curl_multi_exec($mh, $running);
        curl_multi_select($mh);
    } while ($running > 0);

    foreach ($curlArray as $url => $curl) {
        $statusCode = curl_getinfo($curl, CURLINFO_HTTP_CODE);
        $contentType = curl_getinfo($curl, CURLINFO_CONTENT_TYPE);
        
        $responseContent = curl_multi_getcontent($curl);

        $responseInformation[$url] = [
            'statusCode' => $statusCode,
            'content' => $responseContent
        ];

        if (strtolower(pathinfo($url, PATHINFO_EXTENSION)) === 'xml' || strpos($contentType, 'xml') !== false) {
            libxml_use_internal_errors(true);
            $xml = simplexml_load_string($responseContent);
            if ($xml !== false) {
                $responseInformation[$url]['content'] = $xml;
            } else {
                $errors = libxml_get_errors();
                libxml_clear_errors();
            }
            libxml_use_internal_errors(false);
        }

        curl_multi_remove_handle($mh, $curl);
        curl_close($curl);
    }

    curl_multi_close($mh);
    return $responseInformation;
}

?>
