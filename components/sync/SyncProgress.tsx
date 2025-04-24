'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
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
  state: 'idle' | 'retrieving' | 'processing' | 'uploading' | 'importing' | 'complete' | 'error';
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
  const getStatusMessage = () => {
    switch (progress?.state) {
      case 'retrieving':
        return `Retrieving profiles from Klaviyo (Page ${progress.currentPage}/${progress.totalPages || '?'})`;
      case 'processing':
        return 'Processing and formatting data';
      case 'uploading':
        return 'Uploading CSV to storage';
      case 'importing':
        return 'Importing contacts to Kudosity';
      case 'complete':
        return 'Sync completed successfully';
      case 'error':
        return `Error: ${progress.error || 'Unknown error occurred'}`;
      default:
        return 'Preparing sync process';
    }
  };

  // Handle chunked import progress display
  const renderChunkedProgress = () => {
    if (!progress?.chunks || !progress.chunks.details) {
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
          {details.map((chunk: any) => (
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
          {progress?.state === 'complete' ? 'Sync Complete' : 
           progress?.state === 'error' ? 'Sync Error' : 
           'Sync Progress'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Progress status */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>{getStatusMessage()}</span>
            <span>{Math.round(progress?.progress || 0)}%</span>
          </div>
          <Progress value={progress?.progress || 0} className="h-2" />
        </div>
        
        {/* Profile counts */}
        {progress?.profilesRetrieved > 0 && (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="bg-muted p-3 rounded-md">
              <p className="text-muted-foreground">Profiles Retrieved</p>
              <p className="text-lg font-medium">{progress?.profilesRetrieved}</p>
            </div>
            <div className="bg-muted p-3 rounded-md">
              <p className="text-muted-foreground">Total Profiles</p>
              <p className="text-lg font-medium">{progress?.totalProfiles || 'Calculating...'}</p>
            </div>
          </div>
        )}
        
        {/* Error message */}
        {progress?.state === 'error' && progress.error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Sync Failed</AlertTitle>
            <AlertDescription>
              {progress.error}
            </AlertDescription>
          </Alert>
        )}
        
        {/* Technical error details */}
        {progress?.state === 'error' && progress.errorDetails && (
          <div className="mt-4 border border-red-200 rounded-md p-4">
            <h3 className="text-sm font-medium text-red-800 mb-2">Technical Error Details</h3>
            <pre className="bg-gray-50 p-3 rounded-sm text-xs overflow-auto max-h-[200px] whitespace-pre-wrap">
              {JSON.stringify(progress.errorDetails, null, 2)}
            </pre>
          </div>
        )}
        
        {/* Success stats */}
        {progress?.state === 'complete' && progress.stats && (
          <div className="space-y-4">
            <Alert variant="default" className="bg-green-50 text-green-900 border-green-200">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <AlertTitle>Sync Completed Successfully</AlertTitle>
              <AlertDescription>
                The data has been successfully synced to Kudosity.
              </AlertDescription>
            </Alert>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="bg-muted p-3 rounded-md">
                <p className="text-muted-foreground">Successfully Imported</p>
                <p className="text-lg font-medium text-green-600">{progress.stats.imported || 0}</p>
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
        
        {/* Action buttons */}
        <div className="pt-4">
          <Button 
            onClick={onReset}
            variant={progress?.state === 'complete' || progress?.state === 'error' ? 'default' : 'outline'}
            className="w-full"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            {progress?.state === 'complete' || progress?.state === 'error' ? 'Start New Sync' : 'Cancel and Reset'}
          </Button>
        </div>

        {/* Chunked progress */}
        {progress?.chunks && progress.chunks.total > 0 && (
          renderChunkedProgress()
        )}
      </CardContent>
    </Card>
  );
} 