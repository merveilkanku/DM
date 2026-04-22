-- Fix reviews table and add order_id and reply columns
DO $$ 
BEGIN 
    -- Add order_id if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reviews' AND column_name='order_id') THEN
        ALTER TABLE public.reviews ADD COLUMN order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE;
    END IF;

    -- Add reply if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reviews' AND column_name='reply') THEN
        ALTER TABLE public.reviews ADD COLUMN reply text;
    END IF;

    -- Add reply_at if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reviews' AND column_name='reply_at') THEN
        ALTER TABLE public.reviews ADD COLUMN reply_at timestamp with time zone;
    END IF;
END $$;

-- Update RLS policies for reviews
DROP POLICY IF EXISTS "Public Access Reviews" ON public.reviews;
CREATE POLICY "Public Access Reviews" ON public.reviews FOR ALL USING (true);

-- Ensure reviews is in the realtime publication
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'reviews'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE reviews;
    END IF;
END $$;
