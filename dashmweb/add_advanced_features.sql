-- Table pour la gestion de l'équipe (Staff)
create table if not exists public.staff_members (
  id uuid default gen_random_uuid() primary key,
  restaurant_id uuid references public.restaurants on delete cascade not null,
  user_id uuid references auth.users on delete cascade,
  name text not null,
  role text check (role in ('admin', 'manager', 'cook', 'delivery')) not null,
  pin_code text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Table pour le marketing automatisé
create table if not exists public.automated_campaigns (
  id uuid default gen_random_uuid() primary key,
  restaurant_id uuid references public.restaurants on delete cascade not null,
  trigger_type text check (trigger_type in ('abandoned_cart', 'dormant_30_days', 'birthday')) not null,
  discount_percentage int not null default 10,
  is_active boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(restaurant_id, trigger_type)
);

-- Ajout du seuil d'alerte de stock aux articles du menu
alter table public.menu_items add column if not exists low_stock_threshold int default 5;

-- Activation de la sécurité RLS
alter table public.staff_members enable row level security;
alter table public.automated_campaigns enable row level security;

-- Politiques d'accès (permissives pour le développement)
DROP POLICY IF EXISTS "Public Access Staff" ON public.staff_members;
CREATE POLICY "Public Access Staff" ON public.staff_members FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Access Campaigns" ON public.automated_campaigns;
CREATE POLICY "Public Access Campaigns" ON public.automated_campaigns FOR ALL USING (true) WITH CHECK (true);
