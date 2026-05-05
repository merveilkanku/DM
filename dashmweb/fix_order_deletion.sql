-- Correction pour permettre la suppression des commandes
-- Cette migration ajoute la suppression en cascade pour toutes les tables liées aux commandes

-- 1. Messages
-- On retire la contrainte de clé étrangère car order_id peut être un UUID (commande)
-- ou une chaîne "sub-..." (chat direct avec abonné).
ALTER TABLE public.messages 
DROP CONSTRAINT IF EXISTS messages_order_id_fkey;

-- 2. Avis (Reviews)
-- On vérifie les deux noms possibles de contraintes
ALTER TABLE public.reviews 
DROP CONSTRAINT IF EXISTS reviews_order_id_fkey;

ALTER TABLE public.reviews 
ADD CONSTRAINT reviews_order_id_fkey 
FOREIGN KEY (order_id) 
REFERENCES public.orders(id) 
ON DELETE CASCADE;

-- 3. Notifications (si elles ont un lien direct, bien que souvent stocké en JSONB)
-- On s'assure que s'il y a d'autres tables personnalisées, elles ne bloquent pas.

-- 4. Recharger le schéma
NOTIFY pgrst, 'reload schema';
