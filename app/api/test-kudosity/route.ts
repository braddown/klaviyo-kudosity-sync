import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { testKudosityConnection } from '@/lib/api/kudosity';

// GET handler for testing with session authentication
export async function GET(request: Request) {
  try {
    console.log("=== API ROUTE: /api/test-kudosity GET ===");

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
        { success: false, error: `Authentication error: ${sessionError.message}` },
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
    
    // Get the user's Kudosity API settings
    console.log("Fetching user settings...");
    const { data: settings, error } = await supabase
      .from('api_settings')
      .select('kudosity_username, kudosity_password')
      .eq('user_id', data.session.user.id)
      .single();
    
    if (error) {
      console.error('Error fetching settings:', error);
      return NextResponse.json(
        { success: false, error: `Failed to fetch API settings: ${error.message}` },
        { status: 500 }
      );
    }
    
    console.log("Settings retrieved:", !!settings);
    
    // If settings don't exist or credentials are missing
    if (!settings || !settings.kudosity_username || !settings.kudosity_password) {
      console.log("Missing API credentials");
      return NextResponse.json(
        { success: false, error: 'Kudosity API credentials not found. Please configure them in settings.' },
        { status: 400 }
      );
    }
    
    console.log('Testing Kudosity connection with retrieved credentials');
    
    // Test the Kudosity API connection
    try {
      const result = await testKudosityConnection(
        settings.kudosity_username,
        settings.kudosity_password
      );
      
      console.log(`API test result: ${result.success}, found ${result.lists?.length || 0} lists`);
      
      // Return the test result with pagination details
      return NextResponse.json({
        ...result,
        pagination_details: {
          total_lists: result.lists?.length || 0,
          message: "All pages fetched successfully"
        }
      });
    } catch (apiError: any) {
      console.error('Error in testKudosityConnection:', apiError);
      
      // Return the error directly without fallback attempt
      return NextResponse.json(
        { 
          success: false,
          error: `Failed to test Kudosity API: ${apiError.message}`,
          errorDetails: {
            message: apiError.message,
            name: apiError.name
          }
        },
        { status: 500 }
      );
    }
    
  } catch (error: any) {
    console.error('Error testing Kudosity API:', error);
    return NextResponse.json(
      { 
        success: false,
        error: `Failed to test Kudosity API: ${error.message}` 
      },
      { status: 500 }
    );
  }
}

// POST handler for direct testing (fallback if session auth fails)
export async function POST(request: Request) {
  try {
    console.log("=== API ROUTE: /api/test-kudosity POST ===");
    
    // Parse request body
    const body = await request.json().catch(() => ({}));
    console.log("Received direct test request with credentials");
    
    if (!body.kudosity_username || !body.kudosity_password) {
      console.error("Missing credentials in request body");
      return NextResponse.json({
        success: false,
        error: "Missing credentials in request body"
      }, { status: 400 });
    }
    
    console.log("Testing Kudosity with credentials from POST body");
    
    // Test connection directly with provided credentials
    try {
      const result = await testKudosityConnection(
        body.kudosity_username,
        body.kudosity_password
      );
      
      console.log(`Direct API test result: ${result.success}, found ${result.lists?.length || 0} lists`);
      
      // Return the test result with pagination details
      return NextResponse.json({
        ...result,
        pagination_details: {
          total_lists: result.lists?.length || 0,
          message: "All pages fetched successfully"
        }
      });
    } catch (apiError: any) {
      console.error('Error in testKudosityConnection (direct):', apiError);
      
      // Return the error directly without fallback attempt
      return NextResponse.json(
        { 
          success: false,
          error: `Failed to test Kudosity API: ${apiError.message}`,
          errorDetails: {
            message: apiError.message,
            name: apiError.name
          }
        },
        { status: 500 }
      );
    }
    
  } catch (error: any) {
    console.error('Error testing Kudosity API (direct):', error);
    return NextResponse.json(
      { 
        success: false,
        error: `Failed to test Kudosity API: ${error.message}` 
      },
      { status: 500 }
    );
  }
} 