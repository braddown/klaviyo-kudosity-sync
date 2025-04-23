import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

// Import progress is tracked in the sync-to-kudosity route, 
// this route just forwards the request to that handler

export async function GET(request: NextRequest) {
  try {
    // Get job ID from query params
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');
    
    if (!jobId) {
      return NextResponse.json(
        { error: 'Missing job ID parameter' },
        { status: 400 }
      );
    }
    
    // Forward request to sync-to-kudosity route
    const syncProgressResponse = await fetch(
      `${request.nextUrl.origin}/api/sync-to-kudosity?jobId=${jobId}`,
      {
        headers: {
          cookie: request.headers.get('cookie') || '',
        },
      }
    );
    
    // If there's an error, pass it through
    if (!syncProgressResponse.ok) {
      const errorData = await syncProgressResponse.json().catch(() => ({ 
        error: `Failed to get job progress (status: ${syncProgressResponse.status})` 
      }));
      
      return NextResponse.json(
        { error: errorData.error || 'Failed to get job progress' },
        { status: syncProgressResponse.status }
      );
    }
    
    // Return the progress data
    const progressData = await syncProgressResponse.json();
    return NextResponse.json(progressData);
    
  } catch (error: any) {
    console.error('Error checking import progress:', error);
    return NextResponse.json(
      { error: error.message || 'An unknown error occurred' },
      { status: 500 }
    );
  }
} 