-- FIX PROFILES RLS
-- Allow all authenticated users to read profiles (needed for displaying names in reviews, loyalty points, etc.)
DROP POLICY IF EXISTS "Authenticated Read Profiles" ON public.profiles;
CREATE POLICY "Authenticated Read Profiles" ON public.profiles FOR SELECT TO authenticated USING (true);

-- Ensure profiles has a policy for users to update their own profile
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
