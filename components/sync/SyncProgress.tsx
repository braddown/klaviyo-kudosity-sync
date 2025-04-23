'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ExternalLink, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';

interface SyncProgressProps {
  state: 'idle' | 'retrieving' | 'processing' | 'uploading' | 'importing' | 'complete' | 'error';
  progress: number;
  currentPage: number;
  totalPages: number;
  profilesRetrieved: number;
  totalProfiles: number;
  stats: any;
  error: string | null;
  errorDetails?: any;
  onReset: () => void;
}

export default function SyncProgress({
  state,
  progress,
  currentPage,
  totalPages,
  profilesRetrieved,
  totalProfiles,
  stats,
  error,
  errorDetails,
  onReset,
}: SyncProgressProps) {
  const getStatusMessage = () => {
    switch (state) {
      case 'retrieving':
        return `Retrieving profiles from Klaviyo (Page ${currentPage}/${totalPages || '?'})`;
      case 'processing':
        return 'Processing and formatting data';
      case 'uploading':
        return 'Uploading CSV to storage';
      case 'importing':
        return 'Importing contacts to Kudosity';
      case 'complete':
        return 'Sync completed successfully';
      case 'error':
        return `Error: ${error || 'Unknown error occurred'}`;
      default:
        return 'Preparing sync process';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {state === 'complete' ? 'Sync Complete' : 
           state === 'error' ? 'Sync Error' : 
           'Sync Progress'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Progress status */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>{getStatusMessage()}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
        
        {/* Profile counts */}
        {profilesRetrieved > 0 && (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="bg-muted p-3 rounded-md">
              <p className="text-muted-foreground">Profiles Retrieved</p>
              <p className="text-lg font-medium">{profilesRetrieved}</p>
            </div>
            <div className="bg-muted p-3 rounded-md">
              <p className="text-muted-foreground">Total Profiles</p>
              <p className="text-lg font-medium">{totalProfiles || 'Calculating...'}</p>
            </div>
          </div>
        )}
        
        {/* Error message */}
        {state === 'error' && error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Sync Failed</AlertTitle>
            <AlertDescription>
              {error}
            </AlertDescription>
          </Alert>
        )}
        
        {/* Technical error details */}
        {state === 'error' && errorDetails && (
          <div className="mt-4 border border-red-200 rounded-md p-4">
            <h3 className="text-sm font-medium text-red-800 mb-2">Technical Error Details</h3>
            <pre className="bg-gray-50 p-3 rounded-sm text-xs overflow-auto max-h-[200px] whitespace-pre-wrap">
              {JSON.stringify(errorDetails, null, 2)}
            </pre>
          </div>
        )}
        
        {/* Success stats */}
        {state === 'complete' && stats && (
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
                <p className="text-lg font-medium text-green-600">{stats.imported || 0}</p>
              </div>
              <div className="bg-muted p-3 rounded-md">
                <p className="text-muted-foreground">Skipped</p>
                <p className="text-lg font-medium text-amber-600">{stats.skipped || 0}</p>
              </div>
              <div className="bg-muted p-3 rounded-md">
                <p className="text-muted-foreground">Duplicates</p>
                <p className="text-lg font-medium text-blue-600">{stats.duplicates || 0}</p>
              </div>
              <div className="bg-muted p-3 rounded-md">
                <p className="text-muted-foreground">Invalid</p>
                <p className="text-lg font-medium text-red-600">{stats.invalid || 0}</p>
              </div>
            </div>
            
            {stats.listUrl && (
              <Button variant="outline" className="w-full mt-4" onClick={() => window.open(stats.listUrl, '_blank')}>
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
            variant={state === 'complete' || state === 'error' ? 'default' : 'outline'}
            className="w-full"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            {state === 'complete' || state === 'error' ? 'Start New Sync' : 'Cancel and Reset'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
} 