-- ENABLE REALTIME FOR ALL NECESSARY TABLES
-- This ensures that new orders, notifications, and restaurant updates are received instantly.

-- 1. Enable Realtime for 'orders' table
ALTER PUBLICATION supabase_realtime ADD TABLE orders;

-- 2. Enable Realtime for 'notifications' table
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- 3. Enable Realtime for 'restaurants' table
ALTER PUBLICATION supabase_realtime ADD TABLE restaurants;

-- 4. Enable Realtime for 'messages' table (already done but good to ensure)
-- ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- Note: If some tables are already in the publication, the above commands might fail.
-- You can use the following to reset the publication if needed:
-- DROP PUBLICATION IF EXISTS supabase_realtime;
-- CREATE PUBLICATION supabase_realtime FOR TABLE orders, notifications, restaurants, messages, menu_items;

-- 5. Reload PostgREST schema
NOTIFY pgrst, 'reload schema';
