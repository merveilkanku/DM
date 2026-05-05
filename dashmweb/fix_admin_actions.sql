-- SCRIPT DE RÉPARATION POUR ÉVITER LA RÉCURSION INFINIE (Error 42P17)
-- Ce script remplace les politiques qui s'auto-référencent.

-- 1. S'assurer que l'utilisateur est SuperAdmin
UPDATE public.profiles SET role = 'superadmin' WHERE email = 'irmerveilkanku@gmail.com';

-- 2. Supprimer les anciennes politiques problématiques
DROP POLICY IF EXISTS "Superadmins can do everything on profiles" ON public.profiles;
DROP POLICY IF EXISTS "Superadmins can do everything on restaurants" ON public.restaurants;
DROP POLICY IF EXISTS "Superadmins can insert notifications" ON public.notifications;

-- 3. Créer une politique pour 'profiles' qui utilise auth.jwt() au lieu de SELECT sur profiles
-- Cela évite que la politique de 'profiles' appelle une fonction qui fait un SELECT sur 'profiles'
CREATE POLICY "Superadmins can do everything on profiles" ON public.profiles
  FOR ALL USING (
    (auth.jwt() ->> 'email') = 'irmerveilkanku@gmail.com'
  ) WITH CHECK (
    (auth.jwt() ->> 'email') = 'irmerveilkanku@gmail.com'
  );

-- 4. Appliquer la même logique pour les autres tables
CREATE POLICY "Superadmins can do everything on restaurants" ON public.restaurants
  FOR ALL USING (
    (auth.jwt() ->> 'email') = 'irmerveilkanku@gmail.com'
  ) WITH CHECK (
    (auth.jwt() ->> 'email') = 'irmerveilkanku@gmail.com'
  );

CREATE POLICY "Superadmins can do everything on notifications" ON public.notifications
  FOR ALL USING (
    (auth.jwt() ->> 'email') = 'irmerveilkanku@gmail.com'
  ) WITH CHECK (
    (auth.jwt() ->> 'email') = 'irmerveilkanku@gmail.com'
  );

-- 5. Autoriser les utilisateurs normaux à voir leur propre profil (indispensable pour l'app)
DROP POLICY IF EXISTS "Users can see their own profile" ON public.profiles;
CREATE POLICY "Users can see their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- 6. Recharger le schéma
NOTIFY pgrst, 'reload schema';
