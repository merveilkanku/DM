-- Create automated_campaigns table
create table if not exists public.automated_campaigns (
  id uuid default gen_random_uuid() primary key,
  restaurant_id uuid references public.restaurants(id) on delete cascade not null,
  name text not null,
  trigger_type text not null,
  message_body text not null,
  discount_percentage int default 10,
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create loyalty_points table
create table if not exists public.loyalty_points (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  restaurant_id uuid references public.restaurants(id) on delete cascade not null,
  points int default 0,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, restaurant_id)
);

-- Create loyalty_rewards table
create table if not exists public.loyalty_rewards (
  id uuid default gen_random_uuid() primary key,
  restaurant_id uuid references public.restaurants(id) on delete cascade not null,
  name text not null,
  points_required int not null,
  description text,
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.automated_campaigns enable row level security;
alter table public.loyalty_points enable row level security;
alter table public.loyalty_rewards enable row level security;

-- Policies
create policy "Public Access Campaigns" on public.automated_campaigns for all using (true) with check (true);
create policy "Public Access Loyalty Points" on public.loyalty_points for all using (true) with check (true);
create policy "Public Access Loyalty Rewards" on public.loyalty_rewards for all using (true) with check (true);

-- Add to realtime
alter publication supabase_realtime add table automated_campaigns;
alter publication supabase_realtime add table loyalty_points;
alter publication supabase_realtime add table loyalty_rewards;
