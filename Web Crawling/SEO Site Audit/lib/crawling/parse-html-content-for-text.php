<?php 

function parseHtmlContentForText($content) {
    $dom = new DOMDocument();
    @$dom->loadHTML($content);

    $elementTexts = []; // Array to store texts of elements

    // Define the elements to extract text from
    //$elementsToExtract = ['title', 'meta', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p'];
    $elementsToExtract = ['meta', 'p'];

    $counter = 0; // Initialize the counter outside of the loops
    
    foreach ($elementsToExtract as $tagName) {
        // Check if total iterations have reached 100 before processing a new tag
        if ($counter >= 100) {
            break; // Exit the outer loop
        }
    
        $elements = $dom->getElementsByTagName($tagName);
    
        foreach ($elements as $element) {
            if ($counter >= 100) { // Check if total iterations have reached 100
                break; // Exit the inner loop
            }
    
            // Special handling for meta description
            if ($tagName == 'meta' && $element->getAttribute('name') == 'description') {
                $elementTexts[] = $element->getAttribute('content');
            } elseif ($tagName != 'meta') { // Handle other tags
                $elementTexts[] = trim($element->textContent);
            }
    
            $counter++; // Increment the counter after processing each element
        }
    }

    return $elementTexts;
}

?>