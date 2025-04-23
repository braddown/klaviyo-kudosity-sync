'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Input } from '@/components/ui/input';
import { fetchKlaviyoSegments, fetchKlaviyoLists } from '@/lib/api/klaviyo';
import { fetchKudosityLists } from '@/lib/api/kudosity';
import SyncProgress from './SyncProgress';
import FieldMapping from './FieldMapping';
import { getSupabaseClient } from '@/lib/supabase';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, PlusCircle, CheckIcon, ChevronDown, Search, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface SyncFormProps {
  initialError?: string;
}

export default function SyncForm({ initialError }: SyncFormProps) {
  // State for API data
  const [klaviyoSegments, setKlaviyoSegments] = useState<any[]>([]);
  const [klaviyoLists, setKlaviyoLists] = useState<any[]>([]); 
  const [kudosityLists, setKudosityLists] = useState<any[]>([]);
  
  // Selection state
  const [selectedType, setSelectedType] = useState<'segments' | 'lists'>('segments');
  const [selectedKlaviyoId, setSelectedKlaviyoId] = useState<string>('');
  const [selectedKudosityId, setSelectedKudosityId] = useState<string>('');
  const [selectedSegmentProfileCount, setSelectedSegmentProfileCount] = useState<number | null>(null);
  
  // Dropdown open state
  const [openKlaviyoDropdown, setOpenKlaviyoDropdown] = useState(false);
  const [openKudosityDropdown, setOpenKudosityDropdown] = useState(false);
  
  // Search filter state
  const [klaviyoSearchTerm, setKlaviyoSearchTerm] = useState('');
  const [kudositySearchTerm, setKudositySearchTerm] = useState('');
  
  // Dropdown refs for click outside handling
  const klaviyoDropdownRef = useRef<HTMLDivElement>(null);
  const kudosityDropdownRef = useRef<HTMLDivElement>(null);
  
  // New List Dialog state
  const [newListOpen, setNewListOpen] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [creatingList, setCreatingList] = useState(false);
  const [autoMapping, setAutoMapping] = useState(false);
  
  // Field mapping state
  const [fieldMappings, setFieldMappings] = useState<Record<string, string>>({
    phone_number: 'mobile',
    first_name: 'first_name',
    last_name: 'last_name',
  });
  
  // Available fields state
  const [availableFields, setAvailableFields] = useState<string[]>([]);
  const [isLoadingFields, setIsLoadingFields] = useState<boolean>(false);
  const [showAddFieldDropdown, setShowAddFieldDropdown] = useState<boolean>(false);
  const [customFieldName, setCustomFieldName] = useState<string>('');
  const [customFieldSlot, setCustomFieldSlot] = useState<number>(1);
  const addFieldDropdownRef = useRef<HTMLDivElement>(null);
  
  // Progress state
  const [syncState, setSyncState] = useState<'idle' | 'retrieving' | 'processing' | 'uploading' | 'importing' | 'complete' | 'error'>('idle');
  const [progress, setProgress] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [profilesRetrieved, setProfilesRetrieved] = useState<number>(0);
  const [totalProfiles, setTotalProfiles] = useState<number>(0);
  const [syncStats, setSyncStats] = useState<any>(null);
  const [error, setError] = useState<string | null>(initialError || null);
  const [errorDetails, setErrorDetails] = useState<any>(null);
  
  // Loading state
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingProfileCount, setIsLoadingProfileCount] = useState<boolean>(false);
  
  // New expanded state for field mapping after auto-mapping
  const [showFieldMapping, setShowFieldMapping] = useState(false);
  
  const { toast } = useToast();
  
  // Load API data on component mount
  useEffect(() => {
    // If there's an initial error, don't try to load API data
    if (initialError) {
      setIsLoading(false);
      return;
    }
    
    async function loadApiData() {
      console.log("Starting API data loading...");
      setIsLoading(true);
      setError(null);
      setErrorDetails(null);
      
      try {
        // Get API settings from Supabase
        const supabase = getSupabaseClient();
        console.log("Fetching API settings...");
        
        const { data: settings, error: settingsError } = await supabase
          .from('api_settings')
          .select('*')
          .single();
          
        if (settingsError) {
          console.error("Database error:", settingsError);
          throw new Error(`Failed to fetch API settings: ${settingsError.message}`);
        }
          
        if (!settings) {
          throw new Error('API settings not found. Please configure them in the Settings page.');
        }
        
        // Check Klaviyo API key
        if (!settings.klaviyo_api_key) {
          throw new Error('Klaviyo API key is not configured. Please add it in the Settings page.');
        }
        
        // Check Kudosity credentials
        if (!settings.kudosity_username || !settings.kudosity_password) {
          throw new Error('Kudosity credentials are not configured. Please add them in the Settings page.');
        }
        
        console.log("API settings found, proceeding to load data from APIs");
        
        // Load Klaviyo data using the API endpoint first, then fall back to direct method
        console.log("Fetching from Klaviyo API...");
        let segments: any[] = [];
        let lists: any[] = [];
        
        // Load Klaviyo segments
        try {
          // First try the API endpoint with GET
          console.log("Trying GET request to /api/test-klaviyo?type=segments");
          const segmentsResponse = await fetch('/api/test-klaviyo?type=segments', {
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' }
          });
          
          if (segmentsResponse.ok) {
            const data = await segmentsResponse.json();
            if (data.success && data.segments) {
              segments = data.segments;
              console.log(`Retrieved ${segments.length} Klaviyo segments via API endpoint`);
            } else {
              console.warn("API endpoint returned success=false or no segments");
            }
          } else if (segmentsResponse.status === 401) {
            // If unauthorized, try POST as fallback
            console.log("GET request unauthorized, trying POST fallback for segments...");
            
            const postResponse = await fetch('/api/test-klaviyo?type=segments', {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                klaviyo_api_key: settings.klaviyo_api_key
              })
            });
            
            if (postResponse.ok) {
              const data = await postResponse.json();
              if (data.success && data.segments) {
                segments = data.segments;
                console.log(`Retrieved ${segments.length} Klaviyo segments via POST endpoint`);
              }
            }
          }
          
          // If API endpoints failed, fall back to direct method as last resort
          if (segments.length === 0) {
            console.log("API endpoints failed, falling back to direct Klaviyo segments fetch");
            segments = await fetchKlaviyoSegments(settings.klaviyo_api_key);
            console.log(`Retrieved ${segments.length} Klaviyo segments directly`);
          }
          
          // Update segments state
          setKlaviyoSegments(segments);
        } catch (segmentsError: any) {
          console.error('Klaviyo segments loading error:', segmentsError);
          throw new Error(`Failed to fetch Klaviyo segments: ${segmentsError.message}`);
        }
        
        // Load Klaviyo lists
        try {
          // First try the API endpoint with GET
          console.log("Trying GET request to /api/test-klaviyo?type=lists");
          const listsResponse = await fetch('/api/test-klaviyo?type=lists', {
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' }
          });
          
          if (listsResponse.ok) {
            const data = await listsResponse.json();
            if (data.success && data.lists) {
              lists = data.lists;
              console.log(`Retrieved ${lists.length} Klaviyo lists via API endpoint`);
            } else {
              console.warn("API endpoint returned success=false or no lists");
            }
          } else if (listsResponse.status === 401) {
            // If unauthorized, try POST as fallback
            console.log("GET request unauthorized, trying POST fallback for lists...");
            
            const postResponse = await fetch('/api/test-klaviyo?type=lists', {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                klaviyo_api_key: settings.klaviyo_api_key
              })
            });
            
            if (postResponse.ok) {
              const data = await postResponse.json();
              if (data.success && data.lists) {
                lists = data.lists;
                console.log(`Retrieved ${lists.length} Klaviyo lists via POST endpoint`);
              }
            }
          }
          
          // If API endpoints failed, fall back to direct method as last resort
          if (lists.length === 0) {
            console.log("API endpoints failed, falling back to direct Klaviyo lists fetch");
            lists = await fetchKlaviyoLists(settings.klaviyo_api_key);
            console.log(`Retrieved ${lists.length} Klaviyo lists directly`);
          }
          
          // Update lists state
          setKlaviyoLists(lists);
        } catch (listsError: any) {
          console.error('Klaviyo lists loading error:', listsError);
          throw new Error(`Failed to fetch Klaviyo lists: ${listsError.message}`);
        }
        
        console.log("All data loaded successfully");
      } catch (error: any) {
        console.error('Error loading API data:', error);
        
        // Create detailed error information
        const errorDetails = {
          message: error.message,
          stack: error.stack,
          cause: error.cause,
          name: error.name,
          code: error.code
        };
        
        setErrorDetails(errorDetails);
        setError(error.message);
        
        toast({
          title: 'Error Loading Data',
          description: error.message || 'An unexpected error occurred',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    }
    
    loadApiData();
  }, [toast, initialError]);
  
  // Add a new function for fetching available fields
  const fetchFields = async () => {
    if (!selectedKlaviyoId) return;
    
    try {
      setIsLoadingFields(true);
      
      // Call API to get all available fields for the selected Klaviyo source
      const response = await fetch(
        `/api/klaviyo-profile-fields?type=${selectedType}&id=${selectedKlaviyoId}`, 
        {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' }
        }
      );
      
      // If unauthorized, try with direct API key as fallback
      if (response.status === 401) {
        console.log("Session auth failed for field retrieval, trying direct API key...");
        
        // Get the API settings
        const supabase = getSupabaseClient();
        const { data: settings, error: settingsError } = await supabase
          .from('api_settings')
          .select('klaviyo_api_key')
          .single();
          
        if (settingsError || !settings?.klaviyo_api_key) {
          console.error("Failed to get API key:", settingsError);
          throw new Error("Couldn't retrieve API key for fallback authentication");
        }
        
        // Try again with direct API key
        const directResponse = await fetch(
          `/api/klaviyo-profile-fields?type=${selectedType}&id=${selectedKlaviyoId}&api_key=${encodeURIComponent(settings.klaviyo_api_key)}`, 
          { headers: { 'Content-Type': 'application/json' } }
        );
        
        if (directResponse.ok) {
          const data = await directResponse.json();
          if (data.success && data.fields) {
            setAvailableFields(data.fields);
            return;
          }
        }
        
        // Handle errors from direct API call
        const errorData = await directResponse.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to fetch fields (${directResponse.status})`);
      }
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.fields) {
          setAvailableFields(data.fields);
        } else {
          throw new Error(data.error || 'Failed to retrieve Klaviyo fields');
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to fetch fields (${response.status})`);
      }
    } catch (error: any) {
      console.error('Error fetching Klaviyo fields:', error);
      toast({
        title: 'Error retrieving fields',
        description: error.message || 'Failed to retrieve fields from Klaviyo',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingFields(false);
    }
  };
  
  // Fetch available fields when a Klaviyo source is selected
  useEffect(() => {
    if (selectedKlaviyoId) {
      fetchFields();
    } else {
      setAvailableFields([]);
    }
  }, [selectedKlaviyoId, selectedType]);
  
  // Add a click outside handler for the add field dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (addFieldDropdownRef.current && !addFieldDropdownRef.current.contains(event.target as Node)) {
        setShowAddFieldDropdown(false);
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // Handle adding a new custom field mapping
  const handleAddCustomField = () => {
    if (!customFieldName) {
      toast({
        title: 'Field required',
        description: 'Please select a field to map',
        variant: 'destructive',
      });
      return;
    }
    
    // Check if field already mapped
    if (Object.keys(fieldMappings).includes(customFieldName)) {
      toast({
        title: 'Field already mapped',
        description: `The field "${customFieldName}" is already mapped`,
        variant: 'destructive',
      });
      return;
    }
    
    // Auto-generate field name if needed
    if (!customFieldName.startsWith('field_')) {
      // Create a Kudosity-friendly field name from the Klaviyo field
      const fieldNameFormatted = customFieldName.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
      
      // Update field mappings
      const newMappings = { ...fieldMappings };
      newMappings[customFieldName] = fieldNameFormatted;
      setFieldMappings(newMappings);
    } else {
      // Update field mappings with standard field_N format
      const newMappings = { ...fieldMappings };
      newMappings[customFieldName] = `field_${customFieldSlot}`;
      setFieldMappings(newMappings);
    }
    
    // Increment field slot for next mapping
    setCustomFieldSlot((prevSlot: number) => Math.min(prevSlot + 1, 10));
    setCustomFieldName('');
    setShowAddFieldDropdown(false);
    
    toast({
      title: 'Field mapped',
      description: `Added "${customFieldName}" to field mappings`,
    });
  };
  
  // Remove a field mapping
  const removeFieldMapping = (fieldName: string) => {
    // Don't allow removing standard fields
    const standardFields = ['phone_number', 'first_name', 'last_name'];
    if (standardFields.includes(fieldName)) {
      toast({
        title: 'Cannot remove standard field',
        description: 'Standard fields are required for the sync process',
        variant: 'destructive',
      });
      return;
    }
    
    // Remove the field mapping
    const newMappings = { ...fieldMappings };
    delete newMappings[fieldName];
    setFieldMappings(newMappings);
    
    toast({
      title: 'Field removed',
      description: `Removed "${fieldName}" from field mappings`,
    });
  };
  
  // Update the useEffect to fetch profile count for both segments and lists
  useEffect(() => {
    async function fetchProfileCount() {
      if (!selectedKlaviyoId) {
        setSelectedSegmentProfileCount(null);
        return;
      }
      
      try {
        setIsLoadingProfileCount(true);
        
        // Call API to get profile count for the selected segment or list
        const response = await fetch(`/api/klaviyo-profiles-count?type=${selectedType}&id=${selectedKlaviyoId}`, {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' }
        });
        
        // If unauthorized, try with direct API key as fallback
        if (response.status === 401) {
          console.log("Session auth failed for profile count, trying direct API key...");
          
          // Get the API settings
          const supabase = getSupabaseClient();
          const { data: settings, error: settingsError } = await supabase
            .from('api_settings')
            .select('klaviyo_api_key')
            .single();
            
          if (settingsError || !settings?.klaviyo_api_key) {
            console.error("Failed to get API key:", settingsError);
            throw new Error("Couldn't retrieve API key for fallback authentication");
          }
          
          // Try again with direct API key
          const directResponse = await fetch(
            `/api/klaviyo-profiles-count?type=${selectedType}&id=${selectedKlaviyoId}&api_key=${encodeURIComponent(settings.klaviyo_api_key)}`, 
            { headers: { 'Content-Type': 'application/json' } }
          );
          
          // Handle the direct API key response
          if (directResponse.ok) {
            const data = await directResponse.json();
            if (data.success && data.count !== undefined) {
              setSelectedSegmentProfileCount(data.count);
              return;
            }
          }
          
          // If direct API key method failed too, handle that error
          try {
            const errorData = await directResponse.json();
            if (errorData.error) {
              // Update error details for debug panel display
              if (errorData.details) {
                setErrorDetails(errorData.details);
              }
              
              toast({
                title: "Profile count error",
                description: errorData.error,
                variant: "destructive",
              });
            }
          } catch (e) {
            // Don't do anything here, we'll fall through to the original error handling
          }
        }
        
        // Process the original response
        if (response.ok) {
          const data = await response.json();
          // The API returns { success: true, count: number } when successful
          if (data.success && data.count !== undefined) {
            setSelectedSegmentProfileCount(data.count);
          } else if (data.error) {
            console.warn("Failed to get profile count:", data.error);
            setSelectedSegmentProfileCount(null);
            // Show error toast for better user feedback
            toast({
              title: "Failed to get profile count",
              description: data.error,
              variant: "destructive",
            });
          } else {
            console.warn("Unexpected response format:", data);
            setSelectedSegmentProfileCount(null);
          }
        } else {
          console.warn(`Failed to get profile count, status: ${response.status}`);
          setSelectedSegmentProfileCount(null);
          
          // Try to extract error message from response
          try {
            const errorData = await response.json();
            if (errorData.error) {
              // Update error details for debug panel display
              if (errorData.details) {
                setErrorDetails(errorData.details);
              }
              
              toast({
                title: "Profile count error",
                description: errorData.error,
                variant: "destructive",
              });
            }
          } catch (e) {
            // If we can't parse the error, show a generic message
            toast({
              title: "Profile count error",
              description: `Failed to get profile count (status: ${response.status})`,
              variant: "destructive",
            });
          }
        }
      } catch (error) {
        console.error("Error fetching profile count:", error);
        setSelectedSegmentProfileCount(null);
      } finally {
        setIsLoadingProfileCount(false);
      }
    }
    
    fetchProfileCount();
  }, [selectedKlaviyoId, selectedType, toast]);
  
  // Add a debug panel to display more error details
  const renderErrorDebugPanel = () => {
    if (!errorDetails) return null;
    
    return (
      <Card className="mt-4 border-red-300">
        <CardHeader>
          <CardTitle className="text-red-500">Error Details</CardTitle>
          <CardDescription>Technical information about the error</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="bg-gray-100 p-4 rounded text-xs overflow-auto max-h-[300px]">
            {JSON.stringify(errorDetails, null, 2)}
          </pre>
        </CardContent>
      </Card>
    );
  };
  
  // Reset the Klaviyo selection when switching between segments and lists
  useEffect(() => {
    setSelectedKlaviyoId('');
    setSelectedSegmentProfileCount(null);
  }, [selectedType]);
  
  // Update new list name when selecting a Klaviyo segment
  useEffect(() => {
    if (selectedKlaviyoId) {
      const items = selectedType === 'segments' ? klaviyoSegments : klaviyoLists;
      const selected = items.find((item: any) => item.id === selectedKlaviyoId);
      if (selected) {
        setNewListName(`${selected.attributes.name} from Klaviyo`);
      }
    }
  }, [selectedKlaviyoId, selectedType, klaviyoSegments, klaviyoLists]);
  
  // Handle sync initiation
  const handleSync = async () => {
    if (!selectedKlaviyoId) {
      toast({
        title: 'Selection required',
        description: 'Please select a Klaviyo source',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      setSyncState('retrieving');
      setProgress(0);
      setError(null);
      setErrorDetails(null);
      
      // Get source name for automatic list creation
      const sourceName = getSelectedKlaviyoName();
      const timestamp = new Date();
      const uniqueId = Math.random().toString(36).substring(2, 8);
      const listName = `${sourceName} (${timestamp.toISOString().slice(0, 19).replace('T', ' ')} ${uniqueId})`;
      
      // Get credentials
      const supabase = getSupabaseClient();
      const { data: settings, error: settingsError } = await supabase
        .from('api_settings')
        .select('kudosity_username, kudosity_password, klaviyo_api_key')
        .single();
        
      if (settingsError || !settings?.kudosity_username || !settings?.kudosity_password) {
        throw new Error('Could not retrieve Kudosity credentials');
      }
      
      // Create new Kudosity list
      const createResponse = await fetch('/api/create-kudosity-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: listName,
          kudosity_username: settings.kudosity_username,
          kudosity_password: settings.kudosity_password
        })
      });
      
      if (!createResponse.ok) {
        const errorData = await createResponse.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to create Kudosity list (${createResponse.status})`);
      }
      
      const createData = await createResponse.json();
      if (!createData.success || !createData.list?.id) {
        throw new Error('Failed to create Kudosity list');
      }
      
      const kudosityListId = createData.list.id;
      
      // Add custom fields to Kudosity list
      const standardFields = ['phone_number', 'first_name', 'last_name'];
      const customFields = Object.keys(fieldMappings).filter(field => !standardFields.includes(field));
      
      // Add custom fields to the new list
      for (let i = 0; i < customFields.length; i++) {
        const field = customFields[i];
        const fieldSlot = i + 1;
        
        if (fieldSlot <= 10) { // Kudosity limit is 10 custom fields
          const fieldResponse = await fetch('/api/kudosity-add-field', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              list_id: kudosityListId,
              field_name: field,
              field_slot: fieldSlot,
              kudosity_username: settings.kudosity_username,
              kudosity_password: settings.kudosity_password
            })
          });
          
          // Continue even if field creation fails
          if (!fieldResponse.ok) {
            console.error(`Failed to add field ${field} to Kudosity list`);
          }
        }
      }
      
      // Start the sync process
      const response = await fetch('/api/sync-to-kudosity', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceType: selectedType,
          sourceId: selectedKlaviyoId,
          destinationId: kudosityListId,
          fieldMappings,
          kudosity_username: settings.kudosity_username,
          kudosity_password: settings.kudosity_password,
          klaviyo_api_key: settings.klaviyo_api_key
        }),
      });
      
      // Check for non-OK response
      if (!response.ok) {
        const responseText = await response.text();
        let errorData;
        
        try {
          errorData = JSON.parse(responseText);
        } catch (e) {
          // If it's not valid JSON, use the raw text
          errorData = { message: responseText };
        }
        
        // Capture detailed error information
        const errorDetails = {
          status: response.status,
          statusText: response.statusText,
          responseData: errorData,
          responseText: responseText,
          headers: Object.fromEntries([...response.headers.entries()])
        };
        
        setErrorDetails(errorDetails);
        throw new Error(errorData.error || errorData.message || `API error: ${response.status} ${response.statusText}`);
      }
      
      const { jobId } = await response.json();
      
      // Poll for progress updates
      const pollInterval = setInterval(async () => {
        try {
          const progressResponse = await fetch(`/api/import-progress?jobId=${jobId}`, {
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' }
          });
          
          if (!progressResponse.ok) {
            const responseText = await progressResponse.text();
            let errorData;
            
            try {
              errorData = JSON.parse(responseText);
            } catch (e) {
              errorData = { message: responseText };
            }
            
            setErrorDetails({
              status: progressResponse.status,
              statusText: progressResponse.statusText,
              responseData: errorData,
              responseText: responseText,
              headers: Object.fromEntries([...progressResponse.headers.entries()])
            });
            
            throw new Error(errorData.error || `Progress API error: ${progressResponse.status} ${progressResponse.statusText}`);
          }
          
          const progressData = await progressResponse.json();
          
          const { 
            state, 
            progress,
            currentPage,
            totalPages,
            profilesRetrieved,
            totalProfiles,
            stats 
          } = progressData;
          
          setSyncState(state);
          setProgress(progress);
          setCurrentPage(currentPage || 0);
          setTotalPages(totalPages || 0);
          setProfilesRetrieved(profilesRetrieved || 0);
          setTotalProfiles(totalProfiles || 0);
          
          if (state === 'complete') {
            setSyncStats(stats);
            clearInterval(pollInterval);
            
            toast({
              title: 'Sync Complete',
              description: `Successfully synced ${stats?.imported || 0} contacts to Kudosity list "${listName}"`,
              variant: 'default',
            });
          } else if (state === 'error') {
            setError(progressData.error);
            setErrorDetails(progressData.errorDetails || { message: progressData.error });
            clearInterval(pollInterval);
            
            toast({
              title: 'Sync Error',
              description: progressData.error || 'An error occurred during sync',
              variant: 'destructive',
            });
          }
          
        } catch (pollError: any) {
          console.error('Error polling for progress:', pollError);
          setError(`Progress update error: ${pollError.message}`);
          setErrorDetails(pollError);
          setSyncState('error');
          clearInterval(pollInterval);
          
          toast({
            title: 'Sync Progress Error',
            description: pollError.message || 'Failed to get sync progress',
            variant: 'destructive',
          });
        }
      }, 2000);
      
      // Return cleanup function to clear interval if component unmounts
      return () => clearInterval(pollInterval);
      
    } catch (error: any) {
      setSyncState('error');
      setError(error.message || 'Sync failed');
      
      // If no detailed error information is set yet, set it now
      if (!errorDetails) {
        setErrorDetails({
          message: error.message,
          stack: error.stack,
          cause: error.cause,
          name: error.name
        });
      }
      
      toast({
        title: 'Sync Error',
        description: error.message || 'An error occurred during sync',
        variant: 'destructive',
      });
    }
  };
  
  // Handle creating a new Kudosity list
  const handleCreateNewList = async () => {
    if (!newListName.trim()) {
      toast({
        title: 'List name required',
        description: 'Please enter a name for the new list',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      setCreatingList(true);
      setError(null);
      
      // Call API to create new Kudosity list
      const response = await fetch('/api/create-kudosity-list', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newListName
        }),
      });
      
      // If unauthorized, try with direct credentials as fallback
      if (response.status === 401) {
        console.log("Session auth failed for list creation, trying direct credentials...");
        
        // Get the API settings
        const supabase = getSupabaseClient();
        const { data: settings, error: settingsError } = await supabase
          .from('api_settings')
          .select('kudosity_username, kudosity_password')
          .single();
          
        if (settingsError || !settings?.kudosity_username || !settings?.kudosity_password) {
          console.error("Failed to get credentials:", settingsError);
          throw new Error("Couldn't retrieve Kudosity credentials for fallback authentication");
        }
        
        // Try again with direct credentials
        const directResponse = await fetch('/api/create-kudosity-list', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: newListName,
            kudosity_username: settings.kudosity_username,
            kudosity_password: settings.kudosity_password
          }),
        });
        
        // Handle the direct credentials response
        if (!directResponse.ok) {
          const errorData = await directResponse.json();
          throw new Error(errorData.error || `Failed to create list: ${directResponse.statusText}`);
        }
        
        const data = await directResponse.json();
        
        // Add the new list to the state
        if (data.success && data.list) {
          // Add to beginning of array to show at top of list
          setKudosityLists([data.list, ...kudosityLists]);
          setSelectedKudosityId(data.list.id);
          
          toast({
            title: 'List Created',
            description: `Successfully created new list "${newListName}"`,
          });
          
          // Close the dialog
          setNewListOpen(false);
          return;
        } else {
          throw new Error(data.error || 'Failed to create list');
        }
      }
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to create list: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Add the new list to the state
      if (data.success && data.list) {
        // Add to beginning of array to show at top of list
        setKudosityLists([data.list, ...kudosityLists]);
        setSelectedKudosityId(data.list.id);
        
        toast({
          title: 'List Created',
          description: `Successfully created new list "${newListName}"`,
        });
        
        // Close the dialog
        setNewListOpen(false);
      } else {
        throw new Error(data.error || 'Failed to create list');
      }
    } catch (error: any) {
      console.error('Error creating Kudosity list:', error);
      
      toast({
        title: 'List Creation Failed',
        description: error.message || 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setCreatingList(false);
    }
  };
  
  // Reset the sync state to start a new sync
  const handleReset = () => {
    setSyncState('idle');
    setProgress(0);
    setCurrentPage(0);
    setTotalPages(0);
    setProfilesRetrieved(0);
    setTotalProfiles(0);
    setSyncStats(null);
    setError(null);
    setErrorDetails(null);
  };
  
  // Get the display name of the selected Klaviyo item
  const getSelectedKlaviyoName = () => {
    if (!selectedKlaviyoId) return '';
    
    const items = selectedType === 'segments' ? klaviyoSegments : klaviyoLists;
    const selected = items.find((item: any) => item.id === selectedKlaviyoId);
    return selected ? selected.attributes.name : '';
  };
  
  // Get the display name of the selected Kudosity list
  const getSelectedKudosityName = () => {
    if (!selectedKudosityId) return '';
    
    const selected = kudosityLists.find((list: any) => list.id === selectedKudosityId);
    return selected ? selected.name : '';
  };
  
  // Click outside handler for dropdowns
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (klaviyoDropdownRef.current && !klaviyoDropdownRef.current.contains(event.target as Node)) {
        setOpenKlaviyoDropdown(false);
      }
      if (kudosityDropdownRef.current && !kudosityDropdownRef.current.contains(event.target as Node)) {
        setOpenKudosityDropdown(false);
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {/* Debug panel with technical error details */}
      {errorDetails && renderErrorDebugPanel()}
      
      {syncState === 'idle' ? (
        <Card>
          <CardContent className="pt-6">
            <Tabs defaultValue="segments" onValueChange={(value: string) => setSelectedType(value as 'segments' | 'lists')}>
              <TabsList className="mb-4">
                <TabsTrigger value="segments">Sync from Segments</TabsTrigger>
                <TabsTrigger value="lists">Sync from Lists</TabsTrigger>
              </TabsList>
              
              {error ? (
                <div className="my-6">
                  <p className="text-sm text-muted-foreground mb-4">
                    Please fix the error above before continuing. You may need to:
                  </p>
                  <ul className="list-disc pl-5 space-y-2 text-sm">
                    <li>Configure your API credentials in the <a href="/dashboard/settings" className="text-blue-600 hover:underline">Settings page</a></li>
                    <li>Check that your API keys are correct and have the necessary permissions</li>
                    <li>Ensure your network connection is working properly</li>
                  </ul>
                </div>
              ) : (
                <>
                  <TabsContent value="segments" className="space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Select Klaviyo Segment</label>
                      <div className="relative" ref={klaviyoDropdownRef}>
                        <Button
                          variant="outline"
                          className="w-full justify-between"
                          disabled={isLoading}
                          type="button"
                          onClick={() => setOpenKlaviyoDropdown(!openKlaviyoDropdown)}
                        >
                          {selectedKlaviyoId ? getSelectedKlaviyoName() : isLoading ? "Loading segments..." : "Select a segment"}
                          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                        
                        {openKlaviyoDropdown && (
                          <div className="absolute z-10 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg">
                            <div className="p-2 border-b">
                              <div className="flex items-center border rounded-md px-2 py-1">
                                <Search className="h-4 w-4 text-gray-400" />
                                <input
                                  type="text"
                                  placeholder="Search segments..."
                                  className="w-full bg-transparent border-0 outline-none px-2 py-1 text-sm"
                                  value={klaviyoSearchTerm}
                                  onChange={(e) => setKlaviyoSearchTerm(e.target.value)}
                                />
                              </div>
                            </div>
                            
                            <div className="max-h-[300px] overflow-y-auto py-1">
                              {klaviyoSegments
                                .filter((segment: any) => 
                                  segment.attributes.name.toLowerCase().includes(klaviyoSearchTerm.toLowerCase())
                                )
                                .map((segment: any) => (
                                  <div
                                    key={segment.id}
                                    className={cn(
                                      "flex items-center gap-2 w-full px-3 py-2 text-sm cursor-pointer hover:bg-gray-100",
                                      selectedKlaviyoId === segment.id ? "bg-gray-100" : ""
                                    )}
                                    onClick={() => {
                                      setSelectedKlaviyoId(segment.id);
                                      setOpenKlaviyoDropdown(false);
                                      setKlaviyoSearchTerm('');
                                    }}
                                  >
                                    <CheckIcon
                                      className={cn(
                                        "h-4 w-4",
                                        selectedKlaviyoId === segment.id ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    <span>{segment.attributes.name}</span>
                                  </div>
                                ))}
                              
                              {klaviyoSegments
                                .filter((segment: any) => 
                                  segment.attributes.name.toLowerCase().includes(klaviyoSearchTerm.toLowerCase())
                                ).length === 0 && (
                                <div className="px-3 py-2 text-sm text-gray-500">
                                  No segments found
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {/* Profile count display */}
                      {selectedKlaviyoId && (
                        <div className="mt-2 text-sm">
                          {isLoadingProfileCount ? (
                            <span className="text-gray-500">Loading profile count...</span>
                          ) : selectedSegmentProfileCount !== null ? (
                            <span className="font-medium">Profiles: {selectedSegmentProfileCount.toLocaleString()}</span>
                          ) : null}
                        </div>
                      )}
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="lists" className="space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Select Klaviyo List</label>
                      <div className="relative" ref={klaviyoDropdownRef}>
                        <Button
                          variant="outline"
                          className="w-full justify-between"
                          disabled={isLoading}
                          type="button"
                          onClick={() => setOpenKlaviyoDropdown(!openKlaviyoDropdown)}
                        >
                          {selectedKlaviyoId ? getSelectedKlaviyoName() : isLoading ? "Loading lists..." : "Select a list"}
                          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                        
                        {openKlaviyoDropdown && (
                          <div className="absolute z-10 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg">
                            <div className="p-2 border-b">
                              <div className="flex items-center border rounded-md px-2 py-1">
                                <Search className="h-4 w-4 text-gray-400" />
                                <input
                                  type="text"
                                  placeholder="Search lists..."
                                  className="w-full bg-transparent border-0 outline-none px-2 py-1 text-sm"
                                  value={klaviyoSearchTerm}
                                  onChange={(e) => setKlaviyoSearchTerm(e.target.value)}
                                />
                              </div>
                            </div>
                            
                            <div className="max-h-[300px] overflow-y-auto py-1">
                              {klaviyoLists
                                .filter((list: any) => 
                                  list.attributes.name.toLowerCase().includes(klaviyoSearchTerm.toLowerCase())
                                )
                                .map((list: any) => (
                                  <div
                                    key={list.id}
                                    className={cn(
                                      "flex items-center gap-2 w-full px-3 py-2 text-sm cursor-pointer hover:bg-gray-100",
                                      selectedKlaviyoId === list.id ? "bg-gray-100" : ""
                                    )}
                                    onClick={() => {
                                      setSelectedKlaviyoId(list.id);
                                      setOpenKlaviyoDropdown(false);
                                      setKlaviyoSearchTerm('');
                                    }}
                                  >
                                    <CheckIcon
                                      className={cn(
                                        "h-4 w-4",
                                        selectedKlaviyoId === list.id ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    <span>{list.attributes.name}</span>
                                  </div>
                                ))}
                              
                              {klaviyoLists
                                .filter((list: any) => 
                                  list.attributes.name.toLowerCase().includes(klaviyoSearchTerm.toLowerCase())
                                ).length === 0 && (
                                <div className="px-3 py-2 text-sm text-gray-500">
                                  No lists found
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {/* Profile count display */}
                      {selectedKlaviyoId && (
                        <div className="mt-2 text-sm">
                          {isLoadingProfileCount ? (
                            <span className="text-gray-500">Loading profile count...</span>
                          ) : selectedSegmentProfileCount !== null ? (
                            <span className="font-medium">Profiles: {selectedSegmentProfileCount.toLocaleString()}</span>
                          ) : null}
                        </div>
                      )}
                    </div>
                  </TabsContent>
                  
                  {/* Display fields that will be mapped */}
                  {selectedKlaviyoId && (
                    <div className="mt-6 border rounded-md p-4">
                      <h3 className="text-md font-medium mb-2">Field Mappings</h3>
                      {isLoadingFields ? (
                        <div className="flex items-center space-x-2">
                          <div className="h-4 w-4 rounded-full border-2 border-t-current animate-spin" />
                          <span>Loading available fields...</span>
                        </div>
                      ) : (
                        <div>
                          <p className="text-sm text-muted-foreground mb-4">
                            Standard fields are mapped automatically. You can add up to 10 custom fields.
                          </p>
                          
                          {/* Standard Fields Section */}
                          <div className="mb-4">
                            <h4 className="text-sm font-semibold mb-2">Standard Fields</h4>
                            <div className="grid grid-cols-1 gap-2">
                              <div className="flex items-center justify-between p-2 bg-muted/30 rounded-md">
                                <span className="font-medium text-sm">Phone Number</span>
                                <span className="text-sm text-muted-foreground">→ mobile</span>
                              </div>
                              <div className="flex items-center justify-between p-2 bg-muted/30 rounded-md">
                                <span className="font-medium text-sm">First Name</span>
                                <span className="text-sm text-muted-foreground">→ first_name</span>
                              </div>
                              <div className="flex items-center justify-between p-2 bg-muted/30 rounded-md">
                                <span className="font-medium text-sm">Last Name</span>
                                <span className="text-sm text-muted-foreground">→ last_name</span>
                              </div>
                            </div>
                          </div>
                          
                          {/* Custom Fields Section */}
                          <div>
                            <div className="flex justify-between items-center mb-2">
                              <h4 className="text-sm font-semibold">Custom Fields</h4>
                              {/* Only show add button if we haven't reached the limit */}
                              {Object.keys(fieldMappings).length - 3 < 10 && (
                                <div className="relative" ref={addFieldDropdownRef}>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setShowAddFieldDropdown(!showAddFieldDropdown)}
                                    disabled={availableFields.length === 0}
                                    className="flex items-center gap-1"
                                  >
                                    <PlusCircle className="h-4 w-4 mr-1" />
                                    Map New Field
                                  </Button>
                                  
                                  {showAddFieldDropdown && (
                                    <div className="absolute right-0 z-10 mt-1 w-64 bg-white border rounded-md shadow-lg">
                                      <div className="p-2 border-b">
                                        <p className="text-sm font-medium mb-1">Select Klaviyo Field</p>
                                        <div className="flex items-center border rounded-md px-2 py-1">
                                          <Search className="h-4 w-4 text-gray-400" />
                                          <input
                                            type="text"
                                            placeholder="Search fields..."
                                            className="w-full bg-transparent border-0 outline-none px-2 py-1 text-sm"
                                            value={klaviyoSearchTerm}
                                            onChange={(e) => setKlaviyoSearchTerm(e.target.value)}
                                          />
                                        </div>
                                      </div>
                                      
                                      <div className="max-h-[300px] overflow-y-auto">
                                        {availableFields
                                          .filter((field: string) => 
                                            !Object.keys(fieldMappings).includes(field) && 
                                            field.toLowerCase().includes(klaviyoSearchTerm.toLowerCase())
                                          )
                                          .sort((a: string, b: string) => a.localeCompare(b))
                                          .slice(0, 200) // Limit to 200 fields in dropdown to prevent UI lag
                                          .map((field: string) => (
                                            <div
                                              key={field}
                                              className="p-2 hover:bg-gray-100 cursor-pointer"
                                              onClick={() => {
                                                setCustomFieldName(field);
                                                setShowAddFieldDropdown(false);
                                                setKlaviyoSearchTerm('');
                                                // Auto-add the field with a format similar to the field name
                                                setTimeout(() => {
                                                  // Create a Kudosity-friendly field name
                                                  const fieldNameFormatted = field.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
                                                  const newMappings = { ...fieldMappings };
                                                  newMappings[field] = fieldNameFormatted;
                                                  setFieldMappings(newMappings);
                                                  
                                                  toast({
                                                    title: 'Field mapped',
                                                    description: `Added "${field}" to field mappings`,
                                                  });
                                                }, 10);
                                              }}
                                            >
                                              <span className="text-sm">{field}</span>
                                            </div>
                                          ))}
                                        
                                        {availableFields.filter((field: string) => 
                                          !Object.keys(fieldMappings).includes(field) && 
                                          field.toLowerCase().includes(klaviyoSearchTerm.toLowerCase())
                                        ).length === 0 && (
                                          <div className="p-3 text-center text-sm text-gray-500">
                                            No unmapped fields found
                                          </div>
                                        )}
                                        
                                        {availableFields.filter((field: string) => 
                                          !Object.keys(fieldMappings).includes(field) && 
                                          field.toLowerCase().includes(klaviyoSearchTerm.toLowerCase())
                                        ).length > 200 && (
                                          <div className="p-3 text-center text-sm text-amber-600 border-t">
                                            {availableFields.filter((field: string) => 
                                              !Object.keys(fieldMappings).includes(field) && 
                                              field.toLowerCase().includes(klaviyoSearchTerm.toLowerCase())
                                            ).length - 200} more fields available. Please refine your search.
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                            
                            {/* Display custom field mappings */}
                            {Object.entries(fieldMappings)
                              .filter(([field]) => !['phone_number', 'first_name', 'last_name'].includes(field))
                              .map(([klaviyoField, kudosityField]) => (
                                <div key={klaviyoField} className="flex items-center justify-between p-2 mb-2 bg-muted/30 rounded-md">
                                  <span className="font-medium text-sm">{klaviyoField}</span>
                                  <div className="flex items-center">
                                    <span className="text-sm text-muted-foreground mr-2">→ {String(kudosityField)}</span>
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      className="h-7 w-7 p-0" 
                                      onClick={() => removeFieldMapping(klaviyoField)}
                                    >
                                      <XCircle className="h-4 w-4 text-gray-400 hover:text-red-500" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            
                            {Object.keys(fieldMappings).length - 3 === 0 && (
                              <p className="text-sm text-gray-500 italic">No custom fields mapped. Click "Map New Field" to add.</p>
                            )}
                            
                            {Object.keys(fieldMappings).length - 3 >= 10 && (
                              <p className="text-xs text-amber-600 mt-2">
                                Kudosity supports a maximum of 10 custom fields. You have reached the limit.
                              </p>
                            )}
                            
                            {availableFields.length > 0 && (
                              <p className="text-xs text-muted-foreground mt-2">
                                {availableFields.length} fields available from Klaviyo. 
                                {availableFields.length > 100 ? ' Use the search to find specific fields.' : ''}
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div className="mt-6">
                    <Button 
                      onClick={handleSync}
                      disabled={isLoading || !selectedKlaviyoId || isLoadingFields}
                    >
                      {isLoading || isLoadingFields ? 'Loading...' : 'Create List and Start Sync'}
                    </Button>
                    <p className="mt-2 text-xs text-muted-foreground">
                      This will automatically create a new Kudosity list based on the selected Klaviyo source.
                    </p>
                  </div>
                </>
              )}
            </Tabs>
          </CardContent>
        </Card>
      ) : (
        <SyncProgress
          state={syncState}
          progress={progress}
          currentPage={currentPage}
          totalPages={totalPages}
          profilesRetrieved={profilesRetrieved}
          totalProfiles={totalProfiles}
          stats={syncStats}
          error={error}
          errorDetails={errorDetails}
          onReset={handleReset}
        />
      )}
    </div>
  );
} 