<?php

class PageCrawlLink {
    public $URL;
    public $IsExternal;
    public $IsInternal;

    public function __construct($URL, $IsExternal, $IsInternal) {
        $this->URL = $URL;
        $this->IsExternal = $IsExternal;
        $this->IsInternal = $IsInternal;
    }
}

function parseHtmlContent($content, $baseUrl, &$visitedUrls, $DisplayAllLinks) {
    $internalLinks = [];
    $AllPageCrawlLinks = [];
    $dom = new DOMDocument();
    @$dom->loadHTML($content);

    $baseHref = $baseUrl; // Default base href is the base URL
    // Check if there is a <base> tag in the head and use its href as the base URL
    foreach ($dom->getElementsByTagName('base') as $base) {
        $baseHref = $base->getAttribute('href');
        break; // Only use the first <base> tag if there are multiple
    }

    foreach ($dom->getElementsByTagName('a') as $link) {

        if ($DisplayAllLinks == TRUE){
            // Echo the raw HTML code of the current "a" element
            echo htmlspecialchars($dom->saveHTML($link)) . PHP_EOL;
            echo "<br><br>";
        }

        $href = $link->getAttribute('href');
        if ($DisplayAllLinks == TRUE){
            echo "href: $href<br>";
        }
        // Ignore anchors and javascript calls
        if (strpos($href, '#') === 0 || strpos($href, 'javascript:') === 0) {
            continue;
        }
        // Convert relative link to absolute
        $href = trim($href);
        if (parse_url($href, PHP_URL_SCHEME) === null) { // No scheme, likely a relative path
            $href = rtrim($baseHref, '/') . '/' . ltrim($href, '/');
        }
        // Normalize URL and check if it's an internal link
        $href = normalizeUrl($href);

        if ($DisplayAllLinks == TRUE){
            echo "normalized href: $href<br>";
            echo "base url: $baseUrl<br>";
            echo "strpos" . strpos($href, $baseUrl) . "<br>";
        }
        $isInternal = strpos($href, $baseUrl) === 0;
        if ($isInternal && !in_array($href, $visitedUrls)) {
            $internalLinks[] = $href;
        }

        // Determine if the link is external or internal
        $isExternal = !$isInternal;

        // Add to AllPageCrawlLinks
        $AllPageCrawlLinks[] = new PageCrawlLink($href, $isExternal, $isInternal);
    }

    //========================
    //ALL ISSUES TO LOG
    //========================
    $MissingH1Tags = $dom->getElementsByTagName('h1')->length > 0 ? 0 : 1;
    $MultipleH1Headings = 0;

    $MissingCanonicalTag = 1; // Initialize canonical tag check

    $MissingH1Title = 1; // Initialize title check
    $multipleTitleTags = 0;
    $TitleTagTooLong = 0;
    $TitleTagTooShort = 0;

    $MetaDescriptionTooLong = 0;
    $MissingMetaDescription = 1;
    $multipleMetaDescriptions = 0;

    // Check for the meta description tag
    $metaDescriptionCount = 0;
    foreach ($dom->getElementsByTagName('meta') as $meta) {
        if ($meta->getAttribute('name') === 'description') {
            $metaDescriptionCount++;
            $MissingMetaDescription = 0;
            $descriptionContent = $meta->getAttribute('content');
            if (strlen($descriptionContent) > 160) {
                $MetaDescriptionTooLong = 1; // Meta description is too long
            }
            if ($metaDescriptionCount > 1) {
                $multipleMetaDescriptions = 1; // Meta description is too long
            }
            break; // No need to continue once the meta description is found
        }
    }

    // Check for the title tag
    $titles = $dom->getElementsByTagName('title');
    if ($titles->length > 0 && trim($titles->item(0)->textContent) !== '') {
        $MissingH1Title = 0;
        $titleContent = trim($titles->item(0)->textContent);
        if (strlen($titleContent) < 30) {
            $TitleTagTooShort = 1; // Title is too short
        }
        if (strlen($titleContent) > 60) {
            $TitleTagTooLong = 1; // Title is too long
        }
        if ($titles->length > 1) {
            $multipleTitleTags = 1; // Multiple title tags found
        }
    }

    // Check for multiple H1 tags
    $h1Tags = $dom->getElementsByTagName('h1');
    if ($h1Tags->length > 1) {
        $MultipleH1Headings = 1; // Multiple H1 tags found
    }

    // Check for the canonical link tag
    foreach ($dom->getElementsByTagName('link') as $link) {
        if ($link->getAttribute('rel') === 'canonical' && trim($link->getAttribute('href')) !== '') {
            $MissingCanonicalTag = 0;
            break;
        }
    }

    //All ISSUES
    $issues = [
        "Missing H1 Heading" => $MissingH1Tags,
        "Missing Meta Description" => $MissingMetaDescription,
        "Missing Title Tag" => $MissingH1Title, // Add the title issue
        "No Canonical Tag" => $MissingCanonicalTag, // Add the canonical tag issue
        "Meta Description Too Long" => $MetaDescriptionTooLong,
        "Title Tag Too Long" => $TitleTagTooLong, // Add the title too long issue
        "Title Tag Too Short" => $TitleTagTooShort, // Add the title too short issue
        "Multiple Title Tags" => $multipleTitleTags, // Add the multiple title tags issue
        "Multiple Meta Descriptions" => $multipleMetaDescriptions, // Add the multiple meta descriptions issue
        "Multiple H1 Headings" => $MultipleH1Headings, // Add the multiple H1 tags issue
    ];

    return [$internalLinks, $issues, $AllPageCrawlLinks];
}

?>