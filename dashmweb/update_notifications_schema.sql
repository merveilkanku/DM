-- 1. Ajouter la colonne restaurant_id à la table notifications
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE;

-- 2. Mettre à jour les politiques de sécurité pour les notifications
-- Permettre aux propriétaires et au staff de voir les notifications de leur restaurant
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications"
    ON public.notifications FOR SELECT
    USING (
        auth.uid() = user_id 
        OR 
        (restaurant_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.restaurants r
            WHERE r.id = notifications.restaurant_id AND (r.owner_id = auth.uid())
        ))
        OR
        (restaurant_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.staff_members s
            WHERE s.restaurant_id = notifications.restaurant_id AND s.user_id = auth.uid()
        ))
    );

-- 3. S'assurer que le Realtime est bien activé
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'notifications'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
    END IF;
END $$;

-- 4. Recharger le schéma
NOTIFY pgrst, 'reload schema';
