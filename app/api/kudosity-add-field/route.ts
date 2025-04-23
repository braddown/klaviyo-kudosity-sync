import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export async function POST(req: Request) {
  try {
    const { list_id, field_name, field_slot, kudosity_username, kudosity_password } = await req.json();

    if (!list_id) {
      return Response.json({ error: 'Missing required parameter: list_id' }, { status: 400 });
    }

    if (!field_name) {
      return Response.json({ error: 'Missing required parameter: field_name' }, { status: 400 });
    }

    if (!kudosity_username || !kudosity_password) {
      return Response.json({ error: 'Missing required Kudosity credentials' }, { status: 400 });
    }

    // Validate field_slot to be between 1 and 10
    if (field_slot < 1 || field_slot > 10) {
      return Response.json({ 
        error: 'Invalid field_slot value. Must be between 1 and 10',
        details: { provided: field_slot }
      }, { status: 400 });
    }

    console.log(`Adding field to Kudosity list ${list_id}: ${field_name} at position ${field_slot}`);

    // Use the correct API endpoint for Transmit SMS API
    const url = `https://api.transmitsms.com/update-list.json`;
    
    // Format the request body correctly for Transmit SMS API in x-www-form-urlencoded format
    const params = new URLSearchParams();
    params.append('list_id', list_id);
    params.append(`field.${field_slot}`, field_name);
    
    const basicAuth = Buffer.from(`${kudosity_username}:${kudosity_password}`).toString('base64');
    
    console.log(`Making request to Transmit SMS API with params: ${params.toString()}`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${basicAuth}`,
      },
      body: params.toString(),
    });

    console.log('Response status:', response.status, response.statusText);
    
    const responseText = await response.text();
    console.log('Raw response:', responseText.substring(0, 200));
    
    // Check if the response is HTML (potential authentication error or endpoint change)
    if (responseText.trim().startsWith('<')) {
      console.error('Received HTML response instead of JSON:', responseText.substring(0, 200));
      
      // Try to extract a meaningful error message from the HTML
      let errorMessage = 'Received HTML response from API';
      if (responseText.includes('401 Unauthorized') || responseText.includes('Authentication required')) {
        errorMessage = 'Authentication failed. Please check your Kudosity credentials.';
      } else if (responseText.includes('404 Not Found')) {
        errorMessage = 'API endpoint not found. The Kudosity API may have changed.';
      }
      
      return Response.json({
        error: errorMessage,
        details: {
          status: response.status,
          statusText: response.statusText,
          htmlPreview: responseText.substring(0, 200) + '...',
        }
      }, { status: 500 });
    }
    
    // Try to parse the response as JSON
    let responseData;
    try {
      responseData = JSON.parse(responseText);
      console.log('Parsed response data:', responseData);
    } catch (e) {
      return Response.json({
        error: 'Failed to parse API response as JSON',
        details: {
          status: response.status,
          statusText: response.statusText,
          response: responseText.substring(0, 500),
          parseError: e instanceof Error ? e.message : String(e)
        }
      }, { status: 500 });
    }

    // Check for API success (Transmit SMS API returns an error object with code='SUCCESS' for successful calls)
    if (responseData.error && responseData.error.code === 'SUCCESS') {
      return Response.json({
        success: true,
        message: `Field "${field_name}" added successfully to list ${list_id} at position ${field_slot}`,
        data: responseData
      });
    }

    // If we get here, it's an error response
    let errorMessage = `Error from Kudosity API: ${response.status} ${response.statusText}`;
    
    if (responseData && responseData.error) {
      if (typeof responseData.error === 'string') {
        errorMessage = `Kudosity API error: ${responseData.error}`;
      } else if (responseData.error.description) {
        errorMessage = `Kudosity API error: ${responseData.error.description}`;
      } else if (responseData.error.code) {
        errorMessage = `Kudosity API error: ${responseData.error.code}`;
      }
    }
    
    return Response.json({
      error: errorMessage,
      details: {
        status: response.status,
        statusText: response.statusText,
        response: responseData
      }
    }, { status: response.status || 500 });
  } catch (error) {
    console.error('Error adding field to Kudosity list:', error);
    return Response.json({
      error: 'Internal server error',
      details: error instanceof Error ? { message: error.message, stack: error.stack } : String(error)
    }, { status: 500 });
  }
} 