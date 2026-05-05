-- Create table for global application settings
CREATE TABLE IF NOT EXISTS public.app_settings (
    id text PRIMARY KEY,
    value jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Initialize default settings
INSERT INTO public.app_settings (id, value)
VALUES ('global', '{
    "support_email": "support@dashmeals.cd",
    "support_phone": "+243 81 000 0000",
    "support_whatsapp": "+243 81 000 0001",
    "office_address": "Boulevard du 30 Juin, Gombe, Kinshasa, RDC"
}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Allow public read access to global settings
DROP POLICY IF EXISTS "Public can read app settings" ON public.app_settings;
CREATE POLICY "Public can read app settings" ON public.app_settings FOR SELECT USING (true);

-- Allow only superadmins to modify settings
DROP POLICY IF EXISTS "SuperAdmins can modify app settings" ON public.app_settings;
CREATE POLICY "SuperAdmins can modify app settings" ON public.app_settings FOR ALL USING (
  exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'superadmin'
  )
  OR (auth.jwt() ->> 'email' = 'irmerveilkanku@gmail.com')
);
