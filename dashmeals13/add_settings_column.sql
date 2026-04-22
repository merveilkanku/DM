-- Ajout de la colonne settings à la table restaurants pour stocker les préférences avancées
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{
  "privacyProfile": "public",
  "privacyStories": "everyone",
  "notifPush": true,
  "notifEmail": true,
  "notifSms": false,
  "twoFactorEnabled": false
}'::jsonb;
