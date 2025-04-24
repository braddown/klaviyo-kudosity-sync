import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { fetchKlaviyoSegments, fetchKlaviyoLists } from '@/lib/api/klaviyo';
import { 
  fetchKudosityLists, 
  createAndUploadContactsCSV,
  createAndUploadProfilesCSV,
  uploadContactsToKudosity, 
  checkBulkImportProgress 
} from '@/lib/api/kudosity';
import { getSupabaseAdminClient } from '@/lib/supabase';

// Constants for chunked processing
const CHUNK_SIZE = 5000;  // Optimal size for each chunk
const MAX_CONCURRENT_CHUNKS = 1;  // Process one chunk at a time to avoid overwhelming the API
const MAX_IMPORT_CHECK_ATTEMPTS = 40;  // Increase from 20 to 40 attempts
const IMPORT_CHECK_DELAY = 2000;  // 2 seconds between checks

// In-memory storage for job progress (would be replaced with a proper DB solution in production)
const jobProgress: Record<string, any> = {};

// In-memory storage for tracking individual chunk imports
const chunkImports: Record<string, any[]> = {};

// In-memory storage for first chunk list IDs
const firstChunkListIds: Record<string, string> = {};

export async function POST(request: NextRequest) {
  try {
    // Parse request body first to check for direct credentials
    const body = await request.json();
    const { 
      sourceType, 
      sourceId, 
      destinationId, 
      fieldMappings, 
      kudosity_username, 
      kudosity_password, 
      klaviyo_api_key,
      enableChunking = true  // Default to true for chunking
    } = body;
    
    if (!sourceType || !sourceId || !fieldMappings) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }
    
    // Initialize variables for API credentials
    let userKlaviyoApiKey = klaviyo_api_key;
    let userKudosityUsername = kudosity_username;
    let userKudosityPassword = kudosity_password;
    let userId = 'direct_api';
    
    // Try session authentication if direct credentials are not provided
    if (!userKlaviyoApiKey || !userKudosityUsername || !userKudosityPassword) {
      // Authentication check
      const supabase = createRouteHandlerClient({ cookies });
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
      userKlaviyoApiKey = settings.klaviyo_api_key;
      userKudosityUsername = settings.kudosity_username;
      userKudosityPassword = settings.kudosity_password;
      userId = session.user.id;
    }
    
    // Check if we have all necessary credentials now
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
    
    // Create a unique job ID
    const jobId = uuidv4();
    
    // Initialize job progress
    jobProgress[jobId] = {
      state: 'retrieving',
      progress: 0,
      currentPage: 1,
      totalPages: 0,
      profilesRetrieved: 0,
      totalProfiles: 0,
      enableChunking,
      error: null,
      stats: null,
      chunks: {
        total: 0,
        processed: 0,
        failed: 0,
        inProgress: 0,
        details: []
      }
    };
    
    // Initialize chunk tracking for this job
    chunkImports[jobId] = [];
    
    // Start the sync process asynchronously
    startSyncProcess(
      jobId, 
      sourceType, 
      sourceId, 
      destinationId, 
      fieldMappings, 
      userId, 
      userKlaviyoApiKey, 
      userKudosityUsername, 
      userKudosityPassword,
      enableChunking
    );
    
    // Return the job ID immediately
    return NextResponse.json({ jobId });
    
  } catch (error: any) {
    console.error('Error starting sync process:', error);
    return NextResponse.json(
      { error: error.message || 'An unknown error occurred' },
      { status: 500 }
    );
  }
}

async function startSyncProcess(
  jobId: string,
  sourceType: 'segments' | 'lists',
  sourceId: string,
  destinationId: string | null,
  fieldMappings: Record<string, string>,
  userId: string,
  klaviyoApiKey: string,
  kudosityUsername: string,
  kudosityPassword: string,
  enableChunking: boolean = true
) {
  // Initialize chunk tracking immediately to avoid null references
  if (!chunkImports[jobId]) {
    chunkImports[jobId] = [];
  }
  
  // Log environment info to help debugging
  console.log('Sync environment:', {
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
    jobId,
    sourceType,
    enableChunking,
    hasDestinationId: Boolean(destinationId)
  });
  
  try {
    // We already have the credentials passed in, no need to fetch from database
    try {
      // Step 1: Fetch data directly from Klaviyo
      updateJobProgress(jobId, {
        state: 'retrieving',
        progress: 5,
        message: 'Retrieving data from Klaviyo...',
      });
      
      let profiles: any[] = [];
      let sourceName = '';
      
      // In a real implementation, fetch the actual profiles from either segment or list
      if (sourceType === 'segments') {
        // Validate that the segment exists
        const segments = await fetchKlaviyoSegments(klaviyoApiKey);
        const segment = segments.find(s => s.id === sourceId);
        
        if (!segment) {
          throw new Error(`Segment with ID ${sourceId} not found in Klaviyo`);
        }
        
        sourceName = segment.attributes.name;
        updateJobProgress(jobId, {
          message: `Found segment "${sourceName}", retrieving profiles...`,
        });
        
        // TODO: Implement actual profile fetching from Klaviyo segment
        // For now, we'll simulate it with dummy data
        profiles = generateDummyProfiles(26000); // Simulating a large list
      } else {
        // Validate that the list exists
        const lists = await fetchKlaviyoLists(klaviyoApiKey);
        const list = lists.find(l => l.id === sourceId);
        
        if (!list) {
          throw new Error(`List with ID ${sourceId} not found in Klaviyo`);
        }
        
        sourceName = list.attributes.name;
        updateJobProgress(jobId, {
          message: `Found list "${sourceName}", retrieving profiles...`,
        });
        
        // TODO: Implement actual profile fetching from Klaviyo list
        // For now, we'll simulate it with dummy data
        profiles = generateDummyProfiles(26000); // Simulating a large list
      }
      
      // Update progress with total profile count
      updateJobProgress(jobId, {
        profilesRetrieved: profiles.length,
        totalProfiles: profiles.length,
        progress: 25, // First 25% of the process
      });
      
      // Step 2: Process Kudosity destination - either confirm list exists or prepare to create new one
      updateJobProgress(jobId, {
        state: 'processing',
        progress: 30,
        message: 'Preparing Kudosity destination...',
      });
      
      let kudosityListId = destinationId;
      let kudosityListName = '';
      
      if (destinationId) {
        // If destination ID is provided, validate that it exists
        const kudosityLists = await fetchKudosityLists(
          kudosityUsername,
          kudosityPassword,
          true // Force direct API call to prevent recursion
        );
        
        const kudosityList = kudosityLists.find(l => l.id === destinationId);
        if (!kudosityList) {
          updateJobProgress(jobId, {
            message: `List with ID ${destinationId} not found in Kudosity. Creating a new list...`,
          });
          // Don't throw error, just set to null so we'll create a new list
          kudosityListId = null;
        } else {
          kudosityListName = kudosityList.name;
          updateJobProgress(jobId, {
            message: `Found Kudosity list "${kudosityListName}", processing data...`,
          });
        }
      }
      
      // If no valid list ID, we'll create a new list using the source name
      if (!kudosityListId) {
        kudosityListName = `${sourceName} (from Klaviyo)`;
        updateJobProgress(jobId, {
          message: `Will create new Kudosity list: "${kudosityListName}"`,
        });
      }
      
      // Step 3: Transform data according to field mappings
      updateJobProgress(jobId, {
        state: 'uploading',
        progress: 50,
        message: 'Transforming data for Kudosity...',
      });
      
      // Map Klaviyo profiles to Kudosity contacts based on field mappings
      const kudosityContacts = profiles.map(profile => {
        const contact: Record<string, any> = { mobile: '' };
        
        // Apply field mappings
        Object.entries(fieldMappings).forEach(([kudosityField, klaviyoField]) => {
          if (klaviyoField && profile[klaviyoField] !== undefined) {
            contact[kudosityField] = profile[klaviyoField];
          }
        });
        
        // Ensure mobile field is properly formatted
        if (!contact.mobile && profile.phone_number) {
          contact.mobile = profile.phone_number;
        }
        
        return contact;
      });
      
      // Filter out contacts without mobile numbers
      const validContacts = kudosityContacts.filter(contact => contact.mobile);
      const invalidCount = kudosityContacts.length - validContacts.length;
      
      updateJobProgress(jobId, {
        message: `Transformed ${validContacts.length} valid contacts (${invalidCount} skipped due to missing mobile numbers)`,
      });
      
      if (validContacts.length === 0) {
        throw new Error('No valid contacts with mobile numbers found for import');
      }
      
      // Step 4: Decide if we need to use chunking
      const shouldUseChunking = enableChunking && validContacts.length > CHUNK_SIZE;
      
      if (shouldUseChunking) {
        // Split contacts into chunks
        const chunks = chunkArray(validContacts, CHUNK_SIZE);
        
        // Reset chunk imports to make sure we start fresh
        chunkImports[jobId] = [];
        
        updateJobProgress(jobId, {
          state: 'importing',
          progress: 60,
          message: `Large list detected (${validContacts.length} contacts). Processing in ${chunks.length} chunks of ${CHUNK_SIZE} contacts each...`,
          chunks: {
            total: chunks.length,
            processed: 0,
            failed: 0,
            inProgress: 0,
            details: chunks.map((_, index) => ({
              chunkId: index + 1,
              status: 'pending',
              size: index < chunks.length - 1 ? CHUNK_SIZE : validContacts.length % CHUNK_SIZE || CHUNK_SIZE,
              progress: 0,
              importId: null,
              error: null
            }))
          }
        });
        
        // Process chunks sequentially to avoid overwhelming APIs
        let successfulImports = 0;
        let failedImports = 0;
        let totalImported = 0;
        let totalErrors = 0;
        let firstChunkListId = null; // Store the list ID from the first chunk
        
        // Log chunk processing start
        console.log(`Starting chunked processing of ${chunks.length} chunks for job ${jobId}`);
        
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          const chunkNumber = i + 1;
          
          console.log(`Processing chunk ${chunkNumber}/${chunks.length} with ${chunk.length} contacts for job ${jobId}`);
          
          updateJobProgress(jobId, {
            message: `Processing chunk ${chunkNumber}/${chunks.length} (${chunk.length} contacts)...`,
            chunks: {
              details: jobProgress[jobId].chunks.details.map((detail: any, idx: number) => 
                idx === i 
                  ? { ...detail, status: 'processing', progress: 0 } 
                  : detail
              ),
              inProgress: jobProgress[jobId].chunks.inProgress + 1
            },
            progress: 60 + Math.floor((i / chunks.length) * 30)
          });
          
          try {
            // Create CSV for this chunk
            const chunkFilename = `sync-${sourceType}-${sourceName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-chunk${chunkNumber}-${Date.now()}`;
            
            // Upload the chunk CSV
            const csvUrl = await createAndUploadContactsCSV(
              chunk as Array<{mobile: string, [key: string]: any}>,
              chunkFilename
            );
            
            // Update chunk status
            updateJobProgress(jobId, {
              chunks: {
                details: jobProgress[jobId].chunks.details.map((detail: any, idx: number) => 
                  idx === i 
                    ? { ...detail, status: 'uploading', progress: 40, csvUrl } 
                    : detail
                )
              }
            });
            
            // Use the original list ID for the first chunk, but use the list created from first chunk for subsequent chunks
            let targetListId = null;
            let targetListName = null;
            
            if (i === 0) {
              // For the first chunk, use the original list ID or create new list
              targetListId = kudosityListId;
              targetListName = kudosityListName;
              
              // Make sure we have a list name for the first chunk if there's no list ID
              if (!targetListId && !targetListName) {
                targetListName = `${sourceName} from Klaviyo (${new Date().toISOString().slice(0, 19).replace('T', ' ')})`;
                console.log(`Creating new list for first chunk with name: "${targetListName}"`);
              }
            } else {
              // For subsequent chunks, check for stored list ID first in global map
              if (firstChunkListIds[jobId]) {
                targetListId = firstChunkListIds[jobId];
                console.log(`Using stored first chunk list ID ${targetListId} from global map for job ${jobId}, chunk ${chunkNumber}`);
              }
              // Or check if we have a valid first chunk import with a listId
              else if (chunkImports[jobId] && 
                  chunkImports[jobId].length > 0 && 
                  chunkImports[jobId][0] && 
                  firstChunkListId) {
                targetListId = firstChunkListId;
                console.log(`Using firstChunkListId ${targetListId} from local variable for job ${jobId}, chunk ${chunkNumber}`);
              } 
              else if (jobProgress[jobId] && jobProgress[jobId].firstChunkListId) {
                targetListId = jobProgress[jobId].firstChunkListId;
                console.log(`Using firstChunkListId ${targetListId} from job progress for job ${jobId}, chunk ${chunkNumber}`);
              }
              else {
                console.warn(`First chunk import data not available for job ${jobId}. Using original list ID for chunk ${chunkNumber}`);
                // Fall back to the original list ID if we can't get the one from the first chunk
                targetListId = kudosityListId;
                
                // If we don't have a list ID, we must provide a list name
                if (!targetListId) {
                  // Use the original list name or create a new one for this chunk
                  targetListName = kudosityListName || `${sourceName} Chunk ${chunkNumber} (from Klaviyo)`;
                  console.log(`No list ID available, using list name "${targetListName}" for chunk ${chunkNumber}`);
                }
              }
            }
            
            // Final safety check - ensure we have either a list ID or a list name
            if (!targetListId && !targetListName) {
              targetListName = `${sourceName} Chunk ${chunkNumber} (from Klaviyo)`;
              console.log(`No list ID or name available, creating new list "${targetListName}" for chunk ${chunkNumber}`);
            }
            
            console.log(`Chunk ${chunkNumber}: Using target list ID ${targetListId || 'null'} and name ${targetListName || 'null'}`);
            
            // Start import for this chunk
            const importId = await uploadContactsToKudosity(
              kudosityUsername,
              kudosityPassword,
              csvUrl,
              targetListId,
              targetListName || undefined
            );
            
            // Track this chunk's import ID and list ID
            const chunkInfo = {
              chunkId: chunkNumber,
              importId,
              listId: targetListId, // Store the list ID we used for this chunk
              status: 'importing',
              size: chunk.length
            };
            
            // Add to chunked imports tracking
            chunkImports[jobId].push(chunkInfo);
            
            // If this is the first chunk, store its list ID for subsequent chunks
            if (i === 0) {
              firstChunkListId = targetListId;
              
              // Also store in our global map
              if (targetListId) {
                firstChunkListIds[jobId] = targetListId;
                console.log(`Stored first chunk list ID ${targetListId} in global map for job ${jobId}`);
              }
              
              // Update job progress to include this ID
              updateJobProgress(jobId, {
                firstChunkListId
              });
              
              console.log(`First chunk (${chunkNumber}) completed. List ID: ${firstChunkListId || 'null'}`);
            }
            
            // Update chunk status
            updateJobProgress(jobId, {
              chunks: {
                details: jobProgress[jobId].chunks.details.map((detail: any, idx: number) => 
                  idx === i 
                    ? { ...detail, status: 'importing', progress: 70, importId } 
                    : detail
                )
              }
            });
            
            // Monitor import progress for this chunk
            let importComplete = false;
            let attempts = 0;
            let finalProgress = null;
            
            while (!importComplete && attempts < MAX_IMPORT_CHECK_ATTEMPTS) {
              attempts++;
              
              try {
                const progress = await checkBulkImportProgress(
                  kudosityUsername,
                  kudosityPassword,
                  importId
                );
                
                // Update chunk status
                updateJobProgress(jobId, {
                  chunks: {
                    details: jobProgress[jobId].chunks.details.map((detail: any, idx: number) => 
                      idx === i 
                        ? { 
                            ...detail, 
                            status: progress.complete ? 'completed' : 'importing', 
                            progress: 70 + Math.floor((progress.processed / Math.max(1, progress.total)) * 30),
                            importProgress: progress
                          } 
                        : detail
                    )
                  }
                });
                
                if (progress.complete) {
                  importComplete = true;
                  finalProgress = progress;
                  
                  console.log(`Chunk ${chunkNumber} import completed. Processed ${progress.processed} contacts with ${progress.errors} errors.`);
                  
                  // Update chunk status as complete
                  updateJobProgress(jobId, {
                    chunks: {
                      details: jobProgress[jobId].chunks.details.map((detail: any, idx: number) => 
                        idx === i 
                          ? { ...detail, status: 'completed', progress: 100, importProgress: progress } 
                        : detail
                      ),
                      processed: jobProgress[jobId].chunks.processed + 1,
                      inProgress: jobProgress[jobId].chunks.inProgress - 1
                    }
                  });
                  
                  // Update overall stats
                  successfulImports++;
                  totalImported += (progress.processed - progress.errors);
                  totalErrors += progress.errors;
                  
                  // Save actual list ID from first chunk to use for subsequent chunks
                  if (i === 0 && !kudosityListId) {
                    const listId = await getListIdFromImport(kudosityUsername, kudosityPassword, importId, jobId);
                    if (listId) {
                      // Store the list ID in multiple places to ensure it's available
                      firstChunkListIds[jobId] = listId;
                      if (chunkImports[jobId] && chunkImports[jobId][0]) {
                        chunkImports[jobId][0].listId = listId;
                      }
                      firstChunkListId = listId;
                      
                      // Also update job progress
                      updateJobProgress(jobId, {
                        firstChunkListId: listId
                      });
                      
                      console.log(`Retrieved and stored list ID ${listId} for first chunk of job ${jobId}`);
                    }
                  }
                } else {
                  // Wait before checking again
                  await new Promise(resolve => setTimeout(resolve, IMPORT_CHECK_DELAY));
                }
              } catch (error: any) {
                console.error(`Error checking progress for chunk ${chunkNumber}:`, error);
                // If checking progress fails, try again after a delay
                await new Promise(resolve => setTimeout(resolve, 3000));
              }
            }
            
            if (!importComplete) {
              // Instead of marking as failed, mark as "monitoring"
              // This allows the client to keep checking progress
              updateJobProgress(jobId, {
                chunks: {
                  details: jobProgress[jobId].chunks.details.map((detail: any, idx: number) => 
                    idx === i 
                      ? { 
                          ...detail, 
                          status: 'monitoring', 
                          note: 'Import still processing. Progress will continue to be monitored.'
                        } 
                      : detail
                  ),
                  inProgress: jobProgress[jobId].chunks.inProgress - 1
                }
              });
              
              // Don't increment failedImports - this isn't a failure, just taking longer than expected
              // The client side will continue to poll progress for this job
            }
            
          } catch (chunkError: any) {
            console.error(`Error processing chunk ${chunkNumber}:`, chunkError);
            
            // Update chunk status as failed
            updateJobProgress(jobId, {
              chunks: {
                details: jobProgress[jobId].chunks.details.map((detail: any, idx: number) => 
                  idx === i 
                    ? { 
                        ...detail, 
                        status: 'failed', 
                        error: chunkError.message 
                      } 
                    : detail
                ),
                failed: jobProgress[jobId].chunks.failed + 1,
                inProgress: jobProgress[jobId].chunks.inProgress - 1
              }
            });
            
            failedImports++;
          }
        }
        
        // All chunks processed - update final status
        console.log(`All chunks processed for job ${jobId}. Successful: ${successfulImports}, Failed: ${failedImports}, Total imported: ${totalImported}`);
        
        // Determine the final list ID - use the first chunk's list ID if available
        let finalListId = 'new_list';
        if (chunkImports[jobId] && chunkImports[jobId].length > 0 && chunkImports[jobId][0]) {
          finalListId = chunkImports[jobId][0].listId || kudosityListId || 'new_list';
        } else if (kudosityListId) {
          finalListId = kudosityListId;
        }
        
        // Log chunk imports summary to help with debugging
        console.log('Chunk imports summary:', JSON.stringify(chunkImports[jobId], null, 2));
        
        updateJobProgress(jobId, {
          state: 'complete',
          progress: 100,
          message: `Chunked import completed. Successfully imported ${totalImported} contacts across ${successfulImports} chunks. ${failedImports} chunks failed.`,
          stats: {
            imported: totalImported,
            skipped: invalidCount,
            errors: totalErrors,
            total: kudosityContacts.length,
            listId: finalListId,
            chunks: {
              total: chunks.length,
              successful: successfulImports,
              failed: failedImports
            }
          },
        });
        
      } else {
        // Process without chunking (original logic for smaller lists)
        updateJobProgress(jobId, {
          state: 'importing',
          progress: 70,
          message: 'Creating CSV file for bulk import...',
        });
        
        // Create a CSV file and upload to Supabase storage
        const filename = `sync-${sourceType}-${sourceName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${Date.now()}`;
        const csvUrl = await createAndUploadContactsCSV(
          validContacts as Array<{mobile: string, [key: string]: any}>,
          filename
        );
        
        updateJobProgress(jobId, {
          progress: 80,
          message: 'Uploading contacts to Kudosity...',
          csvUrl
        });
        
        // Start the bulk import process
        const importId = await uploadContactsToKudosity(
          kudosityUsername,
          kudosityPassword,
          csvUrl,
          kudosityListId,
          kudosityListName
        );
        
        updateJobProgress(jobId, {
          importId,
          message: `Import started with ID: ${importId}. Monitoring progress...`,
        });
        
        // Monitor import progress
        let importComplete = false;
        let attempts = 0;
        let finalProgress = null;
        
        while (!importComplete && attempts < MAX_IMPORT_CHECK_ATTEMPTS) {
          attempts++;
          
          try {
            const progress = await checkBulkImportProgress(
              kudosityUsername,
              kudosityPassword,
              importId
            );
            
            updateJobProgress(jobId, {
              importProgress: progress,
              message: `Import progress: ${progress.processed}/${progress.total} contacts processed. Status: ${progress.status}`,
              progress: 80 + Math.min(19, Math.floor((progress.processed / Math.max(1, progress.total)) * 19))
            });
            
            if (progress.complete) {
              importComplete = true;
              finalProgress = progress;
            } else {
              // Wait a bit before checking again
              await new Promise(resolve => setTimeout(resolve, IMPORT_CHECK_DELAY));
            }
          } catch (error: any) {
            console.error('Error checking import progress:', error);
            // If checking progress fails, we'll try again after a delay
            await new Promise(resolve => setTimeout(resolve, 3000));
          }
        }
        
        // Step 5: Complete the process
        if (importComplete && finalProgress) {
          updateJobProgress(jobId, {
            state: 'complete',
            progress: 100,
            message: 'Sync completed successfully',
            stats: {
              imported: finalProgress.processed - finalProgress.errors,
              skipped: invalidCount,
              errors: finalProgress.errors,
              total: kudosityContacts.length,
              listId: kudosityListId || 'new_list', // We won't know the new list ID immediately
              csvUrl,
              importId
            },
          });
        } else {
          // If we timed out waiting for import to complete, mark as "monitoring" instead of complete
          updateJobProgress(jobId, {
            state: 'monitoring',
            progress: 95, // Not 100% as it's still processing
            message: 'Sync initiated, import is still processing and will be monitored for completion',
            stats: {
              imported: 'processing',
              skipped: invalidCount,
              total: kudosityContacts.length,
              listId: kudosityListId || 'new_list',
              csvUrl,
              importId
            },
          });
        }
      }
      
      // Save sync history to database if we have a real user ID
      if (userId !== 'direct_api') {
        try {
          // Use the admin client with service role for database operations
          const supabase = getSupabaseAdminClient();
          const { error } = await supabase.from('sync_history').insert({
            user_id: userId,
            source_type: sourceType,
            source_id: sourceId,
            destination_id: shouldUseChunking 
              ? chunkImports[jobId][0]?.listId || 'new_list' 
              : kudosityListId || 'new_list',
            profiles_count: profiles.length,
            imported_count: validContacts.length,
            skipped_count: invalidCount,
            completed_at: new Date().toISOString(),
            import_id: shouldUseChunking 
              ? JSON.stringify(chunkImports[jobId].map(c => c.importId)) 
              : jobProgress[jobId].importId,
            csv_url: shouldUseChunking 
              ? JSON.stringify(jobProgress[jobId].chunks.details.map((d: any) => d.csvUrl).filter(Boolean)) 
              : jobProgress[jobId].csvUrl,
            chunked: shouldUseChunking,
            chunks_count: shouldUseChunking ? chunkImports[jobId].length : 0
          });
          
          if (error) {
            console.error('Failed to save sync history:', error);
          }
        } catch (historyError) {
          console.error('Error saving sync history:', historyError);
          // Continue execution even if history saving fails
        }
      }
      
    } catch (error: any) {
      console.error('Error in sync process:', error);
      updateJobProgress(jobId, {
        state: 'error',
        error: error.message || 'An unknown error occurred during sync',
        errorDetails: {
          message: error.message,
          stack: error.stack,
          name: error.name,
          phase: 'sync_process',
          cause: error.cause ? String(error.cause) : undefined
        }
      });
    }
  } catch (error: any) {
    console.error('Error accessing settings:', error);
    updateJobProgress(jobId, {
      state: 'error',
      error: error.message || 'An unknown error occurred while accessing settings',
      errorDetails: {
        message: error.message,
        stack: error.stack,
        name: error.name,
        phase: 'settings_access',
        cause: error.cause ? String(error.cause) : undefined
      }
    });
  }
}

// Split array into chunks of the specified size
function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

// Helper function to get list ID from an import (implementation depends on Kudosity API)
async function getListIdFromImport(username: string, password: string, importId: string, jobId?: string): Promise<string | null> {
  try {
    console.log(`Attempting to retrieve list ID for import ${importId}`);
    
    // Try to get the list ID from the import response
    // This is a placeholder in the original code, but for many APIs, the import completion
    // response might include the list ID that was created or used
    
    // Simulate retrieving list ID from Kudosity
    // In a real implementation, you would query their API to find which list the import went to
    
    // If we were able to determine the list ID from the import, store it in our maps
    if (jobId) {
      // Get the first chunk details for this job
      const firstChunk = chunkImports[jobId] && chunkImports[jobId].length > 0 ? chunkImports[jobId][0] : null;
      
      if (firstChunk && firstChunk.listId) {
        // We have a list ID from the first chunk, use it
        firstChunkListIds[jobId] = firstChunk.listId;
        console.log(`Retrieved and stored list ID ${firstChunk.listId} from first chunk for job ${jobId}`);
        return firstChunk.listId;
      } else if (jobProgress[jobId] && jobProgress[jobId].firstChunkListId) {
        // Try to use the list ID from job progress
        const storedListId = jobProgress[jobId].firstChunkListId;
        console.log(`Using stored list ID ${storedListId} from job progress for job ${jobId}`);
        
        // Store it in our global map too
        firstChunkListIds[jobId] = storedListId;
        
        return storedListId;
      }
    }
    
    // Default implementation - in a real case, this would use the API to retrieve the list ID
    console.warn(`Could not determine list ID for import ${importId}`);
    return null;
  } catch (error) {
    console.error('Error getting list ID from import:', error);
    return null;
  }
}

// Helper function to generate dummy profiles for testing
function generateDummyProfiles(count: number) {
  const profiles = [];
  for (let i = 0; i < count; i++) {
    profiles.push({
      id: `profile_${i}`,
      email: `test${i}@example.com`,
      phone_number: `+614${Math.floor(10000000 + Math.random() * 90000000)}`,
      first_name: `First${i}`,
      last_name: `Last${i}`,
      properties: {
        custom_field_1: `Value ${i}`,
        custom_field_2: i % 2 === 0 ? 'Yes' : 'No',
        custom_field_3: i % 10
      }
    });
  }
  return profiles;
}

function updateJobProgress(jobId: string, updates: Record<string, any>) {
  if (jobProgress[jobId]) {
    // Deep merge of chunks object
    if (updates.chunks && jobProgress[jobId].chunks) {
      updates.chunks = {
        ...jobProgress[jobId].chunks,
        ...updates.chunks,
      };
    }
    
    jobProgress[jobId] = {
      ...jobProgress[jobId],
      ...updates,
    };
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get job ID from query params
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');
    
    if (!jobId) {
      return NextResponse.json(
        { 
          state: 'error',
          error: 'Job ID is required',
          errorDetails: {
            message: 'No job ID was provided in the request',
            reason: 'missing_job_id',
            requestUrl: request.url
          }
        },
        { status: 400 }
      );
    }
    
    if (!jobProgress[jobId]) {
      // Check database for job information
      try {
        // Try to get information from the database about this job
        const supabase = getSupabaseAdminClient();
        const { data: jobData, error: jobError } = await supabase
          .from('import_queue')
          .select('*')
          .eq('id', jobId)
          .single();
        
        if (jobError || !jobData) {
          // No record found in database either
          return NextResponse.json(
            { 
              state: 'error',
              error: 'Job not found',
              errorDetails: {
                message: `Job with ID ${jobId} was not found in memory or database`,
                jobId,
                reason: 'job_not_found_or_expired',
                suggestion: 'The job may have expired or been cleaned up. Try starting a new sync.'
              }
            },
            { status: 404 }
          );
        }
        
        // We found the job in the database but not in memory
        return NextResponse.json(
          { 
            state: 'error',
            error: 'Job not found in active memory',
            errorDetails: {
              message: `Job with ID ${jobId} exists in database but not in server memory`,
              jobId,
              status: jobData.status,
              created_at: jobData.created_at,
              completed_at: jobData.completed_at,
              reason: 'job_expired_from_memory',
              suggestion: 'The server may have restarted or the job expired from memory. Check the database for results or start a new sync.'
            }
          },
          { status: 410 }
        );
      } catch (dbError: any) {
        // Error accessing the database
        return NextResponse.json(
          { 
            state: 'error',
            error: 'Job not found',
            errorDetails: {
              message: `Job with ID ${jobId} was not found, and database lookup failed`,
              jobId,
              reason: 'job_not_found_with_db_error',
              dbError: dbError.message || String(dbError),
              suggestion: 'The job may not exist or the server encountered an error checking it. Try starting a new sync.'
            }
          },
          { status: 404 }
        );
      }
    }
    
    // Return current job progress
    return NextResponse.json(jobProgress[jobId]);
    
  } catch (error: any) {
    console.error('Error fetching job progress:', error);
    return NextResponse.json(
      { 
        state: 'error',
        error: error.message || 'An unknown error occurred',
        errorDetails: {
          message: error.message || 'Unknown error processing request',
          stack: error.stack,
          name: error.name,
          cause: error.cause ? String(error.cause) : undefined,
          phase: 'progress_api',
          requestUrl: request.url
        }
      },
      { status: 500 }
    );
  }
} 