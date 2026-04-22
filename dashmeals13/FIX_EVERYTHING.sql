-- FINAL DATABASE REPAIR SCRIPT 2026

-- 1. FIX PROFILES TABLE AND POLICIES
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Public Access Profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Service role bypass" ON public.profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.profiles;

-- Create robust policies for profiles
CREATE POLICY "Public Read Profiles" ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Users can insert own profile" ON public.profiles 
FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles 
FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- 2. FIX FOLLOWERS TABLE AND POLICIES
ALTER TABLE IF EXISTS public.followers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Followers access" ON public.followers;
DROP POLICY IF EXISTS "User can follow" ON public.followers;
DROP POLICY IF EXISTS "User can unfollow" ON public.followers;

CREATE POLICY "Anyone can read followers" ON public.followers FOR SELECT USING (true);

CREATE POLICY "Users can follow/unfollow" ON public.followers 
FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 3. FIX MESSAGES TABLE AND POLICIES
-- First, ensure order_id is TEXT to handle different conversation types
ALTER TABLE IF EXISTS public.messages ALTER COLUMN order_id TYPE TEXT;

ALTER TABLE IF EXISTS public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Messages access" ON public.messages;
DROP POLICY IF EXISTS "Recipient can update messages" ON public.messages;

CREATE POLICY "Users can view their conversations" ON public.messages 
FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

CREATE POLICY "Users can send messages" ON public.messages 
FOR INSERT WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Recipient can mark as read" ON public.messages 
FOR UPDATE USING (auth.uid() = recipient_id) WITH CHECK (auth.uid() = recipient_id);

-- 4. FIX REVIEWS TABLE AND POLICIES
ALTER TABLE IF EXISTS public.reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Reviews access" ON public.reviews;

CREATE POLICY "Public Read Reviews" ON public.reviews FOR SELECT USING (true);

CREATE POLICY "Authenticated users can review" ON public.reviews 
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 5. FIX NOTIFICATIONS TABLE AND POLICIES
ALTER TABLE IF EXISTS public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Notifications access" ON public.notifications;
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;

CREATE POLICY "Users can view relevant notifications" ON public.notifications 
FOR SELECT USING (
    auth.uid() = user_id OR 
    (restaurant_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = notifications.restaurant_id AND r.owner_id = auth.uid()))
);

CREATE POLICY "Anyone can insert notifications" ON public.notifications 
FOR INSERT WITH CHECK (true);

-- 6. ENSURE ALL USERS HAVE PROFILES
INSERT INTO public.profiles (id, email, full_name, role, city)
SELECT 
    u.id, 
    u.email, 
    COALESCE(u.raw_user_meta_data->>'full_name', 'Utilisateur'), 
    COALESCE(u.raw_user_meta_data->>'role', 'client'),
    COALESCE(u.raw_user_meta_data->>'city', 'Kinshasa')
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- 7. RESTAURANT SETTINGS AND PASSWORDS
ALTER TABLE IF EXISTS public.restaurants ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;

-- Ensure owner can update their own restaurant settings
DROP POLICY IF EXISTS "Owners can update their restaurant" ON public.restaurants;
CREATE POLICY "Owners can update their restaurant" ON public.restaurants 
FOR UPDATE USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- 8. GRANT PERMISSIONS TO AUTHENTICATED ROLE
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- 9. NOTIFY POSTGREST TO RELOAD SCHEMA
NOTIFY pgrst, 'reload schema';
