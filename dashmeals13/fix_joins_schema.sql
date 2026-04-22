-- FIX FOREIGN KEYS FOR JOINS
-- This script ensures that reviews and loyalty_points correctly reference public.profiles
-- to allow easy joins in Supabase.

-- 1. Fix reviews table
-- Drop existing constraint if it exists
ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_user_id_fkey;

-- Add new constraint referencing public.profiles
ALTER TABLE public.reviews 
ADD CONSTRAINT reviews_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES public.profiles(id) 
ON DELETE CASCADE;

-- 2. Ensure loyalty_points has the correct reference (usually already done but good to be sure)
ALTER TABLE public.loyalty_points DROP CONSTRAINT IF EXISTS loyalty_points_user_id_fkey;
ALTER TABLE public.loyalty_points 
ADD CONSTRAINT loyalty_points_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES public.profiles(id) 
ON DELETE CASCADE;

-- 3. Ensure followers has the correct reference
ALTER TABLE public.followers DROP CONSTRAINT IF EXISTS followers_user_id_fkey;
ALTER TABLE public.followers 
ADD CONSTRAINT followers_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES public.profiles(id) 
ON DELETE CASCADE;

-- 4. Ensure orders has the correct reference
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_user_id_fkey;
ALTER TABLE public.orders 
ADD CONSTRAINT orders_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES public.profiles(id) 
ON DELETE CASCADE;

-- 5. Reload schema
NOTIFY pgrst, 'reload schema';
