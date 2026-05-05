-- Add settings column to restaurants table
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;
