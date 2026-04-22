-- Création des tables pour les abonnés et les avis
create table if not exists public.followers (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  restaurant_id uuid references public.restaurants on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, restaurant_id)
);

create table if not exists public.reviews (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  restaurant_id uuid references public.restaurants on delete cascade not null,
  rating int check (rating >= 1 and rating <= 5) not null,
  comment text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Activation RLS
alter table public.followers enable row level security;
alter table public.reviews enable row level security;

-- Politiques permissives pour le prototype
DROP POLICY IF EXISTS "Public Access Followers" ON public.followers;
CREATE POLICY "Public Access Followers" ON public.followers FOR ALL USING (true);

DROP POLICY IF EXISTS "Public Access Reviews" ON public.reviews;
CREATE POLICY "Public Access Reviews" ON public.reviews FOR ALL USING (true);

-- Ajout à la publication realtime
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'followers'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE followers;
    END IF;
END $$;
