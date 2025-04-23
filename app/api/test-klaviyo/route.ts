import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { testKlaviyoConnection, fetchKlaviyoSegments, fetchKlaviyoLists } from '@/lib/api/klaviyo';

// GET handler for testing with session authentication
export async function GET(request: Request) {
  try {
    console.log("=== API ROUTE: /api/test-klaviyo GET ===");
    
    // Get query parameters
    const url = new URL(request.url);
    const type = url.searchParams.get('type') || 'auth';
    console.log(`Request type: ${type}`);

    // Check all available cookies for debugging
    const cookieStore = cookies();
    const allCookies = cookieStore.getAll();
    console.log("Available cookies:", allCookies.map(c => c.name));
    
    // Create the Supabase client specifically for the server environment
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            const cookie = cookieStore.get(name);
            console.log(`Cookie requested: ${name}, exists: ${!!cookie}`);
            return cookie?.value;
          },
        },
      }
    );
    
    // Check if the user is authenticated
    console.log("Checking session...");
    const { data, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error("Session error:", sessionError);
      return NextResponse.json(
        { 
          success: false, 
          error: `Session error: ${sessionError.message}` 
        },
        { status: 401 }
      );
    }
    
    console.log("Session exists:", !!data.session);
    
    if (!data.session) {
      console.log('No session found in API route');
      return NextResponse.json(
        { success: false, error: 'Unauthorized - No valid session found' },
        { status: 401 }
      );
    }
    
    console.log('User authenticated:', data.session.user.id);
    
    // Get the user's Klaviyo API settings
    console.log("Fetching user settings...");
    const { data: settings, error } = await supabase
      .from('api_settings')
      .select('klaviyo_api_key')
      .eq('user_id', data.session.user.id)
      .single();
    
    if (error) {
      console.error('Error fetching settings:', error);
      return NextResponse.json(
        { 
          success: false,
          error: `Failed to fetch API settings: ${error.message}. You may need to configure your API settings first.` 
        },
        { status: 400 }
      );
    }
    
    console.log("Settings retrieved:", !!settings);
    
    // If settings don't exist or API key is missing
    if (!settings || !settings.klaviyo_api_key) {
      console.log("Missing Klaviyo API key");
      return NextResponse.json(
        { 
          success: false,
          error: 'Klaviyo API key not found. Please configure it in the Settings page.' 
        },
        { status: 400 }
      );
    }
    
    // Handle different request types
    if (type === 'segments') {
      // Fetch segments
      console.log('Fetching Klaviyo segments with API key');
      try {
        const segments = await fetchKlaviyoSegments(settings.klaviyo_api_key);
        return NextResponse.json({
          success: true,
          message: `Successfully fetched ${segments.length} segments.`,
          segments
        });
      } catch (error: any) {
        console.error('Error fetching segments:', error);
        // Enhanced error response with more details
        const errorDetails = {
          message: error.message,
          stack: error.stack,
          cause: error.cause,
          name: error.name,
          code: error.code
        };
        
        return NextResponse.json(
          { 
            success: false,
            error: `Failed to fetch Klaviyo segments: ${error.message}`,
            errorDetails
          },
          { status: 500 }
        );
      }
    } else if (type === 'lists') {
      // Fetch lists
      console.log('Fetching Klaviyo lists with API key');
      try {
        const lists = await fetchKlaviyoLists(settings.klaviyo_api_key);
        return NextResponse.json({
          success: true,
          message: `Successfully fetched ${lists.length} lists.`,
          lists
        });
      } catch (error: any) {
        console.error('Error fetching lists:', error);
        // Enhanced error response with more details
        const errorDetails = {
          message: error.message,
          stack: error.stack,
          cause: error.cause,
          name: error.name,
          code: error.code
        };
        
        return NextResponse.json(
          { 
            success: false,
            error: `Failed to fetch Klaviyo lists: ${error.message}`,
            errorDetails
          },
          { status: 500 }
        );
      }
    } else {
      // Default: Test the Klaviyo API connection
      console.log('Testing Klaviyo connection with retrieved API key');
      
      try {
        const result = await testKlaviyoConnection(settings.klaviyo_api_key, true);
        
        console.log(`API test result: ${result.success}, found ${result.segments?.length || 0} segments`);
        
        // Return the test result with pagination details
        return NextResponse.json({
          ...result,
          pagination_details: {
            total_segments: result.segments?.length || 0,
            segment_count: result.activeSegmentCount || 0,
            message: "Segments fetched successfully"
          }
        });
      } catch (error: any) {
        console.error('Error testing Klaviyo connection:', error);
        // Enhanced error response with more details
        const errorDetails = {
          message: error.message,
          stack: error.stack,
          cause: error.cause,
          name: error.name,
          code: error.code
        };
        
        return NextResponse.json(
          { 
            success: false,
            error: `Failed to test Klaviyo connection: ${error.message}`,
            errorDetails
          },
          { status: 500 }
        );
      }
    }
    
  } catch (error: any) {
    console.error('Error testing Klaviyo API:', error);
    // Enhanced error response with more details
    const errorDetails = {
      message: error.message,
      stack: error.stack,
      cause: error.cause,
      name: error.name,
      code: error.code
    };
    
    return NextResponse.json(
      { 
        success: false,
        error: `Failed to test Klaviyo API: ${error.message}`,
        errorDetails
      },
      { status: 500 }
    );
  }
}

// POST handler for direct testing (fallback if session auth fails)
export async function POST(request: Request) {
  try {
    console.log("=== API ROUTE: /api/test-klaviyo POST ===");
    
    // Parse request body
    const body = await request.json().catch(() => ({}));
    
    // Get query parameters for type
    const url = new URL(request.url);
    const type = url.searchParams.get('type') || body.type || 'auth';
    console.log(`Request type: ${type}`);
    
    // Check if API key is provided in request body
    if (body.klaviyo_api_key) {
      console.log("Using API key from request body");
      const apiKey = body.klaviyo_api_key;
      
      // Handle different request types
      if (type === 'segments') {
        // Fetch segments with provided API key
        console.log('Fetching Klaviyo segments with provided API key');
        try {
          const segments = await fetchKlaviyoSegments(apiKey);
          return NextResponse.json({
            success: true,
            message: `Successfully fetched ${segments.length} segments.`,
            segments
          });
        } catch (error: any) {
          console.error('Error fetching segments:', error);
          return NextResponse.json(
            { 
              success: false,
              error: `Failed to fetch Klaviyo segments: ${error.message}` 
            },
            { status: 500 }
          );
        }
      } else if (type === 'lists') {
        // Fetch lists with provided API key
        console.log('Fetching Klaviyo lists with provided API key');
        try {
          const lists = await fetchKlaviyoLists(apiKey);
          return NextResponse.json({
            success: true,
            message: `Successfully fetched ${lists.length} lists.`,
            lists
          });
        } catch (error: any) {
          console.error('Error fetching lists:', error);
          return NextResponse.json(
            { 
              success: false,
              error: `Failed to fetch Klaviyo lists: ${error.message}` 
            },
            { status: 500 }
          );
        }
      } else {
        // Test connection with provided API key
        console.log('Testing Klaviyo connection with provided API key');
        const result = await testKlaviyoConnection(apiKey, true);
        
        console.log(`Direct API test result: ${result.success}, found ${result.segments?.length || 0} segments`);
        
        return NextResponse.json({
          ...result,
          pagination_details: {
            total_segments: result.segments?.length || 0,
            segment_count: result.activeSegmentCount || 0,
            message: "Segments fetched successfully"
          }
        });
      }
    } else {
      // No API key provided, attempt to use API key from Supabase
      console.log("No API key provided, attempting to use session auth");
      
      try {
        // Check session from cookie
        console.log("Checking session from cookie...");
        const cookieStore = cookies();
        
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
        
        const { data, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError || !data.session) {
          console.error("Session error or no session:", sessionError);
          return NextResponse.json({
            success: false,
            error: 'Unauthorized - No valid session found' 
          }, { status: 401 });
        }
        
        console.log("Session found, getting settings...");
        
        const { data: settings, error } = await supabase
          .from('api_settings')
          .select('klaviyo_api_key')
          .eq('user_id', data.session.user.id)
          .single();
        
        if (error) {
          console.error('Error fetching settings:', error);
          return NextResponse.json(
            { 
              success: false,
              error: `Failed to fetch API settings: ${error.message}. You may need to configure your API settings first.` 
            },
            { status: 400 }
          );
        }
        
        if (!settings || !settings.klaviyo_api_key) {
          return NextResponse.json(
            { 
              success: false,
              error: 'Klaviyo API key not found in your settings. Please configure it in the Settings page.' 
            },
            { status: 400 }
          );
        }
        
        // Handle different request types
        if (type === 'segments') {
          // Fetch segments
          console.log('Fetching Klaviyo segments with settings API key');
          try {
            const segments = await fetchKlaviyoSegments(settings.klaviyo_api_key);
            return NextResponse.json({
              success: true,
              message: `Successfully fetched ${segments.length} segments.`,
              segments
            });
          } catch (error: any) {
            console.error('Error fetching segments:', error);
            return NextResponse.json(
              { 
                success: false,
                error: `Failed to fetch Klaviyo segments: ${error.message}` 
              },
              { status: 500 }
            );
          }
        } else if (type === 'lists') {
          // Fetch lists
          console.log('Fetching Klaviyo lists with settings API key');
          try {
            const lists = await fetchKlaviyoLists(settings.klaviyo_api_key);
            return NextResponse.json({
              success: true,
              message: `Successfully fetched ${lists.length} lists.`,
              lists
            });
          } catch (error: any) {
            console.error('Error fetching lists:', error);
            return NextResponse.json(
              { 
                success: false,
                error: `Failed to fetch Klaviyo lists: ${error.message}` 
              },
              { status: 500 }
            );
          }
        } else {
          // Test connection with API key from settings
          const result = await testKlaviyoConnection(settings.klaviyo_api_key, true);
          
          return NextResponse.json({
            ...result,
            pagination_details: {
              total_segments: result.segments?.length || 0,
              segment_count: result.activeSegmentCount || 0,
              message: "Segments fetched successfully"
            }
          });
        }
      } catch (supabaseError: any) {
        console.error('Error with Supabase client:', supabaseError);
        return NextResponse.json({
          success: false,
          error: `Session authentication error: ${supabaseError.message}`
        }, { status: 500 });
      }
    }
  } catch (error: any) {
    console.error('Error testing Klaviyo API (direct):', error);
    return NextResponse.json(
      { 
        success: false,
        error: `Failed to test Klaviyo API: ${error.message}` 
      },
      { status: 500 }
    );
  }
} 