-- Create a table to track Kudosity bulk imports
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
  completed_at TIMESTAMP WITH TIME ZONE,
  
  -- Add indexes for faster lookups
  CONSTRAINT unique_import_per_user UNIQUE (user_id, import_id)
);

-- Add RLS (Row Level Security) policies
ALTER TABLE kudosity_imports ENABLE ROW LEVEL SECURITY;

-- Users can only see their own imports
CREATE POLICY kudosity_imports_select_policy ON kudosity_imports 
  FOR SELECT USING (auth.uid() = user_id);

-- Users can only insert their own imports
CREATE POLICY kudosity_imports_insert_policy ON kudosity_imports 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can only update their own imports
CREATE POLICY kudosity_imports_update_policy ON kudosity_imports 
  FOR UPDATE USING (auth.uid() = user_id);

-- Add comments for documentation
COMMENT ON TABLE kudosity_imports IS 'Tracks bulk imports of contacts to Kudosity for each user';
COMMENT ON COLUMN kudosity_imports.import_id IS 'Import ID returned by Kudosity API for tracking progress';
COMMENT ON COLUMN kudosity_imports.list_id IS 'Optional Kudosity list ID for imports to existing lists';
COMMENT ON COLUMN kudosity_imports.list_name IS 'Optional name for newly created lists';
COMMENT ON COLUMN kudosity_imports.status IS 'Current status of the import (pending, processing, complete, error)';
COMMENT ON COLUMN kudosity_imports.csv_url IS 'URL to the CSV file in Supabase storage';

-- Create an index on import_id for faster lookups
CREATE INDEX IF NOT EXISTS kudosity_imports_import_id_idx ON kudosity_imports (import_id);

-- Instructions for storage setup (to be executed in Supabase dashboard or with supabase-js):
/*
1. Create a new storage bucket named 'Temporary CSV exports for Klaviyo-Kudosity sync'
2. Make the bucket public (to allow Kudosity API to access the CSV files)
3. Add the following CORS configuration to the bucket:
   {
     "allowed_origins": ["*"],
     "allowed_methods": ["GET"],
     "allowed_headers": ["*"],
     "exposed_headers": ["Content-Length", "Content-Type"],
     "max_age_seconds": 3600
   }
4. Set up policies to allow authenticated users to upload files:
   - CREATE POLICY "Allow authenticated users to upload" 
     ON storage.objects FOR INSERT 
     TO authenticated 
     WITH CHECK (bucket_id = 'Temporary CSV exports for Klaviyo-Kudosity sync');
   
   - CREATE POLICY "Allow public access to files" 
     ON storage.objects FOR SELECT 
     TO public 
     USING (bucket_id = 'Temporary CSV exports for Klaviyo-Kudosity sync');
*/ 