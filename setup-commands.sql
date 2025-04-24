-- SQL commands to set up Supabase storage for Klaviyo-Kudosity Sync
-- 1. Run these in the Supabase SQL Editor
-- 2. Or copy/paste into each section of the Supabase dashboard

-- First, create the storage bucket if it doesn't exist
SELECT storage.create_bucket('temp-csv-storage', 'public');

-- Enable bucket public access
UPDATE storage.buckets SET public = TRUE WHERE name = 'temp-csv-storage';

-- Add RLS policies for the temp-csv-storage bucket:

-- 1. Allow authenticated users to upload files (INSERT)
CREATE POLICY "Allow authenticated uploads"
ON storage.objects
FOR INSERT 
TO authenticated 
USING (bucket_id = 'temp-csv-storage');

-- 2. Allow public to view files (SELECT)
CREATE POLICY "Allow public viewing" 
ON storage.objects 
FOR SELECT 
TO public 
USING (bucket_id = 'temp-csv-storage');

-- 3. Allow service role to manage files (without RLS restrictions)
ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;
ALTER TABLE storage.buckets DISABLE ROW LEVEL SECURITY;

-- 4. Allow bucket owners to update/delete their files
CREATE POLICY "Allow owners to update/delete files"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id = 'temp-csv-storage')
WITH CHECK (auth.uid() = owner);

-- Note: Make sure you have the service role key correctly set in your environment variables:
-- SUPABASE_SERVICE_ROLE_KEY=your-actual-service-role-key


-- IMPORTANT: If you're using the service role in a Next.js app, make sure your .env file has:
-- NEXT_PUBLIC_SUPABASE_URL=your-project-url
-- NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
-- SUPABASE_SERVICE_ROLE_KEY=your-service-role-key (exact key from Supabase dashboard)


-- To test if your service role key is working correctly, run:
-- node test-supabase.js

-- Create import_queue table to track overall import jobs
CREATE TABLE IF NOT EXISTS public.import_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  source_type VARCHAR(20) NOT NULL,
  source_id VARCHAR(100) NOT NULL,
  source_name VARCHAR(255) NOT NULL,
  destination_id VARCHAR(100),
  destination_name VARCHAR(255),
  field_mappings JSONB NOT NULL,
  total_chunks INT NOT NULL DEFAULT 0,
  completed_chunks INT NOT NULL DEFAULT 0,
  failed_chunks INT NOT NULL DEFAULT 0,
  total_profiles INT NOT NULL DEFAULT 0,
  processed_profiles INT NOT NULL DEFAULT 0,
  success_profiles INT NOT NULL DEFAULT 0,
  error_profiles INT NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create import_chunks table to track individual chunks
CREATE TABLE IF NOT EXISTS public.import_chunks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  import_id UUID NOT NULL REFERENCES public.import_queue(id) ON DELETE CASCADE,
  chunk_index INT NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  profiles_count INT NOT NULL DEFAULT 0,
  success_count INT NOT NULL DEFAULT 0,
  error_count INT NOT NULL DEFAULT 0,
  error_message TEXT,
  start_offset INT NOT NULL,
  end_offset INT NOT NULL,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  csv_file_path TEXT,
  kudosity_import_id VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(import_id, chunk_index)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS import_queue_user_id_idx ON public.import_queue(user_id);
CREATE INDEX IF NOT EXISTS import_queue_status_idx ON public.import_queue(status);
CREATE INDEX IF NOT EXISTS import_chunks_import_id_idx ON public.import_chunks(import_id);
CREATE INDEX IF NOT EXISTS import_chunks_status_idx ON public.import_chunks(status);

-- Add RLS policies for the new tables
ALTER TABLE public.import_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_chunks ENABLE ROW LEVEL SECURITY;

-- Policy to allow users to view only their own import jobs
CREATE POLICY import_queue_select_policy ON public.import_queue
  FOR SELECT USING (auth.uid() = user_id);

-- Policy to allow users to insert their own import jobs
CREATE POLICY import_queue_insert_policy ON public.import_queue
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy to allow users to update only their own import jobs
CREATE POLICY import_queue_update_policy ON public.import_queue
  FOR UPDATE USING (auth.uid() = user_id);

-- Policy to allow users to view chunks related to their import jobs
CREATE POLICY import_chunks_select_policy ON public.import_chunks
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.import_queue
    WHERE public.import_queue.id = public.import_chunks.import_id
    AND public.import_queue.user_id = auth.uid()
  ));

-- Policy to allow users to insert chunks related to their import jobs
CREATE POLICY import_chunks_insert_policy ON public.import_chunks
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM public.import_queue
    WHERE public.import_queue.id = public.import_chunks.import_id
    AND public.import_queue.user_id = auth.uid()
  ));

-- Policy to allow users to update chunks related to their import jobs
CREATE POLICY import_chunks_update_policy ON public.import_chunks
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM public.import_queue
    WHERE public.import_queue.id = public.import_chunks.import_id
    AND public.import_queue.user_id = auth.uid()
  ));

-- Create function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

-- Add trigger for import_queue
CREATE TRIGGER update_import_queue_updated_at
BEFORE UPDATE ON public.import_queue
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Add trigger for import_chunks
CREATE TRIGGER update_import_chunks_updated_at
BEFORE UPDATE ON public.import_chunks
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Create stored procedure for incrementing counters
CREATE OR REPLACE FUNCTION increment(inc_row_id UUID, inc_field TEXT, inc_amount INTEGER)
RETURNS VOID AS $$
DECLARE
  table_name TEXT;
  query TEXT;
BEGIN
  -- Determine which table to update based on the ID
  SELECT 
    CASE 
      WHEN EXISTS (SELECT 1 FROM public.import_queue WHERE id = inc_row_id) THEN 'import_queue'
      WHEN EXISTS (SELECT 1 FROM public.import_chunks WHERE id = inc_row_id) THEN 'import_chunks'
      ELSE NULL
    END
  INTO table_name;
  
  -- If table is found, increment the specified field
  IF table_name IS NOT NULL THEN
    query := format('UPDATE public.%I SET %I = COALESCE(%I, 0) + %L WHERE id = %L', 
                    table_name, inc_field, inc_field, inc_amount, inc_row_id);
    EXECUTE query;
  END IF;
END;
$$ LANGUAGE plpgsql;

