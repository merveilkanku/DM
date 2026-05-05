-- REPARATION DEFINITIVE DE LA BASE DE DONNEES
-- Exécutez ce script dans l'éditeur SQL de Supabase pour régler les problèmes d'affichage des noms.

-- 1. Réparation de la table des profils et des permissions
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;

-- 2. S'assurer que tous les utilisateurs ont un profil (SANS DOUBLONS)
INSERT INTO public.profiles (id, email, full_name, role, city)
SELECT 
    id, 
    email, 
    COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', split_part(email, '@', 1)),
    COALESCE(raw_user_meta_data->>'role', 'client'),
    COALESCE(raw_user_meta_data->>'city', 'Kinshasa')
FROM auth.users
ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(profiles.full_name, EXCLUDED.full_name);

-- 3. Correction des clés étrangères pour les jointures fluides
ALTER TABLE IF EXISTS public.reviews DROP CONSTRAINT IF EXISTS reviews_user_id_fkey;
ALTER TABLE IF EXISTS public.reviews ADD CONSTRAINT reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.followers DROP CONSTRAINT IF EXISTS followers_user_id_fkey;
ALTER TABLE IF EXISTS public.followers ADD CONSTRAINT followers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.loyalty_points DROP CONSTRAINT IF EXISTS loyalty_points_user_id_fkey;
ALTER TABLE IF EXISTS public.loyalty_points ADD CONSTRAINT loyalty_points_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 4. Nettoyage des RLS pour garantir l'accès en lecture aux profils
DROP POLICY IF EXISTS "Public Access Profiles" ON public.profiles;
CREATE POLICY "Public Access Profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Public Service Update Profiles" ON public.profiles FOR UPDATE USING (auth.uid() = id OR (auth.jwt() ->> 'email' = 'irmerveilkanku@gmail.com'));

-- 5. Forcer le rechargement du cache Supabase
NOTIFY pgrst, 'reload schema';
