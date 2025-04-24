import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase';

/**
 * API route to verify and set up Supabase storage bucket
 * This helps diagnose permission issues with Supabase storage
 */
export async function GET(request: NextRequest) {
  try {
    // Use admin client to ensure we have proper permissions
    const supabase = getSupabaseAdminClient();
    
    if (!supabase) {
      console.error('Failed to initialize Supabase admin client');
      return NextResponse.json(
        { error: 'Failed to initialize Supabase admin client. Check your environment variables.' },
        { status: 500 }
      );
    }
    
    // Check if the bucket exists
    const bucketName = 'temp-csv-storage';
    const { data: buckets, error: listBucketsError } = await supabase.storage.listBuckets();
    
    if (listBucketsError) {
      console.error('Error listing storage buckets:', listBucketsError);
      return NextResponse.json(
        { 
          error: 'Failed to list storage buckets', 
          details: listBucketsError.message,
          hint: 'Check your Supabase service role key and URL'
        },
        { status: 500 }
      );
    }
    
    const bucketExists = buckets.some(b => b.name === bucketName);
    let createBucketResult = null;
    
    // Create the bucket if it doesn't exist
    if (!bucketExists) {
      console.log(`Bucket '${bucketName}' does not exist. Creating...`);
      
      try {
        const { data, error: createError } = await supabase.storage.createBucket(bucketName, {
          public: true
        });
        
        if (createError) {
          console.error('Error creating bucket:', createError);
          return NextResponse.json(
            { 
              error: 'Failed to create storage bucket',
              details: createError.message,
              hint: 'Check if your Supabase service role has the necessary permissions to create buckets'
            },
            { status: 500 }
          );
        }
        
        createBucketResult = { created: true, message: `Created bucket '${bucketName}'` };
      } catch (err: any) {
        console.error('Unexpected error creating bucket:', err);
        return NextResponse.json(
          { 
            error: 'Unexpected error creating bucket',
            details: err.message,
            stack: err.stack
          },
          { status: 500 }
        );
      }
    }
    
    // Try to upload a test file to verify bucket permissions
    const testFileName = `test-file-${Date.now()}.txt`;
    const testContent = 'This is a test file to verify storage permissions';
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(testFileName, new Blob([testContent], { type: 'text/plain' }), {
        contentType: 'text/plain',
        upsert: true
      });
    
    if (uploadError) {
      console.error('Error uploading test file:', uploadError);
      return NextResponse.json(
        { 
          error: 'Failed to upload test file to bucket',
          details: uploadError.message,
          hint: 'Check bucket permissions and policies in your Supabase dashboard'
        },
        { status: 500 }
      );
    }
    
    // Get public URL for the test file
    const { data: publicUrlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(uploadData?.path || testFileName);
    
    // Return the status information
    return NextResponse.json({
      success: true,
      bucketStatus: {
        name: bucketName,
        existed: bucketExists,
        created: !bucketExists,
        createResult: createBucketResult
      },
      testFile: {
        name: testFileName,
        uploaded: true,
        path: uploadData?.path || testFileName,
        publicUrl: publicUrlData?.publicUrl
      },
      supabaseInfo: {
        url: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Configured' : 'Missing',
        adminKeyStatus: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Configured' : 'Missing',
        anonKeyStatus: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Configured' : 'Missing'
      }
    });
    
  } catch (error: any) {
    console.error('Unexpected error in API route:', error);
    return NextResponse.json(
      { 
        error: 'Unexpected error occurred',
        details: error.message,
        stack: error.stack
      },
      { status: 500 }
    );
  }
} 