'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase';
import SyncForm from '@/components/sync/SyncForm';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

export default function SyncPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Check authentication on client side
  useEffect(() => {
    async function checkAuth() {
      try {
        setLoading(true);
        const supabase = getSupabaseClient();
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error("Auth error:", sessionError.message);
          throw new Error(`Authentication error: ${sessionError.message}`);
        }
        
        if (!session) {
          console.log("No active session found");
          router.push('/login');
          return;
        }
        
        // Session exists, continue loading the page
        setLoading(false);
      } catch (err: any) {
        console.error("Error checking auth:", err);
        setError(err.message);
        setLoading(false);
      }
    }
    
    checkAuth();
  }, [router]);
  
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading sync page...</p>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Sync Data</h1>
        <p className="text-muted-foreground">Transfer contacts from Klaviyo to Kudosity</p>
      </div>
      
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      <SyncForm initialError={error as string | undefined} />
    </div>
  );
} 