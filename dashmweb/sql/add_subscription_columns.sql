-- Ajout des colonnes d'abonnement à la table restaurants
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS subscription_tier text DEFAULT 'free';
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'active';
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS subscription_end_date timestamp with time zone;

-- Index pour accélérer les recherches par statut d'abonnement si besoin
CREATE INDEX IF NOT EXISTS idx_restaurants_subscription_status ON public.restaurants(subscription_status);
