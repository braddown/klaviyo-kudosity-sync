import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { 
  fetchKlaviyoProfilesFromList, 
  fetchKlaviyoProfilesFromSegment 
} from '@/lib/api/klaviyo';
import { 
  createAndUploadProfilesCSV, 
  uploadContactsToKudosity, 
  checkBulkImportProgress 
} from '@/lib/api/kudosity';

// Constants
const MAX_IMPORT_CHECK_ATTEMPTS = 40;
const IMPORT_CHECK_DELAY = 2000; // 2 seconds between checks

interface ProcessChunkRequest {
  import_id: string;
  chunk_id?: string;
  chunk_index?: number;
}

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body: ProcessChunkRequest & {
      kudosity_username?: string;
      kudosity_password?: string;
      klaviyo_api_key?: string;
    } = await request.json();
    
    const { 
      import_id, 
      chunk_id, 
      chunk_index,
      kudosity_username: directKudosityUsername,
      kudosity_password: directKudosityPassword,
      klaviyo_api_key: directKlaviyoApiKey
    } = body;
    
    if (!import_id) {
      return NextResponse.json(
        { error: 'Missing import_id parameter' },
        { status: 400 }
      );
    }
    
    // Create appropriate Supabase client based on credentials
    let supabase;
    if (!!(directKudosityUsername && directKudosityPassword && directKlaviyoApiKey)) {
      // Create a Supabase client with the service role key to bypass RLS for direct API calls
      supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      
      // When using direct API credentials, check if the system API user is configured
      const systemApiUserId = process.env.SYSTEM_API_USER_ID;
      if (!systemApiUserId) {
        console.error('SYSTEM_API_USER_ID environment variable not configured');
        return NextResponse.json(
          { error: 'Server configuration error - system user not configured' },
          { status: 500 }
        );
      }
      
      console.log('Using service role client for direct API credentials');
    } else {
      // Use standard route handler client for authenticated users
      supabase = createRouteHandlerClient({ cookies });
    }
    
    // Get import job details
    const { data: importJob, error: importError } = await supabase
      .from('import_queue')
      .select('*')
      .eq('id', import_id)
      .single();
      
    if (importError || !importJob) {
      return NextResponse.json(
        { error: `Import job not found: ${importError?.message || 'No data'}` },
        { status: 404 }
      );
    }
    
    // Check if direct credentials were provided in the request
    const directCredentialsProvided = !!(directKudosityUsername && directKudosityPassword && directKlaviyoApiKey);
    
    console.log(`Process-chunk: Direct credentials provided: ${directCredentialsProvided}`);
    
    // Initialize variables for API credentials
    let userKlaviyoApiKey = directKlaviyoApiKey;
    let userKudosityUsername = directKudosityUsername;
    let userKudosityPassword = directKudosityPassword;
    
    // Try session authentication if direct credentials are not complete
    if (!directCredentialsProvided) {
      console.log('No direct credentials provided, trying session auth');
      // Authentication check
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        return NextResponse.json(
          { error: 'Unauthorized. Please provide API credentials or log in.' },
          { status: 401 }
        );
      }
      
      // Get job details including user_id
      const { data: jobData, error: jobError } = await supabase
        .from('import_jobs')
        .select('*')
        .eq('id', import_id)
        .single();
        
      if (jobError || !jobData) {
        return NextResponse.json(
          { error: 'Job not found' },
          { status: 404 }
        );
      }
      
      // Check if user has access to this job
      if (jobData.user_id !== session.user.id) {
        return NextResponse.json(
          { error: 'Unauthorized access to job' },
          { status: 403 }
        );
      }
      
      // Get API settings from Supabase
      const { data: settings, error } = await supabase
        .from('api_settings')
        .select('klaviyo_api_key, kudosity_username, kudosity_password')
        .eq('user_id', session.user.id)
        .single();
        
      if (error || !settings) {
        return NextResponse.json(
          { error: 'API settings not found. Please configure your API settings first.' },
          { status: 400 }
        );
      }
      
      // Use credentials from database if direct ones aren't provided
      userKlaviyoApiKey = userKlaviyoApiKey || settings.klaviyo_api_key;
      userKudosityUsername = userKudosityUsername || settings.kudosity_username;
      userKudosityPassword = userKudosityPassword || settings.kudosity_password;
    } else {
      console.log('Using directly provided credentials');
    }
    
    // Validate credentials
    if (!userKlaviyoApiKey || !userKudosityUsername || !userKudosityPassword) {
      return NextResponse.json(
        { error: 'Missing API credentials. Please provide complete credentials or ensure they are configured in your settings.' },
        { status: 401 }
      );
    }
    
    // Find the next pending chunk to process
    let chunkToProcess;
    if (chunk_id) {
      // Process specific chunk by ID
      const { data: chunk, error: chunkError } = await supabase
        .from('import_chunks')
        .select('*')
        .eq('id', chunk_id)
        .eq('import_id', import_id)
        .single();
        
      if (chunkError || !chunk) {
        return NextResponse.json(
          { error: `Chunk not found: ${chunkError?.message || 'No data'}` },
          { status: 404 }
        );
      }
      
      chunkToProcess = chunk;
    } else if (chunk_index !== undefined) {
      // Process specific chunk by index
      const { data: chunk, error: chunkError } = await supabase
        .from('import_chunks')
        .select('*')
        .eq('chunk_index', chunk_index)
        .eq('import_id', import_id)
        .single();
        
      if (chunkError || !chunk) {
        return NextResponse.json(
          { error: `Chunk not found: ${chunkError?.message || 'No data'}` },
          { status: 404 }
        );
      }
      
      chunkToProcess = chunk;
    } else {
      // Find the next pending chunk
      const { data: chunks, error: chunksError } = await supabase
        .from('import_chunks')
        .select('*')
        .eq('import_id', import_id)
        .eq('status', 'pending')
        .order('chunk_index', { ascending: true })
        .limit(1);
        
      if (chunksError) {
        return NextResponse.json(
          { error: `Failed to find next chunk: ${chunksError.message}` },
          { status: 500 }
        );
      }
      
      if (!chunks || chunks.length === 0) {
        // No more pending chunks, check if all chunks are complete
        const { data: completeCount, error: completeError } = await supabase
          .from('import_chunks')
          .select('count', { count: 'exact', head: true })
          .eq('import_id', import_id)
          .eq('status', 'complete');
          
        const { data: failedCount, error: failedError } = await supabase
          .from('import_chunks')
          .select('count', { count: 'exact', head: true })
          .eq('import_id', import_id)
          .eq('status', 'error');
          
        // Get actual count values or default to 0
        const completedChunks = completeCount !== null ? Number(completeCount) : 0;
        const failedChunks = failedCount !== null ? Number(failedCount) : 0;
        
        // Update import job status
        if (completedChunks + failedChunks === importJob.total_chunks) {
          await supabase
            .from('import_queue')
            .update({
              status: failedChunks === 0 ? 'complete' : 'completed_with_errors',
              completed_at: new Date().toISOString(),
              completed_chunks: completedChunks,
              failed_chunks: failedChunks
            })
            .eq('id', import_id);
        }
        
        return NextResponse.json({
          status: 'no_pending_chunks',
          completedChunks,
          failedChunks,
          totalChunks: importJob.total_chunks
        });
      }
      
      chunkToProcess = chunks[0];
    }
    
    // Mark chunk as processing
    await supabase
      .from('import_chunks')
      .update({
        status: 'processing',
        started_at: new Date().toISOString()
      })
      .eq('id', chunkToProcess.id);
      
    // Update import job status if it's still pending
    if (importJob.status === 'pending') {
      await supabase
        .from('import_queue')
        .update({
          status: 'processing'
        })
        .eq('id', import_id);
    }
    
    try {
      // Fetch profiles for this chunk from Klaviyo
      let profiles = [];
      if (importJob.source_type === 'segments') {
        profiles = await fetchKlaviyoProfilesFromSegment(
          userKlaviyoApiKey,
          importJob.source_id,
          chunkToProcess.start_offset,
          chunkToProcess.profiles_count
        );
      } else {
        profiles = await fetchKlaviyoProfilesFromList(
          userKlaviyoApiKey,
          importJob.source_id,
          chunkToProcess.start_offset,
          chunkToProcess.profiles_count
        );
      }
      
      // Update chunk with retrieved profiles count
      await supabase
        .from('import_chunks')
        .update({
          profiles_count: profiles.length
        })
        .eq('id', chunkToProcess.id);
        
      // Update import job with progress
      await supabase
        .from('import_queue')
        .update({
          processed_profiles: supabase.rpc('increment', { 
            inc_row_id: import_id, 
            inc_field: 'processed_profiles', 
            inc_amount: profiles.length 
          })
        })
        .eq('id', import_id);
      
      // Process the profiles according to field mappings
      const fieldMappings = importJob.field_mappings;
      
      // Create a CSV file for this chunk
      const { csvPath, csvContent } = await createAndUploadProfilesCSV(
        profiles,
        fieldMappings,
        `import_${import_id}_chunk_${chunkToProcess.chunk_index}`
      );
      
      // Update chunk with CSV path
      await supabase
        .from('import_chunks')
        .update({
          csv_file_path: csvPath
        })
        .eq('id', chunkToProcess.id);
      
      // Upload the CSV to Kudosity
      let listId = importJob.destination_id || null;
      const listName = importJob.destination_name || `${importJob.source_name} (Import)`;
      
      const importResult = await uploadContactsToKudosity(
        userKudosityUsername,
        userKudosityPassword,
        csvContent,
        listId,
        listName
      );
      
      // If this is the first chunk and no destination was specified, use the created list for future chunks
      if (!listId && importResult.listId) {
        // Update import job with the new list ID
        await supabase
          .from('import_queue')
          .update({
            destination_id: importResult.listId,
            destination_name: listName
          })
          .eq('id', import_id);
        
        // Save the list ID for future reference
        listId = importResult.listId;
      }
      
      // Update chunk with Kudosity import ID
      await supabase
        .from('import_chunks')
        .update({
          kudosity_import_id: importResult.importId
        })
        .eq('id', chunkToProcess.id);
      
      // Monitor the import progress on Kudosity side
      let attempts = 0;
      let importProgress: {
        status: string;
        processed: number;
        total: number;
        errors: number;
        errorDetails?: string;
        complete: boolean;
        success?: number;
      } | undefined;
      let importComplete = false;
      
      while (attempts < MAX_IMPORT_CHECK_ATTEMPTS && !importComplete) {
        attempts++;
        
        // Wait before checking progress
        await new Promise(resolve => setTimeout(resolve, IMPORT_CHECK_DELAY));
        
        // Check import progress
        importProgress = await checkBulkImportProgress(
          userKudosityUsername,
          userKudosityPassword,
          importResult.importId
        );
        
        if (importProgress && (importProgress.status === 'complete' || importProgress.status === 'error')) {
          importComplete = true;
        }
      }
      
      if (!importComplete) {
        throw new Error('Timeout while waiting for Kudosity import to complete');
      }
      
      if (importProgress && importProgress.status === 'error') {
        throw new Error(`Kudosity import failed: ${importProgress.errorDetails || 'Unknown error'}`);
      }
      
      // Ensure importProgress exists before using it
      if (!importProgress) {
        throw new Error('Import progress data is missing');
      }
      
      // Update chunk with success stats
      await supabase
        .from('import_chunks')
        .update({
          status: 'complete',
          completed_at: new Date().toISOString(),
          success_count: importProgress.processed - (importProgress.errors || 0),
          error_count: importProgress.errors || 0
        })
        .eq('id', chunkToProcess.id);
      
      // Update import job with success stats
      await supabase
        .from('import_queue')
        .update({
          completed_chunks: supabase.rpc('increment', { 
            inc_row_id: import_id, 
            inc_field: 'completed_chunks', 
            inc_amount: 1 
          }),
          success_profiles: supabase.rpc('increment', { 
            inc_row_id: import_id, 
            inc_field: 'success_profiles', 
            inc_amount: importProgress.processed - (importProgress.errors || 0) 
          }),
          error_profiles: supabase.rpc('increment', { 
            inc_row_id: import_id, 
            inc_field: 'error_profiles', 
            inc_amount: importProgress.errors || 0 
          })
        })
        .eq('id', import_id);
      
      // Try to start processing the next chunk asynchronously
      try {
        fetch(`${request.nextUrl.origin}/api/queue/process-chunk`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            import_id
          }),
        }).catch(err => console.error('Failed to start next chunk processing:', err));
      } catch (error) {
        console.error('Error starting next chunk processing:', error);
        // Continue - this is not critical
      }
      
      return NextResponse.json({
        status: 'success',
        chunkId: chunkToProcess.id,
        chunkIndex: chunkToProcess.chunk_index,
        importId: import_id,
        profilesProcessed: profiles.length,
        successCount: importProgress.processed - (importProgress.errors || 0),
        errorCount: importProgress.errors || 0
      });
      
    } catch (error: any) {
      console.error(`Error processing chunk ${chunkToProcess.id}:`, error);
      
      // Update chunk with error
      await supabase
        .from('import_chunks')
        .update({
          status: 'error',
          error_message: error.message || 'Unknown error',
          completed_at: new Date().toISOString()
        })
        .eq('id', chunkToProcess.id);
      
      // Update import job with failed chunk
      await supabase
        .from('import_queue')
        .update({
          failed_chunks: supabase.rpc('increment', { 
            inc_row_id: import_id, 
            inc_field: 'failed_chunks', 
            inc_amount: 1 
          })
        })
        .eq('id', import_id);
      
      // Try to start processing the next chunk asynchronously despite this error
      try {
        fetch(`${request.nextUrl.origin}/api/queue/process-chunk`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            import_id
          }),
        }).catch(err => console.error('Failed to start next chunk processing:', err));
      } catch (nextChunkError) {
        console.error('Error starting next chunk processing:', nextChunkError);
        // Continue - this is not critical
      }
      
      return NextResponse.json(
        { error: error.message || 'An unknown error occurred' },
        { status: 500 }
      );
    }
    
  } catch (error: any) {
    console.error('Error processing chunk:', error);
    return NextResponse.json(
      { error: error.message || 'An unknown error occurred' },
      { status: 500 }
    );
  }
} 