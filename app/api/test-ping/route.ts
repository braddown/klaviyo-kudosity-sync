import { NextResponse } from 'next/server';

/**
 * Simple API ping endpoint to test basic API connectivity
 */
export async function GET() {
  try {
    console.log("=== API ROUTE: /api/test-ping GET ===");
    
    // Get server timestamp
    const timestamp = new Date().toISOString();
    
    // Return simple success response with timestamp
    return NextResponse.json({
      success: true,
      message: 'API server is reachable',
      timestamp,
      environment: process.env.NODE_ENV || 'unknown',
    });
  } catch (error: any) {
    console.error('Error in API ping route:', error);
    
    return NextResponse.json({
      success: false,
      error: `Server error: ${error.message}`,
    }, { status: 500 });
  }
}

/**
 * POST version of ping to test if all HTTP methods are working
 */
export async function POST() {
  try {
    console.log("=== API ROUTE: /api/test-ping POST ===");
    
    // Get server timestamp
    const timestamp = new Date().toISOString();
    
    // Return simple success response with timestamp
    return NextResponse.json({
      success: true,
      message: 'API server POST method is working',
      timestamp,
      environment: process.env.NODE_ENV || 'unknown',
    });
  } catch (error: any) {
    console.error('Error in API ping route (POST):', error);
    
    return NextResponse.json({
      success: false,
      error: `Server error: ${error.message}`,
    }, { status: 500 });
  }
} 