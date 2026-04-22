-- REINITIALISATION COMPLETE DES PERMISSIONS
-- Copiez tout ceci et exécutez-le dans Supabase > SQL Editor

-- 1. Accorder l'usage du schema public
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;

-- 2. Accorder les droits sur toutes les tables existantes
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO postgres, anon, authenticated, service_role;

-- 3. S'assurer que les futures tables auront aussi les droits
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;

-- 4. Création des tables (si elles n'existent pas)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  full_name text,
  email text,
  role text check (role in ('client', 'business', 'delivery', 'superadmin')) not null default 'client',
  city text default 'Kinshasa',
  phone_number text,
  settings jsonb default '{
    "notifPush": true,
    "notifEmail": true,
    "notifSms": false,
    "twoFactorEnabled": false,
    "appLockEnabled": false,
    "appLockPin": null,
    "biometricsEnabled": false
  }'::jsonb,
  delivery_info jsonb default '{
    "vehicleType": "moto",
    "isAvailable": true,
    "bio": "",
    "rating": 5.0,
    "completedOrders": 0
  }'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Policy for superadmin to see all profiles
DROP POLICY IF EXISTS "Superadmin Access Profiles" ON public.profiles;
CREATE POLICY "Superadmin Access Profiles" ON public.profiles FOR ALL USING (
  exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'superadmin'
  )
  OR (auth.jwt() ->> 'email' = 'irmerveilkanku@gmail.com')
);

-- Trigger pour créer un profil automatiquement à l'inscription
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, email, role, city)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', 'Utilisateur'),
    new.email,
    case 
      when new.email = 'irmerveilkanku@gmail.com' then 'superadmin'
      else coalesce(new.raw_user_meta_data->>'role', 'client')
    end,
    coalesce(new.raw_user_meta_data->>'city', 'Kinshasa')
  )
  on conflict (id) do update set 
    email = excluded.email,
    full_name = coalesce(excluded.full_name, profiles.full_name);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create table if not exists public.restaurants (
  id uuid default gen_random_uuid() primary key,
  owner_id uuid references auth.users not null,
  name text not null,
  type text check (type in ('restaurant', 'bar', 'terrasse', 'snack')) not null,
  description text,
  latitude double precision not null,
  longitude double precision not null,
  city text default 'Kinshasa',
  is_open boolean default true,
  is_verified boolean default false,
  verification_status text check (verification_status in ('pending', 'verified', 'rejected')) default 'pending',
  rating double precision default 5.0,
  review_count int default 0,
  preparation_time int default 30,
  estimated_delivery_time int default 20,
  delivery_available boolean default true,
  cover_image text,
  phone_number text,
  currency text default 'USD',
  payment_config jsonb default '{"acceptCash": true, "acceptMobileMoney": false}'::jsonb,
  settings jsonb default '{
    "notifPush": true,
    "notifEmail": true,
    "notifSms": false,
    "twoFactorEnabled": false,
    "appLockEnabled": false,
    "appLockPin": null,
    "biometricsEnabled": false,
    "privacyProfile": "public",
    "privacyStories": "everyone"
  }'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.menu_items (
  id uuid default gen_random_uuid() primary key,
  restaurant_id uuid references public.restaurants on delete cascade not null,
  name text not null,
  description text,
  price double precision not null,
  category text check (category in ('entrée', 'plat', 'boisson', 'dessert')) not null,
  image text,
  is_available boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.orders (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  restaurant_id uuid references public.restaurants(id) on delete cascade not null,
  delivery_person_id uuid references public.profiles(id) on delete set null,
  status text check (status in ('pending', 'preparing', 'ready', 'delivering', 'delivered', 'completed', 'cancelled')) default 'pending',
  total_amount double precision not null,
  items jsonb not null,
  delivery_location jsonb,
  delivery_lat double precision,
  delivery_lng double precision,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Add explicit foreign key name for the join if needed, but standard references usually work.
-- However, PostgREST sometimes needs the hint if there are multiple FKs to the same table.
-- Since user_id and delivery_person_id both point to profiles, we need names.
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_user_id_fkey;
ALTER TABLE public.orders ADD CONSTRAINT orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_restaurant_id_fkey;
ALTER TABLE public.orders ADD CONSTRAINT orders_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_delivery_person_id_fkey;
ALTER TABLE public.orders ADD CONSTRAINT orders_delivery_person_id_fkey FOREIGN KEY (delivery_person_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Migration to ensure cascade deletes on existing tables
DO $$
BEGIN
    -- Update orders table for cascade delete
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'orders_user_id_fkey') THEN
        ALTER TABLE public.orders DROP CONSTRAINT orders_user_id_fkey;
        ALTER TABLE public.orders ADD CONSTRAINT orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'orders_restaurant_id_fkey') THEN
        ALTER TABLE public.orders DROP CONSTRAINT orders_restaurant_id_fkey;
        ALTER TABLE public.orders ADD CONSTRAINT orders_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;
    END IF;
END $$;

create table if not exists public.messages (
  id uuid default gen_random_uuid() primary key,
  order_id uuid references public.orders not null,
  sender_id uuid references auth.users not null,
  content text not null,
  is_read boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.promotions (
  id uuid default gen_random_uuid() primary key,
  restaurant_id uuid references public.restaurants on delete cascade not null,
  media_url text not null,
  media_type text check (media_type in ('image', 'video')) default 'image',
  caption text,
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.cities (
  id uuid default gen_random_uuid() primary key,
  name text not null unique,
  province text,
  latitude double precision,
  longitude double precision,
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. CONFIGURATION STORAGE (Pour les images)
-- Insère un bucket 'images' s'il n'existe pas
insert into storage.buckets (id, name, public) 
values ('images', 'images', true)
on conflict (id) do nothing;

create policy "Public Access Images" on storage.objects for select using ( bucket_id = 'images' );
create policy "Public Upload Images" on storage.objects for insert with check ( bucket_id = 'images' );
create policy "Public Update Images" on storage.objects for update with check ( bucket_id = 'images' );

-- 6. Activation RLS (Row Level Security) - Mode PERMISSIF
alter table public.profiles enable row level security;
alter table public.restaurants enable row level security;
alter table public.menu_items enable row level security;
alter table public.orders enable row level security;
alter table public.messages enable row level security;
alter table public.promotions enable row level security;
alter table public.cities enable row level security;

-- Création de politiques "Passoire"
DROP POLICY IF EXISTS "Public Access Profiles" ON public.profiles;
CREATE POLICY "Public Access Profiles" ON public.profiles FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Access Restaurants" ON public.restaurants;
CREATE POLICY "Public Access Restaurants" ON public.restaurants FOR ALL USING (true) WITH CHECK (true);

-- Explicit policy for superadmin to manage all restaurants if needed, 
-- though the public policy above already allows it (for now).
-- In a real app, we'd restrict the public policy.

DROP POLICY IF EXISTS "Public Access Menu" ON public.menu_items;
CREATE POLICY "Public Access Menu" ON public.menu_items FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Access Orders" ON public.orders;
CREATE POLICY "Public Access Orders" ON public.orders FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Access Messages" ON public.messages;
CREATE POLICY "Public Access Messages" ON public.messages FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Access Promotions" ON public.promotions;
CREATE POLICY "Public Access Promotions" ON public.promotions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Access Cities" ON public.cities;
CREATE POLICY "Public Access Cities" ON public.cities FOR ALL USING (true) WITH CHECK (true);

-- 7. ACTIVATION REALTIME (CRITIQUE POUR LA DEMANDE)
-- Ajout des tables 'messages' et 'orders' à la publication realtime
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table orders;

-- Données initiales
insert into public.cities (name, latitude, longitude) values ('Kinshasa', -4.4419, 15.2663) on conflict (name) do nothing;

-- Support Tickets Table
create table if not exists public.support_tickets (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) not null,
  subject text not null,
  message text not null,
  status text check (status in ('open', 'in_progress', 'resolved')) default 'open',
  admin_notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.support_tickets enable row level security;

-- Policies for support_tickets
create policy "Users can view their own tickets"
  on public.support_tickets for select
  using (auth.uid() = user_id);

create policy "Users can create their own tickets"
  on public.support_tickets for insert
  with check (auth.uid() = user_id);

create policy "Admins can view all tickets"
  on public.support_tickets for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('business', 'superadmin')
    )
    OR (auth.jwt() ->> 'email' = 'irmerveilkanku@gmail.com')
  );

create policy "Admins can update all tickets"
  on public.support_tickets for update
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('business', 'superadmin')
    )
    OR (auth.jwt() ->> 'email' = 'irmerveilkanku@gmail.com')
  );

create table if not exists public.reviews (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  restaurant_id uuid references public.restaurants on delete cascade not null,
  order_id uuid references public.orders(id) on delete cascade,
  rating int check (rating >= 1 and rating <= 5) not null,
  comment text,
  image_url text,
  reply text,
  reply_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Ensure image_url column exists (for existing tables)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reviews' AND column_name='image_url') THEN
        ALTER TABLE public.reviews ADD COLUMN image_url text;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reviews' AND column_name='order_id') THEN
        ALTER TABLE public.reviews ADD COLUMN order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reviews' AND column_name='reply') THEN
        ALTER TABLE public.reviews ADD COLUMN reply text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reviews' AND column_name='reply_at') THEN
        ALTER TABLE public.reviews ADD COLUMN reply_at timestamp with time zone;
    END IF;
END $$;

alter table public.reviews enable row level security;

DROP POLICY IF EXISTS "Public Access Reviews" ON public.reviews;
CREATE POLICY "Public Access Reviews" ON public.reviews FOR ALL USING (true) WITH CHECK (true);

-- Ensure reviews is in the realtime publication
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'reviews'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE reviews;
    END IF;
END $$;

-- RPC to sync users from auth.users to public.profiles
CREATE OR REPLACE FUNCTION public.sync_users_to_profiles()
RETURNS void AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role, city)
  SELECT 
    id, 
    COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', 'Utilisateur'),
    email,
    CASE 
      WHEN email = 'irmerveilkanku@gmail.com' THEN 'superadmin'
      ELSE COALESCE(raw_user_meta_data->>'role', 'client')
    END,
    COALESCE(raw_user_meta_data->>'city', 'Kinshasa')
  FROM auth.users
  ON CONFLICT (id) DO UPDATE SET 
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC to delete a user account (auth and profile)
CREATE OR REPLACE FUNCTION public.delete_user_account(user_id uuid)
RETURNS void AS $$
BEGIN
  DELETE FROM auth.users WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
