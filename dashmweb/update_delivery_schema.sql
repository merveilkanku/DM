-- Migration for Delivery Person feature
-- 1. Update profiles role check
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('client', 'business', 'delivery', 'superadmin'));

-- 2. Update orders table to include delivery person info and real-time location
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_person_id uuid REFERENCES auth.users(id);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_lat double precision;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_lng double precision;

-- 3. Ensure RLS allows delivery person to update their location on orders they are assigned to
-- (The current policies are "passoire" (ALL USING true), so it should work, but good to keep in mind)
