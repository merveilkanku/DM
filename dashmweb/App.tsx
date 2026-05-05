import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './lib/supabase';
import { MOCK_RESTAURANTS, KINSHASA_CENTER_LAT, KINSHASA_CENTER_LNG } from './constants';
import { Restaurant, User, UserRole, MenuItem, BusinessType, Theme, Language, AppFont } from './types';
import { AuthScreen } from './components/AuthScreen';
import { CustomerView } from './components/CustomerView';
import { BusinessDashboard } from './BusinessDashboard';
import { SuperAdminDashboard } from './components/SuperAdminDashboard';
import { DeliveryView } from './components/DeliveryView';
import { SplashScreen } from './components/SplashScreen';
import { SecurityLock } from './components/SecurityLock';
import { ResetPasswordPage } from './components/ResetPasswordPage';
import { PaymentResult } from './components/PaymentResult';
import { AlertTriangle, Store, ArrowRight, Zap } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';

const OfflineBanner = ({ isSupabaseReachable }: { isSupabaseReachable: boolean }) => (!isSupabaseReachable) ? (
  <div className="bg-red-600 text-white text-[10px] sm:text-xs font-bold px-4 py-2 text-center flex justify-center items-center sticky top-0 z-[100] shadow-lg animate-in slide-in-from-top duration-300">
      <AlertTriangle size={14} className="mr-2 shrink-0" />
      <span className="mr-3">Erreur de connexion Supabase (Serveur injoignable)</span>
      <button 
        onClick={() => window.location.reload()}
        className="bg-white text-red-600 px-2 py-0.5 rounded-md hover:bg-red-50 transition-colors uppercase text-[9px]"
      >
        Réessayer
      </button>
  </div>
) : null;

function App() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'reset'>('login');
  
  // Détection initiale
  const isRecoveryUrl = window.location.pathname === '/reset-password' ||
                        window.location.hash.includes('type=recovery') || 
                        window.location.href.includes('type=recovery') ||
                        window.location.hash.includes('access_token');

  const [isRecoveryMode, setIsRecoveryMode] = useState(isRecoveryUrl);
  const [loading, setLoading] = useState(!isRecoveryUrl);
  const [showSplash, setShowSplash] = useState(!isRecoveryUrl);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [isSupabaseReachable, setIsSupabaseReachable] = useState(true);
  const [isAppLocked, setIsAppLocked] = useState(false);
  const [isAppInitializing, setIsAppInitializing] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  // Money Fusion Payment Detection
  const queryParams = new URLSearchParams(window.location.search);
  const paymentStatus = queryParams.get('payment_status') as 'success' | 'cancel' | 'failed' | null;

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success("Connexion internet rétablie", { icon: '🌐' });
      // Retry charging data when back online
      fetchRestaurants();
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast.error("Vous êtes hors ligne. Certaines fonctionnalités peuvent être limitées.", { icon: '📡' });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  // Settings States
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('dashmeals_theme') as Theme) || 'light');
  const [language, setLanguage] = useState<Language>(() => (localStorage.getItem('dashmeals_language') as Language) || 'fr');
  const [font, setFont] = useState<AppFont>(() => (localStorage.getItem('dashmeals_font') as AppFont) || 'facebook');

  // États pour la création manuelle de restaurant (Fallback)
  const [newRestoName, setNewRestoName] = useState('');
  const [newRestoType, setNewRestoType] = useState<BusinessType>('restaurant');
  const [creationLoading, setCreationLoading] = useState(false);
  const isFetchingProfile = useRef(false);
  const lastFetchedUserId = useRef<string | null>(null);

  // Apply & Persist Theme
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('dashmeals_theme', theme);
  }, [theme]);

  // Persist Language
  useEffect(() => {
    localStorage.setItem('dashmeals_language', language);
  }, [language]);

  // Apply & Persist Font
  useEffect(() => {
    if (currentUser?.settings?.appLockEnabled) {
      setIsAppLocked(true);
    } else {
      setIsAppLocked(false);
    }
  }, [currentUser?.id, currentUser?.settings?.appLockEnabled]);

  useEffect(() => {
    // Update the global sans font variable to match the selected font
    const fontValue = `var(--font-${font})`;
    document.documentElement.style.setProperty('--font-sans', fontValue);
    // Also force it on body to ensure it overrides any Tailwind defaults
    document.body.style.fontFamily = fontValue;
    localStorage.setItem('dashmeals_font', font);
  }, [font]);

  // Refs to avoid stale closures in timeouts
  const loadingRef = useRef(loading);
  const initializingRef = useRef(isAppInitializing);
  const currentUserRef = useRef(currentUser);

  useEffect(() => { loadingRef.current = loading; }, [loading]);
  useEffect(() => { initializingRef.current = isAppInitializing; }, [isAppInitializing]);
  useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);

  // Initialisation et écoute de la session
  useEffect(() => {
    const initSession = async () => {
      console.log("🚀 [Auth] Début initSession");
      setIsAppInitializing(true);

      // Force le stop du loading après 4s quoi qu'il arrive (Fail-safe ultra rapide)
      const safetyTimer = setTimeout(() => {
        if (initializingRef.current || loadingRef.current) {
          console.warn("⚠️ [Auth] Safety timeout. Forcing UI display.");
          setIsAppInitializing(false);
          setLoading(false);
          setShowSplash(false);
        }
      }, 4000);

      try {
        if (isRecoveryMode) {
          setAuthMode('reset');
          setShowAuth(true);
          clearTimeout(safetyTimer);
          setLoading(false);
          setIsAppInitializing(false);
          return;
        }

        // Récupération PARALLÈLE pour une vitesse maximale
        const [sessionRes, restaurantsRes] = await Promise.allSettled([
            supabase.auth.getSession(),
            fetchRestaurants()
        ]);
        
        if (sessionRes.status === 'fulfilled' && sessionRes.value.data.session) {
          const session = sessionRes.value.data.session;
          console.log("✅ [Auth] Session active trouvée:", session.user.email);
          setShowAuth(false);
          fetchUserProfile(session.user.id, session.user.email!, session.user.user_metadata);
        } else {
          // Fallback local instantané
          const staffSession = localStorage.getItem('dashmeals_staff_session');
          if (staffSession) {
            const user = JSON.parse(staffSession);
            setCurrentUser(user);
            lastFetchedUserId.current = user.id;
            setShowAuth(false);
          }
        }
      } catch (err) {
        console.error("❌ [Auth] Erreur critique initSession:", err);
      } finally {
        clearTimeout(safetyTimer);
        setIsAppInitializing(false);
        setLoading(false);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`🔔 [Auth] Event: ${event}`);
      
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session?.user) {
          console.log(`📡 [Auth] ${event} pour ${session.user.email}`);
          // Close auth screen immediately to show "authenticating" state in main app if needed
          // or at least give visual feedback
          setShowAuth(false);
          fetchUserProfile(session.user.id, session.user.email!, session.user.user_metadata);
        }
      }
      
      if (event === 'SIGNED_OUT') {
        console.log("👋 [Auth] Déconnexion détectée");
        setCurrentUser(null);
        lastFetchedUserId.current = null;
        localStorage.removeItem('dashmeals_staff_session');
        setShowAuth(true);
      }

      if (event === 'PASSWORD_RECOVERY') {
        setAuthMode('reset');
        setShowAuth(true);
      }
    });

    initSession();
    return () => subscription.unsubscribe();
  }, []);

    const fetchUserProfile = async (userId: string, email: string, metadata: any = {}, retryCount = 0): Promise<void> => {
    if (isFetchingProfile.current && retryCount === 0) {
        console.log("⏳ [Auth] fetchUserProfile déjà en cours, on ignore l'appel doublon");
        return;
    }
    
    isFetchingProfile.current = true;
    lastFetchedUserId.current = userId; 
    
    // On ne montre le loader principal QUE si on n'a pas encore d'utilisateur
    if (!currentUserRef.current) {
        setLoading(true);
    }
    
    try {
      console.log(`📡 [Auth] fetchUserProfile pour: ${email} (Tentative ${retryCount + 1})`);
      setIsSupabaseReachable(true); 
      
      // 👑 FORCE SUPERADMIN FOR SPECIFIC EMAIL
      if (email && email.toLowerCase().trim() === 'irmerveilkanku@gmail.com') {
          console.log("👑 [Auth] IDENTIFIÉ COMME SUPER ADMIN");
          const superAdmin: User = {
              id: userId,
              email: email,
              name: metadata?.full_name || 'Super Admin',
              role: 'superadmin',
              city: 'Kinshasa',
              phoneNumber: metadata?.phone_number
          };
          setCurrentUser(superAdmin);
          setLoading(false);
          setIsAppInitializing(false);
          setShowAuth(false);
          isFetchingProfile.current = false;
          return;
      }

      let { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error && (error.code === '42703' || error.message?.includes('column'))) {
        console.warn("⚠️ [Auth] Colonnes profiles manquantes, tentative avec sélection minimale...");
        const fallback = await supabase
          .from('profiles')
          .select('id, email, full_name, role, city, phone_number, settings, delivery_info')
          .eq('id', userId)
          .maybeSingle();
        profile = fallback.data;
        error = fallback.error;
      }

      if (error) {
          console.warn(`Erreur lecture profil (Tentative ${retryCount + 1}):`, error.message);
          const isNetworkError = error.message?.includes('Failed to fetch') || error.message?.includes('network');
          
          if (isNetworkError && retryCount < 3) {
              const delay = Math.pow(2, retryCount) * 1000;
              console.log(`📡 [Auth] Problème réseau. Nouvelle tentative (${retryCount + 1}/3) dans ${delay/1000}s...`);
              await new Promise(resolve => setTimeout(resolve, delay));
              return fetchUserProfile(userId, email, metadata, retryCount + 1);
          }
          throw error;
      }

      // Si pas de profil ou erreur, création profil par défaut
      if (!profile) {
        console.log("🆕 [Auth] Profil introuvable, création du profil par défaut...");
        
        const pendingAuthDataStr = localStorage.getItem('dashmeals_pending_auth');
        const pendingAuthData = pendingAuthDataStr ? JSON.parse(pendingAuthDataStr) : null;
        if (pendingAuthData) localStorage.removeItem('dashmeals_pending_auth');

        const defaultProfile = {
            id: userId,
            full_name: metadata?.full_name || metadata?.name || email.split('@')[0],
            email: email,
            role: pendingAuthData?.role || metadata?.role || 'client', 
            city: pendingAuthData?.city || metadata?.city || 'Kinshasa',
            phone_number: metadata?.phone_number || '',
            created_at: new Date().toISOString()
        };

        const { data: created, error: insertError } = await supabase
            .from('profiles')
            .upsert(defaultProfile)
            .select()
            .single();
        
        if (insertError) {
            console.warn("⚠️ Erreur création profil DB:", insertError.message);
            profile = defaultProfile; // Fallback mémoire
        } else {
            profile = created;
        }
      }

        if (profile) {
          let businessId = profile.business_id; // Try to get businessId from profile first
          
          if (!businessId && profile.role === 'business') {
              console.log("🔍 [Auth] Rôle business détecté, recherche du restaurant appartenant à:", userId);
              
              // First check local state if already populated
              const userRestaurant = restaurants.find(r => r.ownerId === userId);
              if (userRestaurant) {
                  businessId = userRestaurant.id;
              } else {
                  // If not in state, fetch directly from DB to be sure
                  const { data: restoData, error: restoError } = await supabase
                    .from('restaurants')
                    .select('id')
                    .eq('owner_id', userId)
                    .maybeSingle();
                  
                  if (!restoError && restoData) {
                    businessId = restoData.id;
                    console.log("✅ [Auth] Restaurant trouvé via DB:", businessId);
                  } else if (restoError) {
                    console.warn("⚠️ [Auth] Erreur recherche restaurant:", restoError.message);
                  }
              }
          }

          setCurrentUser({
          id: userId,
          email: email,
          name: profile.full_name || 'Utilisateur',
          role: profile.role as UserRole,
          city: profile.city || 'Kinshasa',
          phoneNumber: profile.phone_number,
          businessId,
          deliveryInfo: profile.delivery_info,
          settings: profile.settings || {
            notifPush: true,
            notifEmail: true,
            notifSms: false,
            twoFactorEnabled: false,
            appLockEnabled: false,
            appLockPin: null,
            biometricsEnabled: false
          }
        });
        setIsAppInitializing(false);
        setShowAuth(false);
      }
    } catch (error) {
      console.error("❌ [Auth] Erreur fetchUserProfile:", error);
      setIsOfflineMode(true);
      toast.error("Impossible de synchroniser votre compte. Utilisation du mode restreint.");
    } finally {
      setLoading(false);
      setIsAppInitializing(false);
      isFetchingProfile.current = false;
    }
  };

  const fetchRestaurants = async (retryCount = 0) => {
    try {
      console.log(`📡 [Restaurants] Début chargement... (Tentative ${retryCount + 1})`);
      let data: any[] | null = null;
      let error: any = null;

      const fullResult = await supabase
        .from('restaurants')
        .select(`
          *,
          menu_items (id, name, description, price, image, category, is_available)
        `);

      data = fullResult.data;
      error = fullResult.error;

      // Fallback if columns are missing (Error 42703 or 400 with specific message)
      if (error && (error.code === '42703' || error.message?.includes('column'))) {
        console.warn("⚠️ [Restaurants] Colonnes manquantes détectées, tentative avec sélection minimale...");
        const fallback = await supabase
          .from('restaurants')
          .select(`
            id, owner_id, type, name, description, latitude, longitude, 
            city, is_open, is_active, rating, review_count, 
            preparation_time, estimated_delivery_time, delivery_available, 
            cover_image, created_at,
            subscription_tier, subscription_status, subscription_end_date,
            menu_items (id, name, description, price, image, category, is_available)
          `);
        data = fallback.data;
        error = fallback.error;
      }

      if (error) throw error;

      if (data && data.length > 0) {
        const mappedRestaurants: Restaurant[] = data.map((r: any) => ({
          id: r.id,
          ownerId: r.owner_id,
          type: r.type,
          name: r.name,
          description: r.description,
          latitude: Number(r.latitude) || KINSHASA_CENTER_LAT,
          longitude: Number(r.longitude) || KINSHASA_CENTER_LNG,
          city: r.city || 'Kinshasa',
          isOpen: r.is_open === true,
          isActive: r.is_active !== false,
          rating: r.rating,
          reviewCount: r.review_count,
          preparationTime: r.preparation_time,
          estimatedDeliveryTime: r.estimated_delivery_time || 20,
          deliveryAvailable: r.delivery_available,
          coverImage: r.cover_image || 'https://picsum.photos/800/600?grayscale',
          currency: r.currency || 'USD',
          exchangeRate: r.exchange_rate,
          displayCurrencyMode: r.display_currency_mode || 'dual',
          isVerified: r.is_verified || false,
          verificationRequested: r.verification_requested || false,
          verificationStatus: r.verification_status || 'unverified',
          verificationDocs: r.verification_docs,
          verificationPaymentStatus: r.verification_payment_status,
          subscriptionTier: r.subscription_tier,
          subscriptionStatus: r.subscription_status,
          subscriptionEndDate: r.subscription_end_date,
          createdAt: r.created_at,
          paymentConfig: r.payment_config || {
            acceptCash: true,
            acceptMobileMoney: false
          },
          settings: r.settings || {},
          menu: (r.menu_items || []).map((m: any) => ({
            id: m.id,
            name: m.name,
            description: m.description,
            price: Number(m.price) || 0,
            image: m.image,
            category: m.category,
            isAvailable: m.is_available
          }))
        }));
        setRestaurants(mappedRestaurants);
        setIsOfflineMode(false);
      } else {
        console.log("ℹ️ Aucun restaurant trouvé en base.");
        // Si on n'a pas encore fini l'init ou si on est un vrai utilisateur, on ne montre pas de mocks
        if (isAppInitializing || (currentUser && currentUser.role !== 'guest')) {
            setRestaurants([]); 
        } else {
            setRestaurants(MOCK_RESTAURANTS);
        }
      }
    } catch (err: any) {
      const isNetworkError = err.message?.includes('Failed to fetch') || err.message?.includes('network');
      
      const maxRetries = 5;
      if (isNetworkError && retryCount < maxRetries) {
        const delay = Math.pow(2, retryCount) * 1000;
        console.warn(`⚠️ [Restaurants] Problème réseau. Nouvelle tentative (${retryCount + 1}/${maxRetries}) dans ${delay/1000}s...`);
        
        if (retryCount === 1) {
          toast.error("Connexion instable. Tentative de reconnexion automatique...", { 
            id: 'network-retry',
            duration: 3000 
          });
        }
        
        setTimeout(() => fetchRestaurants(retryCount + 1), delay);
        return;
      }

      console.warn("Erreur chargement restaurants (403 probable). Utilisation des données MOCK.");
      setRestaurants(MOCK_RESTAURANTS);
      setIsOfflineMode(true);
    }
  };

  // Realtime subscription for restaurants
  useEffect(() => {
    const channel = supabase
      .channel('public-restaurants-all')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'restaurants'
        },
        () => {
          console.log("Changement détecté dans les restaurants, rechargement...");
          fetchRestaurants();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleUpdateRestaurant = async (updatedResto: Restaurant) => {
    // Mise à jour de l'état local uniquement pour éviter les conflits et la latence
    setRestaurants(prev => prev.map(r => r.id === updatedResto.id ? updatedResto : r));
    // Nous ne rappelons PAS fetchRestaurants() ici pour laisser l'UI fluide
    // La prochaine visite ou refresh chargera les données DB.
  };

  // Fonction pour force la création du restaurant si l'automatisme a échoué
  const handleManualRestaurantCreation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setCreationLoading(true);

    const newRestaurantPayload = {
        owner_id: currentUser.id,
        name: newRestoName || "Mon Restaurant",
        type: newRestoType,
        city: currentUser.city || 'Kinshasa',
        description: `Bienvenue chez ${newRestoName}`,
        latitude: -4.325 + (Math.random() * 0.01), // Random pos near center
        longitude: 15.322 + (Math.random() * 0.01),
        is_open: true,
        preparation_time: 30,
        estimated_delivery_time: 30,
        currency: 'USD',
        exchange_rate: 2850,
        settings: {
            appearance: 'light',
            language: 'fr'
        },
        cover_image: 'https://picsum.photos/800/600?food'
    };

    try {
        // 1. Tenter l'insertion DB
        const { data, error } = await supabase
            .from('restaurants')
            .insert(newRestaurantPayload)
            .select()
            .single();

        if (error) throw error;

        // 2. Si succès, recharger
        await fetchRestaurants();
    } catch (err: any) {
        console.warn("Erreur création DB (Mode Offline activé):", err.message);
        
        // 3. Fallback Mode Offline / Démo
        const mockResto: Restaurant = {
            id: `temp-${Date.now()}`,
            ownerId: currentUser.id,
            name: newRestoName || "Mon Restaurant (Mode Démo)",
            type: newRestoType,
            city: currentUser.city || 'Kinshasa',
            description: "Restaurant créé en mode démonstration.",
            latitude: -4.325,
            longitude: 15.322,
            isOpen: true,
            rating: 5.0,
            reviewCount: 0,
            preparationTime: 30,
            estimatedDeliveryTime: 30,
            deliveryAvailable: true,
            coverImage: 'https://picsum.photos/800/600?food',
            currency: 'USD',
            menu: []
        };
        
        setRestaurants(prev => [...prev, mockResto]);
        setIsOfflineMode(true);
    } finally {
        setCreationLoading(false);
    }
  };

  if (showSplash && !isRecoveryMode) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  if (loading && !currentUser && !isRecoveryMode) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-black p-6">
        <div className="relative mb-8">
            <div className="w-20 h-20 border-4 border-brand-100 dark:border-brand-900/30 rounded-full animate-pulse"></div>
            <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-brand-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <div className="absolute -top-2 -right-2 bg-brand-500 text-white p-1.5 rounded-full shadow-lg">
                <Zap size={14} className="animate-pulse" />
            </div>
        </div>
        
        <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tighter italic mb-2">Chargement...</h2>
        <p className="text-gray-500 dark:text-gray-400 text-sm font-medium animate-pulse">Initialisation de votre session sécurisée</p>
        
        <button 
            onClick={() => setLoading(false)}
            className="mt-12 text-[10px] font-black text-gray-400 hover:text-brand-600 uppercase tracking-[0.2em] transition-colors"
        >
            Si cela prend trop de temps, cliquez ici
        </button>
      </div>
    );
  }

  const handleManualLogin = (user: User) => {
    setCurrentUser(user);
    setShowAuth(false);
    setAuthMode('login');
    setIsOfflineMode(true);
  };

  const handleLogout = async () => {
    localStorage.removeItem('dashmeals_staff_session');
    await supabase.auth.signOut();
    setCurrentUser(null);
    setIsAppLocked(false);
    setShowAuth(true); // Show auth screen after logout
  };

  const renderContent = () => {
    // 0. Check for Money Fusion Payment Redirect (IMMEDIATE PRIORITY)
    if (paymentStatus) {
      return (
        <PaymentResult 
          status={paymentStatus} 
          onReturn={() => window.location.href = window.location.origin} 
        />
      );
    }

    // Previous 0. Check for dedicated reset password route
    if (isRecoveryMode) {
      return <ResetPasswordPage />;
    }

    // PRIORITÉ ABSOLUE : Réinitialisation du mot de passe (Legacy detection)
    if (authMode === 'reset' && showAuth) {
      return (
        <>
          <OfflineBanner isSupabaseReachable={isSupabaseReachable} />
          <AuthScreen 
            onLogin={handleManualLogin} 
            isSupabaseReachable={isSupabaseReachable} 
            language={language}
            onBackToGuest={() => {
              setShowAuth(false);
              setAuthMode('login');
            }} 
            initialMode="reset"
          />
        </>
      );
    }

    // 1. Loading / Initializing State
    // Si on est encore en train d'initialiser ou si un chargement critique est en cours sans utilisateur résolu, on bloque l'UI
    if (isAppInitializing || (loading && !currentUser)) {
      if (showSplash) {
        return <SplashScreen onFinish={() => setShowSplash(false)} />;
      }
      return (
        <div className="fixed inset-0 flex items-center justify-center bg-white dark:bg-gray-900 z-[100]">
           <div className="flex flex-col items-center">
             <div className="w-12 h-12 border-4 border-brand-600 border-t-transparent rounded-full animate-spin mb-4"></div>
             <p className="text-sm text-gray-500 animate-pulse font-medium">Initialisation de votre session...</p>
           </div>
        </div>
      );
    }

    // 2. Not Logged In -> Show Auth or Guest View
    if (!currentUser) {
      if (showAuth) {
        return (
          <>
            {!isSupabaseReachable && (
              <div className="bg-red-600 text-white p-3 text-center text-sm font-bold sticky top-0 z-[100] flex items-center justify-center">
                <AlertTriangle size={18} className="mr-2" />
                Connexion Supabase impossible. L'application fonctionne en mode dégradé (Mocks).
              </div>
            )}
            <AuthScreen 
              onLogin={handleManualLogin} 
              isSupabaseReachable={isSupabaseReachable} 
              language={language}
              onBackToGuest={() => {
                setShowAuth(false);
                setAuthMode('login');
              }} 
              initialMode={authMode}
            />
          </>
        );
      }

      // Guest View
      const guestUser: User = {
          id: 'guest',
          name: 'Invité',
          email: '',
          role: 'guest',
          city: 'Kinshasa'
      };

      return (
        <>
          <OfflineBanner isSupabaseReachable={isSupabaseReachable} />
          <CustomerView 
            user={guestUser}
            allRestaurants={restaurants}
            onLogout={() => setShowAuth(true)} // onLogout for guest means "Login"
            theme={theme}
            setTheme={setTheme}
            language={language}
            setLanguage={setLanguage}
            font={font}
            setFont={setFont}
            onUpdateUser={setCurrentUser}
          />
        </>
      );
    }

    // 2. Logged in as SuperAdmin
    if (currentUser.role === 'superadmin') {
        return (
          <SuperAdminDashboard 
            user={currentUser} 
            onLogout={handleLogout} 
            theme={theme}
            setTheme={setTheme}
            language={language}
            setLanguage={setLanguage}
            font={font}
            setFont={setFont}
          />
        );
    }

    // 3. Logged in as Delivery or Staff Delivery
    if (currentUser.role === 'delivery' || (currentUser.role === 'staff' && currentUser.staffRole === 'delivery')) {
      return (
        <DeliveryView 
          user={currentUser} 
          onLogout={handleLogout} 
        />
      );
    }

    // 4. Logged in as Business or Staff
    if (currentUser.role === 'business' || currentUser.role === 'staff') {
      const myRestaurant = restaurants.find(r => r.id === currentUser.businessId || r.ownerId === currentUser.id);
      
      // CAS CRITIQUE : L'utilisateur est Business mais n'a pas de restaurant (Echec initialisation)
      if (!myRestaurant && currentUser.role === 'business') {
           return (
               <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center p-4">
                   <OfflineBanner isSupabaseReachable={isSupabaseReachable} />
                   
                   <div className="bg-white dark:bg-gray-800 max-w-md w-full rounded-2xl shadow-xl p-8 text-center animate-in fade-in zoom-in duration-300">
                       <div className="w-16 h-16 bg-brand-100 dark:bg-brand-900 text-brand-600 dark:text-brand-400 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Store size={32} />
                       </div>
                       
                       <h2 className="text-2xl font-black text-gray-800 dark:text-white mb-2">Finalisation</h2>
                       <p className="text-[10px] text-gray-400 mb-2 uppercase font-bold">Connecté : {currentUser.email} ({currentUser.role})</p>
                       <p className="text-gray-500 dark:text-gray-400 mb-6">Nous devons configurer votre établissement pour continuer.</p>
                       
                       <form onSubmit={handleManualRestaurantCreation} className="space-y-4 text-left">
                          <div>
                              <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 mb-1">Nom du restaurant</label>
                              <input 
                                  type="text"
                                  required
                                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none dark:bg-gray-700 dark:text-white"
                                  placeholder="Ex: Chez Maman..."
                                  value={newRestoName}
                                  onChange={e => setNewRestoName(e.target.value)}
                              />
                          </div>

                          <div>
                              <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 mb-1">Type d'établissement</label>
                              <select 
                                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none bg-white dark:bg-gray-700 dark:text-white"
                                  value={newRestoType}
                                  onChange={e => setNewRestoType(e.target.value as BusinessType)}
                              >
                                  <option value="restaurant">Restaurant</option>
                                  <option value="snack">Snack / Fast Food</option>
                                  <option value="bar">Bar / Lounge</option>
                                  <option value="terrasse">Terrasse</option>
                              </select>
                          </div>

                          <button 
                              type="submit"
                              disabled={creationLoading}
                              className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-3 rounded-xl shadow-lg flex justify-center items-center mt-4"
                          >
                              {creationLoading ? (
                                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              ) : (
                                  <>Créer mon espace <ArrowRight size={18} className="ml-2"/></>
                              )}
                          </button>
                       </form>
                       
                        <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-700 flex flex-col space-y-3">
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest text-center">Déjà configuré ?</p>
                            <button 
                                onClick={() => fetchRestaurants()}
                                className="w-full p-3 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-xl font-bold text-sm transition-colors flex items-center justify-center"
                            >
                                <Zap size={16} className="mr-2 text-brand-600" />
                                Actualiser mes données
                            </button>
                            <button onClick={handleLogout} className="text-gray-400 text-xs hover:text-red-500 underline py-2 text-center">
                                Annuler et se déconnecter
                            </button>
                        </div>
                   </div>
               </div>
           )
      }
      
      return (
        <>
          <OfflineBanner isSupabaseReachable={isSupabaseReachable} />
          <BusinessDashboard 
              user={currentUser} 
              restaurant={myRestaurant} 
              onUpdateRestaurant={handleUpdateRestaurant}
              onUpdateUser={setCurrentUser}
              onRefreshData={() => fetchRestaurants()}
              onLogout={handleLogout}
              theme={theme}
              setTheme={setTheme}
              language={language}
              setLanguage={setLanguage}
              font={font}
              setFont={setFont}
          />
        </>
      );
    }

    // 4. Logged in as Client
    return (
      <>
        <OfflineBanner isSupabaseReachable={isSupabaseReachable} />
        <CustomerView 
          user={currentUser}
          allRestaurants={restaurants}
          onLogout={handleLogout}
          theme={theme}
          setTheme={setTheme}
          language={language}
          setLanguage={setLanguage}
          font={font}
          setFont={setFont}
          onUpdateUser={setCurrentUser}
        />
      </>
    );
  };

  return (
    <>
      <Toaster position="top-center" richColors />
      <AnimatePresence mode="wait">
        {isAppLocked && currentUser?.settings?.appLockEnabled ? (
          <SecurityLock 
            key="lock"
            isEnabled={true}
            correctPin={currentUser.settings.appLockPin}
            biometricsEnabled={currentUser.settings.biometricsEnabled}
            onUnlock={() => setIsAppLocked(false)}
          />
        ) : (
          <motion.div
            key="content"
            initial={{ opacity: 1 }} // Start with 1 to avoid white page if animation engine is slow
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="min-h-screen"
          >
            {renderContent()}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default App;