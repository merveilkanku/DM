-- DEFINITIVE FIX FOR MESSAGES TABLE
-- This script fixes the "invalid input syntax for type uuid" error
-- and allows deleting orders without breaking the messages table.

-- 1. Remove the foreign key constraint that forces order_id to be a valid UUID in orders table
-- This is necessary because we use "sub-..." strings for direct chats with subscribers.
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_order_id_fkey;

-- 2. Change the column type to TEXT to support both UUIDs and custom strings
ALTER TABLE public.messages ALTER COLUMN order_id TYPE TEXT USING order_id::text;

-- 3. Add a manual index for performance since we removed the FK
CREATE INDEX IF NOT EXISTS idx_messages_order_id ON public.messages(order_id);

-- 4. Ensure RLS is permissive for the demo
DROP POLICY IF EXISTS "Public Access Messages" ON public.messages;
CREATE POLICY "Public Access Messages" ON public.messages FOR ALL USING (true) WITH CHECK (true);

-- 5. Enable Realtime for the messages table
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
-- Note: If it's already added, this might throw an error, but it's safe to ignore or use:
-- ALTER PUBLICATION supabase_realtime DROP TABLE messages;
-- ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- 6. Reload PostgREST schema
NOTIFY pgrst, 'reload schema';
