-- FIX FOR DELETION POLICIES
-- Execute this in your Supabase SQL Editor

-- 1. Support Tickets
DROP POLICY IF EXISTS "Admins can delete tickets" ON public.support_tickets;
CREATE POLICY "Admins can delete tickets"
  ON public.support_tickets FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'superadmin'
    )
    OR (auth.jwt() ->> 'email' = 'irmerveilkanku@gmail.com')
  );

DROP POLICY IF EXISTS "Users can delete their own tickets" ON public.support_tickets;
CREATE POLICY "Users can delete their own tickets"
  ON public.support_tickets FOR DELETE
  USING (auth.uid() = user_id);

-- 2. Restaurants (Ensure Superadmin can always delete)
DROP POLICY IF EXISTS "Superadmin can delete everything" ON public.restaurants;
CREATE POLICY "Superadmin can delete everything"
  ON public.restaurants FOR DELETE
  USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'superadmin'
    )
    OR (auth.jwt() ->> 'email' = 'irmerveilkanku@gmail.com')
  );

-- 3. Profiles (Explicit Delete Policy for Superadmin)
DROP POLICY IF EXISTS "Superadmin can delete profiles" ON public.profiles;
CREATE POLICY "Superadmin can delete profiles"
  ON public.profiles FOR DELETE
  USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'superadmin'
    )
    OR (auth.jwt() ->> 'email' = 'irmerveilkanku@gmail.com')
  );

-- 4. Messages
DROP POLICY IF EXISTS "Admins can delete messages" ON public.messages;
CREATE POLICY "Admins can delete messages"
  ON public.messages FOR DELETE
  USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'superadmin'
    )
    OR (auth.jwt() ->> 'email' = 'irmerveilkanku@gmail.com')
  );

-- 5. Foreign Key Constraints (Ensure CASCADE)
DO $$
BEGIN
    -- support_tickets -> profiles
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'support_tickets_user_id_fkey') THEN
        ALTER TABLE public.support_tickets DROP CONSTRAINT support_tickets_user_id_fkey;
    END IF;
    ALTER TABLE public.support_tickets ADD CONSTRAINT support_tickets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

    -- restaurants -> auth.users
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'restaurants_owner_id_fkey') THEN
        ALTER TABLE public.restaurants DROP CONSTRAINT restaurants_owner_id_fkey;
    END IF;
    ALTER TABLE public.restaurants ADD CONSTRAINT restaurants_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
END $$;

-- 6. Fix verification_status check and default
ALTER TABLE public.restaurants DROP CONSTRAINT IF EXISTS restaurants_verification_status_check;
ALTER TABLE public.restaurants ADD CONSTRAINT restaurants_verification_status_check 
    CHECK (verification_status IN ('unverified', 'pending', 'verified', 'rejected'));
ALTER TABLE public.restaurants ALTER COLUMN verification_status SET DEFAULT 'unverified';

-- Update existing restaurants that might be 'pending' without reason
UPDATE public.restaurants SET verification_status = 'unverified' 
WHERE verification_status = 'pending' AND (verification_docs IS NULL OR verification_docs::text = '{}');
