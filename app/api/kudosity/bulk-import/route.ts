import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { 
  createAndUploadContactsCSV, 
  uploadContactsToKudosity,
  checkBulkImportProgress 
} from '@/lib/api/kudosity';

/**
 * POST handler for initiating bulk upload of contacts to Kudosity
 * Request body should contain:
 * - contacts: Array of contact objects (must include mobile field)
 * - listId: (optional) Existing Kudosity list ID to add contacts to
 * - listName: (optional) Name for a new list if listId not provided
 * Response includes importId for tracking progress
 */
export async function POST(request: Request) {
  try {
    console.log("=== API ROUTE: /api/kudosity/bulk-import POST ===");
    
    // Parse request body
    const body = await request.json().catch(() => ({}));
    
    // Check authentication
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
      console.error("Authentication error:", sessionError || "No session found");
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Please log in' },
        { status: 401 }
      );
    }
    
    // Get API credentials from database
    const { data: settings, error: settingsError } = await supabase
      .from('api_settings')
      .select('kudosity_username, kudosity_password')
      .eq('user_id', data.session.user.id)
      .single();
    
    if (settingsError || !settings || !settings.kudosity_username || !settings.kudosity_password) {
      console.error("Error fetching Kudosity credentials:", settingsError || "Missing credentials");
      return NextResponse.json(
        { success: false, error: 'Kudosity API credentials not configured' },
        { status: 400 }
      );
    }
    
    // Validate request
    if (!body.contacts || !Array.isArray(body.contacts) || body.contacts.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No contacts provided for import' },
        { status: 400 }
      );
    }
    
    if (!body.listId && !body.listName) {
      return NextResponse.json(
        { success: false, error: 'Either listId or listName must be provided' },
        { status: 400 }
      );
    }
    
    // Validate that all contacts have the required 'mobile' field
    const invalidContacts = body.contacts.filter((contact: {mobile?: string, [key: string]: any}) => !contact.mobile);
    if (invalidContacts.length > 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: `${invalidContacts.length} contacts are missing the required 'mobile' field` 
        },
        { status: 400 }
      );
    }
    
    try {
      // Step 1: Create and upload CSV file to Supabase storage
      console.log(`Creating CSV for ${body.contacts.length} contacts`);
      const listIdentifier = body.listId || body.listName.replace(/[^a-z0-9]/gi, '-').toLowerCase();
      const filename = `contacts-${listIdentifier}-${Date.now()}`;
      
      const csvUrl = await createAndUploadContactsCSV(body.contacts, filename);
      
      // Step 2: Upload the CSV to Kudosity
      console.log("Uploading CSV to Kudosity");
      const importId = await uploadContactsToKudosity(
        settings.kudosity_username,
        settings.kudosity_password,
        csvUrl,
        body.listId,
        body.listName
      );
      
      // Step 3: Initial progress check
      console.log("Checking initial import progress");
      const initialProgress = await checkBulkImportProgress(
        settings.kudosity_username,
        settings.kudosity_password,
        importId
      );
      
      // Save the import details to the database for future reference
      const { error: saveError } = await supabase
        .from('kudosity_imports')
        .insert({
          user_id: data.session.user.id,
          import_id: importId,
          list_id: body.listId,
          list_name: body.listName,
          contact_count: body.contacts.length,
          status: initialProgress.status,
          csv_url: csvUrl,
          created_at: new Date().toISOString()
        });
      
      if (saveError) {
        console.error("Error saving import details:", saveError);
        // Non-blocking error, continue with the process
      }
      
      // Return success response with import ID and initial progress
      return NextResponse.json({
        success: true,
        message: `Bulk import initiated with ${body.contacts.length} contacts`,
        importId,
        progress: initialProgress,
        csvUrl
      });
      
    } catch (importError: any) {
      console.error("Error during import process:", importError);
      return NextResponse.json(
        { success: false, error: importError.message },
        { status: 500 }
      );
    }
    
  } catch (error: any) {
    console.error("Error in bulk import API:", error);
    return NextResponse.json(
      { success: false, error: `Server error: ${error.message}` },
      { status: 500 }
    );
  }
}

/**
 * GET handler for checking the progress of a bulk import
 * Query parameters:
 * - importId: The import ID returned from the POST handler
 */
export async function GET(request: Request) {
  try {
    console.log("=== API ROUTE: /api/kudosity/bulk-import GET ===");
    
    // Get import ID from query parameters
    const url = new URL(request.url);
    const importId = url.searchParams.get('importId');
    
    if (!importId) {
      return NextResponse.json(
        { success: false, error: 'Missing importId parameter' },
        { status: 400 }
      );
    }
    
    // Check authentication
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
      console.error("Authentication error:", sessionError || "No session found");
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Please log in' },
        { status: 401 }
      );
    }
    
    // Get API credentials from database
    const { data: settings, error: settingsError } = await supabase
      .from('api_settings')
      .select('kudosity_username, kudosity_password')
      .eq('user_id', data.session.user.id)
      .single();
    
    if (settingsError || !settings || !settings.kudosity_username || !settings.kudosity_password) {
      console.error("Error fetching Kudosity credentials:", settingsError || "Missing credentials");
      return NextResponse.json(
        { success: false, error: 'Kudosity API credentials not configured' },
        { status: 400 }
      );
    }
    
    try {
      // Check import progress
      const progress = await checkBulkImportProgress(
        settings.kudosity_username,
        settings.kudosity_password,
        importId
      );
      
      // Update status in the database if the import is complete
      if (progress.complete) {
        const { error: updateError } = await supabase
          .from('kudosity_imports')
          .update({
            status: progress.status,
            processed_count: progress.processed,
            error_count: progress.errors,
            completed_at: new Date().toISOString()
          })
          .eq('import_id', importId)
          .eq('user_id', data.session.user.id);
        
        if (updateError) {
          console.error("Error updating import record:", updateError);
          // Non-blocking error, continue with the response
        }
      }
      
      // Return progress information
      return NextResponse.json({
        success: true,
        importId,
        progress
      });
      
    } catch (progressError: any) {
      console.error("Error checking import progress:", progressError);
      return NextResponse.json(
        { success: false, error: progressError.message },
        { status: 500 }
      );
    }
    
  } catch (error: any) {
    console.error("Error in bulk import progress API:", error);
    return NextResponse.json(
      { success: false, error: `Server error: ${error.message}` },
      { status: 500 }
    );
  }
} 