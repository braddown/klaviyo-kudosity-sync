import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    console.log("=== API ROUTE: /api/test-klaviyo-auth POST ===");
    
    // Get API key from request
    const body = await request.json().catch(() => ({}));
    const apiKey = body.apiKey;
    
    if (!apiKey) {
      return NextResponse.json({ 
        success: false, 
        message: "Missing API key in request" 
      }, { status: 400 });
    }
    
    // Mask API key for logging
    const maskedKey = `${apiKey.substring(0, 5)}...${apiKey.substring(apiKey.length - 3)}`;
    console.log(`Testing Klaviyo authentication with key: ${maskedKey}`);
    
    // Test the API key directly against Klaviyo's API
    const response = await fetch('https://a.klaviyo.com/api/profiles?page[size]=1', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Klaviyo-API-Key ${apiKey}`,
        'revision': '2023-10-15'
      }
    });
    
    // Get response details
    const status = response.status;
    const statusText = response.statusText;
    console.log(`Klaviyo auth test response: ${status} ${statusText}`);
    
    // Try to get response body for more details
    let responseBody = null;
    try {
      responseBody = await response.json();
    } catch (e) {
      console.log('Could not parse response as JSON');
      try {
        responseBody = await response.text();
      } catch (textError) {
        console.log('Could not get response text');
      }
    }
    
    if (response.ok) {
      return NextResponse.json({
        success: true,
        message: "Klaviyo API key is valid",
        status,
        data: {
          profiles_count: responseBody?.data?.length || 0
        }
      });
    } else {
      // Enhanced error response with more details
      return NextResponse.json({
        success: false,
        message: `Klaviyo API authentication failed: ${status} ${statusText}`,
        status,
        error: responseBody,
        errorDetails: {
          status,
          statusText,
          responseType: typeof responseBody,
          responseSize: JSON.stringify(responseBody).length
        }
      }, { status: response.status === 401 ? 401 : 500 });
    }
  } catch (error: any) {
    console.error('Error testing Klaviyo API key:', error);
    
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
      message: `Error: ${error.message}`,
      error: error.toString(),
      errorDetails
    }, { status: 500 });
  }
} 