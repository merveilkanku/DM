import React, { useState, useEffect } from 'react';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Keyboard } from '@capacitor/keyboard';
import { supabase, isDefaultProject } from '../lib/supabase';
import { User, UserRole, BusinessType } from '../types';
import { CITIES_RDC, APP_LOGO_URL } from '../constants';
import { User as UserIcon, Store, AlertCircle, MapPin, Mail, Phone, KeyRound, Users, Bike } from 'lucide-react';
import { Language } from '../types';
import { useTranslation } from '../lib/i18n';

interface Props {
  onLogin: (user: User, businessData?: any) => void;
  isSupabaseReachable?: boolean;
  onBackToGuest?: () => void;
  initialMode?: 'login' | 'signup' | 'reset';
  language?: Language;
}

export const AuthScreen: React.FC<Props> = ({ onLogin, isSupabaseReachable = true, onBackToGuest, initialMode = 'login', language = 'fr' }) => {
  const t = useTranslation(language as Language);
  const [isLogin, setIsLogin] = useState(initialMode === 'login');
  const [isStaffMode, setIsStaffMode] = useState(false);
  const [role, setRole] = useState<UserRole>('client');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('Kinshasa');
  const [availableCities, setAvailableCities] = useState<string[]>(CITIES_RDC);
  
  // Business Specific States
  const [businessType, setBusinessType] = useState<BusinessType>('restaurant');
  const [businessName, setBusinessName] = useState('');
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);

  // Forgot Password States
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(initialMode === 'reset');
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    if (initialMode === 'reset') {
      setIsResettingPassword(true);
      setIsLogin(false);
      setIsForgotPassword(false);
    } else if (initialMode === 'signup') {
      setIsLogin(false);
      setIsResettingPassword(false);
      setIsForgotPassword(false);
    } else {
      setIsLogin(true);
      setIsResettingPassword(false);
      setIsForgotPassword(false);
    }
  }, [initialMode]);

  // Staff Specific States
  const [staffRestaurantName, setStaffRestaurantName] = useState('');
  const [staffName, setStaffName] = useState('');
  const [staffPin, setStaffPin] = useState('');

  // Listen for OAuth messages from popup
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      console.log("📩 [AuthScreen] Message reçu de la popup:", event.origin, event.data?.type);
      
      // Origin check - be more lenient in development/preview environments
      const isAllowedOrigin = event.origin === window.location.origin || 
                             event.origin.includes('.run.app') || 
                             event.origin.includes('localhost') ||
                             event.origin.includes('stripe.com'); // Allow stripe for JS SDK
                             
      if (event.origin.includes('stripe.com')) return; // Ignore stripe messages for auth

      if (!isAllowedOrigin) {
        console.warn("⚠️ [AuthScreen] Origine non autorisée:", event.origin);
        return;
      }
      
      if (event.data?.type === 'OAUTH_SUCCESS' && event.data.session) {
        console.log("✅ [AuthScreen] OAuth Success message received, setting session...");
        setLoading(true);
        supabase.auth.setSession(event.data.session);
        // Remove reload. onAuthStateChange in App.tsx will handle the rest.
      } else if (event.data?.type === 'OAUTH_ERROR') {
        console.error("❌ [AuthScreen] OAuth Error message received:", event.data.error);
        setError(event.data.error || t('error'));
        setLoading(false);
      }
    };
    
    window.addEventListener('message', handleMessage);
    
    // Check for password recovery event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsResettingPassword(true);
      }
    });

    return () => {
      window.removeEventListener('message', handleMessage);
      subscription.unsubscribe();
      if (appListener) {
        appListener.remove();
      }
    };
  }, []);

  // Fetch cities from DB on mount
  useEffect(() => {
    const fetchCities = async () => {
      try {
        const { data, error } = await supabase
          .from('cities')
          .select('name')
          .eq('is_active', true)
          .order('name');
        
        if (!error && data && data.length > 0) {
          setAvailableCities(data.map(c => c.name));
        }
      } catch (err) {
        console.warn("Could not fetch cities from DB, using defaults");
      }
    };
    fetchCities();
  }, []);

  const handleOAuthLogin = async (provider: 'google' | 'facebook') => {
    if (provider === 'facebook') {
      setError("Connexion via Facebook indisponible pour l'instant, utiliser Google ou créer un compte manuellement");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      localStorage.setItem('dashmeals_pending_auth', JSON.stringify({ 
          role, 
          city,
      }));

      const isCapacitor = (window as any).Capacitor;
      const currentOrigin = isCapacitor ? 'com.dashmeals.android://callback' : window.location.origin;
      console.log("OAuth Redirect URL:", currentOrigin);

      // Detect if we are in the AI Studio preview
      const isPreview = !isCapacitor && window.location.origin.includes('.run.app');

      if (isPreview) {
          // In preview (iframe), we MUST use a popup
          const { data, error } = await supabase.auth.signInWithOAuth({
            provider: provider,
            options: {
              redirectTo: currentOrigin,
              skipBrowserRedirect: true, // IMPORTANT: Get URL instead of redirecting
              queryParams: {
                access_type: 'offline',
                prompt: 'consent',
              }
            }
          });
          
          if (error) throw error;

          if (data?.url) {
            // Open popup
            const width = 500;
            const height = 650;
            const left = window.screen.width / 2 - width / 2;
            const top = window.screen.height / 2 - height / 2;
            
            const popup = window.open(
              data.url,
              'oauth_popup',
              `width=${width},height=${height},left=${left},top=${top},status=no,menubar=no,toolbar=no`
            );

            // Check if popup was blocked
            if (!popup || popup.closed || typeof popup.closed === 'undefined') {
                setError("Le popup de connexion a été bloqué. Veuillez autoriser les popups pour ce site dans les réglages de votre navigateur.");
                setLoading(false);
                return;
            }

            // Poll to see if popup is closed (user cancelled)
            const timer = setInterval(() => {
                if (popup.closed) {
                    clearInterval(timer);
                    setLoading(false); // Reset loading state if closed without success
                }
            }, 1000);
          }
      } else if (isCapacitor) {
          const { data, error } = await supabase.auth.signInWithOAuth({
            provider: provider,
            options: {
              redirectTo: currentOrigin,
              skipBrowserRedirect: true,
              queryParams: {
                access_type: 'offline',
                prompt: 'consent',
              }
            }
          });

          if (error) throw error;
          if (data?.url) {
            await Browser.open({ url: data.url, windowName: '_system' });
          }
      } else {
          // Standard web
          const { error } = await supabase.auth.signInWithOAuth({
            provider: provider,
            options: {
              redirectTo: currentOrigin,
              queryParams: {
                access_type: 'offline',
                prompt: 'consent',
              }
            }
          });
          
          if (error) throw error;
      }
    } catch (err: any) {
      console.error("OAuth Error:", err);
      // Check for 403 or specific Supabase error messages related to URL
      if (err.message?.includes('403') || err.status === 403) {
        setError(`Erreur 403 : URL non autorisée. Avez-vous ajouté "${window.location.origin}" dans les "Redirect URLs" de votre projet Supabase ?`);
      } else {
        setError(err.message || "Erreur de connexion sociale");
      }
      setLoading(false);
    }
  };

  const handleDemoLogin = (demoRole: 'client' | 'business') => {
    const demoUser: User = {
      id: 'demo-user-' + Date.now(),
      email: 'demo@example.com',
      name: 'Utilisateur Démo',
      role: demoRole,
      city: 'Kinshasa',
      businessId: demoRole === 'business' ? 'resto-1' : undefined
    };
    onLogin(demoUser);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        // LOGIN
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      } else {
        // SIGN UP
        // 1. Create Auth User
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            // On sauvegarde aussi les infos dans les métadonnées comme backup
            data: { 
                full_name: name, 
                role: role, 
                city: city, 
                phone_number: phone 
            }, 
          }
        });

        if (authError) throw authError;
        
        if (authData.user) {
          // 2. Create Profile in DB using UPSERT to prevent conflicts
          const { error: profileError } = await supabase.from('profiles').upsert({
            id: authData.user.id,
            role: role,
            full_name: name,
            city: city,
            phone_number: phone,
            email: email
          });
          
          if (profileError) {
             console.warn("Avertissement création profil (Non bloquant):", profileError);
             // On ne throw PAS d'erreur ici car l'utilisateur est déjà créé dans Auth
             // et l'application peut fonctionner avec les métadonnées ou le mode offline
          }

          // 3. If Business, Create Restaurant
          if (role === 'business') {
            if (!businessName.trim()) throw new Error("Le nom du commerce est requis");

            const { error: restoError } = await supabase.from('restaurants').insert({
              owner_id: authData.user.id,
              name: businessName,
              type: businessType,
              city: city, 
              latitude: -4.301 + (Math.random() - 0.5) * 0.02, 
              longitude: 15.301 + (Math.random() - 0.5) * 0.02,
              description: `Bienvenue chez ${businessName}`,
              cover_image: `https://picsum.photos/800/600?random=${Date.now()}`,
              preparation_time: 30,
              estimated_delivery_time: 30,
              currency: 'USD',
              exchange_rate: 2850,
              phone_number: phone // Set restaurant phone number to owner's phone initially
            });
            if (restoError) {
                console.warn("Restaurant creation warning:", restoError);
            }
          }
          
          // Si inscription réussie mais pas de session auto (ex: email confirm), on prévient
          if (!authData.session) {
              setError("Compte créé ! Veuillez vérifier vos emails pour confirmer votre adresse avant de vous connecter.");
              setIsLogin(true);
              setLoading(false);
              return;
          }
        }
      }
    } catch (err: any) {
      console.error("Auth Error:", err);
      let message = err.message || "Une erreur est survenue";
      const lowerMsg = message.toLowerCase();
      
      // MAPPING DES ERREURS SUPABASE
      if (lowerMsg.includes("rate limit") || lowerMsg.includes("too many requests")) {
        message = "Trop de tentatives de connexion. Pour votre sécurité, veuillez patienter quelques minutes avant de réessayer.";
      } else if (lowerMsg.includes("invalid login credentials")) {
        message = "Identifiants incorrects. Si vous n'avez pas de compte, inscrivez-vous ou utilisez le Mode Démo.";
      } else if (lowerMsg.includes("email not confirmed")) {
        message = "Votre adresse email n'a pas encore été confirmée. Veuillez vérifier votre boîte de réception (et vos spams).";
      } else if (lowerMsg.includes("user already registered") || lowerMsg.includes("already exists")) {
        message = "Cette adresse email est déjà associée à un compte. Essayez de vous connecter.";
      } else if (lowerMsg.includes("password should be at least")) {
        message = "Le mot de passe est trop court. Il doit contenir au moins 6 caractères.";
      } else if (lowerMsg.includes("captcha verification process failed")) {
        message = "La vérification Captcha a échoué. Veuillez désactiver 'Enable Captcha protection' dans votre dashboard Supabase (Authentication > Settings) pour permettre l'inscription sans Captcha.";
      } else if (lowerMsg.includes("fetch failed") || lowerMsg.includes("network request failed")) {
        message = "Impossible de contacter le serveur d'authentification (Supabase). Vérifiez votre connexion internet ou la configuration de votre projet Supabase.";
      }

      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);

    try {
      // 1. Find the restaurant by name
      const { data: restoData, error: restoError } = await supabase
        .from('restaurants')
        .select('id, name')
        .ilike('name', `%${staffRestaurantName}%`)
        .limit(1)
        .single();

      if (restoError || !restoData) {
        throw new Error("Établissement non trouvé. Vérifiez le nom.");
      }

      // 2. Find the staff member in that restaurant
      const { data: staffData, error: staffError } = await supabase
        .from('staff_members')
        .select('*')
        .eq('restaurant_id', restoData.id)
        .ilike('name', staffName)
        .eq('pin_code', staffPin)
        .single();

      if (staffError || !staffData) {
        throw new Error("Nom ou Code PIN incorrect pour cet établissement.");
      }

      // 3. Create a virtual user session
      const staffUser: User = {
        id: staffData.id,
        name: staffData.name,
        email: `staff_${staffData.id}@dashmeals.com`,
        role: 'staff',
        city: 'Kinshasa', // Default
        businessId: staffData.restaurant_id,
        staffRole: staffData.role
      };

      // Save to local storage for persistence (since it's not a real Supabase Auth session)
      localStorage.setItem('dashmeals_staff_session', JSON.stringify(staffUser));
      
      onLogin(staffUser);
    } catch (err: any) {
      console.error("Staff Login Error:", err);
      setError(err.message || "Erreur de connexion équipe");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (!email) {
      setError("Veuillez entrer votre adresse email.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setResetEmailSent(true);
    } catch (err: any) {
      console.error("Forgot Password Error:", err);
      setError(err.message || "Erreur lors de l'envoi de l'email de réinitialisation.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (newPassword.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) throw error;
      
      // Sign out to force re-login with new password
      await supabase.auth.signOut();
      setIsResettingPassword(false);
      setIsLogin(true);
      setError("Mot de passe réinitialisé avec succès ! Vous pouvez maintenant vous connecter.");
    } catch (err: any) {
      console.error("Reset Password Error:", err);
      setError(err.message || "Erreur lors de la réinitialisation du mot de passe.");
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    if ((window as any).Capacitor) {
      Keyboard.setAccessoryBarVisible({ isVisible: false }).catch(() => {});
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-black flex flex-col items-center p-4 relative overflow-y-auto transition-colors duration-500">
      <div className="w-full h-20 shrink-0 sm:hidden"></div> {/* Spacer for top on mobile */}
      {/* Background Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-brand-500/10 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>

      {onBackToGuest && (
        <button 
          onClick={onBackToGuest}
          className="absolute top-6 left-6 p-3 glass rounded-full shadow-lg text-gray-600 dark:text-gray-300 hover:text-brand-600 dark:hover:text-brand-400 transition-all z-20 active:scale-90"
          title="Retourner à l'accueil"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
      )}

      <div className="w-full max-w-md relative z-10 glass rounded-[32px] shadow-2xl overflow-hidden border border-white/40 dark:border-white/10 my-8">
        
        {/* Header */}
        <div className="p-8 text-center flex flex-col items-center bg-brand-600 relative overflow-hidden">
          {/* Subtle pattern background */}
          <div className="absolute inset-0 opacity-10 mix-blend-overlay">
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="white" strokeWidth="0.5"/>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>
          </div>

          <div className="bg-white/10 backdrop-blur-xl p-4 rounded-3xl shadow-2xl border border-white/20 mb-6 group transition-transform hover:scale-105 duration-500">
             <img src={APP_LOGO_URL} alt="DashMeals Logo" className="h-12 w-auto object-contain filter drop-shadow-lg" />
          </div>
          <div className="relative z-10">
             <h1 className="text-4xl font-display font-black text-white tracking-tight uppercase italic leading-none">DashMeals <span className="text-brand-200">RDC</span></h1>
             <div className="h-1 w-12 bg-white/30 mx-auto mt-4 rounded-full"></div>
             <p className="text-brand-50 mt-4 font-medium text-sm tracking-wide opacity-90 uppercase">La plateforme gourmande de Kinshasa</p>
          </div>
        </div>

        {/* Tabs */}
        {!isStaffMode && !isForgotPassword && !isResettingPassword && (
          <div className="flex bg-gray-50/80 dark:bg-white/5 backdrop-blur-md p-1.5 mx-6 mt-6 rounded-2xl border border-gray-100 dark:border-white/5">
            <button 
              type="button"
              onClick={() => setRole('client')}
              className={`flex-1 py-4 flex items-center justify-center rounded-xl transition-all duration-500 ${role === 'client' ? 'text-brand-600 bg-white dark:bg-gray-800 shadow-md transform scale-[1.02]' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'}`}
              title={t('client_role')}
            >
              <UserIcon size={24} className={role === 'client' ? 'animate-bounce' : ''} />
            </button>
            <button 
              type="button"
              onClick={() => setRole('business')}
              className={`flex-1 py-4 flex items-center justify-center rounded-xl transition-all duration-500 ${role === 'business' ? 'text-brand-600 bg-white dark:bg-gray-800 shadow-md transform scale-[1.02]' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'}`}
              title={t('business_role')}
            >
              <Store size={24} className={role === 'business' ? 'animate-bounce' : ''} />
            </button>
            <button 
              type="button"
              onClick={() => setRole('delivery')}
              className={`flex-1 py-4 flex items-center justify-center relative rounded-xl transition-all duration-500 ${role === 'delivery' ? 'text-brand-600 bg-white dark:bg-gray-800 shadow-md transform scale-[1.02]' : 'text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
              title={t('delivery_role')}
            >
              <Bike size={24} className={role === 'delivery' ? 'animate-bounce' : ''} />
            </button>
          </div>
        )}

        <div className="p-8 pb-4">
            {!isForgotPassword && !isResettingPassword && (
              <>
                <div className="flex flex-col items-center justify-center mb-6">
                    <div className="w-12 h-12 rounded-2xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center mb-3 shadow-inner">
                        {role === 'client' ? <UserIcon className="text-brand-600" /> : role === 'business' ? <Store className="text-brand-600" /> : <Bike className="text-brand-600" />}
                    </div>
                    <h2 className="text-2xl font-display font-black text-gray-900 dark:text-white text-center uppercase tracking-tight italic">
                        {isStaffMode ? t('staff_access') : (isLogin ? t('login') : t('signup'))}
                    </h2>
                </div>
                {!isLogin && !isStaffMode && (
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 text-center mb-8 font-bold uppercase tracking-widest leading-relaxed">
                    {role === 'client' ? 'Inscrivez-vous pour commander vos plats préférés.' : 
                     role === 'business' ? 'Inscrivez-vous pour vendre vos produits sur la plateforme.' : 
                     'Inscrivez-vous pour devenir livreur et gagner de l\'argent.'}
                  </p>
                )}
                {isLogin && !isStaffMode && <div className="mb-4"></div>}

                {/* Social Login Buttons */}
                {!isStaffMode && (
                  <div className="space-y-3 mb-6">
                      <button 
                          type="button"
                          onClick={() => handleOAuthLogin('google')}
                          className="w-full flex items-center justify-center py-3 px-4 border border-gray-300 rounded-xl transition-colors font-bold text-sm bg-white text-gray-700 hover:bg-gray-50"
                          title="Connexion avec Google"
                      >
                          <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                          </svg>
                          {isLogin ? t('login_btn') + " avec Google" : t('signup_btn') + " avec Google"}
                      </button>
                      
                      <button 
                          type="button"
                          onClick={() => handleOAuthLogin('facebook')}
                          className="w-full flex items-center justify-center py-3 px-4 border border-gray-300 rounded-xl transition-colors font-bold text-sm group bg-white text-gray-700 hover:bg-[#1877F2] hover:text-white hover:border-[#1877F2]"
                          title="Connexion avec Facebook"
                      >
                          <svg className="w-5 h-5 mr-3 text-[#1877F2] group-hover:text-white fill-current transition-colors" viewBox="0 0 24 24">
                              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                          </svg>
                          {isLogin ? t('login_btn') + " avec Facebook" : t('signup_btn') + " avec Facebook"}
                      </button>
                  </div>
                )}
                
                {!isStaffMode && (
                  <div className="relative flex items-center justify-center mb-6">
                      <hr className="w-full border-gray-300" />
                      <span className="absolute bg-white px-3 text-xs text-gray-500 font-medium">OU AVEC EMAIL</span>
                  </div>
                )}
              </>
            )}
        </div>

        {/* Form */}
        {isResettingPassword ? (
          <form onSubmit={handleResetPassword} className="px-6 pb-6 space-y-4">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">{t('new_password')}</h2>
              <p className="text-xs text-gray-500 mt-1">{t('account_security')}</p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-xl text-sm animate-pulse flex items-start shadow-sm">
                   <AlertCircle size={18} className="mr-2 flex-shrink-0 mt-0.5" />
                   <span className="font-medium leading-tight">{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">{t('new_password')}</label>
              <div className="relative">
                <KeyRound size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="password"
                  placeholder="••••••••"
                  className="w-full p-3 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-black bg-white placeholder:text-gray-400"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-3 rounded-xl shadow-lg transition-transform active:scale-95 mt-4 flex justify-center items-center ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : t('update')}
            </button>
          </form>
        ) : isForgotPassword ? (
          <form onSubmit={handleForgotPassword} className="px-6 pb-6 space-y-4">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">{t('forgot_password')}</h2>
              <p className="text-xs text-gray-500 mt-1">
                {resetEmailSent 
                  ? t('success') 
                  : t('send_reset_link')}
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-xl text-sm animate-pulse flex items-start shadow-sm">
                   <AlertCircle size={18} className="mr-2 flex-shrink-0 mt-0.5" />
                   <span className="font-medium leading-tight">{error}</span>
              </div>
            )}

            {!resetEmailSent ? (
              <>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">{t('email')}</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="email"
                      placeholder={t('email_placeholder')}
                      className="w-full p-3 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-black bg-white placeholder:text-gray-400"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-3 rounded-xl shadow-lg transition-transform active:scale-95 mt-4 flex justify-center items-center ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                  {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : t('send_reset_link')}
                </button>
              </>
            ) : (
              <div className="bg-brand-50 p-4 rounded-xl text-brand-700 text-xs text-center font-medium">
                Veuillez vérifier votre boîte de réception (et vos spams) pour le lien de réinitialisation.
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setIsForgotPassword(false);
                setResetEmailSent(false);
                setError(null);
              }}
              className="w-full text-brand-600 font-bold text-sm py-2"
            >
              {t('back_to_login')}
            </button>
          </form>
        ) : isStaffMode ? (
          <form onSubmit={handleStaffLogin} className="px-6 pb-6 space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-xl text-sm flex items-start shadow-sm">
                   <AlertCircle size={18} className="mr-2 flex-shrink-0 mt-0.5" />
                   <span className="font-medium leading-tight">{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">{t('establishment_name')}</label>
              <div className="relative">
                <Store size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input 
                  type="text" 
                  required 
                  className="w-full p-3 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-black bg-white placeholder:text-gray-400"
                  placeholder="Ex: Chez Ntemba"
                  value={staffRestaurantName}
                  onChange={(e) => setStaffRestaurantName(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">{t('name')}</label>
              <div className="relative">
                <Users size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input 
                  type="text" 
                  required 
                  className="w-full p-3 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-black bg-white placeholder:text-gray-400"
                  placeholder="Ex: Jean"
                  value={staffName}
                  onChange={(e) => setStaffName(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Code PIN (4 chiffres)</label>
              <div className="relative">
                <KeyRound size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input 
                  type="password" 
                  required 
                  maxLength={4}
                  pattern="\d{4}"
                  className="w-full p-3 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-black bg-white placeholder:text-gray-400 tracking-widest"
                  placeholder="••••"
                  value={staffPin}
                  onChange={(e) => setStaffPin(e.target.value)}
                />
              </div>
            </div>

            <button 
              type="submit"
              disabled={loading}
              className={`w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-3 rounded-xl shadow-lg transition-transform active:scale-95 mt-4 flex justify-center items-center ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : t('login_btn')}
            </button>

            <button 
              type="button"
              onClick={() => setIsStaffMode(false)}
              className="w-full text-brand-600 font-bold text-sm py-2"
            >
              {t('back_to_login')}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-4">
          
          {error && (
            <div className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-xl text-sm animate-pulse flex items-start shadow-sm">
                 <AlertCircle size={18} className="mr-2 flex-shrink-0 mt-0.5" />
                 <span className="font-medium leading-tight">{error}</span>
            </div>
          )}

          {!isLogin && (
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">{t('full_name')}</label>
              <input 
                type="text" 
                required 
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-black bg-white placeholder:text-gray-400"
                placeholder="Ex: Jean K."
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          )}

           {/* Phone Number Field */}
           {!isLogin && (
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">{t('phone')}</label>
              <div className="relative">
                <Phone size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input 
                    type="tel" 
                    required 
                    className="w-full p-3 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-black bg-white placeholder:text-gray-400"
                    placeholder="Ex: 0812345678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* City Selection for both Roles during Signup */}
          {!isLogin && (
             <div>
                <label className="block text-xs font-bold text-gray-600 mb-1 flex items-center">
                  <MapPin size={12} className="mr-1"/> 
                  {role === 'business' ? t('city') : t('city')}
                </label>
                <select 
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none bg-white text-gray-900"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                >
                  {availableCities.map(c => (
                    <option key={c} value={c} className="text-gray-900">{c}</option>
                  ))}
                </select>
             </div>
          )}

          {/* Business Specific Fields during Signup */}
          {!isLogin && role === 'business' && (
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-3">
              <h3 className="text-sm font-bold text-gray-700 flex items-center"><Store size={14} className="mr-2"/> Infos Établissement</h3>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Nom du commerce</label>
                <input 
                  type="text" 
                  required 
                  className="w-full p-2 border border-gray-300 rounded focus:ring-1 focus:ring-brand-500 outline-none text-gray-900"
                  placeholder="Ex: Chez Ntemba"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Type</label>
                <select 
                  className="w-full p-2 border border-gray-300 rounded bg-white text-gray-900"
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value as BusinessType)}
                >
                  <option value="restaurant" className="text-gray-900">Restaurant</option>
                  <option value="bar" className="text-gray-900">Bar / Lounge</option>
                  <option value="terrasse" className="text-gray-900">Terrasse</option>
                  <option value="snack" className="text-gray-900">Snack / Fast-food</option>
                </select>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">{t('email')}</label>
            <input 
              type="email" 
              required 
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-black bg-white placeholder:text-gray-400"
              placeholder={t('email_placeholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">{t('password')}</label>
            <input 
              type="password" 
              required 
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-black bg-white placeholder:text-gray-400"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {isLogin && (
              <div className="flex justify-end mt-1">
                <button
                  type="button"
                  onClick={() => setIsForgotPassword(true)}
                  className="text-[10px] font-bold text-brand-600 hover:underline"
                >
                  {t('forgot_password')}
                </button>
              </div>
            )}
          </div>

          {!isLogin && (
            <div className="flex items-start space-x-2 mt-2">
              <input
                type="checkbox"
                id="privacy"
                checked={acceptPrivacy}
                onChange={(e) => setAcceptPrivacy(e.target.checked)}
                className="mt-1 h-4 w-4 text-brand-600 focus:ring-brand-500 border-gray-300 rounded"
              />
              <label htmlFor="privacy" className="text-xs text-gray-600 leading-tight">
                {t('accept_privacy')}
              </label>
            </div>
          )}

          <button 
            type="submit"
            disabled={loading || (!isLogin && !acceptPrivacy)}
            className={`w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-3 rounded-xl shadow-lg transition-transform active:scale-95 mt-4 flex justify-center items-center ${loading || (!isLogin && !acceptPrivacy) ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : (isLogin ? t('login_btn') : t('signup_btn'))}
          </button>

          {(isDefaultProject || !isSupabaseReachable || error) && (
            <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-xl">
              <p className="text-xs text-orange-800 mb-2 font-medium text-center">
                {!isSupabaseReachable 
                  ? "Le serveur est injoignable. Utiliser le mode démo ?" 
                  : "Pour tester sans compte, utilisez le mode démo."}
              </p>
              <button 
                type="button"
                onClick={() => handleDemoLogin(role as any)}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 rounded-lg text-sm shadow-sm transition-colors"
              >
                Continuer en Mode Démo
              </button>
            </div>
          )}

          <div className="mt-4">
            <button 
              type="button"
              onClick={() => onLogin({ id: 'guest', name: 'Invité', email: '', role: 'guest', city: 'Kinshasa' })}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 rounded-xl shadow-sm transition-transform active:scale-95 flex justify-center items-center"
            >
              {t('continue_as_guest')}
            </button>
          </div>
        </form>
        )}

        <div className="bg-gray-50/50 dark:bg-white/5 p-6 text-center border-t border-gray-100 dark:border-white/5 space-y-3">
          <button 
            type="button"
            onClick={() => {
                setIsLogin(!isLogin);
                setIsStaffMode(false);
                setError(null);
            }}
            className="text-xs text-brand-600 dark:text-brand-400 font-black hover:underline block w-full uppercase tracking-widest italic"
          >
            {isLogin ? t('no_account') + " " + t('signup') : t('have_account') + " " + t('login')}
          </button>
          
          {isLogin && !isStaffMode && (
            <button 
              type="button"
              onClick={() => {
                  setIsStaffMode(true);
                  setError(null);
              }}
              className="text-[10px] text-gray-400 hover:text-brand-600 font-bold flex items-center justify-center w-full uppercase tracking-tighter"
            >
              <KeyRound size={12} className="mr-1.5" /> {t('staff_access')} (PIN)
            </button>
          )}
        </div>
      </div>
    </div>
  );
};