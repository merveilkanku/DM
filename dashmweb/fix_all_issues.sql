-- 1. Mise à jour de la table profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_number text;

-- 2. Mise à jour de la table restaurants
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- 3. Mise à jour de la table notifications
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE;

-- 4. Politiques de sécurité pour les restaurants (Super Admin)
DROP POLICY IF EXISTS "Superadmins can update any restaurant" ON public.restaurants;
CREATE POLICY "Superadmins can update any restaurant"
    ON public.restaurants FOR UPDATE
    USING (EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'superadmin'
    ));

-- 5. Politiques de sécurité pour les notifications (Restaurant Staff/Owner)
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

DROP POLICY IF EXISTS "Anyone can insert notifications" ON public.notifications;
CREATE POLICY "Anyone can insert notifications"
    ON public.notifications FOR INSERT
    WITH CHECK (true);

-- 6. Activer le Realtime pour les nouvelles colonnes
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
-- Note: Si déjà présent, cela peut échouer, mais c'est pour être sûr.

-- 7. Recharger le schéma
NOTIFY pgrst, 'reload schema';
