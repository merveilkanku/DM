-- Add is_verified column to restaurants
ALTER TABLE public.restaurants 
ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;
