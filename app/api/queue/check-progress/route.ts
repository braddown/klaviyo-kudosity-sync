import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Get import ID from query params
    const { searchParams } = new URL(request.url);
    const importId = searchParams.get('importId');
    
    if (!importId) {
      return NextResponse.json(
        { error: 'Missing importId parameter' },
        { status: 400 }
      );
    }
    
    // Authentication check
    const routeHandlerClient = createRouteHandlerClient({ cookies });
    const { data: { session } } = await routeHandlerClient.auth.getSession();
    
    // Use appropriate client based on authentication status
    let supabase;
    if (!session) {
      // No session - use service role client to bypass RLS
      supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      console.log('Using service role client for unauthenticated access');
    } else {
      // Authenticated session - use route handler client
      supabase = routeHandlerClient;
    }
    
    // Job lookup
    const { data: importJob, error: importError } = await supabase
      .from('import_queue')
      .select('*')
      .eq('id', importId)
      .single();
      
    if (importError || !importJob) {
      return NextResponse.json(
        { error: `Import job not found: ${importError?.message || 'No data'}` },
        { status: 404 }
      );
    }
    
    // For direct API calls, if there's no session but the job exists, allow access
    // If the user is logged in, verify ownership
    if (!session) {
      // For unauthenticated requests, allow access to jobs created by the system API user
      const systemApiUserId = process.env.SYSTEM_API_USER_ID;
      
      if (importJob.user_id !== systemApiUserId) {
        return NextResponse.json(
          { 
            error: 'Authentication required to access this import job', 
            authError: true
          },
          { status: 401 }
        );
      }
      
      console.log('Allowing access to system API user import job without authentication');
    } else if (session.user.id !== importJob.user_id) {
      // User is authenticated but doesn't own this job
      return NextResponse.json(
        { error: 'You do not have permission to access this import job' },
        { status: 403 }
      );
    }
    
    // Get chunks for this import
    const { data: chunks, error: chunksError } = await supabase
      .from('import_chunks')
      .select('*')
      .eq('import_id', importId)
      .order('chunk_index', { ascending: true });
      
    if (chunksError) {
      return NextResponse.json(
        { error: `Failed to retrieve chunks: ${chunksError.message}` },
        { status: 500 }
      );
    }
    
    // Calculate progress percentages
    const totalChunks = importJob.total_chunks || 0;
    const completedChunks = importJob.completed_chunks || 0;
    const failedChunks = importJob.failed_chunks || 0;
    const processingChunks = chunks?.filter(c => c.status === 'processing').length || 0;
    const pendingChunks = chunks?.filter(c => c.status === 'pending').length || 0;
    
    const overallProgressPercent = totalChunks > 0 
      ? Math.round(((completedChunks + failedChunks) / totalChunks) * 100) 
      : 0;
    
    const processedProfiles = importJob.processed_profiles || 0;
    const totalProfiles = importJob.total_profiles || 0;
    const successProfiles = importJob.success_profiles || 0;
    const errorProfiles = importJob.error_profiles || 0;
    
    const profileProgressPercent = totalProfiles > 0 
      ? Math.round((processedProfiles / totalProfiles) * 100) 
      : 0;
    
    // Format chunk details for the response
    const chunkDetails = chunks?.map(chunk => ({
      id: chunk.id,
      index: chunk.chunk_index,
      status: chunk.status,
      profilesCount: chunk.profiles_count,
      successCount: chunk.success_count,
      errorCount: chunk.error_count,
      startOffset: chunk.start_offset,
      endOffset: chunk.end_offset,
      startedAt: chunk.started_at,
      completedAt: chunk.completed_at,
      errorMessage: chunk.error_message,
    })) || [];
    
    // Return detailed progress information
    return NextResponse.json({
      id: importJob.id,
      status: importJob.status,
      sourceType: importJob.source_type,
      sourceName: importJob.source_name,
      destinationName: importJob.destination_name,
      startedAt: importJob.started_at,
      completedAt: importJob.completed_at,
      errorMessage: importJob.error_message,
      progress: {
        overallPercent: overallProgressPercent,
        profilePercent: profileProgressPercent,
        chunks: {
          total: totalChunks,
          completed: completedChunks,
          failed: failedChunks,
          processing: processingChunks,
          pending: pendingChunks,
        },
        profiles: {
          total: totalProfiles,
          processed: processedProfiles,
          success: successProfiles,
          error: errorProfiles,
        }
      },
      chunks: chunkDetails,
    });
    
  } catch (error: any) {
    console.error('Error checking import progress:', error);
    return NextResponse.json(
      { error: error.message || 'An unknown error occurred' },
      { status: 500 }
    );
  }
} 