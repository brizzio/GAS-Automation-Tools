<?php

function removeRelativePathComponents($path) {
    $pathParts = explode('/', $path);
    $resolvedPathParts = [];

    foreach ($pathParts as $part) {
        if ($part == '..') {
            // Go up one directory; remove the last part if it's not empty
            if (count($resolvedPathParts) > 0 && end($resolvedPathParts) !== '') {
                array_pop($resolvedPathParts);
            }
        } elseif ($part !== '.' && $part !== '') {
            // Only add non-empty, non-current directory parts
            $resolvedPathParts[] = $part;
        }
    }

    return implode('/', $resolvedPathParts);
}

?>