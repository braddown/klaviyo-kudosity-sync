import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export async function POST(request: Request) {
  try {
    console.log("=== API ROUTE: /api/create-kudosity-list POST ===");
    
    // Parse request body
    const body = await request.json().catch(() => ({}));
    const { name, kudosity_username, kudosity_password } = body;
    
    if (!name) {
      return NextResponse.json({ 
        success: false, 
        error: 'List name is required' 
      }, { status: 400 });
    }
    
    let username, password;
    
    // If direct credentials are provided in the request body, use them instead of session auth
    if (kudosity_username && kudosity_password) {
      console.log("Using direct credentials from request");
      username = kudosity_username;
      password = kudosity_password;
    } else {
      // Otherwise, try to get credentials from Supabase via session auth
      
      // Get Kudosity credentials from Supabase
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
      
      // Check session
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !sessionData.session) {
        console.error("Session error:", sessionError);
        return NextResponse.json(
          { 
            success: false, 
            error: `Authentication error: ${sessionError?.message || 'No valid session'}` 
          },
          { status: 401 }
        );
      }
      
      // Get API settings for Kudosity
      const { data: settings, error: settingsError } = await supabase
        .from('api_settings')
        .select('kudosity_username, kudosity_password')
        .eq('user_id', sessionData.session.user.id)
        .single();
      
      if (settingsError || !settings) {
        console.error("Settings error:", settingsError);
        return NextResponse.json(
          { 
            success: false, 
            error: `Failed to get Kudosity credentials: ${settingsError?.message || 'No settings found'}` 
          },
          { status: 400 }
        );
      }
      
      if (!settings.kudosity_username || !settings.kudosity_password) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Kudosity credentials are not configured. Please add them in the Settings page.' 
          },
          { status: 400 }
        );
      }
      
      username = settings.kudosity_username;
      password = settings.kudosity_password;
    }
    
    console.log(`Creating new Kudosity list: "${name}"`);
    
    // Call Kudosity API to create a new list
    // Using the Transmit SMS API endpoint for Kudosity
    const auth = Buffer.from(`${username}:${password}`).toString('base64');
    
    // Format the request body correctly for Transmit SMS API
    const params = new URLSearchParams();
    params.append('name', name);
    
    console.log(`Making request to Transmit SMS API with params: ${params.toString()}`);
    
    const kudosityResponse = await fetch('https://api.transmitsms.com/add-list.json', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${auth}`
      },
      body: params.toString()
    });
    
    console.log('Response status:', kudosityResponse.status, kudosityResponse.statusText);
    
    // Get raw response text for debugging
    const rawResponse = await kudosityResponse.text();
    console.log('Raw response:', rawResponse);
    
    // Try to parse as JSON
    let responseData;
    try {
      responseData = JSON.parse(rawResponse);
      console.log('Parsed response data:', responseData);
    } catch (e) {
      console.error('Failed to parse response as JSON:', e);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to parse Kudosity API response as JSON',
          rawResponse
        },
        { status: 500 }
      );
    }
    
    // Check if the response was actually successful
    // The API returns an error object with code='SUCCESS' for successful calls
    if (responseData.error && responseData.error.code === 'SUCCESS') {
      console.log('List created successfully:', responseData);
      
      // For successful responses, the ID is in responseData.id
      if (!responseData.id) {
        console.error('List created but no ID returned:', responseData);
        return NextResponse.json(
          { 
            success: false, 
            error: 'List created but no ID was returned',
            details: responseData
          },
          { status: 500 }
        );
      }
      
      // Convert id to string safely
      const listId = responseData.id.toString ? responseData.id.toString() : String(responseData.id);
      
      // Return the new list data
      return NextResponse.json({
        success: true,
        message: `List "${name}" created successfully`,
        list: {
          id: listId,
          name: name
        }
      });
    }
    
    // If we get here, it's an actual error response
    if (!kudosityResponse.ok || (responseData.error && responseData.error.code !== 'SUCCESS')) {
      console.error('Kudosity API error:', responseData);
      
      // Try to extract a meaningful error message
      let errorMessage = `Kudosity API error: ${kudosityResponse.status} ${kudosityResponse.statusText}`;
      let errorDetails = responseData;
      
      if (responseData && responseData.error) {
        if (typeof responseData.error === 'string') {
          errorMessage = `Kudosity API error: ${responseData.error}`;
        } else if (responseData.error.description) {
          errorMessage = `Kudosity API error: ${responseData.error.description}`;
        } else if (responseData.error.code) {
          errorMessage = `Kudosity API error: ${responseData.error.code}`;
        }
      }
      
      console.error(errorMessage);
      
      return NextResponse.json(
        { 
          success: false, 
          error: errorMessage,
          statusCode: kudosityResponse.status,
          details: errorDetails,
          rawResponse
        },
        { status: 500 }
      );
    }
    
    // Should never reach here if the API is working correctly, but adding as a fallback
    return NextResponse.json({
      success: true,
      message: `List "${name}" created successfully`,
      list: {
        id: responseData.id || 'unknown',
        name: name
      }
    });
    
  } catch (error: any) {
    console.error('Error creating Kudosity list:', error);
    
    // Enhanced error response with more details
    const errorDetails = {
      message: error.message,
      stack: error.stack,
      cause: error.cause,
      name: error.name,
      code: error.code
    };
    
    return NextResponse.json({
      success: false,
      error: `Error creating list: ${error.message}`,
      errorDetails
    }, { status: 500 });
  }
} 