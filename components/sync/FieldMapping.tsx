'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronDown, ChevronUp, Plus, X, Loader2, PlusCircle, Trash2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { getSupabaseClient } from '@/lib/supabase';
import { ClipLoader } from 'react-spinners';

interface FieldMappingProps {
  mappings: Record<string, string>;
  onChange: (mappings: Record<string, string>) => void;
  selectedType: 'segments' | 'lists';
  selectedKlaviyoId: string;
  selectedKudosityId: string;
}

export default function FieldMapping({ 
  mappings, 
  onChange, 
  selectedType,
  selectedKlaviyoId,
  selectedKudosityId
}: FieldMappingProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [newFieldKey, setNewFieldKey] = useState('');
  const [newFieldValue, setNewFieldValue] = useState('');
  
  const [availableKlaviyoFields, setAvailableKlaviyoFields] = useState<string[]>([]);
  const [loadingFields, setLoadingFields] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [addingField, setAddingField] = useState(false);
  
  // Track used custom field slots
  const [usedFieldSlots, setUsedFieldSlots] = useState<number[]>([]);
  
  // Standard fields that should always be present
  const standardFields = ['phone_number', 'first_name', 'last_name'];
  const customFields = Object.keys(mappings).filter(
    (key) => !standardFields.includes(key)
  );
  
  // Standard Kudosity fields
  const standardKudosityFields = ['mobile', 'first_name', 'last_name'];
  
  // Maximum number of custom fields allowed in Kudosity
  const MAX_FIELD_SLOTS = 10;
  
  useEffect(() => {
    if (mappings && Object.keys(mappings).length > 0) {
      const slots = getUsedFieldSlots(mappings);
      setUsedFieldSlots(slots);
    }
  }, [mappings]);

  useEffect(() => {
    const supabase = getSupabaseClient();
    supabase
      .from('api_settings')
      .select('klaviyo_api_key')
      .single()
      .then(({ data }) => {
        if (data?.klaviyo_api_key) {
          loadKlaviyoFields();
        }
      });
  }, []);
  
  // Load available Klaviyo fields from the API
  const loadKlaviyoFields = async () => {
    if (!selectedKlaviyoId) {
      return;
    }
    
    setLoadingFields(true);
    setFieldError(null);
    
    try {
      // Call API to get profile fields for the selected segment or list
      const response = await fetch(
        `/api/klaviyo-profile-fields?type=${selectedType}&id=${selectedKlaviyoId}`, 
        {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' }
        }
      );
      
      // If unauthorized, try with direct API key as fallback
      if (response.status === 401) {
        console.log("Session auth failed for fields, trying direct API key...");
        
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
            setAvailableKlaviyoFields(data.fields);
          } else {
            setFieldError(data.error || 'Failed to load Klaviyo fields');
          }
        } else {
          const errorData = await directResponse.json().catch(() => ({}));
          setFieldError(errorData.error || `Failed to load fields (${directResponse.status})`);
        }
        
        setLoadingFields(false);
        return;
      }
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.fields) {
          setAvailableKlaviyoFields(data.fields);
        } else {
          setFieldError(data.error || 'Failed to load Klaviyo fields');
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        setFieldError(errorData.error || `Failed to load fields (${response.status})`);
      }
    } catch (error: any) {
      console.error("Error loading Klaviyo fields:", error);
      setFieldError(error.message || 'Failed to load Klaviyo fields');
    } finally {
      setLoadingFields(false);
    }
  };
  
  // Get currently used field slots when selected Kudosity list or mappings change
  useEffect(() => {
    async function getUsedFieldSlots() {
      if (!selectedKudosityId) {
        setUsedFieldSlots([]);
        return;
      }
      
      // For now, just determine used slots from the current mappings
      // This is a simplified approach - ideally we'd query the API for existing fields
      const existingSlots: number[] = [];
      
      // Assume standard fields don't use custom field slots
      Object.values(mappings).forEach(fieldName => {
        if (!standardKudosityFields.includes(fieldName)) {
          // Extract the number if the field name follows the pattern field_N
          const match = fieldName.match(/^field_(\d+)$/);
          if (match) {
            existingSlots.push(parseInt(match[1], 10));
          }
        }
      });
      
      setUsedFieldSlots(existingSlots);
    }
    
    getUsedFieldSlots();
  }, [selectedKudosityId, mappings]);
  
  // Get the next available field slot (1-10)
  const getNextAvailableFieldSlot = () => {
    for (let i = 1; i <= 10; i++) {
      if (!usedFieldSlots.includes(i)) {
        return i;
      }
    }
    // If all slots are used, return the first slot (will overwrite)
    return 1;
  };
  
  // Handle adding a field
  const handleAddField = async () => {
    // First ensure we have a field value if we have a selected field
    if (newFieldKey && !newFieldValue) {
      // Create a field name from the selected key
      const generatedFieldName = newFieldKey.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
      setNewFieldValue(generatedFieldName);
      
      // Wait briefly to ensure the state updates before proceeding
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    if (newFieldKey && newFieldValue) {
      // Update local state first
      const updatedMappings = {
        ...mappings,
        [newFieldKey]: newFieldValue,
      };
      
      onChange(updatedMappings);
      
      // Check if this is a new field in Kudosity that needs to be created
      if (
        !standardKudosityFields.includes(newFieldValue) && 
        !Object.values(mappings).includes(newFieldValue) &&
        selectedKudosityId &&
        !newFieldValue.startsWith('field_') // Only create if not already using field_N format
      ) {
        // ... rest of the existing function ...
      }
      
      setNewFieldKey('');
      setNewFieldValue('');
    }
  };

  const handleRemoveField = (key: string) => {
    const newMappings = { ...mappings };
    delete newMappings[key];
    onChange(newMappings);
  };

  const handleUpdateMapping = (key: string, value: string) => {
    onChange({
      ...mappings,
      [key]: value,
    });
  };

  // Function to determine which field slots are currently in use
  const getUsedFieldSlots = (currentMappings: Record<string, string>): number[] => {
    const slots: number[] = [];
    
    // Extract slot numbers from mapping values that follow the 'field_N' pattern
    Object.values(currentMappings).forEach(value => {
      const match = value.match(/^field_(\d+)$/);
      if (match) {
        slots.push(parseInt(match[1], 10));
      }
    });
    
    return slots;
  };

  return (
    <div className="mt-6">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Field Mapping</CardTitle>
              <CardDescription>
                Configure how fields from Klaviyo map to Kudosity
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardHeader>
        {isExpanded && (
          <CardContent>
            {loadingFields ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                <span className="ml-2 text-sm text-gray-500">Loading available fields...</span>
              </div>
            ) : fieldError ? (
              <div className="rounded bg-red-50 p-4 text-sm text-red-600 mb-4">
                {fieldError}
              </div>
            ) : (
              <div className="space-y-6">
                {/* Field Mappings Table */}
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                      <tr>
                        <th className="px-4 py-3 text-left">Kudosity Field</th>
                        <th className="px-4 py-3 text-left">Klaviyo Field</th>
                        <th className="px-4 py-3 w-16"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {/* Standard Fields */}
                      {standardFields.map((key) => (
                        <tr key={key} className="bg-white">
                          <td className="px-4 py-3 text-sm">
                            <span className="font-medium">{mappings[key] || ''}</span>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {key.replace('_', ' ')}
                          </td>
                          <td className="px-4 py-3"></td>
                        </tr>
                      ))}
                      
                      {/* Custom Fields */}
                      {customFields.map((key) => (
                        <tr key={key} className="bg-white">
                          <td className="px-4 py-3 text-sm">
                            <span className="font-medium">{mappings[key] || ''}</span>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {key}
                          </td>
                          <td className="px-4 py-3">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveField(key)}
                              className="h-8 w-8 p-0"
                            >
                              <Trash2 className="h-4 w-4 text-gray-400 hover:text-red-500" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Add New Custom Field */}
                {usedFieldSlots.length < MAX_FIELD_SLOTS && (
                  <div className="border rounded-lg p-4">
                    <h4 className="text-sm font-medium mb-3">Add Custom Field</h4>
                    <div className="flex space-x-3">
                      <div className="flex-1">
                        <Label htmlFor="new-klaviyo-field" className="text-xs mb-1 block">Klaviyo Field</Label>
                        <Select 
                          value={newFieldKey}
                          onValueChange={(value: string) => {
                            setNewFieldKey(value);
                            // Auto-populate the Kudosity field name based on the selected Klaviyo field
                            if (value && value !== 'custom') {
                              // Create a Kudosity-friendly field name from the Klaviyo field
                              const fieldName = value.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
                              setNewFieldValue(fieldName);
                              
                              // Show a toast confirming the field was selected and auto-mapped
                              toast({
                                title: "Field selected",
                                description: `Klaviyo field "${value}" selected and mapped to "${fieldName}" in Kudosity`,
                              });
                            }
                          }}
                        >
                          <SelectTrigger id="new-klaviyo-field">
                            <SelectValue placeholder="Select Klaviyo field" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableKlaviyoFields
                              .filter((field: string) => !Object.keys(mappings).includes(field))
                              .map((field: string) => (
                                <SelectItem key={field} value={field}>
                                  {field}
                                </SelectItem>
                              ))}
                            <SelectItem value="custom">Add custom field...</SelectItem>
                          </SelectContent>
                        </Select>
                        {newFieldKey === 'custom' && (
                          <Input
                            className="mt-2"
                            value={newFieldKey === 'custom' ? '' : newFieldKey}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => newFieldKey === 'custom' && setNewFieldKey(e.target.value)}
                            placeholder="Custom field name"
                          />
                        )}
                      </div>
                      <div className="flex-1">
                        <Label htmlFor="new-kudosity-field" className="text-xs mb-1 block">Kudosity Field Name</Label>
                        <Input
                          id="new-kudosity-field"
                          value={newFieldValue}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewFieldValue(e.target.value)}
                          placeholder={`field_${getNextAvailableFieldSlot()}`}
                        />
                      </div>
                      <div className="flex items-end">
                        <Button
                          onClick={handleAddField}
                          disabled={!newFieldKey || !newFieldValue || addingField || (newFieldKey === 'custom' && !newFieldKey)}
                          className="mb-[1px]"
                        >
                          {addingField ? (
                            <span className="flex items-center">
                              <div className="h-4 w-4 rounded-full border-2 border-transparent border-t-current animate-spin mr-2" />
                              Adding...
                            </span>
                          ) : (
                            <span className="flex items-center">
                              <Plus className="h-4 w-4 mr-1" />
                              Add Field
                            </span>
                          )}
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      {usedFieldSlots.length < MAX_FIELD_SLOTS ? (
                        <>You can add {MAX_FIELD_SLOTS - usedFieldSlots.length} more custom fields (up to 10 total in Kudosity).</>
                      ) : (
                        <>You have reached the maximum of 10 custom fields allowed in Kudosity.</>
                      )}
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
} 