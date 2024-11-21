<?php

function CalculateUserWebsiteCrawlSiteScore($UserWebsiteCrawlId) {
    // Define weights for each type of finding
    $issueWeight = 1;
    $warningWeight = 0.2;
    $noticeWeight = 0.1;

    // Include the connection file
    //----------------> Conncetion Below shouldn't be needed because it should be called first on the page on which this function is called
    //include $_SERVER['DOCUMENT_ROOT'] . '/connections/ExampleConnection.php'; 
    // Assuming $conn is accessible as a global variable or through some singleton pattern
    global $conn;
     
    try {
        // Query to fetch necessary data
        $sql = "With UserWebsiteCrawlFilter AS (
            SELECT 
            UserWebsite.WebsiteId
            ,MAX(UserWebsiteCrawlId) AS UserWebsiteCrawlId
            FROM UserWebsiteCrawl
    
            LEFT JOIN UserWebsite 
            ON UserWebsiteCrawl.UserWebsiteId = UserWebsite.UserWebsiteId
    
            WHERE UserWebsiteCrawl.Complete = TRUE 
            AND UserWebsiteCrawl.IsTest = FALSE
            AND UserWebsiteCrawl.PagesCrawled > 5 
            AND UserWebsiteCrawl.IssuesFound > 2
            AND CAST(UserWebsiteCrawl.Timestamp AS DATE) > '2024-06-05'
    
            GROUP BY UserWebsite.WebsiteId
            )
    
            ,CrawlStats as (
            SELECT DISTINCT
            UserWebsiteCrawlFilter.WebsiteId 
            ,UserWebsiteCrawlFilter.UserWebsiteCrawlId
            ,UserWebsiteCrawl.PagesCrawled
            ,COUNT(CASE PageCrawlItemType.ItemTypeStatus WHEN 'Issue' THEN 1 ELSE NULL END) as Issues
            ,COUNT(CASE PageCrawlItemType.ItemTypeStatus WHEN 'Warning' THEN 1 ELSE NULL END) as Warnings
            ,COUNT(CASE PageCrawlItemType.ItemTypeStatus WHEN 'Notice' THEN 1 ELSE NULL END) as Notices
            ,COUNT(CASE PageCrawlItemType.ItemTypeStatus WHEN 'Information' THEN 1 ELSE NULL END) as Information
            FROM UserWebsiteCrawlFilter
    
            LEFT JOIN UserWebsiteCrawl 
            ON UserWebsiteCrawlFilter.UserWebsiteCrawlId = UserWebsiteCrawl.UserWebsiteCrawlId
            
            LEFT JOIN PageCrawl 
            ON UserWebsiteCrawl.UserWebsiteCrawlId = PageCrawl.UserWebsiteCrawlId
            
            LEFT JOIN PageCrawlItem 
            ON PageCrawl.PageCrawlId = PageCrawlItem.PageCrawlId
            
            LEFT JOIN PageCrawlItemType
                ON PageCrawlItem.CrawlItemTypeId = PageCrawlItemType.PageCrawlItemTypeId
                
            GROUP BY UserWebsiteCrawlFilter.WebsiteId 
            ,UserWebsiteCrawlFilter.UserWebsiteCrawlId
            ,UserWebsiteCrawl.PagesCrawled)
    
            ,Percents as (
            SELECT 
            UserWebsiteCrawlId 
            ,WebsiteId
            ,PagesCrawled
            ,Issues
            ,Warnings
            ,Notices
            ,'--'
            ,Issues / PagesCrawled as IssueRate
            ,Warnings / PagesCrawled as WarningRate
            ,Notices / PagesCrawled as NoticeRate
            FROM CrawlStats)
    
            ,MaxMin as (
            SELECT 
            UserWebsiteCrawlId
            ,WebsiteId
            ,IssueRate
            ,WarningRate
            ,NoticeRate
            ,(SELECT(MAX(IssueRate)) as MaxIssueRate FROM Percents) as MaxIssueRate
            ,(SELECT(MIN(IssueRate)) as MaxIssueRate FROM Percents) as MinIssueRate
            ,(SELECT(MAX(WarningRate)) as MaxWarningRate FROM Percents) as MaxWarningRate
            ,(SELECT(MIN(WarningRate)) as MinWarningRate FROM Percents) as MinWarningRate
            ,(SELECT(MAX(NoticeRate)) as MaxNoticeRate FROM Percents) as MaxNoticeRate
            ,(SELECT(MIN(NoticeRate)) as MinNoticeRate FROM Percents) as MinNoticeRate
            FROM Percents
            )
    
            ,NormalizedData as (
            SELECT 
            UserWebsiteCrawlId
            ,WebsiteId
            ,MaxIssueRate
            ,MinIssueRate
            ,MaxWarningRate
            ,MinWarningRate
            ,MaxNoticeRate
            ,MinNoticeRate
            ,(IssueRate - MinIssueRate) / (MaxIssueRate - MinIssueRate) as IssueRateNorm
            ,(WarningRate - MinWarningRate) / (MaxWarningRate - MinWarningRate) as WarningRateNorm
            ,(NoticeRate - MinNoticeRate) / (MaxNoticeRate - MinNoticeRate) as NoticeRateNorm
            FROM MaxMin
            )
    
            ,Scores as (
            SELECT 
            UserWebsiteCrawlId
            ,WebsiteId
            ,MaxIssueRate
            ,MinIssueRate
            ,MaxWarningRate
            ,MinWarningRate
            ,MaxNoticeRate
            ,MinNoticeRate
            ,(COALESCE(IssueRateNorm, 0) * $issueWeight) + (COALESCE(WarningRateNorm, 0) * $warningWeight) + (COALESCE(NoticeRateNorm, 0) * $noticeWeight) as InitialScore
            FROM NormalizedData
            )
    
            SELECT DISTINCT
            MaxIssueRate
            , MinIssueRate
            , MaxWarningRate
            , MinWarningRate
            , MaxNoticeRate
            , MinNoticeRate
            ,(SELECT MIN(InitialScore) as MinScore FROM Scores) MinInitialScore
            ,(SELECT MAX(InitialScore) as MaxScore FROM Scores) MaxInitialScore
            FROM Scores";

        // Perform the query
        $result = $conn->query($sql);

        if ($result === false) {
            throw new Exception("Error executing query: " . $conn->error);
        }

        // Processing the result
        if ($result->num_rows > 0) {
            while ($row = $result->fetch_assoc()) {
                $MaxIssueRate = $row["MaxIssueRate"];
                $MinIssueRate = $row["MinIssueRate"];
                $MaxWarningRate = $row["MaxWarningRate"];
                $MinWarningRate = $row["MinWarningRate"];
                $MaxNoticeRate = $row["MaxNoticeRate"];
                $MinNoticeRate = $row["MinNoticeRate"];
                $MaxInitialScore = $row["MaxInitialScore"];
                $MinInitialScore = $row["MinInitialScore"];
            }
        } else {
            // Handle case when no rows are returned
        }
    } catch (Exception $e) {
        // Log the exception for debugging purposes
        error_log("Exception: " . $e->getMessage());

        // Handle the exception appropriately (e.g., return a default value, re-throw the exception)
        return 0; // Or any other default value you prefer
    }




    try {
        // Query to fetch necessary data
        $sql = "
            SELECT DISTINCT
                UserWebsite.WebsiteId 
                ,UserWebsiteCrawl.UserWebsiteCrawlId
                ,UserWebsiteCrawl.PagesCrawled
                ,COUNT(CASE PageCrawlItemType.ItemTypeStatus WHEN 'Issue' THEN 1 ELSE NULL END) as Issues
                ,COUNT(CASE PageCrawlItemType.ItemTypeStatus WHEN 'Warning' THEN 1 ELSE NULL END) as Warnings
                ,COUNT(CASE PageCrawlItemType.ItemTypeStatus WHEN 'Notice' THEN 1 ELSE NULL END) as Notices
            FROM UserWebsite
    
            JOIN UserWebsiteCrawl 
                ON UserWebsite.UserWebsiteId = UserWebsiteCrawl.UserWebsiteId 
                    AND UserWebsiteCrawl.UserWebsiteCrawlId = $UserWebsiteCrawlId

            LEFT JOIN PageCrawl 
            ON UserWebsiteCrawl.UserWebsiteCrawlId = PageCrawl.UserWebsiteCrawlId
            
            LEFT JOIN PageCrawlItem 
            ON PageCrawl.PageCrawlId = PageCrawlItem.PageCrawlId
            
            LEFT JOIN PageCrawlItemType
                ON PageCrawlItem.CrawlItemTypeId = PageCrawlItemType.PageCrawlItemTypeId
                
            GROUP BY UserWebsite.WebsiteId 
            ,UserWebsiteCrawl.UserWebsiteCrawlId
            ,UserWebsiteCrawl.PagesCrawled";

        // Perform the query
        $result = $conn->query($sql);

        if ($result === false) {
            throw new Exception("Error executing query: " . $conn->error);
        }

        // Processing the result
        if ($result->num_rows > 0) {
            while ($row = $result->fetch_assoc()) {
                $pagesCrawled = $row["PagesCrawled"];
                $issuesCount = $row["Issues"];
                $warningsCount = $row["Warnings"];
                $noticesCount = $row["Notices"];
            }
        } else {
            // Handle case when no rows are returned
        }
    } catch (Exception $e) {
        // Log the exception for debugging purposes
        error_log("Exception: " . $e->getMessage());

        // Handle the exception appropriately (e.g., return a default value, re-throw the exception)
        return 0; // Or any other default value you prefer
    }

    // Calculate the Rates
    $issueRate = $issuesCount / $pagesCrawled;
    $warningRate = $warningsCount / $pagesCrawled;
    $noticeRate = $noticesCount / $pagesCrawled;


    // Normalize the rates
    if ($MaxIssueRate != $MinIssueRate) {
        $issueRateNorm = ($issueRate - $MinIssueRate) / ($MaxIssueRate - $MinIssueRate);
    } else {
        $issueRateNorm = 0;
    }
    
    if ($MaxWarningRate != $MinWarningRate) {
        $warningRateNorm = ($warningRate - $MinWarningRate) / ($MaxWarningRate - $MinWarningRate);
    } else {
        $warningRateNorm = 0;
    }
    
    if ($MaxNoticeRate != $MinNoticeRate) {
        $noticeRateNorm = ($noticeRate - $MinNoticeRate) / ($MaxNoticeRate - $MinNoticeRate);
    } else {
        $noticeRateNorm = 0;
    }

    // Calculate initial score
    $initialScore = ($issueRateNorm * $issueWeight) + ($warningRateNorm * $warningWeight) + ($noticeRateNorm * $noticeWeight);
    echo "Initial Score: $initialScore<br>";

    echo "<br>MaxInitialScore: $MaxInitialScore<br>";
    echo "<br>MinInitialScore: $MinInitialScore<br>";
    // Normalize the score
    $normalizedScore = 1 - ($initialScore - $MinInitialScore) / ($MaxInitialScore - $MinInitialScore);
    echo "Normalized Score: $normalizedScore<br>";

    if ($normalizedScore < 0) {
        $normalizedScore = 0;
    } else if ($normalizedScore > 1) {
        $normalizedScore = 1;
    }

    $normalizedScore = round($normalizedScore * 100, 2);
    // Display the calculated score.
    echo "<br> Normalized Score: $normalizedScore<br>";






    //Update Site Crawl Issue Count
    // Prepare an UPDATE SQL statement
    $sql = "UPDATE UserWebsiteCrawl SET IssuesFound = ?, WarningsFound = ?, NoticesFound = ? WHERE UserWebsiteCrawlId = ?";
    
    // Prepare the SQL statement for execution
    $stmt = $conn->prepare($sql);
    if ($stmt === false) {
        throw new Exception("Error preparing statement: " . $conn->error);
    }

    // Bind the parameters to the SQL statement
    $stmt->bind_param("iiii", $issuesCount, $warningsCount, $noticesCount,  $UserWebsiteCrawlId);

    // Execute the statement
    if ($stmt->execute()) {
        // Check if any row was actually updated
        if ($stmt->affected_rows > 0) {
            // Close the prepared statement.
            $stmt->close();
            // Return true to indicate success
            //return true;
        } else {
            // Close the prepared statement.
            $stmt->close();
            // If no row was updated, return false
            //return false;
        }
    } else {
        // Close the prepared statement.
        $stmt->close();
        // Handle error - you might want to return false or throw an exception
        //return false;
    }





    return $normalizedScore;
}
?>