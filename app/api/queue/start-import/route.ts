import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { fetchKlaviyoSegments, fetchKlaviyoLists } from '@/lib/api/klaviyo';

// Constants
const CHUNK_SIZE = 5000; // Process 5000 profiles per chunk

interface ImportRequestBody {
  sourceType: 'segments' | 'lists';
  sourceId: string;
  destinationId: string | null;
  destinationName?: string;
  fieldMappings: Record<string, string>;
  kudosity_username?: string;
  kudosity_password?: string;
  klaviyo_api_key?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body: ImportRequestBody = await request.json();
    const { 
      sourceType, 
      sourceId, 
      destinationId, 
      destinationName,
      fieldMappings, 
      kudosity_username, 
      kudosity_password, 
      klaviyo_api_key
    } = body;
    
    if (!sourceType || !sourceId || !fieldMappings) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }
    
    // Check if direct credentials were provided in the request
    const directCredentialsProvided = !!(kudosity_username && kudosity_password && klaviyo_api_key);
    
    console.log(`Start-import: Direct credentials provided: ${directCredentialsProvided}`);
    
    // Initialize variables for API credentials
    let userKlaviyoApiKey = klaviyo_api_key;
    let userKudosityUsername = kudosity_username;
    let userKudosityPassword = kudosity_password;
    
    // Use service role client to get the API system user
    let userId;
    let supabase;
    
    if (directCredentialsProvided) {
      // Create a Supabase client with the service role key to bypass RLS
      supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      console.log('Using service role client for direct API credentials');
      
      // Use the system API user ID
      userId = process.env.SYSTEM_API_USER_ID;
      
      if (!userId) {
        console.error('SYSTEM_API_USER_ID environment variable not configured');
        return NextResponse.json(
          { error: 'Server configuration error - system user not configured' },
          { status: 500 }
        );
      }
    } else {
      console.log('No direct credentials provided, trying session auth');
      // Authentication check
      supabase = createRouteHandlerClient({ cookies });
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        return NextResponse.json(
          { error: 'Unauthorized. Please provide API credentials or log in.' },
          { status: 401 }
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
      
      // Use credentials from database
      userKlaviyoApiKey = userKlaviyoApiKey || settings.klaviyo_api_key;
      userKudosityUsername = userKudosityUsername || settings.kudosity_username;
      userKudosityPassword = userKudosityPassword || settings.kudosity_password;
      userId = session.user.id;
    }
    
    // Check if we have all necessary credentials
    if (!userKlaviyoApiKey) {
      return NextResponse.json(
        { error: 'Klaviyo API key not found. Please configure it in the Settings page or provide it in the request.' },
        { status: 400 }
      );
    }
    
    if (!userKudosityUsername || !userKudosityPassword) {
      return NextResponse.json(
        { error: 'Kudosity credentials not found. Please configure them in the Settings page or provide them in the request.' },
        { status: 400 }
      );
    }
    
    // Get source name from Klaviyo
    let sourceName = '';
    try {
      if (sourceType === 'segments') {
        const segments = await fetchKlaviyoSegments(userKlaviyoApiKey);
        const segment = segments.find(s => s.id === sourceId);
        if (!segment) {
          return NextResponse.json(
            { error: `Segment with ID ${sourceId} not found in Klaviyo` },
            { status: 400 }
          );
        }
        sourceName = segment.attributes.name;
      } else {
        const lists = await fetchKlaviyoLists(userKlaviyoApiKey);
        const list = lists.find(l => l.id === sourceId);
        if (!list) {
          return NextResponse.json(
            { error: `List with ID ${sourceId} not found in Klaviyo` },
            { status: 400 }
          );
        }
        sourceName = list.attributes.name;
      }
    } catch (error: any) {
      return NextResponse.json(
        { error: `Failed to verify Klaviyo source: ${error.message}` },
        { status: 500 }
      );
    }
    
    // Get profile count to determine number of chunks
    let profileCount = 0;
    try {
      const countResponse = await fetch(`${request.nextUrl.origin}/api/klaviyo-profiles-count`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source_type: sourceType,
          source_id: sourceId,
          klaviyo_api_key: userKlaviyoApiKey
        }),
      });
      
      if (!countResponse.ok) {
        throw new Error(`Failed to get profile count: ${countResponse.statusText}`);
      }
      
      const countData = await countResponse.json();
      profileCount = countData.count || 0;
      
    } catch (error: any) {
      // Continue with a fallback approach - estimate count as 10,000
      console.error('Error getting profile count:', error);
      profileCount = 10000; // Default estimation
    }
    
    // Calculate number of chunks needed
    const numChunks = Math.max(1, Math.ceil(profileCount / CHUNK_SIZE));
    
    // Create a new import job in the queue
    let importId = uuidv4();
    
    const { data: importJob, error: importError } = await supabase
      .from('import_queue')
      .insert({
        id: importId,
        user_id: userId,
        status: 'pending',
        source_type: sourceType,
        source_id: sourceId,
        source_name: sourceName,
        destination_id: destinationId,
        destination_name: destinationName || null,
        field_mappings: fieldMappings,
        total_chunks: numChunks,
        total_profiles: profileCount,
      })
      .select()
      .single();
      
    if (importError) {
      return NextResponse.json(
        { error: `Failed to create import job: ${importError.message}` },
        { status: 500 }
      );
    }
    
    // Create chunk records for this import
    const chunksToInsert = [];
    for (let i = 0; i < numChunks; i++) {
      const startOffset = i * CHUNK_SIZE;
      const endOffset = Math.min(startOffset + CHUNK_SIZE - 1, profileCount - 1);
      
      chunksToInsert.push({
        import_id: importId,
        chunk_index: i,
        status: 'pending',
        profiles_count: Math.min(CHUNK_SIZE, endOffset - startOffset + 1),
        start_offset: startOffset,
        end_offset: endOffset,
      });
    }
    
    if (chunksToInsert.length > 0) {
      const { error: chunksError } = await supabase
        .from('import_chunks')
        .insert(chunksToInsert);
        
      if (chunksError) {
        // Try to clean up the import job
        await supabase.from('import_queue').delete().eq('id', importId);
        
        return NextResponse.json(
          { error: `Failed to create import chunks: ${chunksError.message}` },
          { status: 500 }
        );
      }
    }
    
    // Start processing the first chunk asynchronously
    try {
      fetch(`${request.nextUrl.origin}/api/queue/process-chunk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          import_id: importId
        }),
      }).catch(err => console.error('Failed to start chunk processing:', err));
    } catch (error) {
      console.error('Error starting chunk processing:', error);
      // Continue - we'll let the user manually trigger processing if needed
    }
    
    // Return the import job info
    return NextResponse.json({
      importId,
      status: 'pending',
      totalChunks: numChunks,
      totalProfiles: profileCount,
    });
    
  } catch (error: any) {
    console.error('Error starting import process:', error);
    return NextResponse.json(
      { error: error.message || 'An unknown error occurred' },
      { status: 500 }
    );
  }
} 