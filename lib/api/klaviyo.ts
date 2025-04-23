/**
 * Klaviyo API client utilities
 * Using Klaviyo API v2023-10-15: https://developers.klaviyo.com/en/reference/segments_api_overview
 */

/**
 * Fetches Klaviyo segments using API credentials
 * Handles pagination correctly to retrieve all segments
 */
export async function fetchKlaviyoSegments(
  apiKey: string
): Promise<any[]> {
  try {
    // First, validate the API key format
    if (!apiKey || apiKey.trim() === '') {
      throw new Error('API key is empty or invalid');
    }
    
    console.log(`Using API key: ${apiKey.substring(0, 5)}...${apiKey.substring(apiKey.length - 3)}`);
    
    let allSegments: any[] = [];
    let nextCursor: string | null = null;
    let hasMorePages = true;
    let page = 1;
    const MAX_PAGES = 20; // Increased to ensure we get all segments
    
    // Fetch all pages
    while (hasMorePages && page <= MAX_PAGES) {
      console.log(`Fetching Klaviyo segments page ${page}...`);
      
      try {
        // Per Klaviyo documentation: https://developers.klaviyo.com/en/reference/get_segments
        const endpoint = 'https://a.klaviyo.com/api/segments';
        
        // API returns max 10 results per page (as per docs)
        // Only include fields parameter - no additional pagination parameters needed
        let url = `${endpoint}?fields[segment]=name,created,updated`;
        
        // Only add cursor for pages after the first
        if (nextCursor) {
          url += `&page[cursor]=${encodeURIComponent(nextCursor)}`;
        }
        
        console.log(`Making request to: ${url}`);
        
        // Make API request with proper API key authentication
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': `Klaviyo-API-Key ${apiKey}`,
            'revision': '2023-10-15' // Klaviyo API version
          },
        });
        
        // Debug response status and headers
        console.log(`Response status: ${response.status}`);
        
        // Convert headers to a plain object without using iteration
        const responseHeaders: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          responseHeaders[key] = value;
        });
        console.log(`Response headers:`, responseHeaders);
        
        if (!response.ok) {
          // Try to get error details if available
          let errorMessage = response.statusText;
          try {
            const errorData = await response.json();
            console.error('Error response body:', JSON.stringify(errorData));
            errorMessage = errorData?.detail || errorData?.errors?.[0]?.detail || errorData?.error?.message || response.statusText;
          } catch (e) {
            console.error('Could not parse error response as JSON');
            // Try to get the response text
            try {
              const textResponse = await response.text();
              console.error('Error response text:', textResponse);
              errorMessage = textResponse || response.statusText;
            } catch (textError) {
              console.error('Could not get response text:', textError);
            }
          }
          
          throw new Error(`Klaviyo API error (${response.status}): ${errorMessage}`);
        }
        
        const data = await response.json();
        
        console.log(`Raw response data structure:`, 
          JSON.stringify({
            data_count: data.data?.length || 0,
            has_next: !!data.links?.next,
            next_link: data.links?.next || 'none'
          })
        );
        
        // Process segments from this page
        const segments = data.data || [];
        console.log(`Page ${page}: received ${segments.length} segments`);
        
        // Add this page's segments to our collection
        allSegments = [...allSegments, ...segments];
        
        // Check if we have a next link
        if (data.links && data.links.next && typeof data.links.next === 'string') {
          try {
            // Extract cursor from next URL
            console.log(`Next link: ${data.links.next}`);
            const nextUrl = new URL(data.links.next);
            const cursorParam = nextUrl.searchParams.get('page[cursor]');
            
            if (cursorParam) {
              console.log(`Found next cursor: ${cursorParam}`);
              nextCursor = cursorParam;
              page++;
            } else {
              console.log('No cursor in next link, ending pagination');
              hasMorePages = false;
            }
          } catch (urlError) {
            console.error('Error parsing next URL:', urlError);
            hasMorePages = false;
          }
        } else {
          console.log('No next link found, reached last page');
          hasMorePages = false;
        }
        
        // If we didn't get any segments, stop paginating
        if (segments.length === 0) {
          console.log('Received empty page, stopping pagination');
          hasMorePages = false;
        }
      } catch (fetchError: any) {
        // Handle network errors specifically
        console.error(`Network error on page ${page}:`, fetchError);
        const errorMessage = fetchError.message || 'Unknown network error';
        
        // If we're getting CORS or network errors, provide clear message
        if (errorMessage.includes('fetch') || errorMessage.includes('network') || 
            errorMessage.includes('CORS') || errorMessage.includes('Failed to fetch')) {
          throw new Error(`Network error connecting to Klaviyo API: ${errorMessage}. This may be due to CORS restrictions or network connectivity issues.`);
        }
        
        // Otherwise rethrow with context
        throw new Error(`Error fetching Klaviyo segments page ${page}: ${errorMessage}`);
      }
    }
    
    if (page > MAX_PAGES) {
      console.warn(`Reached maximum page limit (${MAX_PAGES}), stopping pagination`);
    }
    
    console.log(`Retrieved ${allSegments.length} segments total across ${page} pages`);
    return allSegments;
  } catch (error: any) {
    console.error('Error fetching Klaviyo segments:', error);
    throw new Error(`Failed to fetch Klaviyo segments: ${error.message}`);
  }
}

/**
 * Fetches Klaviyo lists using API credentials
 * Handles pagination correctly to retrieve all lists
 */
export async function fetchKlaviyoLists(
  apiKey: string
): Promise<any[]> {
  try {
    // First, validate the API key format
    if (!apiKey || apiKey.trim() === '') {
      throw new Error('API key is empty or invalid');
    }
    
    console.log(`Using API key: ${apiKey.substring(0, 5)}...${apiKey.substring(apiKey.length - 3)}`);
    
    let allLists: any[] = [];
    let nextCursor: string | null = null;
    let hasMorePages = true;
    let page = 1;
    const MAX_PAGES = 20; // Increased to ensure we get all lists
    
    // Fetch all pages
    while (hasMorePages && page <= MAX_PAGES) {
      console.log(`Fetching Klaviyo lists page ${page}...`);
      
      try {
        // Per Klaviyo documentation: https://developers.klaviyo.com/en/reference/get_lists
        const endpoint = 'https://a.klaviyo.com/api/lists';
        
        // API returns max 10 results per page (as per docs)
        // Only include fields parameter - no additional pagination parameters needed
        let url = `${endpoint}?fields[list]=name,created,updated`;
        
        // Only add cursor for pages after the first
        if (nextCursor) {
          url += `&page[cursor]=${encodeURIComponent(nextCursor)}`;
        }
        
        console.log(`Making request to: ${url}`);
        
        // Make API request with proper API key authentication
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': `Klaviyo-API-Key ${apiKey}`,
            'revision': '2023-10-15' // Klaviyo API version
          },
        });
        
        // Debug response status and headers
        console.log(`Response status: ${response.status}`);
        
        // Convert headers to a plain object without using iteration
        const responseHeaders: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          responseHeaders[key] = value;
        });
        console.log(`Response headers:`, responseHeaders);
        
        if (!response.ok) {
          // Try to get error details if available
          let errorMessage = response.statusText;
          try {
            const errorData = await response.json();
            console.error('Error response body:', JSON.stringify(errorData));
            errorMessage = errorData?.detail || errorData?.errors?.[0]?.detail || errorData?.error?.message || response.statusText;
          } catch (e) {
            console.error('Could not parse error response as JSON');
            // Try to get the response text
            try {
              const textResponse = await response.text();
              console.error('Error response text:', textResponse);
              errorMessage = textResponse || response.statusText;
            } catch (textError) {
              console.error('Could not get response text:', textError);
            }
          }
          
          throw new Error(`Klaviyo API error (${response.status}): ${errorMessage}`);
        }
        
        const data = await response.json();
        
        console.log(`Raw response data structure:`, 
          JSON.stringify({
            data_count: data.data?.length || 0,
            has_next: !!data.links?.next,
            next_link: data.links?.next || 'none'
          })
        );
        
        // Process lists from this page
        const lists = data.data || [];
        console.log(`Page ${page}: received ${lists.length} lists`);
        
        // Add this page's lists to our collection
        allLists = [...allLists, ...lists];
        
        // Check if we have a next link
        if (data.links && data.links.next && typeof data.links.next === 'string') {
          try {
            // Extract cursor from next URL
            console.log(`Next link: ${data.links.next}`);
            const nextUrl = new URL(data.links.next);
            const cursorParam = nextUrl.searchParams.get('page[cursor]');
            
            if (cursorParam) {
              console.log(`Found next cursor: ${cursorParam}`);
              nextCursor = cursorParam;
              page++;
            } else {
              console.log('No cursor in next link, ending pagination');
              hasMorePages = false;
            }
          } catch (urlError) {
            console.error('Error parsing next URL:', urlError);
            hasMorePages = false;
          }
        } else {
          console.log('No next link found, reached last page');
          hasMorePages = false;
        }
        
        // If we didn't get any lists, stop paginating
        if (lists.length === 0) {
          console.log('Received empty page, stopping pagination');
          hasMorePages = false;
        }
      } catch (fetchError: any) {
        // Handle network errors specifically
        console.error(`Network error on page ${page}:`, fetchError);
        const errorMessage = fetchError.message || 'Unknown network error';
        
        // If we're getting CORS or network errors, provide clear message
        if (errorMessage.includes('fetch') || errorMessage.includes('network') || 
            errorMessage.includes('CORS') || errorMessage.includes('Failed to fetch')) {
          throw new Error(`Network error connecting to Klaviyo API: ${errorMessage}. This may be due to CORS restrictions or network connectivity issues.`);
        }
        
        // Otherwise rethrow with context
        throw new Error(`Error fetching Klaviyo lists page ${page}: ${errorMessage}`);
      }
    }
    
    if (page > MAX_PAGES) {
      console.warn(`Reached maximum page limit (${MAX_PAGES}), stopping pagination`);
    }
    
    console.log(`Retrieved ${allLists.length} lists total across ${page} pages`);
    return allLists;
  } catch (error: any) {
    console.error('Error fetching Klaviyo lists:', error);
    throw new Error(`Failed to fetch Klaviyo lists: ${error.message}`);
  }
}

/**
 * Tests the Klaviyo API connection and counts segments
 * Makes a simpler API call to verify authentication
 * @param apiKey Klaviyo API key 
 * @param forceDirect If true, always make direct API calls (used to prevent recursion in API routes)
 * @returns Object with success status, message, and segments if successful
 */
export async function testKlaviyoConnection(
  apiKey: string,
  forceDirect: boolean = false
): Promise<{ 
  success: boolean; 
  message: string; 
  segments?: any[];
  activeSegmentCount?: number;
  errorDetails?: any;
}> {
  try {
    // Always use direct API calls when testing from server environment
    const isServer = typeof window === 'undefined';
    
    // First try a simple API call to verify authentication
    console.log(`Testing Klaviyo API authentication ${isServer || forceDirect ? '(direct mode)' : ''}`);
    const testResponse = await fetch('https://a.klaviyo.com/api/profiles?fields[profile]=email', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Klaviyo-API-Key ${apiKey}`,
        'revision': '2023-10-15'
      }
    });

    if (!testResponse.ok) {
      console.error(`Auth test failed with status: ${testResponse.status}`);
      
      // Try to extract detailed error information
      let responseText = '';
      let responseData = null;
      
      try {
        responseText = await testResponse.text();
        try {
          responseData = JSON.parse(responseText);
        } catch (e) {
          // Not valid JSON, that's fine
        }
      } catch (e) {
        console.error("Could not read response body:", e);
      }
      
      // Create detailed error information
      const errorDetails = {
        status: testResponse.status,
        statusText: testResponse.statusText,
        responseText,
        responseData,
        headers: Object.fromEntries([...testResponse.headers.entries()])
      };
      
      let errorMessage = `Klaviyo API error: ${testResponse.status} ${testResponse.statusText}`;
      
      if (testResponse.status === 401) {
        errorMessage = `Authentication failed. Please verify your Klaviyo API key is correct and has the necessary permissions.`;
      } else if (responseData && responseData.errors) {
        const errors = responseData.errors.map((e: any) => e.detail || e.title || 'Unknown error').join(', ');
        errorMessage = `Klaviyo API error: ${errors}`;
      }
      
      return {
        success: false,
        message: errorMessage,
        errorDetails
      };
    }

    // If authentication succeeded, proceed to fetch segments
    console.log("Authentication successful, fetching segments...");
    const segments = await fetchKlaviyoSegments(apiKey);
    const activeSegmentCount = segments.length;
    
    return {
      success: true,
      message: `Successfully connected to Klaviyo API. Found ${activeSegmentCount} total segments.`,
      segments,
      activeSegmentCount
    };
  } catch (error: any) {
    console.error('Error testing Klaviyo connection:', error);
    return {
      success: false,
      message: error.message || 'Failed to connect to Klaviyo API',
      errorDetails: {
        message: error.message,
        stack: error.stack,
        name: error.name
      }
    };
  }
} 