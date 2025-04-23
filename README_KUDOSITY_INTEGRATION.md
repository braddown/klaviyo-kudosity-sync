# Kudosity Integration Guide

This document outlines the integration with the Kudosity API (via Transmit SMS) for bulk contact imports from Klaviyo.

## Overview

The integration uses Kudosity's bulk contact import API to efficiently transfer contacts from Klaviyo to Kudosity SMS lists. The process:

1. Fetches contacts from Klaviyo
2. Formats them as a CSV file
3. Uploads the CSV to Supabase Storage (with public access)
4. Sends the CSV URL to Kudosity's bulk import API
5. Monitors the import progress using Kudosity's progress tracking API

## API Endpoints

The integration uses the following Kudosity API endpoints:

- `https://api.transmitsms.com/add-contacts-bulk.json` - For initiating bulk imports
- `https://api.transmitsms.com/add-contacts-bulk-progress.json` - For checking import progress
- `https://api.transmitsms.com/get-lists.json` - For retrieving existing lists

## Implementation Components

### 1. Kudosity API Client (`lib/api/kudosity.ts`)

Contains utility functions for interacting with the Kudosity API:

- `createAndUploadContactsCSV` - Creates a CSV file from contact data and uploads to Supabase Storage
- `uploadContactsToKudosity` - Uploads the CSV to Kudosity via their bulk API
- `checkBulkImportProgress` - Monitors the progress of a bulk import
- `fetchKudosityLists` - Retrieves existing Kudosity lists
- `testKudosityConnection` - Tests API connectivity

### 2. Bulk Import API Route (`app/api/kudosity/bulk-import/route.ts`)

Backend API endpoints for managing imports:

- `POST` - Initiates a bulk import with the provided contacts
- `GET` - Checks progress of an existing import

### 3. Sync Process (`app/api/sync-to-kudosity/route.ts`)

Manages the end-to-end sync process:

1. Fetches contacts from Klaviyo
2. Transforms them according to field mappings
3. Creates and uploads a CSV
4. Initiates the import to Kudosity
5. Monitors import progress
6. Records sync history

### 4. UI Component (`components/sync/BulkImportButton.tsx`)

React component for triggering and monitoring imports from the UI.

## Database Schema

The integration uses a `kudosity_imports` table in Supabase to track imports:

```sql
CREATE TABLE IF NOT EXISTS kudosity_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  import_id TEXT NOT NULL,
  list_id TEXT,
  list_name TEXT,
  contact_count INTEGER NOT NULL,
  processed_count INTEGER,
  error_count INTEGER,
  status TEXT NOT NULL,
  csv_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE
);
```

## Supabase Storage Setup

A public bucket named `Temporary CSV exports for Klaviyo-Kudosity sync` is used to store CSV files for import:

1. Set up a bucket with public read access
2. Configure CORS to allow Kudosity to access the files
3. Set up policies for authenticated users to upload files

## CSV Format

The CSV format follows Kudosity's requirements:

- First column must be `mobile` (required)
- Additional columns for custom fields
- All values properly escaped and quoted

Example:
```
"mobile","firstname","lastname","custom_field_1"
"+61412345678","John","Doe","Value 1"
"+61487654321","Jane","Smith","Value 2"
```

## Usage Example

Using the BulkImportButton component:

```tsx
import BulkImportButton from '@/components/sync/BulkImportButton';

// Example contacts with mobile numbers
const contacts = [
  { mobile: "+61412345678", firstname: "John", lastname: "Doe" },
  { mobile: "+61487654321", firstname: "Jane", lastname: "Smith" }
];

// For a new list
<BulkImportButton
  contacts={contacts}
  listName="My New List"
  onComplete={(result) => console.log('Import completed:', result)}
/>

// For an existing list
<BulkImportButton
  contacts={contacts}
  listId="123456"
  buttonText="Update Existing List"
  variant="secondary"
/>
```

## Error Handling

The implementation includes detailed error handling:

- Validation of contact data (requiring mobile numbers)
- Network error handling and retries
- Progress monitoring timeouts
- User-friendly error messages
- Detailed logging

## Performance Considerations

For large imports:

- Imports are processed asynchronously
- Progress is monitored with a timeout to prevent blocking
- The Kudosity API handles large volumes efficiently
- CSV creation is optimized for memory usage

## Security Considerations

- API credentials are stored securely in Supabase
- Row-level security policies restrict access to user data
- CSV files are publicly accessible but have no sensitive data
- Auth checks protect all API endpoints

## Troubleshooting

Common issues:

1. **"List not found"** - Check if the list ID is correct and still exists in Kudosity
2. **Import errors** - Verify contact data format, especially mobile numbers
3. **CSV upload issues** - Check Supabase storage bucket permissions
4. **API authentication failures** - Verify credentials in settings

## Resources

- [Kudosity API Documentation](https://developers.kudosity.com/reference/post_add-contacts-bulk-json)
- [Transmit SMS Bulk Import Docs](https://developers.kudosity.com/reference/post_add-contacts-bulk-progress-json) 