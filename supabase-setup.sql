-- =====================================================================
-- LEARNOTECH SOLUTIONS - SUPABASE DATABASE & STORAGE INITIALIZATION SQL
-- =====================================================================
-- How to run this:
-- 1. Open your Supabase Dashboard: https://supabase.com/dashboard
-- 2. Select your project.
-- 3. In the left navigation, click "SQL Editor".
-- 4. Paste the entire content of this file and click "Run".
-- =====================================================================

-- 1. Create tables
CREATE TABLE IF NOT EXISTS public.adverts (
    id TEXT PRIMARY KEY,
    tag TEXT NOT NULL DEFAULT 'What''s new',
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    image_url TEXT,
    button_label TEXT,
    button_url TEXT,
    published INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.accessories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    image_url TEXT NOT NULL,
    price NUMERIC(10, 2),
    currency TEXT NOT NULL DEFAULT 'USD',
    is_active INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.adverts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accessories ENABLE ROW LEVEL SECURITY;

-- 3. Create Public Read Policies for website visitors
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'adverts' AND policyname = 'Allow public read access for adverts'
    ) THEN
        CREATE POLICY "Allow public read access for adverts"
            ON public.adverts FOR SELECT
            USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'accessories' AND policyname = 'Allow public read access for accessories'
    ) THEN
        CREATE POLICY "Allow public read access for accessories"
            ON public.accessories FOR SELECT
            USING (true);
    END IF;
END $$;

-- 4. Create Full Access Policies for Service Role / Authenticated Backend
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'adverts' AND policyname = 'Allow all actions for service role on adverts'
    ) THEN
        CREATE POLICY "Allow all actions for service role on adverts"
            ON public.adverts FOR ALL
            USING (true)
            WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'accessories' AND policyname = 'Allow all actions for service role on accessories'
    ) THEN
        CREATE POLICY "Allow all actions for service role on accessories"
            ON public.accessories FOR ALL
            USING (true)
            WITH CHECK (true);
    END IF;
END $$;

-- 5. Set up Storage Bucket: learnotech-media
-- Creates public bucket if it does not already exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'learnotech-media',
    'learnotech-media',
    true,
    5242880, -- 5 MB limit
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- Storage Policies for learnotech-media bucket
DO $$
BEGIN
    -- Public Read
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Public Access to learnotech-media'
    ) THEN
        CREATE POLICY "Public Access to learnotech-media"
            ON storage.objects FOR SELECT
            USING (bucket_id = 'learnotech-media');
    END IF;

    -- Upload & Manage Access
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Allow write access to learnotech-media'
    ) THEN
        CREATE POLICY "Allow write access to learnotech-media"
            ON storage.objects FOR ALL
            USING (bucket_id = 'learnotech-media')
            WITH CHECK (bucket_id = 'learnotech-media');
    END IF;
END $$;

-- 6. Indices for fast querying
CREATE INDEX IF NOT EXISTS idx_adverts_published_created ON public.adverts (published DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_accessories_active_sort ON public.accessories (is_active DESC, sort_order ASC, created_at DESC);
