import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Check, RefreshCw, XCircle, Clock, RotateCw } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

interface LargeListSyncProps {
  sourceType: 'segments' | 'lists';
  sourceId: string;
  sourceName: string;
  destinationId: string | null;
  destinationName: string | null;
  fieldMappings: Record<string, string>;
  onComplete: () => void;
  onCancel: () => void;
}

interface ImportProgress {
  id: string;
  status: string;
  sourceType: string;
  sourceName: string;
  destinationName: string | null;
  startedAt: string;
  completedAt: string | null;
  errorMessage: string | null;
  progress: {
    overallPercent: number;
    profilePercent: number;
    chunks: {
      total: number;
      completed: number;
      failed: number;
      processing: number;
      pending: number;
    };
    profiles: {
      total: number;
      processed: number;
      success: number;
      error: number;
    };
  };
  chunks: Array<{
    id: string;
    index: number;
    status: string;
    profilesCount: number;
    successCount: number;
    errorCount: number;
    startOffset: number;
    endOffset: number;
    startedAt: string | null;
    completedAt: string | null;
    errorMessage: string | null;
  }>;
}

export default function LargeListSync({
  sourceType,
  sourceId,
  sourceName,
  destinationId,
  destinationName,
  fieldMappings,
  onComplete,
  onCancel
}: LargeListSyncProps) {
  const [importId, setImportId] = useState<string | null>(null);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  
  const { toast } = useToast();
  
  // Start the import process
  const startImport = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // First get credentials from Supabase
      const { getSupabaseClient } = await import('@/lib/supabase');
      const supabase = getSupabaseClient();
      
      // Check if we have a session
      const { data: { session } } = await supabase.auth.getSession();
      
      // Get API credentials if we have a session
      let credentials = {};
      let hasCredentials = false;
      
      if (session) {
        // Get user_id from session
        const userId = session.user.id;
        
        // Get API settings specifically for this user
        const { data: settings, error: settingsError } = await supabase
          .from('api_settings')
          .select('*')
          .eq('user_id', userId)
          .single();
          
        if (settingsError) {
          console.error('Error fetching API settings:', settingsError);
        }
        
        if (settings) {
          // Always send credentials directly in request body like the settings page does
          credentials = {
            kudosity_username: settings.kudosity_username,
            kudosity_password: settings.kudosity_password,
            klaviyo_api_key: settings.klaviyo_api_key
          };
          
          // Check if we have valid credentials
          hasCredentials = !!(
            settings.kudosity_username && 
            settings.kudosity_password &&
            settings.klaviyo_api_key
          );
          
          console.log('Retrieved API credentials for user:', userId, 'Valid:', hasCredentials);
        } else {
          console.warn('No API settings found for user:', userId);
        }
      } else {
        console.warn('No active session, cannot retrieve API credentials');
      }
      
      if (!hasCredentials) {
        throw new Error('Missing API credentials. Please configure your API settings first.');
      }
      
      console.log('Starting import with API credentials...');
      const response = await fetch('/api/queue/start-import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sourceType,
          sourceId,
          destinationId,
          destinationName,
          fieldMappings,
          // Include credentials directly in the request just like settings page does
          ...credentials
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to start import');
      }
      
      setImportId(data.importId);
      startProgressPolling(data.importId);
      
      toast({
        title: 'Import started',
        description: `Processing ${data.totalProfiles} profiles in ${data.totalChunks} chunks`,
      });
      
    } catch (error: any) {
      console.error('Error starting import:', error);
      setError(error.message || 'Failed to start import process');
      toast({
        variant: 'destructive',
        title: 'Import Error',
        description: error.message || 'Failed to start import process',
      });
    } finally {
      setIsLoading(false);
    }
  }, [sourceType, sourceId, destinationId, destinationName, fieldMappings, toast]);
  
  // Poll for progress updates
  const startProgressPolling = useCallback((id: string) => {
    // Clear any existing polling
    if (pollingInterval) {
      clearInterval(pollingInterval);
    }
    
    // Start polling
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/queue/check-progress?importId=${id}`);
        
        if (!response.ok) {
          const errorData = await response.json();
          console.error('Error checking progress:', errorData);
          
          // Handle authentication errors
          if (response.status === 401 || response.status === 403) {
            clearInterval(interval);
            setPollingInterval(null);
            
            const authErrorMessage = response.status === 401
              ? 'Authentication required. Please log in to monitor this import.'
              : 'You do not have permission to access this import job.';
            
            setError(authErrorMessage);
            
            toast({
              variant: 'destructive',
              title: 'Authentication Error',
              description: authErrorMessage
            });
            
            return;
          }
          
          return;
        }
        
        const progressData: ImportProgress = await response.json();
        setProgress(progressData);
        
        // If complete, stop polling
        if (['complete', 'completed_with_errors', 'error'].includes(progressData.status)) {
          clearInterval(interval);
          setPollingInterval(null);
          
          // Notify completion
          if (progressData.status === 'complete') {
            toast({
              title: 'Import complete',
              description: `Successfully imported ${progressData.progress.profiles.success} profiles`,
            });
          } else if (progressData.status === 'completed_with_errors') {
            toast({
              variant: 'destructive',
              title: 'Import completed with errors',
              description: `Imported ${progressData.progress.profiles.success} profiles with ${progressData.progress.profiles.error} errors`,
            });
          } else if (progressData.status === 'error') {
            toast({
              variant: 'destructive',
              title: 'Import failed',
              description: progressData.errorMessage || 'Unknown error occurred',
            });
          }
        }
        
      } catch (error: any) {
        console.error('Error polling for progress:', error);
      }
    }, 3000);
    
    setPollingInterval(interval);
    
    // Clean up interval on component unmount
    return () => clearInterval(interval);
  }, [pollingInterval, toast]);
  
  // Start import on component mount
  useEffect(() => {
    startImport();
    
    // Clean up polling interval
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [startImport, pollingInterval]);
  
  // Retry a failed chunk
  const retryChunk = async (chunkIndex: number) => {
    if (!importId) return;
    
    try {
      setIsLoading(true);
      
      // Get credentials from Supabase
      const { getSupabaseClient } = await import('@/lib/supabase');
      const supabase = getSupabaseClient();
      
      // Check if we have a session
      const { data: { session } } = await supabase.auth.getSession();
      
      // Get API credentials if we have a session
      let credentials = {};
      let hasCredentials = false;
      
      if (session) {
        // Get user_id from session
        const userId = session.user.id;
        
        // Get API settings specifically for this user
        const { data: settings, error: settingsError } = await supabase
          .from('api_settings')
          .select('*')
          .eq('user_id', userId)
          .single();
          
        if (settingsError) {
          console.error('Error fetching API settings for retry:', settingsError);
        }
        
        if (settings) {
          // Always send credentials directly in request body like the settings page does
          credentials = {
            kudosity_username: settings.kudosity_username,
            kudosity_password: settings.kudosity_password,
            klaviyo_api_key: settings.klaviyo_api_key
          };
          
          // Check if we have valid credentials
          hasCredentials = !!(
            settings.kudosity_username && 
            settings.kudosity_password &&
            settings.klaviyo_api_key
          );
          
          console.log('Retrieved API credentials for retry, user:', userId, 'Valid:', hasCredentials);
        } else {
          console.warn('No API settings found for retry, user:', userId);
        }
      } else {
        console.warn('No active session for retry, cannot retrieve API credentials');
      }
      
      if (!hasCredentials) {
        throw new Error('Missing API credentials. Please configure your API settings first.');
      }
      
      console.log('Retrying chunk with API credentials...');
      const response = await fetch('/api/queue/process-chunk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          import_id: importId,
          chunk_index: chunkIndex,
          // Include credentials directly in the request just like settings page does
          ...credentials
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to retry chunk');
      }
      
      toast({
        title: 'Chunk retry started',
        description: `Retrying chunk ${chunkIndex + 1}`,
      });
      
    } catch (error: any) {
      console.error('Error retrying chunk:', error);
      toast({
        variant: 'destructive',
        title: 'Retry Error',
        description: error.message || 'Failed to retry chunk',
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Format date for display
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString();
  };
  
  // Get status badge color
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'complete':
        return <Badge className="bg-green-500"><Check className="h-3 w-3 mr-1" />Complete</Badge>;
      case 'processing':
        return <Badge className="bg-blue-500"><RefreshCw className="h-3 w-3 mr-1 animate-spin" />Processing</Badge>;
      case 'error':
        return <Badge className="bg-red-500"><XCircle className="h-3 w-3 mr-1" />Error</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'completed_with_errors':
        return <Badge className="bg-orange-500"><AlertCircle className="h-3 w-3 mr-1" />Completed with errors</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };
  
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            <span>Large List Import</span>
            {progress && getStatusBadge(progress.status)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {!progress && !error && (
            <div className="flex items-center justify-center h-40">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
                <p className="mt-4 text-gray-600">Starting import process...</p>
              </div>
            </div>
          )}
          
          {progress && (
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Overall Progress</span>
                  <span>{progress.progress.overallPercent}%</span>
                </div>
                <Progress value={progress.progress.overallPercent} className="h-2" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="text-sm font-medium mb-2">Source</h4>
                  <p className="text-sm">{progress.sourceName}</p>
                  <p className="text-xs text-gray-500">{progress.sourceType}</p>
                </div>
                
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="text-sm font-medium mb-2">Destination</h4>
                  <p className="text-sm">{progress.destinationName || 'New List'}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="text-sm font-medium mb-1">Total Profiles</h4>
                  <p className="text-xl font-bold">{progress.progress.profiles.total.toLocaleString()}</p>
                </div>
                
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <h4 className="text-sm font-medium mb-1">Processed</h4>
                  <p className="text-xl font-bold">{progress.progress.profiles.processed.toLocaleString()}</p>
                </div>
                
                <div className="bg-green-50 p-4 rounded-lg">
                  <h4 className="text-sm font-medium mb-1">Successful</h4>
                  <p className="text-xl font-bold">{progress.progress.profiles.success.toLocaleString()}</p>
                </div>
                
                <div className="bg-red-50 p-4 rounded-lg">
                  <h4 className="text-sm font-medium mb-1">Errors</h4>
                  <p className="text-xl font-bold">{progress.progress.profiles.error.toLocaleString()}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="bg-gray-50 p-4 rounded-lg text-center">
                  <h4 className="text-sm font-medium mb-1">Total Chunks</h4>
                  <p className="text-lg font-bold">{progress.progress.chunks.total}</p>
                </div>
                
                <div className="bg-green-50 p-4 rounded-lg text-center">
                  <h4 className="text-sm font-medium mb-1">Completed</h4>
                  <p className="text-lg font-bold">{progress.progress.chunks.completed}</p>
                </div>
                
                <div className="bg-blue-50 p-4 rounded-lg text-center">
                  <h4 className="text-sm font-medium mb-1">Processing</h4>
                  <p className="text-lg font-bold">{progress.progress.chunks.processing}</p>
                </div>
                
                <div className="bg-red-50 p-4 rounded-lg text-center">
                  <h4 className="text-sm font-medium mb-1">Failed</h4>
                  <p className="text-lg font-bold">{progress.progress.chunks.failed}</p>
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-medium mb-2">Chunks</h3>
                
                <Accordion type="single" collapsible className="w-full">
                  {progress.chunks.map((chunk) => (
                    <AccordionItem key={chunk.id} value={chunk.id}>
                      <AccordionTrigger className="py-2">
                        <div className="flex items-center gap-2">
                          <span>Chunk {chunk.index + 1}</span>
                          {getStatusBadge(chunk.status)}
                          {chunk.status === 'complete' && (
                            <span className="text-xs text-green-600">
                              {chunk.successCount} successful, {chunk.errorCount} errors
                            </span>
                          )}
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-2 py-2 px-1">
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="font-medium">Profiles:</span> {chunk.profilesCount}
                            </div>
                            <div>
                              <span className="font-medium">Range:</span> {chunk.startOffset} - {chunk.endOffset}
                            </div>
                            <div>
                              <span className="font-medium">Started:</span> {formatDate(chunk.startedAt)}
                            </div>
                            <div>
                              <span className="font-medium">Completed:</span> {formatDate(chunk.completedAt)}
                            </div>
                          </div>
                          
                          {chunk.errorMessage && (
                            <Alert variant="destructive" className="mt-2">
                              <AlertCircle className="h-4 w-4" />
                              <AlertTitle>Chunk Error</AlertTitle>
                              <AlertDescription className="break-words">{chunk.errorMessage}</AlertDescription>
                            </Alert>
                          )}
                          
                          {chunk.status === 'error' && (
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="mt-2"
                              onClick={() => retryChunk(chunk.index)}
                              disabled={isLoading}
                            >
                              <RotateCw className="h-4 w-4 mr-1" />
                              Retry Chunk
                            </Button>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
          
          {progress && ['complete', 'completed_with_errors', 'error'].includes(progress.status) && (
            <Button onClick={onComplete}>
              Finish
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
} 