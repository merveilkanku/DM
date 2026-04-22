-- ADD CURRENCY COLUMN TO RESTAURANTS
-- Exécutez ce script dans Supabase > SQL Editor

-- 1. Add column with default value 'USD'
ALTER TABLE public.restaurants 
ADD COLUMN IF NOT EXISTS currency text DEFAULT 'USD';

-- 2. Add check constraint to ensure valid values
ALTER TABLE public.restaurants 
ADD CONSTRAINT check_currency CHECK (currency IN ('USD', 'CDF'));

-- 3. Update existing rows (optional, handled by default)
UPDATE public.restaurants SET currency = 'USD' WHERE currency IS NULL;
