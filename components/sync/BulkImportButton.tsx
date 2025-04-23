import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/use-toast';

type BulkImportButtonProps = {
  contacts: Array<{mobile: string, [key: string]: any}>;
  listId?: string;
  listName?: string;
  onComplete?: (result: any) => void;
  onError?: (error: any) => void;
  buttonText?: string;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
};

export default function BulkImportButton({
  contacts,
  listId,
  listName,
  onComplete,
  onError,
  buttonText = 'Import Contacts',
  variant = 'default'
}: BulkImportButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [importId, setImportId] = useState<string | null>(null);
  const [showProgress, setShowProgress] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  const { toast } = useToast();
  
  const startImport = async () => {
    if (!contacts || contacts.length === 0) {
      toast({
        title: 'No contacts to import',
        description: 'Please provide contacts with mobile numbers for the import.',
        variant: 'destructive',
      });
      return;
    }
    
    if (!listId && !listName) {
      toast({
        title: 'Missing destination',
        description: 'Please provide either a list ID or a name for a new list.',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      setIsLoading(true);
      setStatus('Preparing contacts for import...');
      setShowProgress(true);
      setProgress(10);
      
      // Start the bulk import process
      const response = await fetch('/api/kudosity/bulk-import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contacts,
          listId,
          listName,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start bulk import');
      }
      
      const data = await response.json();
      
      if (!data.success || !data.importId) {
        throw new Error(data.error || 'Failed to start bulk import');
      }
      
      setImportId(data.importId);
      setProgress(30);
      setStatus(`Import started. ID: ${data.importId}`);
      
      // Poll for progress updates
      await monitorImportProgress(data.importId);
      
    } catch (err: any) {
      console.error('Error starting bulk import:', err);
      setError(err.message || 'Failed to import contacts');
      setShowProgress(false);
      setIsLoading(false);
      
      toast({
        title: 'Import Error',
        description: err.message || 'Failed to import contacts',
        variant: 'destructive',
      });
      
      if (onError) {
        onError(err);
      }
    }
  };
  
  const monitorImportProgress = async (importId: string) => {
    let completed = false;
    let attempts = 0;
    
    while (!completed && attempts < 30) { // Limit to 30 attempts
      attempts++;
      
      try {
        const response = await fetch(`/api/kudosity/bulk-import?importId=${importId}`);
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to check import progress');
        }
        
        const data = await response.json();
        
        if (!data.success) {
          throw new Error(data.error || 'Failed to check import progress');
        }
        
        const importProgress = data.progress;
        
        // Update progress display
        const percentage = importProgress.processed / Math.max(1, importProgress.total);
        const progressValue = 30 + Math.round(percentage * 60); // Scale from 30% to 90%
        
        setProgress(progressValue);
        setStatus(`Processing: ${importProgress.processed}/${importProgress.total} contacts. Status: ${importProgress.status}`);
        
        if (importProgress.complete) {
          completed = true;
          setProgress(100);
          setStatus('Import completed');
          setImportResult({
            processed: importProgress.processed,
            errors: importProgress.errors,
            status: importProgress.status,
            importId
          });
          
          // Show success message
          toast({
            title: 'Import Completed',
            description: `Successfully processed ${importProgress.processed} contacts with ${importProgress.errors} errors.`,
            variant: 'default',
          });
          
          // Wait a moment and then hide the progress dialog
          setTimeout(() => {
            setShowProgress(false);
            setIsLoading(false);
            
            if (onComplete) {
              onComplete({
                importId,
                processed: importProgress.processed,
                errors: importProgress.errors,
                status: importProgress.status
              });
            }
          }, 2000);
          
          return;
        }
        
        // Wait before checking again
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (err: any) {
        console.error('Error checking import progress:', err);
        
        // Don't fail the process on a progress check error, just try again
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    
    // If we reach here, the polling timed out without completing
    setProgress(90);
    setStatus('Import in progress, but monitoring timed out. You can check the status later.');
    
    toast({
      title: 'Import Status',
      description: 'The import is still processing. You can check its status later.',
      variant: 'default',
    });
    
    setShowProgress(false);
    setIsLoading(false);
    
    if (onComplete) {
      onComplete({
        importId,
        status: 'processing',
        message: 'Import still in progress. Check status later.'
      });
    }
  };
  
  return (
    <>
      <Button 
        onClick={startImport} 
        disabled={isLoading || !contacts || contacts.length === 0}
        variant={variant}
      >
        {isLoading ? 'Importing...' : buttonText}
      </Button>
      
      <AlertDialog open={showProgress} onOpenChange={setShowProgress}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {error ? 'Import Error' : 'Importing Contacts'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {error ? (
                <div className="text-red-500">{error}</div>
              ) : (
                <>
                  <div className="mb-2">{status}</div>
                  <Progress value={progress} className="h-2" />
                  
                  {importResult && (
                    <div className="mt-4 p-4 bg-gray-50 rounded-md">
                      <h3 className="font-medium">Import Results</h3>
                      <div className="mt-2 text-sm space-y-1">
                        <div>Processed: {importResult.processed} contacts</div>
                        <div>Errors: {importResult.errors} contacts</div>
                        <div>Status: {importResult.status}</div>
                        <div>Import ID: {importResult.importId}</div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {error || importResult ? (
              <AlertDialogAction onClick={() => setShowProgress(false)}>
                Close
              </AlertDialogAction>
            ) : (
              <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
} 