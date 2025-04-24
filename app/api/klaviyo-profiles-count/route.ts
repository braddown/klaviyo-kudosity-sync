import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export async function GET(request: Request) {
  try {
    console.log("=== API ROUTE: /api/klaviyo-profiles-count GET ===");
    
    // Get query parameters
    const requestUrl = new URL(request.url);
    const type = requestUrl.searchParams.get('type') || 'segments'; // segments or lists
    const id = requestUrl.searchParams.get('id');
    const directApiKey = requestUrl.searchParams.get('api_key'); // Allow direct API key parameter
    
    if (!id) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing ID parameter',
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }
    
    console.log(`Fetching profile count for Klaviyo ${type} ID: ${id}`);
    
    /* 
     * We use different approaches for getting profile counts depending on type:
     * 
     * For Segments:
     * - We use the segments endpoint with additional-fields[segment]=profile_count 
     * - This returns the total count directly in the response attributes
     * 
     * For Lists: 
     * - We query the profiles endpoint with a consent status filter
     * - We extract the count from response headers or metadata
     */
    
    let apiKey: string;
    
    // If direct API key is provided, use it instead of fetching from Supabase
    if (directApiKey) {
      console.log("Using API key provided in query parameters");
      apiKey = directApiKey;
    } else {
      // Get Klaviyo API key from Supabase
      const cookieStore = cookies();
      
      // Log available cookies for debugging
      const availableCookies = cookieStore.getAll().map(c => c.name);
      console.log("Available cookies:", availableCookies);
      
      console.log("Checking session...");
      
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            get(name: string) {
              console.log(`Cookie requested: ${name}, exists: ${!!cookieStore.get(name)}`);
              return cookieStore.get(name)?.value;
            },
          },
        }
      );
      
      // Check session
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      
      console.log("Session exists:", !!sessionData?.session);
      if (sessionError) {
        console.error("Session error:", sessionError);
        return NextResponse.json(
          { 
            success: false, 
            error: `Authentication error: ${sessionError.message}`,
            timestamp: new Date().toISOString()
          },
          { status: 401 }
        );
      }
      
      if (!sessionData.session) {
        console.error("No session found");
        return NextResponse.json(
          { 
            success: false, 
            error: 'Authentication required. Please log in.',
            timestamp: new Date().toISOString()
          },
          { status: 401 }
        );
      }
      
      console.log(`User authenticated: ${sessionData.session.user.id}`);
      
      // Get API settings for Klaviyo
      const { data: settings, error: settingsError } = await supabase
        .from('api_settings')
        .select('klaviyo_api_key')
        .eq('user_id', sessionData.session.user.id)
        .single();
      
      if (settingsError || !settings) {
        console.error("Settings error:", settingsError);
        return NextResponse.json(
          { 
            success: false, 
            error: `Failed to get Klaviyo API key: ${settingsError?.message || 'No settings found'}`,
            timestamp: new Date().toISOString()
          },
          { status: 400 }
        );
      }
      
      if (!settings.klaviyo_api_key) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Klaviyo API key is not configured. Please add it in the Settings page.',
            timestamp: new Date().toISOString() 
          },
          { status: 400 }
        );
      }
      
      // Check for empty API key
      if (settings.klaviyo_api_key.trim() === '') {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Klaviyo API key is empty. Please configure a valid API key in the Settings page.',
            timestamp: new Date().toISOString() 
          },
          { status: 400 }
        );
      }
      
      apiKey = settings.klaviyo_api_key;
    }
    
    const maskedKey = `${apiKey.substring(0, 5)}...${apiKey.substring(apiKey.length - 3)}`;
    console.log(`Using Klaviyo API key: ${maskedKey}`);
    
    // Construct the API endpoint based on the type
    const endpoint = type === 'segments'
      ? `https://a.klaviyo.com/api/segments/${id}?additional-fields[segment]=profile_count`
      : `https://a.klaviyo.com/api/lists/${id}/profiles`;
    
    console.log(`Using Klaviyo API endpoint: ${endpoint}`);
    
    // Make request to Klaviyo API
    // For segments, use the new endpoint with profile_count field
    // For lists, keep using the original approach with filter
    const queryParams = type === 'segments'
      ? ''
      : 'page[size]=1&filter=equals(consent_status,"SUBSCRIBED")';
    
    // For segments, we now use a different endpoint structure without query params
    const apiUrl = type === 'segments' 
      ? endpoint 
      : `${endpoint}?${queryParams}`;
      
    console.log(`Making request to: ${apiUrl}`);
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Klaviyo-API-Key ${apiKey}`,
        'revision': '2023-10-15',
        'Prefer': 'total-count=estimated'
      }
    });
    
    console.log('Klaviyo response status:', response.status);
    
    if (!response.ok) {
      console.error(`Klaviyo API error: ${response.status} ${response.statusText}`);
      
      let errorData = null;
      let errorMessage = `Klaviyo API error: ${response.status} ${response.statusText}`;
      
      try {
        errorData = await response.json();
        
        // Extract specific error messages from Klaviyo's error response format
        if (errorData && errorData.errors && Array.isArray(errorData.errors)) {
          const errors = errorData.errors.map((e: any) => e.detail || e.title).filter(Boolean);
          if (errors.length > 0) {
            errorMessage = `Klaviyo error: ${errors.join(', ')}`;
          }
        }
        
        console.error('Klaviyo API error details:', JSON.stringify(errorData));
      } catch (e) {
        console.log('Could not parse error response as JSON');
      }
      
      // Include specific messages for common error codes
      if (response.status === 404) {
        errorMessage = `The ${type === 'segments' ? 'segment' : 'list'} ID "${id}" was not found in Klaviyo.`;
      } else if (response.status === 403) {
        errorMessage = 'Your Klaviyo API key does not have permission to access this resource.';
      } else if (response.status === 401) {
        errorMessage = 'Your Klaviyo API key is invalid or expired.';
      }
      
      return NextResponse.json(
        { 
          success: false, 
          error: errorMessage,
          details: errorData,
          timestamp: new Date().toISOString()
        },
        { status: response.status }
      );
    }
    
    // Parse response
    console.log(`Klaviyo response status: ${response.status}`);
    let profileCount = 0;
    
    if (response.ok) {
      try {
        const data = await response.json();
        console.log('Klaviyo response data:', JSON.stringify(data).substring(0, 500) + '...');
        
        // Extract profile count based on response format
        if (type === 'segments') {
          // For segments, we're using the new endpoint that provides profile_count directly
          if (data.data?.attributes?.profile_count !== undefined) {
            profileCount = data.data.attributes.profile_count;
            console.log(`Profile count from segment attributes: ${profileCount}`);
          } else {
            console.warn("Could not find profile_count in segment attributes:", JSON.stringify(data).substring(0, 500));
            throw new Error("Could not extract profile count from segment response");
          }
        } else {
          // For lists, we're still using the original approach
          // Extract total count from headers or data
          const totalCountHeader = response.headers.get('Klaviyo-Total-Count');
          
          if (totalCountHeader) {
            // Use the count from the header if available
            profileCount = parseInt(totalCountHeader, 10);
            console.log(`Total count from header: ${profileCount}`);
          } else if (data.meta?.total) {
            // Fallback to meta.total if available (for lists)
            profileCount = data.meta.total;
            console.log(`Total count from meta: ${profileCount}`);
          } else if (data.data && Array.isArray(data.data)) {
            // Final fallback to data length
            profileCount = data.data.length;
            console.log(`Total count from data length: ${profileCount}`);
          } else {
            // If we can't find a count in the expected structure
            console.warn("Unexpected Klaviyo API response format:", JSON.stringify(data).substring(0, 500));
            throw new Error("Could not extract profile count from Klaviyo API response");
          }
        }
      } catch (error: any) {
        console.error("Error parsing Klaviyo response:", error);
        return NextResponse.json({
          success: false,
          error: `Error parsing Klaviyo response: ${error.message}`,
          details: { message: error.message, stack: error.stack },
          timestamp: new Date().toISOString()
        }, { status: 500 });
      }
    }
    
    console.log(`Total profile count for ${type} ID ${id}: ${profileCount}`);
    
    return NextResponse.json({ 
      success: true,
      count: profileCount,
      timestamp: new Date().toISOString()
    }, { status: 200 });
  } catch (error: any) {
    console.error('Error fetching Klaviyo profile count:', error);
    
    // Enhanced error response with more details
    const errorDetails = {
      message: error.message,
      stack: error.stack,
      cause: error.cause,
      name: error.name,
      code: error.code
    };
    
    // Specific handling for network errors and API errors
    let errorMessage = `Error fetching profile count: ${error.message}`;
    
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      errorMessage = 'Network error: Could not connect to Klaviyo API. Please check your internet connection.';
    } else if (error.message.includes('JSON')) {
      errorMessage = 'Error parsing Klaviyo API response. The API may have changed format.';
    } else if (error.name === 'AbortError') {
      errorMessage = 'Request to Klaviyo API timed out. The API may be experiencing issues.';
    }
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
      errorDetails,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    console.log("=== API ROUTE: /api/klaviyo-profiles-count POST ===");
    
    // Get parameters from request body
    const body = await request.json();
    const type = body.source_type || 'segments'; // segments or lists
    const id = body.source_id;
    const directApiKey = body.klaviyo_api_key; // Allow direct API key in body
    
    if (!id) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing source_id parameter',
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }
    
    console.log(`Fetching profile count for Klaviyo ${type} ID: ${id}`);
    
    let apiKey: string;
    
    // If direct API key is provided, use it instead of fetching from Supabase
    if (directApiKey) {
      console.log("Using API key provided in request body");
      apiKey = directApiKey;
    } else {
      // Get Klaviyo API key from Supabase
      const cookieStore = cookies();
      
      console.log("Checking session...");
      
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            get(name: string) {
              return cookieStore.get(name)?.value;
            },
          },
        }
      );
      
      // Check session
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      
      console.log("Session exists:", !!sessionData?.session);
      if (sessionError) {
        console.error("Session error:", sessionError);
        return NextResponse.json(
          { 
            success: false, 
            error: `Authentication error: ${sessionError.message}`,
            timestamp: new Date().toISOString()
          },
          { status: 401 }
        );
      }
      
      if (!sessionData.session) {
        console.error("No session found");
        return NextResponse.json(
          { 
            success: false, 
            error: 'Authentication required. Please log in.',
            timestamp: new Date().toISOString()
          },
          { status: 401 }
        );
      }
      
      console.log(`User authenticated: ${sessionData.session.user.id}`);
      
      // Get API settings for Klaviyo
      const { data: settings, error: settingsError } = await supabase
        .from('api_settings')
        .select('klaviyo_api_key')
        .eq('user_id', sessionData.session.user.id)
        .single();
      
      if (settingsError || !settings) {
        console.error("Settings error:", settingsError);
        return NextResponse.json(
          { 
            success: false, 
            error: `Failed to get Klaviyo API key: ${settingsError?.message || 'No settings found'}`,
            timestamp: new Date().toISOString()
          },
          { status: 400 }
        );
      }
      
      if (!settings.klaviyo_api_key) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Klaviyo API key is not configured. Please add it in the Settings page.',
            timestamp: new Date().toISOString() 
          },
          { status: 400 }
        );
      }
      
      // Check for empty API key
      if (settings.klaviyo_api_key.trim() === '') {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Klaviyo API key is empty. Please configure a valid API key in the Settings page.',
            timestamp: new Date().toISOString() 
          },
          { status: 400 }
        );
      }
      
      apiKey = settings.klaviyo_api_key;
    }
    
    const maskedKey = `${apiKey.substring(0, 5)}...${apiKey.substring(apiKey.length - 3)}`;
    console.log(`Using Klaviyo API key: ${maskedKey}`);
    
    // Construct the API endpoint based on the type
    const endpoint = type === 'segments'
      ? `https://a.klaviyo.com/api/segments/${id}?additional-fields[segment]=profile_count`
      : `https://a.klaviyo.com/api/lists/${id}/profiles`;
    
    console.log(`Using Klaviyo API endpoint: ${endpoint}`);
    
    // Make request to Klaviyo API
    // For segments, use the new endpoint with profile_count field
    // For lists, keep using the original approach with filter
    const queryParams = type === 'segments'
      ? ''
      : 'page[size]=1&filter=equals(consent_status,"SUBSCRIBED")';
    
    // For segments, we now use a different endpoint structure without query params
    const apiUrl = type === 'segments' 
      ? endpoint 
      : `${endpoint}?${queryParams}`;
      
    console.log(`Making request to: ${apiUrl}`);
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Klaviyo-API-Key ${apiKey}`,
        'revision': '2023-10-15',
        'Prefer': 'total-count=estimated'
      }
    });
    
    console.log('Klaviyo response status:', response.status);
    
    if (!response.ok) {
      console.error(`Klaviyo API error: ${response.status} ${response.statusText}`);
      
      let errorData = null;
      let errorMessage = `Klaviyo API error: ${response.status} ${response.statusText}`;
      
      try {
        errorData = await response.json();
        
        // Extract specific error messages from Klaviyo's error response format
        if (errorData && errorData.errors && Array.isArray(errorData.errors)) {
          const errors = errorData.errors.map((e: any) => e.detail || e.title).filter(Boolean);
          if (errors.length > 0) {
            errorMessage = `Klaviyo error: ${errors.join(', ')}`;
          }
        }
        
        console.error('Klaviyo API error details:', JSON.stringify(errorData));
      } catch (e) {
        console.log('Could not parse error response as JSON');
      }
      
      // Include specific messages for common error codes
      if (response.status === 404) {
        errorMessage = `The ${type === 'segments' ? 'segment' : 'list'} ID "${id}" was not found in Klaviyo.`;
      } else if (response.status === 403) {
        errorMessage = 'Your Klaviyo API key does not have permission to access this resource.';
      } else if (response.status === 401) {
        errorMessage = 'Your Klaviyo API key is invalid or expired.';
      }
      
      return NextResponse.json(
        { 
          success: false, 
          error: errorMessage,
          details: errorData,
          timestamp: new Date().toISOString()
        },
        { status: response.status }
      );
    }
    
    // Parse response
    console.log(`Klaviyo response status: ${response.status}`);
    let profileCount = 0;
    
    if (response.ok) {
      try {
        const data = await response.json();
        console.log('Klaviyo response data:', JSON.stringify(data).substring(0, 500) + '...');
        
        // Extract profile count based on response format
        if (type === 'segments') {
          // For segments, we're using the new endpoint that provides profile_count directly
          if (data.data?.attributes?.profile_count !== undefined) {
            profileCount = data.data.attributes.profile_count;
            console.log(`Profile count from segment attributes: ${profileCount}`);
          } else {
            console.warn("Could not find profile_count in segment attributes:", JSON.stringify(data).substring(0, 500));
            throw new Error("Could not extract profile count from segment response");
          }
        } else {
          // For lists, we're still using the original approach
          // Extract total count from headers or data
          const totalCountHeader = response.headers.get('Klaviyo-Total-Count');
          
          if (totalCountHeader) {
            // Use the count from the header if available
            profileCount = parseInt(totalCountHeader, 10);
            console.log(`Total count from header: ${profileCount}`);
          } else if (data.meta?.total) {
            // Fallback to meta.total if available (for lists)
            profileCount = data.meta.total;
            console.log(`Total count from meta: ${profileCount}`);
          } else if (data.data && Array.isArray(data.data)) {
            // Final fallback to data length
            profileCount = data.data.length;
            console.log(`Total count from data length: ${profileCount}`);
          } else {
            // If we can't find a count in the expected structure
            console.warn("Unexpected Klaviyo API response format:", JSON.stringify(data).substring(0, 500));
            throw new Error("Could not extract profile count from Klaviyo API response");
          }
        }
      } catch (error: any) {
        console.error("Error parsing Klaviyo response:", error);
        return NextResponse.json({
          success: false,
          error: `Error parsing Klaviyo response: ${error.message}`,
          details: { message: error.message, stack: error.stack },
          timestamp: new Date().toISOString()
        }, { status: 500 });
      }
    }
    
    console.log(`Total profile count for ${type} ID ${id}: ${profileCount}`);
    
    return NextResponse.json({ 
      success: true,
      count: profileCount,
      timestamp: new Date().toISOString()
    }, { status: 200 });
  } catch (error: any) {
    console.error("Unhandled error in klaviyo-profiles-count POST:", error);
    return NextResponse.json({
      success: false,
      error: `Unhandled server error: ${error.message}`,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 