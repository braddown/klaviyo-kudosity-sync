'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { ExternalLink, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';

interface ChunkDetail {
  chunkId: number;
  status: 'pending' | 'processing' | 'uploading' | 'importing' | 'completed' | 'failed';
  size: number;
  progress: number;
  importId?: string;
  error?: string;
  csvUrl?: string;
  importProgress?: {
    processed: number;
    total: number;
    errors: number;
    status: string;
  };
}

interface ChunksProgress {
  total: number;
  processed: number;
  failed: number;
  inProgress: number;
  details: ChunkDetail[];
}

interface SyncProgressState {
  state: 'idle' | 'retrieving' | 'processing' | 'uploading' | 'importing' | 'complete' | 'error' | 'monitoring';
  progress: number;
  currentPage?: number;
  totalPages?: number;
  profilesRetrieved?: number;
  totalProfiles?: number;
  message?: string;
  error?: string;
  errorDetails?: any;
  importId?: string;
  csvUrl?: string;
  importProgress?: {
    status: string;
    processed: number;
    total: number;
    errors: number;
    complete: boolean;
  };
  enableChunking?: boolean;
  chunks?: ChunksProgress;
  stats?: any;
}

interface SyncProgressProps {
  progress?: SyncProgressState;
  onRetry?: () => void;
  onReset?: () => void;
}

export default function SyncProgress({ progress, onRetry, onReset }: SyncProgressProps) {
  // Fallback for undefined progress
  if (!progress) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Sync in Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <p>No sync information available.</p>
        </CardContent>
      </Card>
    );
  }

  const getStatusMessage = () => {
    if (!progress.state) return 'Preparing sync process';
    
    switch (progress.state) {
      case 'retrieving':
        return progress.message || `Retrieving profiles from Klaviyo${progress.currentPage ? ` (Page ${progress.currentPage}/${progress.totalPages || '?'})` : ''}`;
      case 'processing':
        return progress.message || 'Processing and formatting data';
      case 'uploading':
        return progress.message || 'Uploading contacts to Kudosity';
      case 'importing':
        return progress.message || 'Importing contacts into Kudosity';
      case 'monitoring':
        return progress.message || 'Import is still in progress. Monitoring for completion.';
      case 'complete':
        return progress.message || 'Sync completed successfully';
      case 'error':
        return `Error: ${progress.error || 'Unknown error occurred'}`;
      default:
        return progress.message || 'Preparing sync process';
    }
  };

  // Handle chunked import progress display
  const renderChunkedProgress = () => {
    if (!progress.chunks || !progress.chunks.details) {
      return null;
    }

    const { total, processed, failed, details } = progress.chunks;
    
    return (
      <div className="mt-4 space-y-4">
        <div className="text-sm font-medium">
          Processing in chunks: {processed + failed}/{total} completed
          {failed > 0 && <span className="text-red-500"> ({failed} failed)</span>}
        </div>
        
        <div className="space-y-3">
          {details.map((chunk: ChunkDetail) => (
            <div key={chunk.chunkId} className="border rounded-md p-3">
              <div className="flex justify-between items-center mb-2">
                <div className="text-sm font-medium">
                  Chunk {chunk.chunkId} ({chunk.size.toLocaleString()} contacts)
                </div>
                <div className="text-xs">
                  {getChunkStatusBadge(chunk.status)}
                </div>
              </div>
              
              <Progress value={chunk.progress} className="h-2" />
              
              {chunk.status === 'failed' && chunk.error && (
                <div className="mt-2 text-xs text-red-500">
                  Error: {chunk.error}
                </div>
              )}
              
              {chunk.importProgress && (
                <div className="mt-2 text-xs">
                  {chunk.importProgress.processed}/{chunk.importProgress.total} processed
                  {chunk.importProgress.errors > 0 && 
                    <span className="text-red-500"> ({chunk.importProgress.errors} errors)</span>
                  }
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Helper function to render status badges
  const getChunkStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="bg-gray-100 text-gray-800 px-2 py-0.5 rounded-full text-xs">Pending</span>;
      case 'processing':
        return <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-xs">Processing</span>;
      case 'uploading':
        return <span className="bg-violet-100 text-violet-800 px-2 py-0.5 rounded-full text-xs">Uploading</span>;
      case 'importing':
        return <span className="bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full text-xs">Importing</span>;
      case 'monitoring':
        return <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-xs">Still Processing</span>;
      case 'completed':
        return <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded-full text-xs">Completed</span>;
      case 'failed':
        return <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded-full text-xs">Failed</span>;
      default:
        return <span className="bg-gray-100 text-gray-800 px-2 py-0.5 rounded-full text-xs">{status}</span>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {progress.state === 'complete' ? 'Sync Complete' : 
           progress.state === 'error' ? 'Sync Error' : 
           'Sync Progress'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress bar */}
        <div>
          <div className="flex items-center justify-between text-sm">
            <span>{getStatusMessage()}</span>
            <span>{Math.round(progress.progress)}%</span>
          </div>
          <Progress value={progress.progress} className="h-2" />
        </div>
        
        {/* Profile counts */}
        {progress.profilesRetrieved && progress.profilesRetrieved > 0 && (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="bg-muted p-3 rounded-md">
              <p className="text-muted-foreground">Profiles Retrieved</p>
              <p className="text-lg font-medium">{progress.profilesRetrieved}</p>
            </div>
            <div className="bg-muted p-3 rounded-md">
              <p className="text-muted-foreground">Total Profiles</p>
              <p className="text-lg font-medium">{progress.totalProfiles || 'Calculating...'}</p>
            </div>
          </div>
        )}
        
        {/* Error message */}
        {progress.state === 'error' && progress.error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Sync Failed</AlertTitle>
            <AlertDescription>
              {progress.error}
            </AlertDescription>
          </Alert>
        )}
        
        {/* Technical error details */}
        {progress.state === 'error' && progress.errorDetails && (
          <div className="mt-4 border border-red-200 rounded-md p-4">
            <h3 className="text-sm font-medium text-red-800 mb-2">Technical Error Details</h3>
            
            {/* Format specific error types differently */}
            {progress.errorDetails.reason && (
              <div className="mb-3 text-sm">
                <p className="font-medium">Error Type: {progress.errorDetails.reason.replace(/_/g, ' ')}</p>
                {progress.errorDetails.suggestion && (
                  <p className="mt-1 text-gray-700">{progress.errorDetails.suggestion}</p>
                )}
              </div>
            )}
            
            {/* Common solutions based on error message */}
            {progress.error && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-md">
                <h4 className="text-sm font-medium text-amber-800 mb-1">Common Solutions</h4>
                <ul className="text-xs text-amber-700 space-y-1 list-disc pl-4">
                  {progress.error.includes('Job not found') && (
                    <>
                      <li>The sync job may have expired or been cleaned up</li>
                      <li>Try starting a new sync</li>
                      <li>If this happens frequently, contact support</li>
                    </>
                  )}
                  {progress.error.includes('upload') && (
                    <>
                      <li>Check that your Supabase storage is properly configured</li>
                      <li>Verify that the service role key has permission to upload files</li>
                      <li>Check that the storage bucket exists and is accessible</li>
                    </>
                  )}
                  {progress.error.includes('invalid signature') && (
                    <>
                      <li>Your Supabase service role key might be invalid or expired</li>
                      <li>The storage bucket might not exist</li>
                      <li>Environment variables may not be properly configured</li>
                    </>
                  )}
                  {progress.error.includes('API') && (
                    <>
                      <li>Verify your Kudosity API credentials</li>
                      <li>Check that you have permission to create lists</li>
                      <li>The Kudosity API might be temporarily unavailable</li>
                    </>
                  )}
                  {progress.error.includes('timeout') && (
                    <>
                      <li>The operation may have taken too long to complete</li>
                      <li>Try with a smaller batch of contacts</li>
                      <li>Check your network connection</li>
                    </>
                  )}
                  {!progress.error.includes('Job not found') && 
                   !progress.error.includes('upload') && 
                   !progress.error.includes('invalid signature') && 
                   !progress.error.includes('API') && 
                   !progress.error.includes('timeout') && (
                    <>
                      <li>Try starting a new sync</li>
                      <li>Check your API credentials in Settings</li>
                      <li>Make sure all required fields are mapped correctly</li>
                    </>
                  )}
                </ul>
              </div>
            )}

            {/* Collapsible error details */}
            <details className="text-xs">
              <summary className="cursor-pointer font-medium mb-2 text-blue-800 hover:text-blue-700 select-none">
                Show Technical Details
              </summary>
              <pre className="bg-gray-50 p-3 rounded-sm text-xs overflow-auto max-h-[200px] whitespace-pre-wrap">
                {JSON.stringify(progress.errorDetails, null, 2)}
              </pre>
            </details>
            
            {/* Retry button */}
            {onRetry && (
              <Button 
                onClick={onRetry} 
                variant="outline" 
                className="mt-3 w-full"
                size="sm"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Try Again
              </Button>
            )}
          </div>
        )}
        
        {/* Success or monitoring state */}
        {(progress.state === 'complete' || progress.state === 'monitoring') && progress.stats && (
          <div className="space-y-4">
            <Alert variant={progress.state === 'complete' ? "default" : "destructive"} 
                   className={progress.state === 'complete' ? "bg-green-50 text-green-900 border-green-200" : "bg-amber-50 text-amber-900 border-amber-200"}>
              {progress.state === 'complete' ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <RefreshCw className="h-4 w-4 animate-spin" />
              )}
              <AlertTitle>
                {progress.state === 'complete' ? 'Sync Completed Successfully' : 'Sync In Progress'}
              </AlertTitle>
              <AlertDescription>
                {progress.state === 'complete' 
                  ? 'All contacts have been processed and synchronized.'
                  : 'Import is still processing. This may take several minutes for large imports.'}
              </AlertDescription>
            </Alert>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div className="bg-muted p-3 rounded-md">
                <p className="text-muted-foreground">Successfully Imported</p>
                <p className="text-lg font-medium text-green-600">
                  {progress.stats.imported === 'processing' ? (
                    <span className="text-amber-600">Processing...</span>
                  ) : (
                    progress.stats.imported || 0
                  )}
                </p>
              </div>
              <div className="bg-muted p-3 rounded-md">
                <p className="text-muted-foreground">Skipped</p>
                <p className="text-lg font-medium text-amber-600">{progress.stats.skipped || 0}</p>
              </div>
              <div className="bg-muted p-3 rounded-md">
                <p className="text-muted-foreground">Duplicates</p>
                <p className="text-lg font-medium text-blue-600">{progress.stats.duplicates || 0}</p>
              </div>
              <div className="bg-muted p-3 rounded-md">
                <p className="text-muted-foreground">Invalid</p>
                <p className="text-lg font-medium text-red-600">{progress.stats.invalid || 0}</p>
              </div>
            </div>
            
            {progress.stats.listUrl && (
              <Button variant="outline" className="w-full mt-4" onClick={() => window.open(progress.stats.listUrl, '_blank')}>
                <ExternalLink className="mr-2 h-4 w-4" />
                View List in Kudosity
              </Button>
            )}
          </div>
        )}
        
        {/* Chunked progress */}
        {progress.chunks && progress.chunks.total > 0 && renderChunkedProgress()}
        
        {/* Action buttons */}
        <div className="pt-4">
          <Button 
            onClick={onReset}
            variant={progress.state === 'complete' || progress.state === 'error' ? 'default' : 'outline'}
            className="w-full"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            {progress.state === 'complete' || progress.state === 'error' ? 'Start New Sync' : 'Cancel and Reset'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
} 