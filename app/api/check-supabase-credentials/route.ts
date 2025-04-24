import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdminClient } from '@/lib/supabase';

// Define interfaces for the diagnostic results
interface ErrorInfo {
  message: string;
  name: string;
}

interface TestResult {
  success: boolean;
  error: ErrorInfo | null;
  [key: string]: any; // Allow for additional properties
}

interface DiagnosticResults {
  environment: string;
  config: {
    url: boolean;
    anonKey: boolean;
    serviceRoleKey: boolean;
  };
  tests: {
    adminClient: TestResult;
    anonClient: TestResult;
    storage: TestResult;
    database: TestResult;
  };
}

/**
 * API route to verify Supabase credentials are properly configured
 * This helps diagnose authentication issues with Supabase
 */
export async function GET(request: NextRequest) {
  try {
    const diagnosticResults: DiagnosticResults = {
      environment: process.env.NODE_ENV || 'unknown',
      config: {
        url: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
        anonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
        serviceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      },
      tests: {
        adminClient: { success: false, error: null },
        anonClient: { success: false, error: null },
        storage: { success: false, error: null },
        database: { success: false, error: null }
      }
    };
    
    // Test 1: Admin client (service role)
    try {
      const adminClient = getSupabaseAdminClient();
      
      if (!adminClient) {
        throw new Error('Admin client is undefined - likely missing environment variables');
      }
      
      // Try a simple DB query using admin privileges
      const { data: adminData, error: adminError } = await adminClient
        .from('api_settings')
        .select('count(*)')
        .limit(1);
        
      if (adminError) {
        throw adminError;
      }
      
      diagnosticResults.tests.adminClient.success = true;
    } catch (error: any) {
      diagnosticResults.tests.adminClient.error = {
        message: error.message,
        name: error.name
      };
    }
    
    // Test 2: Anonymous client
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Missing environment variables for anonymous client');
      }
      
      const anonClient = createClient(supabaseUrl, supabaseAnonKey);
      
      // Try a simple public endpoint test
      const { data: anonData, error: anonError } = await anonClient.auth.getSession();
      
      if (anonError) {
        throw anonError;
      }
      
      diagnosticResults.tests.anonClient.success = true;
    } catch (error: any) {
      diagnosticResults.tests.anonClient.error = {
        message: error.message,
        name: error.name
      };
    }
    
    // Test 3: Storage
    try {
      const adminClient = getSupabaseAdminClient();
      
      if (!adminClient) {
        throw new Error('Admin client is undefined for storage test');
      }
      
      // Test bucket listing
      const { data: buckets, error: bucketError } = await adminClient.storage.listBuckets();
      
      if (bucketError) {
        throw bucketError;
      }
      
      diagnosticResults.tests.storage.success = true;
      diagnosticResults.tests.storage.buckets = buckets.map(b => b.name);
    } catch (error: any) {
      diagnosticResults.tests.storage.error = {
        message: error.message,
        name: error.name
      };
    }
    
    // Test 4: Database
    try {
      const adminClient = getSupabaseAdminClient();
      
      if (!adminClient) {
        throw new Error('Admin client is undefined for database test');
      }
      
      // Test table existence
      const { data, error } = await adminClient.rpc('get_table_names');
      
      if (error) {
        throw error;
      }
      
      diagnosticResults.tests.database.success = true;
      diagnosticResults.tests.database.tables = data;
    } catch (error: any) {
      diagnosticResults.tests.database.error = {
        message: error.message,
        name: error.name
      };
      
      try {
        // Fallback test - try to query a specific table
        const adminClient = getSupabaseAdminClient();
        const { data, error } = await adminClient
          .from('sync_history')
          .select('count(*)')
          .limit(1);
          
        if (!error) {
          diagnosticResults.tests.database.success = true;
          diagnosticResults.tests.database.fallback = true;
        }
      } catch (fallbackError) {
        // Silently ignore fallback error
      }
    }
    
    // Add recommendations based on results
    const recommendations = [];
    
    if (!diagnosticResults.tests.adminClient.success) {
      recommendations.push('Check your SUPABASE_SERVICE_ROLE_KEY environment variable');
    }
    
    if (!diagnosticResults.tests.anonClient.success) {
      recommendations.push('Check your NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables');
    }
    
    if (!diagnosticResults.tests.storage.success) {
      recommendations.push('Verify storage permissions in your Supabase project settings');
    }
    
    return NextResponse.json({
      ...diagnosticResults,
      recommendations,
      allTestsPassed: Object.values(diagnosticResults.tests).every(test => test.success)
    });
    
  } catch (error: any) {
    console.error('Error in Supabase credentials check:', error);
    return NextResponse.json(
      { error: error.message || 'Unknown error checking Supabase credentials' },
      { status: 500 }
    );
  }
} 