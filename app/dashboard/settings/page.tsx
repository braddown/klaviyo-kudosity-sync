'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase';

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  
  // Kudosity test states
  const [kudosityTestStatus, setKudosityTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [kudosityTestResult, setKudosityTestResult] = useState<string | null>(null);
  
  // Klaviyo test states
  const [klaviyoTestStatus, setKlaviyoTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [klaviyoTestResult, setKlaviyoTestResult] = useState<string | null>(null);
  
  // Klaviyo direct API test
  const [klaviyoDirectTestStatus, setKlaviyoDirectTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [klaviyoDirectTestResult, setKlaviyoDirectTestResult] = useState<string | null>(null);
  
  // Basic API test state
  const [pingTestStatus, setPingTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [pingTestResult, setPingTestResult] = useState<string | null>(null);
  
  // Form state
  const [kudosityKey, setKudosityKey] = useState('');
  const [kudositySecret, setKudositySecret] = useState('');
  const [klaviyoApiKey, setKlaviyoApiKey] = useState('');

  // Load existing settings
  useEffect(() => {
    async function loadSettings() {
      setLoading(true);
      try {
        const supabase = getSupabaseClient();
        
        // Get the current user
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          // If not logged in, redirect to login
          router.push('/login');
          return;
        }
        
        // Get settings for the current user
        const { data, error } = await supabase
          .from('api_settings')
          .select('*')
          .eq('user_id', session.user.id)
          .single();
        
        if (error && error.code !== 'PGRST116') { // PGRST116 is no rows returned
          throw error;
        }
        
        if (data) {
          // Populate form with existing data
          setKudosityKey(data.kudosity_username || '');
          setKudositySecret(data.kudosity_password || '');
          setKlaviyoApiKey(data.klaviyo_api_key || '');
        }
      } catch (err) {
        console.error('Error loading settings:', err);
        setError('Failed to load settings');
      } finally {
        setLoading(false);
      }
    }
    
    loadSettings();
  }, [router]);

  // Save settings
  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveStatus('saving');
    setError(null);
    
    try {
      const supabase = getSupabaseClient();
      
      // Get the current user
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      
      // Check if the user already has settings
      const { data: existingSettings, error: checkError } = await supabase
        .from('api_settings')
        .select('id')
        .eq('user_id', session.user.id)
        .single();
      
      // If there's an error other than "no rows returned", throw it
      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }
      
      // Prepare settings data
      const settingsData = {
        kudosity_username: kudosityKey,
        kudosity_password: kudositySecret,
        klaviyo_api_key: klaviyoApiKey,
        user_id: session.user.id,
        updated_at: new Date().toISOString()
      };
      
      let result;
      
      if (existingSettings) {
        // Update existing settings
        result = await supabase
          .from('api_settings')
          .update(settingsData)
          .eq('id', existingSettings.id)
          .select();
      } else {
        // Insert new settings
        result = await supabase
          .from('api_settings')
          .insert({
            ...settingsData,
            created_at: new Date().toISOString()
          })
          .select();
      }
      
      if (result.error) {
        throw result.error;
      }
      
      setSaveStatus('success');
      
      // Reset status after a delay
      setTimeout(() => {
        setSaveStatus('idle');
      }, 3000);
      
    } catch (err) {
      console.error('Error saving settings:', err);
      setError('Failed to save settings');
      setSaveStatus('error');
    }
  };

  // Test Kudosity API connection
  const testKudosityConnection = async () => {
    setKudosityTestStatus('testing');
    setKudosityTestResult(null);
    
    try {
      console.log("Testing Kudosity connection...");
      
      // First check if we have a session
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.error("No session found");
        throw new Error("No active session found. Please log in again.");
      }
      
      console.log("Session found, user ID:", session.user.id);
      
      // Try using GET with credentials first
      console.log("Trying GET request with credentials to /api/test-kudosity");
      let response;
      try {
        response = await fetch('/api/test-kudosity', {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        console.log("API response status:", response.status);
      } catch (fetchError: any) {
        console.error("Error during fetch operation:", fetchError);
        throw new Error(`Fetch error: ${fetchError.message}`);
      }
      
      // If unauthorized, try POST as fallback
      if (response.status === 401) {
        console.log("GET request unauthorized, trying POST fallback...");
        
        try {
          // Use POST as fallback, sending credentials in request body
          response = await fetch('/api/test-kudosity', {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              kudosity_username: kudosityKey,
              kudosity_password: kudositySecret
            })
          });
          
          console.log("POST fallback response status:", response.status);
        } catch (postError: any) {
          console.error("Error during POST fallback:", postError);
          throw new Error(`POST fallback error: ${postError.message}`);
        }
      }
      
      let data;
      try {
        data = await response.json();
        console.log("API response data:", data);
      } catch (jsonError: any) {
        console.error("Error parsing JSON response:", jsonError);
        throw new Error(`Failed to parse response: ${jsonError.message}`);
      }
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to test connection');
      }
      
      if (data.success) {
        setKudosityTestStatus('success');
        setKudosityTestResult(data.message + (data.pagination_details ? 
          ` (Total: ${data.pagination_details.total_lists} lists)` : ''));
      } else {
        setKudosityTestStatus('error');
        setKudosityTestResult(data.message);
      }
    } catch (err: any) {
      console.error('Error testing Kudosity connection:', err);
      setKudosityTestStatus('error');
      setKudosityTestResult(err.message || 'Failed to test connection');
    }
  };
  
  // Test Klaviyo API connection
  const testKlaviyoConnection = async () => {
    setKlaviyoTestStatus('testing');
    setKlaviyoTestResult(null);
    
    try {
      console.log("Testing Klaviyo connection...");
      
      // First check if we have a session
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.error("No session found");
        throw new Error("No active session found. Please log in again.");
      }
      
      console.log("Session found, user ID:", session.user.id);
      
      // Try using GET with credentials first
      console.log("Trying GET request with credentials to /api/test-klaviyo");
      let response;
      try {
        response = await fetch('/api/test-klaviyo', {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        console.log("API response status:", response.status);
      } catch (fetchError: any) {
        console.error("Error during fetch operation:", fetchError);
        throw new Error(`Fetch error: ${fetchError.message}`);
      }
      
      // If unauthorized, try POST as fallback
      if (response.status === 401) {
        console.log("GET request unauthorized, trying POST fallback...");
        
        try {
          // Use POST as fallback, sending API key in request body
          response = await fetch('/api/test-klaviyo', {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              klaviyo_api_key: klaviyoApiKey
            })
          });
          
          console.log("POST fallback response status:", response.status);
        } catch (postError: any) {
          console.error("Error during POST fallback:", postError);
          throw new Error(`POST fallback error: ${postError.message}`);
        }
      }
      
      let data;
      try {
        data = await response.json();
        console.log("API response data:", data);
      } catch (jsonError: any) {
        console.error("Error parsing JSON response:", jsonError);
        throw new Error(`Failed to parse response: ${jsonError.message}`);
      }
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to test connection');
      }
      
      if (data.success) {
        setKlaviyoTestStatus('success');
        setKlaviyoTestResult(data.message + (data.pagination_details ? 
          ` (Total segments: ${data.pagination_details.segment_count})` : ''));
      } else {
        setKlaviyoTestStatus('error');
        setKlaviyoTestResult(data.message);
      }
    } catch (err: any) {
      console.error('Error testing Klaviyo connection:', err);
      setKlaviyoTestStatus('error');
      setKlaviyoTestResult(err.message || 'Failed to test connection');
    }
  };

  // Test basic API connection
  const testApiPing = async () => {
    setPingTestStatus('testing');
    setPingTestResult(null);
    
    try {
      console.log("Testing basic API connectivity...");
      
      // Try simple GET request
      let response;
      try {
        response = await fetch('/api/test-ping', {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        console.log("Ping API response status:", response.status);
      } catch (fetchError: any) {
        console.error("Error during ping fetch:", fetchError);
        throw new Error(`Ping fetch error: ${fetchError.message}`);
      }
      
      let data;
      try {
        data = await response.json();
        console.log("Ping API response data:", data);
      } catch (jsonError: any) {
        console.error("Error parsing ping response:", jsonError);
        throw new Error(`Failed to parse ping response: ${jsonError.message}`);
      }
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to ping API');
      }
      
      setPingTestStatus('success');
      setPingTestResult(`API is working: ${data.message}. Time: ${data.time}`);
    } catch (err: any) {
      console.error('Error testing API ping:', err);
      setPingTestStatus('error');
      setPingTestResult(err.message || 'Failed to connect to API');
    }
  };

  // Test Klaviyo API key directly
  const testKlaviyoKeyDirectly = async () => {
    setKlaviyoDirectTestStatus('testing');
    setKlaviyoDirectTestResult(null);
    
    try {
      console.log("Testing Klaviyo API key directly...");
      
      if (!klaviyoApiKey) {
        throw new Error("Please enter a Klaviyo API key first");
      }
      
      const response = await fetch('/api/test-klaviyo-auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          apiKey: klaviyoApiKey
        })
      });
      
      console.log("Direct test response status:", response.status);
      
      const data = await response.json();
      console.log("Direct test response data:", data);
      
      if (response.ok && data.success) {
        setKlaviyoDirectTestStatus('success');
        setKlaviyoDirectTestResult(`API key is valid. Status: ${data.status}`);
      } else {
        setKlaviyoDirectTestStatus('error');
        setKlaviyoDirectTestResult(data.message || 'API key validation failed');
      }
    } catch (err: any) {
      console.error('Error testing Klaviyo API key directly:', err);
      setKlaviyoDirectTestStatus('error');
      setKlaviyoDirectTestResult(err.message || 'Failed to test API key');
    }
  };

  return (
    <div className="container max-w-2xl py-8">
      <h1 className="text-2xl font-bold mb-6">API Settings</h1>
      
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-md p-4 mb-4">
          {error}
        </div>
      )}
      
      {saveStatus === 'success' && (
        <div className="bg-green-50 border border-green-200 text-green-800 rounded-md p-4 mb-4">
          Settings saved successfully
        </div>
      )}
      
      {/* API Test Section */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-lg font-medium mb-4">API Connectivity Test</h2>
        <p className="text-gray-500 text-sm mb-4">
          Test basic API connectivity to diagnose issues.
        </p>
        
        {pingTestResult && (
          <div className={`mt-4 p-3 rounded-md ${
            pingTestStatus === 'success' 
              ? 'bg-green-50 text-green-700 border border-green-200' 
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {pingTestResult}
          </div>
        )}
        
        <div className="mt-4">
          <button
            type="button"
            onClick={testApiPing}
            disabled={pingTestStatus === 'testing'}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50"
          >
            {pingTestStatus === 'testing' ? 'Testing...' : 'Test API Connectivity'}
          </button>
        </div>
      </div>
      
      <form onSubmit={saveSettings} className="space-y-6">
        {/* Kudosity Settings */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium mb-4">Kudosity API Credentials</h2>
          <p className="text-gray-500 text-sm mb-4">
            Enter your Kudosity API credentials to enable integration with the SMS service.
            You can find these in your Kudosity account under Settings &gt; API Settings.
          </p>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                API Key (Username)
              </label>
              <input
                type="text"
                value={kudosityKey}
                onChange={(e) => setKudosityKey(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Enter your Kudosity API Key"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                API Secret (Password)
              </label>
              <input
                type="password"
                value={kudositySecret}
                onChange={(e) => setKudositySecret(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Enter your Kudosity API Secret"
              />
              <p className="mt-1 text-xs text-gray-500">
                Your API Secret is stored securely and never shared.
              </p>
            </div>
          </div>
          
          {/* Test Connection Results */}
          {kudosityTestResult && (
            <div className={`mt-4 p-3 rounded-md ${
              kudosityTestStatus === 'success' 
                ? 'bg-green-50 text-green-700 border border-green-200' 
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {kudosityTestResult}
            </div>
          )}
          
          {/* Action Buttons */}
          <div className="mt-6 flex items-center space-x-4">
            <button
              type="button"
              onClick={testKudosityConnection}
              disabled={kudosityTestStatus === 'testing' || !kudosityKey || !kudositySecret}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50"
            >
              {kudosityTestStatus === 'testing' ? 'Testing...' : 'Test Kudosity Connection'}
            </button>
          </div>
        </div>
        
        {/* Klaviyo Settings */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium mb-4">Klaviyo API Credentials</h2>
          <p className="text-gray-500 text-sm mb-4">
            Enter your Klaviyo API key to enable integration with the email marketing service.
            You can create an API key in your Klaviyo account under Settings &gt; API Keys.
          </p>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Klaviyo API Key (Private API Key)
              </label>
              <input
                type="password"
                value={klaviyoApiKey}
                onChange={(e) => setKlaviyoApiKey(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Enter your Klaviyo Private API Key"
              />
              <p className="mt-1 text-xs text-gray-500">
                You need a Private API Key with read/write permissions.
              </p>
            </div>
          </div>
          
          {/* Test Connection Results */}
          {klaviyoTestResult && (
            <div className={`mt-4 p-3 rounded-md ${
              klaviyoTestStatus === 'success' 
                ? 'bg-green-50 text-green-700 border border-green-200' 
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {klaviyoTestResult}
            </div>
          )}
          
          {/* Direct API Test Results */}
          {klaviyoDirectTestResult && (
            <div className={`mt-4 p-3 rounded-md ${
              klaviyoDirectTestStatus === 'success' 
                ? 'bg-green-50 text-green-700 border border-green-200' 
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              <strong>Direct API Test:</strong> {klaviyoDirectTestResult}
            </div>
          )}
          
          {/* Action Buttons */}
          <div className="mt-6 flex items-center space-x-4">
            <button
              type="button"
              onClick={testKlaviyoConnection}
              disabled={klaviyoTestStatus === 'testing' || !klaviyoApiKey}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50"
            >
              {klaviyoTestStatus === 'testing' ? 'Testing...' : 'Test Klaviyo Connection'}
            </button>
            
            <button
              type="button"
              onClick={testKlaviyoKeyDirectly}
              disabled={klaviyoDirectTestStatus === 'testing' || !klaviyoApiKey}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {klaviyoDirectTestStatus === 'testing' ? 'Testing...' : 'Test API Key Only'}
            </button>
          </div>
        </div>
        
        {/* Save Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saveStatus === 'saving' || loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {saveStatus === 'saving' ? 'Saving...' : 'Save All Settings'}
          </button>
        </div>
      </form>
    </div>
  );
} 