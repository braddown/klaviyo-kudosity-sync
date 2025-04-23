import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export async function GET(request: Request) {
  try {
    console.log("=== API ROUTE: /api/klaviyo-profile-fields GET ===");
    
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
    
    console.log(`Fetching profile fields for Klaviyo ${type} ID: ${id}`);
    
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
    
    // Define standard fields we know exist - we'll add these regardless
    const standardFields = [
      'email',
      'phone_number',
      'first_name',
      'last_name',
      'organization',
      'title',
      'address1',
      'address2',
      'city',
      'region',
      'zip',
      'country',
      'timezone'
    ];
    
    // Helper function to flatten nested objects into dot notation
    const flattenObject = (obj: Record<string, any>, prefix = ''): Record<string, any> => {
      return Object.keys(obj).reduce((acc: Record<string, any>, key: string) => {
        const pre = prefix.length ? `${prefix}.` : '';
        
        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
          // Recursively flatten nested objects
          Object.assign(acc, flattenObject(obj[key], `${pre}${key}`));
        } else {
          // Only include if it's a primitive value or array (not null objects)
          if (obj[key] !== null || typeof obj[key] !== 'object') {
            acc[`${pre}${key}`] = obj[key];
          }
        }
        
        return acc;
      }, {});
    };
    
    // Fetch up to 100 profiles to get a more comprehensive list of fields
    const sampleProfileUrl = type === 'segments'
      ? `https://a.klaviyo.com/api/segments/${id}/profiles?page[size]=100`
      : `https://a.klaviyo.com/api/lists/${id}/profiles?page[size]=100`;
    
    console.log(`Getting profiles from: ${sampleProfileUrl}`);
    
    const profileResponse = await fetch(sampleProfileUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Klaviyo-API-Key ${apiKey}`,
        'revision': '2023-10-15'
      }
    });
    
    // If profiles request failed, try the profiles endpoint directly
    if (!profileResponse.ok) {
      console.log(`Failed to get profiles (${profileResponse.status}), trying general profile schema`);
      
      const profileSchemaUrl = 'https://a.klaviyo.com/api/profiles?page[size]=1';
      const schemaResponse = await fetch(profileSchemaUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Klaviyo-API-Key ${apiKey}`,
          'revision': '2023-10-15'
        }
      });
      
      if (!schemaResponse.ok) {
        console.error(`Klaviyo API error: ${schemaResponse.status} ${schemaResponse.statusText}`);
        return NextResponse.json(
          { 
            success: false, 
            error: `Klaviyo API error: ${schemaResponse.status} ${schemaResponse.statusText}`,
            timestamp: new Date().toISOString()
          },
          { status: schemaResponse.status }
        );
      }
      
      // Return standard fields when we can't get profiles
      return NextResponse.json({
        success: true,
        fields: standardFields,
        message: 'Standard profile fields retrieved (fallback)',
        timestamp: new Date().toISOString()
      });
    }
    
    const profileData = await profileResponse.json();
    
    // Check if we have profiles
    if (!profileData.data || !Array.isArray(profileData.data) || profileData.data.length === 0) {
      console.log('No profiles found, returning standard fields');
      return NextResponse.json({
        success: true,
        fields: standardFields,
        message: 'No profiles found, returning standard fields',
        timestamp: new Date().toISOString()
      });
    }
    
    console.log(`Processing ${profileData.data.length} profiles for field discovery`);
    
    // Create a set to store all unique fields
    const allFields = new Set<string>();
    
    // Process each profile to extract all possible fields
    for (const profile of profileData.data) {
      if (!profile.attributes) continue;
      
      // Flatten the profile attributes to capture nested fields
      const flattenedAttributes = flattenObject(profile.attributes);
      
      // Add all fields to our set
      Object.keys(flattenedAttributes).forEach(field => {
        // Filter out internal fields (starting with $ or _)
        if (!field.startsWith('$') && !field.startsWith('_')) {
          allFields.add(field);
        }
      });
    }
    
    // Add standard fields to ensure they're always available
    standardFields.forEach(field => allFields.add(field));
    
    // Convert set to array for response
    const fieldsArray = Array.from(allFields);
    
    console.log(`Found ${fieldsArray.length} profile fields from ${profileData.data.length} profiles`);
    console.log(`Sample fields: ${fieldsArray.slice(0, 10).join(', ')}${fieldsArray.length > 10 ? '...' : ''}`);
    
    return NextResponse.json({
      success: true,
      fields: fieldsArray,
      profilesProcessed: profileData.data.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('Error fetching Klaviyo profile fields:', error);
    
    // Enhanced error response with more details
    const errorDetails = {
      message: error.message,
      stack: error.stack,
      cause: error.cause,
      name: error.name,
      code: error.code
    };
    
    // Specific handling for network errors and API errors
    let errorMessage = `Error fetching profile fields: ${error.message}`;
    
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