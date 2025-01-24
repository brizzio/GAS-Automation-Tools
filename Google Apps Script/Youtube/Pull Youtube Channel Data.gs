/*****************************************************
 * MAIN FUNCTION
 *****************************************************/
function getYoutubeChannels() {
  // 1) REFERENCE THE BOUND SPREADSHEET
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

  // 2) CHECK IF "YouTube Data" SHEET EXISTS; CREATE IF NOT
  let sheet = spreadsheet.getSheetByName("YouTube Data");
  if (!sheet) {
    sheet = spreadsheet.insertSheet("YouTube Data");
    // Optionally add headers
    sheet.appendRow([
      'Channel ID',
      'Channel Name',
      'Description',
      'Subscriber Count',
      'Video Count',
      'Email',
      'Channel URL'
    ]);
  }
  
  // 3) PROPERTIES FOR PAGINATION / SAVING STATE
  const scriptProperties   = PropertiesService.getScriptProperties();
  let savedPageToken       = scriptProperties.getProperty('NEXT_PAGE_TOKEN') || '';
  let currentQueryIndex    = Number(scriptProperties.getProperty('CURRENT_QUERY_INDEX') || 0);
  
  // 4) SEARCH QUERIES / KEYWORDS
  const MAX_API_CALLS  = 6;
  const PAGES_TO_FETCH = 1;
  
  /*
    Below are example queries focusing on "Gardening" topics. 
    Adjust them as needed for your niche.
  */
  const SEARCH_QUERIES = [
    '"backyard gardening"',
    '"organic gardening"',
    '"container gardening"',
    '"indoor plants"',
    '"houseplants"',
    '"landscaping"',
    '"garden design"',
    '"composting"',
    '"urban gardening"'
  ].map(q => q.toLowerCase());

  /*
    INITIAL_KEYWORDS:
    Only channels whose short "search snippet" includes these 
    will receive a further detailed Channel API call.
  */
  const INITIAL_KEYWORDS = [
    'garden',
    'gardening',
    'horticulture'
  ].map(k => k.toLowerCase());

  /*
    INCLUDE_KEYWORDS:
    If at least one of these is found in the channel's 
    full/long description (or channel name), we include it.
  */
  const INCLUDE_KEYWORDS = [
    'organic gardening',
    'urban gardening',
    'landscaping',
    'indoor plants',
    'houseplants'
  ].map(k => k.toLowerCase());

  /*
    EXCLUDE_KEYWORDS:
    If the short snippet has any of these, we skip the channel entirely.
    Adjust as needed for your niche to exclude irrelevant channels.
  */
  const EXCLUDE_KEYWORDS = [
    'gaming',
    'gameplay',
    'funny',
    'meme',
    'music',
    'robotics',
    'cars',
    'sports'
  ].map(k => k.toLowerCase());
  

  // 5) LOAD EXISTING CHANNELS INTO A MAP
  const existingData = sheet.getDataRange().getValues();  // 2D array
  // store channelId → rowIndex for quick look-up
  const existingChannels = new Map();
  for (let i = 1; i < existingData.length; i++) {
    const row = existingData[i];
    const channelId = row[0];  // first column in each row
    if (channelId) {
      existingChannels.set(channelId, i + 1); // 1-based row index
    }
  }

  Logger.log(`Starting search with query: ${SEARCH_QUERIES[currentQueryIndex]}`);
  Logger.log(`Starting with saved page token: ${savedPageToken}`);
  
  let apiCallCount = 0;
  let allItems     = [];
  let pageToken    = savedPageToken;

  /*****************************************************
   * (A) SEARCH FOR CHANNELS
   *****************************************************/
  for (let page = 0; page < PAGES_TO_FETCH; page++) {
    apiCallCount++;
    Logger.log(`Making search API call for page ${page + 1}`);

    // Common Topic IDs (optional to refine search):
    //
    // /m/04rlf    => Music
    // /m/02mscn   => Sports
    // /m/06ntj    => Movies
    // /m/0kt51    => Entertainment
    // /m/09s1f    => Autos & Vehicles
    // /m/07c1v    => Technology
    // /m/098wr    => Business
    // /m/0bzvm2   => Comedy
    // /m/07bxq    => Travel
    // /m/04gxy    => People & Society
    // /m/01k8wb   => Finance
    // /m/05qt0    => Nonprofits & Activism
    // ... etc.

    // Prepare search params
    const searchParams = {
      q: SEARCH_QUERIES[currentQueryIndex],
      type: 'channel',
      regionCode: 'US',
      relevanceLanguage: 'en',
      // topicId: '/m/07bxq', // Example: restricting to travel. Adjust or remove as needed.
      maxResults: 50
    };
    if (pageToken) {
      searchParams.pageToken = pageToken;
    }

    // Use Advanced Service: YouTube.Search.list
    const searchResponse = YouTube.Search.list('snippet', searchParams);
    const items = searchResponse.items || [];
    Logger.log(`Page ${page + 1} results: ${items.length} channels`);

    allItems = allItems.concat(items);
    pageToken = searchResponse.nextPageToken;

    if (!pageToken) {
      Logger.log('No more pages available for current query');
      // Move to next query for next run
      currentQueryIndex = (currentQueryIndex + 1) % SEARCH_QUERIES.length;
      scriptProperties.setProperty('CURRENT_QUERY_INDEX', currentQueryIndex.toString());
      scriptProperties.setProperty('NEXT_PAGE_TOKEN', '');
      break;
    }

    // If we haven't broken out, save the next pageToken on the last iteration
    if (page === PAGES_TO_FETCH - 1) {
      Logger.log(`Saving next page token for next run: ${pageToken}`);
      scriptProperties.setProperty('NEXT_PAGE_TOKEN', pageToken);
    }

    // Sleep to avoid hitting rate limits too fast
    Utilities.sleep(1000);

    // Also watch overall API calls
    if (apiCallCount >= MAX_API_CALLS) {
      Logger.log('Reached API call limit during search phase');
      break;
    }
  }

  /*****************************************************
   * (B) FILTER CHANNELS BASED ON DESCRIPTION
   *****************************************************/
  const initialFiltered = allItems.filter(item => {
    const description = item.snippet.description.toLowerCase();
    // Must contain at least one of the initial keywords
    const hasInitialKeyword = INITIAL_KEYWORDS.some(keyword => description.includes(keyword));
    // Must not contain any exclude keyword
    const hasExcludeKeyword = EXCLUDE_KEYWORDS.some(keyword => description.includes(keyword));
    return hasInitialKeyword && !hasExcludeKeyword;
  });

  Logger.log(`Found ${allItems.length} total channels, filtered to ${initialFiltered.length}`);

  let newChannels     = 0;
  let updatedChannels = 0;

  /*****************************************************
   * (C) GET CHANNEL DETAILS & APPLY FINAL FILTER
   *****************************************************/
  for (const item of initialFiltered) {
    if (apiCallCount >= MAX_API_CALLS) {
      Logger.log('Reached API call limit during channel detail fetch');
      break;
    }

    const channelId = item.snippet.channelId;
    Logger.log(`Processing channel ID: ${channelId}`);

    // Fetch channel details
    apiCallCount++;
    const channelResponse = YouTube.Channels.list('snippet,statistics,brandingSettings', {
      id: channelId
    });
    const channelItems = channelResponse.items || [];
    if (channelItems.length > 0) {
      const channel         = channelItems[0];
      const fullDescription = channel.snippet.description;  // the "long" description
      const shortDescription = item.snippet.description;    // the "short" search snippet
      const channelName     = channel.snippet.title.toLowerCase();

      // Check if "include" keywords appear in channel name or the long description
      const hasIncludeKeyword = INCLUDE_KEYWORDS.some(
        keyword => fullDescription.toLowerCase().includes(keyword) || channelName.includes(keyword)
      );

      if (hasIncludeKeyword) {
        // 1) Attempt to extract an email from the short snippet (if any)
        const shortEmailMatch = shortDescription.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
        let email = shortEmailMatch ? shortEmailMatch[0] : '';

        // 2) If still no email found, parse the long description
        if (!email) {
          const longEmailMatch = fullDescription.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
          email = longEmailMatch ? longEmailMatch[0] : '';
        }

        // Build a Channel URL if there's a customUrl
        const customUrl = channel.snippet.customUrl 
                          ? `https://www.youtube.com/${channel.snippet.customUrl}`
                          : '';

        // We'll keep the description with its line breaks
        const rowData = [
          channelId,
          channel.snippet.title,
          fullDescription,                  // store the "long" description in the sheet
          channel.statistics.subscriberCount,
          channel.statistics.videoCount,
          email,
          customUrl
        ];

        // If channel already exists, update its row
        if (existingChannels.has(channelId)) {
          const rowIndex = existingChannels.get(channelId);
          sheet.getRange(rowIndex, 1, 1, 7).setValues([rowData]);
          // Force row height to a standard (e.g., 21) so line breaks don't expand it
          sheet.setRowHeight(rowIndex, 21);
          updatedChannels++;
          Logger.log(`Updated channel: ${channel.snippet.title}`);
        } else {
          // Otherwise, append a new row
          sheet.appendRow(rowData);
          let newRow = sheet.getLastRow();
          // Force row height to a standard size
          sheet.setRowHeight(newRow, 21);
          newChannels++;
          Logger.log(`Added new channel: ${channel.snippet.title}`);
        }
      } else {
        Logger.log(
          `Skipped channel: ${channel.snippet.title} - ` +
          `no matching "include" keywords.`
        );
      }
    }

    Logger.log(`API calls made so far: ${apiCallCount}`);
    // Sleep a bit to respect quota
    Utilities.sleep(1000);
  }

  Logger.log(`Done! New channels: ${newChannels}, Updated channels: ${updatedChannels}`);
  Logger.log(`Total API calls: ${apiCallCount}`);
}

/*****************************************************
 * OPTIONAL: HELPER FUNCTIONS FOR MENU & RESET
 *****************************************************/

/** Adds a custom menu to run the search directly from the Sheet. */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('YouTube Tools')
    .addItem('Search Gardening Channels', 'getYoutubeChannels')
    .addItem('Reset Search Progress', 'resetSearch')
    .addToUi();
}

/** Resets saved page tokens so the script restarts from the first query. */
function resetSearch() {
  const scriptProperties = PropertiesService.getScriptProperties();
  scriptProperties.setProperty('NEXT_PAGE_TOKEN', '');
  scriptProperties.setProperty('CURRENT_QUERY_INDEX', '0');
  Logger.log('Search reset to first query with empty page token');
}
