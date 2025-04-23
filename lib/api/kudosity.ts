/**
 * Kudosity API client utilities
 * Using the Transmit SMS API: https://developers.kudosity.com/reference/authentication
 */

// Add these imports at the top
import { createClient } from '@supabase/supabase-js';
import { SupabaseClient } from '@supabase/supabase-js';

// Get Supabase client for storage operations
function getSupabaseStorageClient() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    
    if (!supabaseUrl || !supabaseKey) {
      console.error("Missing Supabase environment variables");
      throw new Error("Missing required Supabase configuration");
    }
    
    return createClient(supabaseUrl, supabaseKey);
  } catch (error) {
    console.error("Error creating Supabase client:", error);
    throw error;
  }
}

/**
 * Creates and uploads a CSV file of contacts to Supabase Storage - Legacy wrapper for backward compatibility
 * @param contacts Array of contact objects with mobile numbers
 * @param filenameOrClient Either a filename string or Supabase client instance
 * @returns Public URL of the uploaded CSV file or file:// URL for local fallback
 */
export async function createAndUploadContactsCSV(
  contacts: Array<Record<string, any>>,
  filenameOrClient: string | SupabaseClient
): Promise<string> {
  // Create a Supabase client if none is provided
  let supabase: SupabaseClient | null = null;
  let filename = '';
  
  // Handle different argument patterns
  if (typeof filenameOrClient === 'string') {
    filename = filenameOrClient;
    try {
      supabase = getSupabaseStorageClient();
    } catch (error) {
      console.warn("Could not create Supabase client, will fall back to local file storage");
      throw new Error('Supabase client is required for CSV file uploads. Kudosity API requires publicly accessible URLs for CSV files.');
    }
  } else {
    supabase = filenameOrClient;
  }
  
  // Generate a timestamp-based filename component
  const timestamp = new Date().toISOString().replace(/[:.-]/g, '');
  const fullFilename = filename ? `${filename}_${timestamp}.csv` : `contacts_${timestamp}.csv`;
  
  // Skip server-side rendering
  if (typeof window !== 'undefined' && !supabase) {
    throw new Error("Cannot create CSV file in browser without Supabase client");
  }
  
  // Create CSV content - first column MUST be 'mobile'
  let csvContent = 'mobile,first_name,last_name,email\n';
  
  // Validate contacts
  if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
    throw new Error('No contacts provided for CSV creation');
  }
  
  // Filter out contacts without mobile numbers
  const validContacts = contacts.filter(contact => 
    contact && 
    contact.mobile && 
    typeof contact.mobile === 'string' && 
    contact.mobile.trim() !== ''
  );
  
  if (validContacts.length === 0) {
    throw new Error('No valid contacts with mobile numbers found');
  }
  
  console.log(`Creating CSV with ${validContacts.length} contacts`);
  
  // Generate CSV rows
  validContacts.forEach(contact => {
    // Ensure mobile number is properly formatted (remove spaces, ensure starts with country code)
    const mobile = contact.mobile.trim().replace(/\s+/g, '');
    
    // CSV escape fields to handle commas, quotes, etc.
    const escapeCsvField = (field: string) => {
      if (!field || typeof field !== 'string') return '';
      // If field contains quotes, commas, or newlines, wrap in quotes and escape internal quotes
      if (/[",\n\r]/.test(field)) {
        return `"${field.replace(/"/g, '""')}"`;
      }
      return field;
    };
    
    const firstName = escapeCsvField(contact.firstName || contact.first_name || '');
    const lastName = escapeCsvField(contact.lastName || contact.last_name || '');
    const email = escapeCsvField(contact.email || '');
    
    csvContent += `${mobile},${firstName},${lastName},${email}\n`;
  });
  
  // Try uploading to Supabase if client is available
  if (supabase) {
    try {
      // Use the bucket name provided by the user
      const bucketName = 'temp-csv-storage';
      
      console.log(`Uploading CSV to Supabase bucket: ${bucketName}`);
      console.log(`Bucket name length: ${bucketName.length}, bucket ID: ${encodeURIComponent(bucketName)}`);
      
      // Skip bucket existence check and creation - assume bucket exists
      // Upload the file directly
      const { data, error } = await supabase.storage
        .from(bucketName)
        .upload(fullFilename, new Blob([csvContent], { type: 'text/csv' }), {
          contentType: 'text/csv',
          upsert: true,
          cacheControl: '3600'
        });
      
      if (error) {
        console.error('Error uploading CSV to storage:', error);
        throw error;
      }
      
      if (!data || !data.path) {
        throw new Error('No path returned from upload');
      }
      
      // Get public URL for the uploaded file
      const { data: publicUrlData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(data.path);
      
      if (!publicUrlData || !publicUrlData.publicUrl) {
        throw new Error('Failed to generate public URL for uploaded CSV');
      }
      
      // Clean up the URL - ensure it's properly encoded
      let publicUrl = publicUrlData.publicUrl;
      
      // Validate the URL format
      try {
        // Parse the URL to ensure it's valid
        const url = new URL(publicUrl);
        
        // Ensure the path is properly encoded (especially important for bucket names with spaces)
        const pathParts = url.pathname.split('/').map(part => 
          // Skip encoding for forward slashes and already encoded parts
          part.includes('%') ? part : encodeURIComponent(part)
        );
        
        // Reconstruct the URL with encoded path parts
        url.pathname = pathParts.join('/');
        publicUrl = url.toString();
        
        // Log the final URL
        console.log(`CSV publicly accessible at: ${publicUrl}`);
      } catch (error) {
        console.warn(`Warning: Could not parse/encode public URL: ${publicUrl}`, error);
      }
      
      // Final URL validation
      if (!publicUrl.startsWith('http')) {
        throw new Error(`Invalid public URL format: ${publicUrl}`);
      }
      
      return publicUrl;
    } catch (storageError: any) {
      console.error('Storage upload failed:', storageError);
      throw new Error(`Failed to upload CSV to Supabase storage: ${storageError.message || 'Unknown error'}. Please check your Supabase storage configuration and permissions.`);
    }
  }
  
  // If no Supabase client is available
  if (!supabase) {
    throw new Error('Supabase client is required for CSV file uploads. Kudosity API requires publicly accessible URLs for CSV files.');
  }
  
  // If execution somehow gets here, throw error (should never happen)
  throw new Error('Failed to upload CSV to storage: unexpected code path');
}

/**
 * Uploads contacts to a Kudosity list via their API
 * Supports both public URLs and local file:// URLs
 * 
 * @param username Kudosity API username
 * @param password Kudosity API password
 * @param csvUrl CSV file URL (public URL or file:// URL) 
 * @param listId Optional Kudosity list ID to upload to. If not provided, listName is required to create a new list.
 * @param listName Required when listId is not provided to create a new list
 * @returns Promise with import ID string on success
 */
export async function uploadContactsToKudosity(
  username: string,
  password: string,
  csvUrl: string,
  listId?: string | null,
  listName?: string
): Promise<string> {
  try {
    if (!username || !password) {
      throw new Error('Kudosity credentials missing');
    }
    
    if (!csvUrl) {
      throw new Error('CSV URL is required');
    }
    
    // Require either listId or listName
    if (!listId && !listName) {
      throw new Error('Either Kudosity list ID or list name is required');
    }
    
    console.log(`Uploading contacts to Kudosity ${listId ? `list ${listName || listId}` : `new list "${listName}"`}...`);
    
    let fileContent: Blob | File;
    let fileName: string;
    
    // Handle file:// URLs (local file paths)
    if (csvUrl.startsWith('file://')) {
      if (typeof window !== 'undefined') {
        // Browser environment cannot access local file system
        throw new Error('Local file URLs not supported in browser environment');
      }
      
      // Server-side: read file from local filesystem
      const fs = require('fs');
      const path = require('path');
      const filePath = csvUrl.replace('file://', '');
      
      console.log(`Reading local file: ${filePath}`);
      
      if (!fs.existsSync(filePath)) {
        throw new Error(`Local CSV file not found at ${filePath}`);
      }
      
      // Local files aren't accessible to Kudosity API - we need to upload to a publicly accessible URL
      throw new Error('Local file URLs cannot be used with Kudosity API. The file must be hosted at a publicly accessible URL.');
    } else {
      // Handle public URL - log the URL for debugging
      console.log(`Using CSV from URL: ${csvUrl}`);
      
      // Ensure URL is properly formatted (must be a complete URL starting with http:// or https://)
      if (!csvUrl.startsWith('http://') && !csvUrl.startsWith('https://')) {
        throw new Error(`CSV URL must be a complete URL starting with http:// or https:// - Got: ${csvUrl}`);
      }
      
      // Try to validate the URL is accessible
      try {
        const response = await fetch(csvUrl, { method: 'HEAD' });
        if (!response.ok) {
          console.warn(`Warning: CSV URL returned status ${response.status} ${response.statusText}`);
        }
      } catch (error: any) {
        console.warn(`Warning: Could not validate CSV URL accessibility: ${error.message}`);
      }
    }
    
    // Prepare FormData for upload
    const formData = new FormData();
    
    // Create authorization header instead of sending credentials in form
    const auth = Buffer.from(`${username}:${password}`).toString('base64');
    
    if (listId) {
      formData.append('list_id', listId);
    } else if (listName) {
      formData.append('list_name', listName);
    }
    
    // Use file_url parameter instead of file upload
    // The API expects a URL to a CSV file, not a direct file upload
    console.log(`Sending file_url to API: ${csvUrl}`);
    formData.append('file_url', csvUrl);
    formData.append('type', 'csv');
    formData.append('field_mappings', JSON.stringify({
      mobile: 'mobile',
      first_name: 'first_name',
      last_name: 'last_name',
      email: 'email'
    }));
    
    // Send the request to Kudosity API
    console.log('Sending import request to Kudosity API...');
    const apiResponse = await fetch('https://api.transmitsms.com/add-contacts-bulk.json', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json',
      },
      body: formData,
    });
    
    // Parse API response
    const responseText = await apiResponse.text();
    
    // Handle potential HTML responses (authentication errors)
    if (responseText.includes('<!DOCTYPE html>') || responseText.includes('<html>')) {
      throw new Error('Received HTML response from API. Check credentials.');
    }
    
    // Parse JSON response
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch (error) {
      console.error('Failed to parse API response:', responseText);
      throw new Error(`Unexpected API response format: ${responseText.substring(0, 100)}...`);
    }
    
    // Check for API errors
    if (responseData.error) {
      const errorMessage = responseData.error.description || responseData.error.code || responseData.error;
      throw new Error(`Kudosity API error: ${errorMessage}`);
    }
    
    // Validate import ID is present
    if (!responseData.import_id) {
      console.warn('API response missing import_id:', responseData);
      throw new Error('Upload successful but import ID missing from response');
    }
    
    // Log success
    console.log(`Successfully uploaded contacts to ${listId ? `list ${listName || listId}` : `new list "${listName}"`}`, 
      { importId: responseData.import_id });
    
    return responseData.import_id;
  } catch (error: any) {
    console.error('Error uploading contacts to Kudosity:', error);
    throw new Error(`Failed to upload contacts: ${error.message}`);
  }
}

/**
 * Checks the progress of a bulk contact import
 * @param username Kudosity/Transmit SMS API username
 * @param password Kudosity/Transmit SMS API password
 * @param importId Import ID returned from uploadContactsToKudosity
 * @returns Import progress status
 */
export async function checkBulkImportProgress(
  username: string,
  password: string,
  importId: string
): Promise<{
  status: string;
  processed: number;
  total: number;
  errors: number;
  errorDetails?: string;
  complete: boolean;
}> {
  try {
    console.log(`Checking progress of bulk import ID: ${importId}`);
    
    // API endpoint for checking bulk import progress
    const url = 'https://api.transmitsms.com/add-contacts-bulk-progress.json';
    const auth = Buffer.from(`${username}:${password}`).toString('base64');
    
    // Prepare form data
    const formData = new FormData();
    formData.append('import_id', importId);
    
    // Make the API request
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json',
      },
      body: formData,
    });
    
    // Check for HTML response (common auth error indicator)
    const responseText = await response.text();
    if (responseText.trim().startsWith('<')) {
      console.error("Received HTML response from API", responseText.substring(0, 200));
      throw new Error("Authentication failed or API endpoint has changed. Received HTML response instead of JSON.");
    }
    
    // Parse the response
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error("Failed to parse API response as JSON", e);
      throw new Error(`Failed to parse API response as JSON: ${e instanceof Error ? e.message : String(e)}`);
    }
    
    // Handle API error responses
    if (data.error && data.error.code !== 'SUCCESS') {
      const errorMessage = data.error.description || data.error.code || 'Unknown API error';
      console.error("API error response:", errorMessage, data);
      throw new Error(`API error: ${errorMessage}`);
    }
    
    // Extract progress information
    const status = data.status || 'unknown';
    const processed = parseInt(data.processed || '0', 10);
    const total = parseInt(data.total || '0', 10);
    const errors = parseInt(data.errors || '0', 10);
    const errorDetails = data.error_details;
    
    // Determine if complete based on status
    const isComplete = status === 'complete' || status === 'completed';
    
    console.log(`Import status: ${status}, processed: ${processed}/${total}, errors: ${errors}`);
    
    return {
      status,
      processed,
      total,
      errors,
      errorDetails,
      complete: isComplete
    };
  } catch (error: any) {
    console.error('Error checking bulk import progress:', error);
    throw new Error(`Failed to check bulk import progress: ${error.message}`);
  }
}

/**
 * Directly fetches Kudosity lists using the Transmit SMS API
 * Handles pagination to get all lists
 * @param username Kudosity/Transmit SMS API username
 * @param password Kudosity/Transmit SMS API password
 * @returns Array of list objects
 */
export async function fetchKudosityListsDirectly(
  username: string,
  password: string
): Promise<any[]> {
  try {
    console.log("Fetching Kudosity lists directly from Transmit SMS API...");
    
    // API endpoint
    const baseUrl = 'https://api.transmitsms.com/get-lists.json';
    const auth = Buffer.from(`${username}:${password}`).toString('base64');
    
    let allLists: any[] = [];
    let currentPage = 1;
    let totalPages = 1;
    let hasMorePages = true;
    
    // Fetch all pages
    while (hasMorePages) {
      console.log(`Fetching page ${currentPage} of lists...`);
      
      // Build URL with page parameter
      const url = new URL(baseUrl);
      url.searchParams.append('page', currentPage.toString());
      
      // Make the API request
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Accept': 'application/json',
        },
      });
      
      // Check for HTML response (common auth error indicator)
      const responseText = await response.text();
      if (responseText.trim().startsWith('<')) {
        console.error("Received HTML response from API", responseText.substring(0, 200));
        throw new Error("Authentication failed or API endpoint has changed. Received HTML response instead of JSON.");
      }
      
      // Parse the response
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error("Failed to parse API response as JSON", e);
        throw new Error(`Failed to parse API response as JSON: ${e instanceof Error ? e.message : String(e)}`);
      }
      
      // Handle API error responses
      if (data.error && data.error.code !== 'SUCCESS') {
        const errorMessage = data.error.description || data.error.code || 'Unknown API error';
        console.error("API error response:", errorMessage, data);
        throw new Error(`API error: ${errorMessage}`);
      }
      
      // Check if response contains lists array
      if (!data.lists || !Array.isArray(data.lists)) {
        console.warn("No lists array in API response", data);
        // No error, but no lists - just return empty array
        return [];
      }
      
      // Add lists from this page to overall result
      allLists = [...allLists, ...data.lists];
      
      // Check pagination
      // API might include total_pages in metadata
      totalPages = data.total_pages || totalPages;
      
      // Move to next page or stop if this was the last page
      currentPage++;
      hasMorePages = currentPage <= totalPages;
    }
    
    console.log(`Successfully fetched ${allLists.length} lists from ${totalPages} pages`);
    return allLists;
  } catch (error: any) {
    // Handle network errors
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      console.error("Network error connecting to Transmit SMS API:", error);
      throw new Error(`Network error connecting to Transmit SMS API: ${error.message}`);
    }
    
    console.error("Error fetching Kudosity lists directly:", error);
    throw new Error(`Failed to fetch Kudosity lists: ${error.message}`);
  }
}

/**
 * Fetches Kudosity lists using API credentials
 * Handles pagination to get all lists
 * @param username Kudosity/Transmit SMS API username
 * @param password Kudosity/Transmit SMS API password
 * @param forceDirect If true, skip API route and always use direct API call
 * @returns Array of list objects
 */
export async function fetchKudosityLists(
  username: string, 
  password: string, 
  forceDirect: boolean = false
): Promise<any[]> {
  try {
    console.log("Fetching Kudosity lists...");
    
    // Check if we're in a server environment (API route or server component)
    const isServer = typeof window === 'undefined';
    
    // Always use direct API call in these cases:
    // 1. If we're on the server (to prevent recursion in API routes)
    // 2. If forceDirect is explicitly set to true
    if (isServer || forceDirect) {
      console.log(`Using direct API call (${isServer ? 'server-side' : 'forced direct'})`);
      return await fetchKudosityListsDirectly(username, password);
    }
    
    // For client-side code, try using the Next.js API route first
    console.log("Using client-side API route");
    try {
      // Use the Next.js API route instead of calling Transmit SMS directly
      const response = await fetch('/api/test-kudosity', {
        method: 'POST', // POST to send credentials in body, not URL
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          kudosity_username: username,
          kudosity_password: password
        })
      });
      
      // Handle errors
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `API error: ${response.status} ${response.statusText}`);
      }
      
      // Parse response
      const data = await response.json();
      
      // Check if success and lists array exists
      if (!data.success || !data.lists || !Array.isArray(data.lists)) {
        console.warn("No lists found in Kudosity response", data);
        return [];
      }
      
      return data.lists;
    } catch (apiRouteError) {
      // If the API route fails, try direct API call as fallback
      console.warn("API route failed, falling back to direct API call:", apiRouteError);
      return await fetchKudosityListsDirectly(username, password);
    }
  } catch (error: any) {
    // Handle network errors
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      console.error("Network error connecting to Kudosity API:", error);
      throw new Error(`Network error connecting to Kudosity API: ${error.message}`);
    }
    
    console.error("Error fetching Kudosity lists:", error);
    throw new Error(`Failed to fetch Kudosity lists: ${error.message}`);
  }
}

/**
 * Tests the Kudosity API connection with the provided credentials
 * @param username Kudosity/Transmit SMS API username
 * @param password Kudosity/Transmit SMS API password 
 * @returns Object containing success status, message, and lists if successful
 */
export async function testKudosityConnection(
  username: string,
  password: string
): Promise<{ success: boolean; message: string; lists?: any[] }> {
  try {
    // Always use forceDirect=true to prevent recursion when called from API routes
    const lists = await fetchKudosityLists(username, password, true);
    return {
      success: true,
      message: `Successfully connected to Kudosity API. Found ${lists.length} lists across multiple pages.`,
      lists,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || 'Failed to connect to Kudosity API',
    };
  }
} 