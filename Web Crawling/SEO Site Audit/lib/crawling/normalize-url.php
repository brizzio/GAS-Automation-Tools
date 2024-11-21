<?php

function normalizeUrl($url) {
    // Filter the URL to ensure it's a valid URL
    $url = filter_var($url, FILTER_SANITIZE_URL);

    // Parse the URL into its components
    $urlParts = parse_url($url);

    // If the host is set and does not start with 'www.', prepend 'www.'
    if (isset($urlParts['host']) && strpos($urlParts['host'], 'www.') !== 0) {
        $urlParts['host'] = 'www.' . $urlParts['host'];
    }

    // If the path is set and has relative path components, resolve them
    if (isset($urlParts['path'])) {
        $path = $urlParts['path'];

        // Remove any '..' and '.' from the path with realpath() if not an HTTP path
        if (filter_var($url, FILTER_VALIDATE_URL) && strpos($url, 'http') === 0) {
            $path = realpath($path) ?: $path;
        } else {
            $path = removeRelativePathComponents($path);
        }

        $urlParts['path'] = $path;
    }

    // Rebuild the URL from the resolved components
    $normalizedUrl = (isset($urlParts['scheme']) ? "{$urlParts['scheme']}://" : '') .
                     (isset($urlParts['user']) ? "{$urlParts['user']}" : '') .
                     (isset($urlParts['pass']) ? ":{$urlParts['pass']}" : '') .
                     (isset($urlParts['user']) ? "@" : '') .
                     (isset($urlParts['host']) ? "{$urlParts['host']}" : '') .
                     (isset($urlParts['port']) ? ":{$urlParts['port']}" : '') .
                     (isset($urlParts['path']) ? "{$urlParts['path']}" : '') .
                     (isset($urlParts['query']) ? "?{$urlParts['query']}" : '') .
                     (isset($urlParts['fragment']) ? "#{$urlParts['fragment']}" : '');

    return $normalizedUrl;
}

?>