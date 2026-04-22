import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  MapPin, ShoppingBag, List, Map, ArrowLeft, ArrowRight, Plus, Bike, Footprints, 
  LogOut, Navigation, Search, X, Receipt, Phone, Info, Image as ImageIcon, 
  PlayCircle, Settings, Moon, Sun, Globe, CheckCircle, CheckCircle2, Star, Type, Clock, Bell, ChevronRight,
  Shield, Lock, Fingerprint, Zap, HelpCircle, Book, Mail, ExternalLink, Car, Upload, FileText, Smartphone, MessageSquare
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { KINSHASA_CENTER_LAT, KINSHASA_CENTER_LNG, CITIES_RDC, APP_LOGO_URL } from '../constants';
import { formatDualPrice } from '../utils/format';
import { Restaurant, UserState, ViewMode, MenuItem, CartItem, User, Order, Promotion, Theme, Language, AppFont, PaymentMethod, MobileMoneyNetwork, SecuritySettings } from '../types';
import { calculateTime, getDistanceFromLatLonInKm, formatDistance, formatTime } from '../utils/geo';
import { RestaurantCard } from './RestaurantCard';
import { MapView } from './MapView';
import { CartDrawer } from './CartDrawer';
import { ChatWindow } from './ChatWindow';
import { StoryViewer } from './StoryViewer';
import { OrdersView } from './OrdersView';
import { useTranslation } from '../lib/i18n';
import { useNativePicker } from '../utils/useNativePicker';
import { PinSetupDialog } from './PinSetupDialog';
import { HelpCenter } from './HelpCenter';
import { requestNotificationPermission, sendPushNotification } from '../utils/notifications';
import { sendOrderConfirmationEmail, sendNewOrderNotificationToRestaurant } from '../lib/email';

// Speed constants
const SPEED_WALKING = 5;
const SPEED_MOTO = 30;

interface Props {
  user: User;
  allRestaurants: Restaurant[];
  onLogout: () => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
  language: Language;
  setLanguage: (l: Language) => void;
  font?: AppFont;
  setFont?: (f: AppFont) => void;
  onUpdateUser?: (user: User) => void;
}

export const CustomerView: React.FC<Props> = ({ user, allRestaurants, onLogout, theme, setTheme, language, setLanguage, font, setFont, onUpdateUser }) => {
  const t = useTranslation(language);
  const { isCapacitor, pickImage } = useNativePicker();
  // State
  const [userState, setUserState] = useState<UserState>({
    location: null,
    locationError: null,
    loadingLocation: true,
  });
  
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [promotionsMap, setPromotionsMap] = useState<Record<string, Promotion[]>>({});
  
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [urgentMode, setUrgentMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [selectedCity, setSelectedCity] = useState<string>('Toutes');
  const [selectedCategory, setSelectedCategory] = useState<string>('Tous');
  const [selectedMenuCategory, setSelectedMenuCategory] = useState<string>('Tous');
  const [sortBy, setSortBy] = useState<string>('relevance');
  const [openNow, setOpenNow] = useState<boolean>(false);
  const [detectedAddress, setDetectedAddress] = useState<string | null>(null);
  
  const [isSearchingUrgent, setIsSearchingUrgent] = useState(false);
  const [urgentRestaurant, setUrgentRestaurant] = useState<Restaurant | null>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Order States
  const [orders, setOrders] = useState<Order[]>([]);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  
  // Chat State
  const [activeChatOrder, setActiveChatOrder] = useState<Order | null>(null);

  // Story State
  const [activeStoryRestaurant, setActiveStoryRestaurant] = useState<Restaurant | null>(null);
  const [storyStartIndex, setStoryStartIndex] = useState(0);

  // Subscription State
  const [subscribedRestaurants, setSubscribedRestaurants] = useState<string[]>([]);
  const [isSubscribing, setIsSubscribing] = useState<string | null>(null);
  const [loyaltyPoints, setLoyaltyPoints] = useState<Record<string, number>>({});
  const [loyaltyRewards, setLoyaltyRewards] = useState<Record<string, any[]>>({});

  const [activeTab, setActiveTab ] = useState<'restaurants' | 'items'>('restaurants');
  const [cartConflict, setCartConflict] = useState<{ item: MenuItem, restaurant: Restaurant } | null>(null);

  const [isPinSetupOpen, setIsPinSetupOpen] = useState(false);
  const [isHelpCenterOpen, setIsHelpCenterOpen] = useState(false);
  
  // Notifications State
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Nearby Restaurants (Sorted by distance)
  const nearbyRestaurants = useMemo(() => {
    // We show the 8 closest restaurants, whether they are verified or not, to ensure visibility
    return restaurants.slice(0, 8);
  }, [restaurants]);

  // Discovery Feed: Popular Items from nearby restaurants
  const discoverableItems = useMemo(() => {
    const items: (MenuItem & { restaurant: Restaurant })[] = [];
    restaurants.forEach(r => {
      r.menu.forEach(m => {
        items.push({ ...m, restaurant: r });
      });
    });
    // Return random selection or based on ratings if available
    return items.sort(() => Math.random() - 0.5).slice(0, 15);
  }, [restaurants]);

  // Past Ordered Items
  const recentOrderedItems = useMemo(() => {
    const items: (MenuItem & { restaurant: Restaurant })[] = [];
    const seenIds = new Set();
    
    orders.forEach(o => {
      o.items.forEach(item => {
        if (!seenIds.has(item.id)) {
          const restaurant = allRestaurants.find(r => r.id === o.restaurantId);
          if (restaurant) {
            items.push({ ...item, restaurant } as any);
            seenIds.add(item.id);
          }
        }
      });
    });
    return items.slice(0, 8);
  }, [orders, allRestaurants]);

  // Delivery Onboarding State
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [deliveryVehicle, setDeliveryVehicle] = useState<'moto' | 'velo' | 'voiture' | 'pieton'>('moto');
  const [deliveryIdNumber, setDeliveryIdNumber] = useState('');
  const [deliveryLicensePlate, setDeliveryLicensePlate] = useState('');
  const [isSubmittingOnboarding, setIsSubmittingOnboarding] = useState(false);
  const [idCardFile, setIdCardFile] = useState<File | null>(null);
  const [licenseFile, setLicenseFile] = useState<File | null>(null);

  const idCardInputRef = useRef<HTMLInputElement>(null);
  const licenseInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user.id) {
        fetchNotifications();
        
        const channel = supabase
            .channel(`user_notifications:${user.id}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${user.id}`
            }, (payload) => {
                console.log("[Notifications] Nouvelle notification reçue:", payload.new);
                setNotifications(prev => [payload.new, ...prev]);
                setUnreadCount(prev => prev + 1);
                toast.info(`🔔 ${payload.new.title}`, {
                    description: payload.new.message,
                    duration: 5000
                });
            })
            .subscribe((status) => {
                console.log(`[Notifications] Statut de la souscription: ${status}`);
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }
  }, [user.id]);

  const fetchNotifications = async (retryCount = 0) => {
    if (user.role === 'guest' || user.id === 'guest') {
        console.log("[Notifications] Bypass fetch pour mode invité");
        return;
    }
    
    try {
        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (error) {
            console.warn(`Erreur notifications (Tentative ${retryCount + 1}):`, error.message);
            
            const isNetworkError = error.message?.includes('Failed to fetch') || error.message?.includes('network');
            
            if (isNetworkError && retryCount < 2) {
                console.log(`Nouvelle tentative de lecture notifications dans 2s...`);
                setTimeout(() => fetchNotifications(retryCount + 1), 2000);
                return;
            }
            throw error;
        }
        setNotifications(data || []);
        setUnreadCount((data || []).filter((n: any) => !n.is_read).length);
    } catch (error) {
        console.error("Error fetching notifications:", error);
    }
  };

  const markNotificationAsRead = async (id: string) => {
    try {
        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('id', id);

        if (error) throw error;
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
        console.error("Error marking notification as read:", error);
    }
  };

  const markAllAsRead = async () => {
    if (user.role === 'guest' || user.id === 'guest') return;
    
    try {
        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('user_id', user.id)
            .eq('is_read', false);

        if (error) throw error;
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        setUnreadCount(0);
    } catch (error) {
        console.error("Error marking all as read:", error);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
        const { error } = await supabase
            .from('notifications')
            .delete()
            .eq('id', id);

        if (error) throw error;
        setNotifications(prev => prev.filter(n => n.id !== id));
        setUnreadCount(prev => {
            const n = notifications.find(notif => notif.id === id);
            return n && !n.is_read ? Math.max(0, prev - 1) : prev;
        });
    } catch (error) {
        console.error("Error deleting notification:", error);
    }
  };

  // Fetch loyalty data
  useEffect(() => {
    if (user && user.role !== 'guest') {
      const fetchLoyaltyData = async () => {
        // Fetch points
        const { data: pointsData } = await supabase
          .from('loyalty_points')
          .select('restaurant_id, points')
          .eq('user_id', user.id);
        
        if (pointsData) {
          const pointsMap: Record<string, number> = {};
          pointsData.forEach(p => {
            pointsMap[p.restaurant_id] = p.points;
          });
          setLoyaltyPoints(pointsMap);
        }

        // Fetch rewards for all restaurants (or just the selected one)
        const { data: rewardsData } = await supabase
          .from('loyalty_rewards')
          .select('*')
          .eq('is_active', true);
        
        if (rewardsData) {
          const rewardsMap: Record<string, any[]> = {};
          rewardsData.forEach(r => {
            if (!rewardsMap[r.restaurant_id]) rewardsMap[r.restaurant_id] = [];
            rewardsMap[r.restaurant_id].push(r);
          });
          setLoyaltyRewards(rewardsMap);
        }
      };
      fetchLoyaltyData();
    }
  }, [user, selectedRestaurant]);

  // Fetch subscriptions
  useEffect(() => {
    if (user && user.role !== 'guest') {
      const fetchSubscriptions = async () => {
        const { data, error } = await supabase
          .from('followers')
          .select('restaurant_id')
          .eq('user_id', user.id);
        
        if (!error && data) {
          setSubscribedRestaurants(data.map(f => f.restaurant_id));
        }
      };
      fetchSubscriptions();
    }
  }, [user]);

  const toggleSubscription = async (restaurantId: string) => {
    if (user.role === 'guest') {
      toast.error("Vous devez d'abord vous connecter pour vous abonner.");
      return;
    }

    if (isSubscribing === restaurantId) return;

    setIsSubscribing(restaurantId);
    const isSubscribed = subscribedRestaurants.includes(restaurantId);

    try {
      if (isSubscribed) {
        const { error } = await supabase
          .from('followers')
          .delete()
          .eq('user_id', user.id)
          .eq('restaurant_id', restaurantId);
        
        if (error) throw error;
        setSubscribedRestaurants(prev => prev.filter(id => id !== restaurantId));
        toast.info("Abonnement annulé.");
      } else {
        // Use upsert to handle potential duplicates gracefully at the database level
        const { error } = await supabase
          .from('followers')
          .upsert(
            { user_id: user.id, restaurant_id: restaurantId },
            { onConflict: 'user_id,restaurant_id' }
          );
        
        // Even with upsert, we check for errors. If it's still a duplicate (which should not happen with upsert), 
        // or any other error, we handle it.
        if (error && error.code !== '23505') {
            throw error;
        }
        
        if (!subscribedRestaurants.includes(restaurantId)) {
          setSubscribedRestaurants(prev => [...prev, restaurantId]);
        }
        toast.success("Vous êtes maintenant abonné à ce restaurant !");
      }
    } catch (error: any) {
      console.error("Erreur abonnement:", error);
      toast.error("Une erreur est survenue lors de l'abonnement.");
    } finally {
      setIsSubscribing(null);
    }
  };

  const handleClaimReward = async (reward: any) => {
    if (!user || user.role === 'guest') return;
    
    const currentPoints = loyaltyPoints[reward.restaurant_id] || 0;
    if (currentPoints < reward.points_required) {
        toast.error("Points insuffisants");
        return;
    }

    try {
        const { error } = await supabase
            .from('loyalty_points')
            .update({ 
                points: currentPoints - reward.points_required,
                updated_at: new Date().toISOString()
            })
            .eq('user_id', user.id)
            .eq('restaurant_id', reward.restaurant_id);

        if (error) throw error;

        setLoyaltyPoints(prev => ({
            ...prev,
            [reward.restaurant_id]: currentPoints - reward.points_required
        }));

        toast.success(`Récompense réclamée : ${reward.name} ! Montrez ce message au restaurant.`);
    } catch (err) {
        console.error("Error claiming reward:", err);
        toast.error("Erreur lors de la réclamation");
    }
  };

  const updateSecuritySettings = async (newSettings: Partial<SecuritySettings>) => {
    if (!user || user.role === 'guest' || !onUpdateUser) return;

    const updatedSettings = {
      ...(user.settings || {
        notifPush: true,
        notifEmail: true,
        notifSms: false,
        twoFactorEnabled: false,
        appLockEnabled: false,
        appLockPin: null,
        biometricsEnabled: false
      }),
      ...newSettings
    };

    const updatedUser = {
      ...user,
      settings: updatedSettings
    };

    onUpdateUser(updatedUser);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ settings: updatedSettings })
        .eq('id', user.id);

      if (error) throw error;
      toast.success("Paramètres de sécurité mis à jour");
    } catch (err) {
      console.error("Error updating security settings:", err);
      toast.error("Erreur lors de la mise à jour des paramètres");
    }
  };

  const handleSetPin = (pin: string) => {
    updateSecuritySettings({ appLockPin: pin, appLockEnabled: true });
    setIsPinSetupOpen(false);
    toast.success("Code PIN configuré avec succès !");
  };

  // Carousel Ref
  const carouselRef = useRef<HTMLDivElement>(null);

  // Auto-scroll carousel
  useEffect(() => {
      const carousel = carouselRef.current;
      if (!carousel) return;

      let scrollInterval: NodeJS.Timeout;
      const startScroll = () => {
          scrollInterval = setInterval(() => {
              if (carousel.scrollLeft + carousel.clientWidth >= carousel.scrollWidth - 10) {
                  carousel.scrollTo({ left: 0, behavior: 'smooth' });
              } else {
                  carousel.scrollBy({ left: carousel.clientWidth, behavior: 'smooth' });
              }
          }, 5000); // Scroll every 5 seconds
      };

      startScroll();

      // Pause on hover/touch
      const pauseScroll = () => clearInterval(scrollInterval);
      carousel.addEventListener('mouseenter', pauseScroll);
      carousel.addEventListener('mouseleave', startScroll);
      carousel.addEventListener('touchstart', pauseScroll);
      carousel.addEventListener('touchend', startScroll);

      return () => {
          clearInterval(scrollInterval);
          carousel.removeEventListener('mouseenter', pauseScroll);
          carousel.removeEventListener('mouseleave', startScroll);
          carousel.removeEventListener('touchstart', pauseScroll);
          carousel.removeEventListener('touchend', startScroll);
      };
  }, []);

  // History Management
  useEffect(() => {
      // Initial state
      if (!window.history.state) {
          window.history.replaceState({ view: 'list' }, '', '#list');
      }

      const onPopState = (e: PopStateEvent) => {
          const state = e.state;
          if (state?.view) {
              setViewMode(state.view);
              if (state.view === 'list' || state.view === 'map') {
                  setSelectedRestaurant(null);
              }
          }
          
          setIsCartOpen(!!state?.cart);
          if (!state?.chat) setActiveChatOrder(null);
          if (!state?.story) setActiveStoryRestaurant(null);
          if (!state?.help) setIsHelpCenterOpen(false);
          if (!state?.urgent) {
              setUrgentMode(false);
              setUrgentRestaurant(null);
          }
      };

      window.addEventListener('popstate', onPopState);
      return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigateTo = (mode: ViewMode) => {
      if (mode === viewMode) return;
      window.history.pushState({ view: mode }, '', `#${mode}`);
      setViewMode(mode);
  };

  const openCart = () => {
      window.history.pushState({ view: viewMode, cart: true }, '', '#cart');
      setIsCartOpen(true);
  };

  const closeCart = () => {
      if (window.history.state?.cart) window.history.back();
      else setIsCartOpen(false);
  };

  const openChat = (order: Order) => {
      window.history.pushState({ view: viewMode, chat: true }, '', '#chat');
      setActiveChatOrder(order);
  };

  const closeChat = () => {
      if (window.history.state?.chat) window.history.back();
      else setActiveChatOrder(null);
  };

  const openStory = (restaurant: Restaurant, index: number) => {
      window.history.pushState({ view: viewMode, story: true }, '', '#story');
      setStoryStartIndex(index);
      setActiveStoryRestaurant(restaurant);
  };

  const closeStory = () => {
      if (window.history.state?.story) window.history.back();
      else setActiveStoryRestaurant(null);
  };

  const openHelpCenter = () => {
      window.history.pushState({ view: viewMode, help: true }, '', '#help');
      setIsHelpCenterOpen(true);
  };

  const closeHelpCenter = () => {
      if (window.history.state?.help) window.history.back();
      else setIsHelpCenterOpen(false);
  };

  const toggleUrgentMode = () => {
      if (!urgentMode) {
          window.history.pushState({ view: viewMode, urgent: true }, '', '#urgent');
          setUrgentMode(true);
      } else {
          if (window.history.state?.urgent) window.history.back();
          else setUrgentMode(false);
      }
  };

  // Geolocation Function
  const refreshLocation = () => {
    setUserState(prev => ({ ...prev, loadingLocation: true, locationError: null }));
    
    if (!navigator.geolocation) {
      setUserState({
        location: null,
        locationError: "La géolocalisation n'est pas supportée par votre navigateur",
        loadingLocation: false
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserState({
          location: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          },
          locationError: null,
          loadingLocation: false
        });
      },
      (error) => {
        console.warn("Geo error:", error);
        // Fallback to IP geolocation if GPS fails
        fetch('https://ipapi.co/json/')
          .then(res => res.json())
          .then(data => {
            if (data.latitude && data.longitude) {
              setUserState({
                location: {
                  latitude: data.latitude,
                  longitude: data.longitude
                },
                locationError: "Position GPS introuvable. Utilisation de la position réseau.",
                loadingLocation: false
              });
            } else {
              throw new Error("IP Geo failed");
            }
          })
          .catch(err => {
            setUserState({
                location: {
                    latitude: KINSHASA_CENTER_LAT,
                    longitude: KINSHASA_CENTER_LNG
                },
                locationError: "Position introuvable. Utilisation de la position par défaut (Kinshasa).",
                loadingLocation: false
            });
          });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Initial Geolocation
  useEffect(() => {
    refreshLocation();
  }, []);

  // Update Restaurants when location or database changes
  useEffect(() => {
    if (userState.location) {
      // Reverse Geocoding to get city
      if (!userState.locationError) {
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${userState.location.latitude}&lon=${userState.location.longitude}`)
          .then(res => res.json())
          .then(data => {
            const city = data.address?.city || data.address?.town || data.address?.village || data.address?.state;
            if (city) {
              setDetectedAddress(city);
              const matchedCity = CITIES_RDC.find(c => city.toLowerCase().includes(c.toLowerCase()));
              if (matchedCity) {
                // We don't auto-select the city anymore to avoid hiding restaurants
                // that might be in a specific municipality (e.g., Gombe instead of Kinshasa).
                // The user can manually select the city if they want.
              }
            }
          })
          .catch(err => console.error("Reverse geocoding failed", err));
      }

      const updatedRestaurants = allRestaurants
        .filter(r => r.is_active !== false)
        .map(r => {
        const dist = getDistanceFromLatLonInKm(
          userState.location!.latitude,
          userState.location!.longitude,
          r.latitude,
          r.longitude
        );
        return {
          ...r,
          distance: dist,
          timeWalking: calculateTime(dist, SPEED_WALKING),
          timeMoto: calculateTime(dist, SPEED_MOTO),
        };
      }).sort((a, b) => (a.distance || 0) - (b.distance || 0));

      setRestaurants(updatedRestaurants);
      // Fetch promotions after restaurants are ready
      fetchPromotions(updatedRestaurants);
    } else {
      const activeRestaurants = allRestaurants.filter(r => r.is_active !== false);
      setRestaurants(activeRestaurants);
      fetchPromotions(activeRestaurants);
    }
  }, [userState.location, allRestaurants]);

  // Realtime Orders Subscription for Customer
  useEffect(() => {
    // Request notification permission on mount
    requestNotificationPermission();

    const channel = supabase
        .channel('customer-orders')
        .on(
            'postgres_changes',
            {
                event: 'UPDATE', // On écoute quand le restaurant change le statut
                schema: 'public',
                table: 'orders',
                filter: `user_id=eq.${user.id}`
            },
            (payload) => {
                console.log("Mise à jour commande client:", payload);
                // On met à jour l'état local pour voir le changement instantanément
                setOrders(prev => prev.map(o => 
                    o.id === payload.new.id ? { ...o, status: payload.new.status } : o
                ));
                
                // Send push notification
                const statusMap: Record<string, string> = {
                    'preparing': t('order_preparing_msg'),
                    'ready': t('order_ready_msg'),
                    'delivering': t('order_delivering_msg'),
                    'completed': t('order_completed_msg'),
                    'cancelled': t('order_cancelled_msg')
                };
                
                const message = statusMap[payload.new.status] || `${t('order_status_changed')} : ${payload.new.status}`;
                
                sendPushNotification(t('order_update'), {
                    body: message,
                    tag: `order-${payload.new.id}`,
                    requireInteraction: true
                });
            }
        )
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
  }, [user.id]);

  const fetchPromotions = async (restos: Restaurant[]) => {
      // Filter for last 24 hours
      const yesterday = new Date();
      yesterday.setHours(yesterday.getHours() - 24);

      let { data, error } = await supabase
        .from('promotions')
        .select('*')
        .gte('created_at', yesterday.toISOString())
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error && error.code === '42703') {
          // Fallback if is_active column doesn't exist yet
          const fallback = await supabase
            .from('promotions')
            .select('*')
            .gte('created_at', yesterday.toISOString())
            .order('created_at', { ascending: false });
          data = fallback.data;
      }

      if (data) {
          const mapping: Record<string, Promotion[]> = {};
          data.forEach((p: any) => {
              if (!mapping[p.restaurant_id]) mapping[p.restaurant_id] = [];
              mapping[p.restaurant_id].push({
                  id: p.id,
                  restaurantId: p.restaurant_id,
                  mediaUrl: p.media_url,
                  mediaType: p.media_type,
                  caption: p.caption,
                  createdAt: p.created_at
              });
          });
          setPromotionsMap(mapping);
      }
  };

  // Load Orders when entering 'orders' view and subscribe to changes
  useEffect(() => {
    if (viewMode === 'orders' && user.id !== 'guest') {
        fetchOrders();

        // Subscribe to real-time updates for orders
        const ordersSubscription = supabase
            .channel('orders-realtime')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'orders',
                    filter: `user_id=eq.${user.id}`
                },
                (payload) => {
                    console.log('Order update received:', payload);
                    fetchOrders(); // Refresh all orders to get updated data including restaurant info
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(ordersSubscription);
        };
    }
  }, [viewMode, user.id]);

  const fetchOrders = async () => {
    try {
        const { data: ordersData, error: ordersError } = await supabase
            .from('orders')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (ordersError) {
             console.warn("Fetch orders failed:", ordersError.message);
             const localOrdersStr = localStorage.getItem('dashmeals_mock_orders');
             if (localOrdersStr) {
                 const localOrders = JSON.parse(localOrdersStr);
                 const userLocalOrders = localOrders.filter((o: any) => o.user_id === user.id);
                 if (userLocalOrders.length > 0) {
                     setOrders(userLocalOrders.map((o: any) => ({
                         id: o.id,
                         userId: o.user_id,
                         restaurantId: o.restaurant_id,
                         status: o.status,
                         totalAmount: o.total_amount,
                         isUrgent: o.items && o.items.length > 0 ? o.items[0].isUrgent : false,
                         items: o.items,
                         createdAt: o.created_at,
                         restaurant: { 
                             name: restaurants.find(r => r.id === o.restaurant_id)?.name || 'Restaurant Local',
                             phone_number: restaurants.find(r => r.id === o.restaurant_id)?.phoneNumber || ''
                         }
                     })));
                 }
             }
             return;
        }
        
        let allOrders = ordersData || [];
        
        // Merge with local orders
        const localOrdersStr = localStorage.getItem('dashmeals_mock_orders');
        if (localOrdersStr) {
            try {
                const localOrders = JSON.parse(localOrdersStr);
                // Only add local orders that belong to this user
                const userLocalOrders = localOrders.filter((o: any) => o.user_id === user.id);
                allOrders = [...userLocalOrders, ...allOrders];
            } catch (e) {
                console.error("Error parsing local orders", e);
            }
        }

        if (allOrders.length >= 0) {
            // Extract unique restaurant IDs
            const restaurantIds = Array.from(new Set(allOrders.map((o: any) => o.restaurant_id))).filter(Boolean);
            const validRestaurantIds = restaurantIds.filter((id: any) => typeof id === 'string' && id.length === 36);
            
            // Fetch restaurants
            let restaurantsMap: Record<string, any> = {};
            if (validRestaurantIds.length > 0) {
                const { data: restaurantsData, error: restaurantsError } = await supabase
                    .from('restaurants')
                    .select('id, name, phone_number, owner_id, currency, display_currency_mode, exchange_rate')
                    .in('id', validRestaurantIds);
                
                if (restaurantsError) {
                    console.error("Error fetching restaurants:", restaurantsError);
                }
                
                if (restaurantsData) {
                    restaurantsData.forEach((r: any) => {
                        restaurantsMap[r.id] = {
                            id: r.id,
                            name: r.name,
                            phone_number: r.phone_number,
                            ownerId: r.owner_id,
                            currency: r.currency,
                            displayCurrencyMode: r.display_currency_mode,
                            exchangeRate: r.exchange_rate
                        };
                    });
                }
            }

            // Also check allRestaurants prop for fallback
            allRestaurants.forEach(r => {
                if (!restaurantsMap[r.id]) {
                    restaurantsMap[r.id] = r;
                }
            });

            const formattedOrders = allOrders.map((o: any) => {
                const restaurantData = restaurantsMap[o.restaurant_id];
                const firstItem = o.items && o.items.length > 0 ? o.items[0] : null;
                
                return {
                    id: o.id,
                    userId: o.user_id,
                    restaurantId: o.restaurant_id,
                    status: o.status,
                    totalAmount: o.total_amount,
                    isUrgent: firstItem?.isUrgent || false,
                    paymentMethod: firstItem?.paymentMethod || 'cash',
                    paymentNetwork: firstItem?.paymentNetwork,
                    paymentStatus: firstItem?.paymentStatus || 'pending',
                    deliveryLocation: firstItem?.deliveryLocation || o.delivery_location,
                    items: o.items,
                    exchangeRate: o.exchange_rate,
                    createdAt: o.created_at,
                    restaurant: {
                        id: restaurantData?.id,
                        name: restaurantData?.name || 'Inconnu',
                        phone_number: restaurantData?.phone_number,
                        ownerId: restaurantData?.ownerId,
                        latitude: restaurantData?.latitude,
                        longitude: restaurantData?.longitude,
                        currency: restaurantData?.currency || 'USD',
                        displayCurrencyMode: restaurantData?.displayCurrencyMode || 'dual'
                    }
                };
            });
            
            // Sort by created_at descending
            formattedOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            setOrders(formattedOrders);
        }
    } catch (err) {
        console.error("Error fetching orders:", err);
    }
  };

  const handleUrgentMode = async () => {
    if (urgentMode) {
      setUrgentMode(false);
      setUrgentRestaurant(null);
      return;
    }

    setUrgentMode(true);
    setIsSearchingUrgent(true);

    // Simulate searching for nearby restaurants
    setTimeout(() => {
      // Find the closest open restaurant with quick prep time
      const closest = restaurants
        .filter(r => r.isOpen && r.preparationTime <= 20)
        .sort((a, b) => (a.distance || Infinity) - (b.distance || Infinity))[0];

      setIsSearchingUrgent(false);
      
      if (closest) {
        setUrgentRestaurant(closest);
        setSelectedRestaurant(closest);
        // Don't navigate yet, show the "Found" overlay instead
      } else {
        toast.info("Aucun restaurant rapide trouvé à proximité !");
        setUrgentMode(false);
      }
    }, 2000);
  };

  // Filter Logic (City + Urgent + Search + Category + Sort + OpenNow)
  const filteredRestaurants = useMemo(() => {
    let list = restaurants;
    
    // Filter by active status and privacy
    list = list.filter(r => r.isActive !== false);
    
    if (selectedCity && selectedCity !== 'Toutes') {
        const normalizedSelectedCity = selectedCity.toLowerCase().trim();
        list = list.filter(r => r.city && r.city.toLowerCase().trim() === normalizedSelectedCity);
    }
    if (selectedCategory && selectedCategory !== 'Tous') {
        const normalizedCategory = selectedCategory.toLowerCase().trim();
        list = list.filter(r => r.type && r.type.toLowerCase().trim() === normalizedCategory);
    }
    if (urgentMode) list = list.filter(r => r.isOpen && r.preparationTime <= 20);
    if (openNow) list = list.filter(r => r.isOpen);
    
    if (searchQuery) {
        const query = searchQuery.toLowerCase();
        list = list.filter(r => 
          (r.name && r.name.toLowerCase().includes(query)) || 
          (r.description && r.description.toLowerCase().includes(query))
        );
    }

    // Sorting
    if (sortBy === 'rating') {
        list = [...list].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (sortBy === 'distance') {
        list = [...list].sort((a, b) => (a.distance || 0) - (b.distance || 0));
    } else if (sortBy === 'time') {
        list = [...list].sort((a, b) => (a.estimatedDeliveryTime || 0) - (b.estimatedDeliveryTime || 0));
    }

    return list;
  }, [restaurants, urgentMode, selectedCity, searchQuery, selectedCategory, sortBy, openNow]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCity, urgentMode, searchQuery, restaurants, selectedCategory, sortBy, openNow]);

  const paginatedRestaurants = useMemo(() => {
      const startIndex = (currentPage - 1) * itemsPerPage;
      return filteredRestaurants.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredRestaurants, currentPage]);

  const totalPages = Math.ceil(filteredRestaurants.length / itemsPerPage);

  // Cart Logic
  const addToCart = (item: MenuItem, restaurant: Restaurant) => {
    if (cart.length > 0 && cart[0].restaurantId !== restaurant.id) {
        setCartConflict({ item, restaurant });
        return;
    }
    setCart(prev => {
        const existing = prev.find(i => i.id === item.id);
        if (existing) return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
        return [...prev, { ...item, quantity: 1, restaurantId: restaurant.id, restaurantName: restaurant.name }];
    });
  };

  const clearAndAddToCart = () => {
    if (!cartConflict) return;
    const { item, restaurant } = cartConflict;
    setCart([{ ...item, quantity: 1, restaurantId: restaurant.id, restaurantName: restaurant.name }]);
    setCartConflict(null);
    toast.info(`Panier mis à jour avec ${item.name}`);
  };

  const removeFromCart = (itemId: string) => {
    setCart(prev => {
        const index = prev.findIndex(i => i.id === itemId);
        if (index > -1) {
            const newArr = [...prev];
            newArr.splice(index, 1);
            return newArr;
        }
        return prev;
    });
  };

  const updateQuantity = (itemId: string, newQuantity: number) => {
    setCart(prev => prev.map(item => 
      item.id === itemId ? { ...item, quantity: newQuantity } : item
    ));
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const handleCheckout = async (paymentMethod: PaymentMethod, network?: MobileMoneyNetwork, isUrgent?: boolean, paymentProof?: string, deliveryLocation?: { lat: number; lng: number; address: string }) => {
    console.log('handleCheckout started', { paymentMethod, isUrgent });
    if (user.role === 'guest') {
        toast.error(t('login_required_order'));
        onLogout(); // Redirect to login
        return;
    }
    if (cart.length === 0) return;
    setIsCheckingOut(true);

    // Add isUrgent flag, payment info, and customer info to the first item as a workaround for schema limitations
    const itemsWithUrgent = cart.map((item, index) => 
        index === 0 ? { 
            ...item, 
            isUrgent: isUrgent || false,
            paymentMethod: paymentMethod,
            paymentNetwork: network,
            paymentStatus: 'pending',
            paymentProof: paymentProof,
            customerName: user.name,
            customerPhone: user.phoneNumber,
            customerEmail: user.email,
            deliveryLocation: deliveryLocation
        } : item
    );

    try {
        console.log('Inserting order into Supabase...');
        const { data, error } = await supabase.from('orders').insert({
            user_id: user.id,
            restaurant_id: cart[0].restaurantId,
            status: 'pending',
            total_amount: cartTotal,
            exchange_rate: selectedRestaurant?.exchangeRate,
            items: itemsWithUrgent // Supabase will stringify this automatically for jsonb
        }).select().single();

        if (error) {
            console.warn("Erreur Supabase, sauvegarde locale:", error);
            const localOrders = JSON.parse(localStorage.getItem('dashmeals_mock_orders') || '[]');
            const newOrder = {
                id: 'mock-' + Date.now(),
                user_id: user.id,
                restaurant_id: cart[0].restaurantId,
                status: 'pending',
                total_amount: cartTotal,
                exchange_rate: selectedRestaurant?.exchangeRate,
                items: itemsWithUrgent,
                created_at: new Date().toISOString()
            };
            localOrders.push(newOrder);
            localStorage.setItem('dashmeals_mock_orders', JSON.stringify(localOrders));
        }

        console.log('Order created successfully, clearing cart...');
        // Success Path
        closeCart();
        setShowSuccess(true);
        setCart([]);
        
        // Send confirmation email
        if (user.email) {
          console.log('Sending confirmation email...');
          sendOrderConfirmationEmail({
            id: data?.id || 'mock-' + Date.now(),
            totalAmount: cartTotal,
            items: itemsWithUrgent
          }, user.email);
        }

        // Notify restaurant
        const restaurant = restaurants.find(r => r.id === cart[0].restaurantId);
        if (restaurant && restaurant.ownerId) {
          console.log('Notifying restaurant...');
          // 1. Database notification
          if (data?.id) {
            await supabase.from('notifications').insert({
              user_id: restaurant.ownerId,
              restaurant_id: restaurant.id,
              title: `Nouvelle commande #${data.id.slice(0, 4)}`,
              message: `Vous avez reçu une nouvelle commande de ${cartTotal} FC.`,
              type: 'new_order',
              data: { order_id: data.id }
            });
          }

          // 2. Email notification
          const { data: ownerProfile } = await supabase
            .from('profiles')
            .select('email')
            .eq('id', restaurant.ownerId)
            .single();
          
          if (ownerProfile?.email) {
            sendNewOrderNotificationToRestaurant({
              id: data?.id || 'mock-' + Date.now(),
              totalAmount: cartTotal,
              items: itemsWithUrgent
            }, ownerProfile.email, restaurant.name);
          }
        }

        // Redirection rapide vers l'historique pour voir le suivi
        setTimeout(() => {
             setShowSuccess(false);
             setViewMode('orders');
             // fetchOrders sera appelé par le useEffect du viewMode
        }, 2000);

    } catch (err: any) {
        console.error('Checkout Error:', err);
        toast.error(err.message || "Erreur inconnue lors de la commande.");
    } finally {
        setIsCheckingOut(false);
    }
  };

  // Views
  if (userState.loadingLocation) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-brand-50 dark:bg-gray-900">
        <div className="w-16 h-16 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-brand-800 dark:text-brand-400 font-medium">Localisation en cours...</p>
      </div>
    );
  }

  // Get list of restaurants that have promotions
  const handleOnboardingSubmit = async () => {
    if (!deliveryIdNumber) {
        toast.error("Veuillez entrer votre numéro de pièce d'identité.");
        return;
    }
    if ((deliveryVehicle === 'moto' || deliveryVehicle === 'voiture') && !deliveryLicensePlate) {
        toast.error("Veuillez entrer votre numéro de plaque d'immatriculation.");
        return;
    }

    if (!idCardFile) {
        toast.error("Veuillez sélectionner une photo de votre pièce d'identité.");
        return;
    }

    if ((deliveryVehicle === 'moto' || deliveryVehicle === 'voiture') && !licenseFile) {
        toast.error("Veuillez sélectionner une photo de votre permis de conduire.");
        return;
    }

    setIsSubmittingOnboarding(true);
    try {
        // Upload documents
        const uploadDoc = async (file: File, type: string) => {
            const fileExt = file.name.split('.').pop();
            const fileName = `${user.id}_${type}_${Date.now()}.${fileExt}`;
            const { error: uploadError } = await supabase.storage
                .from('images')
                .upload(`verifications/${fileName}`, file);
            
            if (uploadError) throw uploadError;
            
            const { data: { publicUrl } } = supabase.storage
                .from('images')
                .getPublicUrl(`verifications/${fileName}`);
            
            return publicUrl;
        };

        const idCardUrl = await uploadDoc(idCardFile, 'id_card');
        let licenseUrl = '';
        if (licenseFile) {
            licenseUrl = await uploadDoc(licenseFile, 'license');
        }

        const { error } = await supabase
            .from('profiles')
            .update({
                deliveryApplicationStatus: 'pending',
                deliveryInfo: {
                    vehicleType: deliveryVehicle,
                    idNumber: deliveryIdNumber,
                    licensePlate: deliveryLicensePlate,
                    idCardUrl,
                    licenseUrl,
                    isAvailable: false,
                    rating: 5,
                    completedOrders: 0
                }
            })
            .eq('id', user.id);

        if (error) throw error;

        toast.success("Votre demande a été envoyée avec succès !");
        setOnboardingStep(4);
    } catch (error) {
        console.error("Error submitting onboarding:", error);
        toast.error("Une erreur est survenue lors de l'envoi de votre demande.");
    } finally {
        setIsSubmittingOnboarding(false);
    }
  };

  const renderDeliveryOnboarding = () => {
    return (
        <div className="animate-in slide-in-from-right duration-300 pb-20">
            <button onClick={() => setViewMode('settings')} className="mb-4 flex items-center text-gray-600 dark:text-gray-300 font-medium hover:text-brand-600">
                <ArrowLeft size={18} className="mr-1" /> Retour
            </button>
            
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="bg-brand-600 p-8 text-white text-center relative">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                    <div className="relative z-10">
                        <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-md">
                            <Bike size={32} />
                        </div>
                        <h2 className="text-2xl font-black mb-2">Devenir Livreur</h2>
                        <p className="text-brand-100 text-sm">Étape {onboardingStep} sur 3</p>
                    </div>
                </div>

                <div className="p-6">
                    {onboardingStep === 1 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div>
                                <h3 className="font-black text-gray-900 dark:text-white text-lg mb-2">Quel est votre véhicule ?</h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Choisissez le moyen de transport que vous utiliserez pour vos livraisons.</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {[
                                    { id: 'moto', icon: <Bike size={24} />, label: 'Moto' },
                                    { id: 'velo', icon: <Bike size={24} />, label: 'Vélo' },
                                    { id: 'voiture', icon: <Car size={24} />, label: 'Voiture' },
                                    { id: 'pieton', icon: <Footprints size={24} />, label: 'À pied' }
                                ].map((v) => (
                                    <button
                                        key={v.id}
                                        onClick={() => setDeliveryVehicle(v.id as any)}
                                        className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center justify-center space-y-2 ${deliveryVehicle === v.id ? 'border-brand-600 bg-brand-50 dark:bg-brand-900/20 text-brand-600' : 'border-gray-100 dark:border-gray-700 text-gray-400 hover:border-brand-200'}`}
                                    >
                                        {v.icon}
                                        <span className="text-xs font-bold">{v.label}</span>
                                    </button>
                                ))}
                            </div>

                            <button 
                                onClick={() => setOnboardingStep(2)}
                                className="w-full py-4 bg-brand-600 text-white rounded-2xl font-black shadow-lg hover:bg-brand-700 transition-all flex items-center justify-center"
                            >
                                Continuer <ArrowRight size={18} className="ml-2" />
                            </button>
                        </div>
                    )}

                    {onboardingStep === 2 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div>
                                <h3 className="font-black text-gray-900 dark:text-white text-lg mb-2">Informations d'identité</h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Nous avons besoin de ces informations pour valider votre compte.</p>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1 block">Numéro de pièce d'identité (CNI/Passeport)</label>
                                    <div className="relative">
                                        <FileText className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                        <input 
                                            type="text"
                                            value={deliveryIdNumber}
                                            onChange={(e) => setDeliveryIdNumber(e.target.value)}
                                            placeholder="Ex: 123456789"
                                            className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:border-brand-500 text-sm"
                                        />
                                    </div>
                                </div>

                                {(deliveryVehicle === 'moto' || deliveryVehicle === 'voiture') && (
                                    <div>
                                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1 block">Numéro de plaque d'immatriculation</label>
                                        <div className="relative">
                                            <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                            <input 
                                                type="text"
                                                value={deliveryLicensePlate}
                                                onChange={(e) => setDeliveryLicensePlate(e.target.value)}
                                                placeholder="Ex: 1234AB01"
                                                className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:border-brand-500 text-sm"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-3">
                                <button 
                                    onClick={() => setOnboardingStep(1)}
                                    className="flex-1 py-4 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-2xl font-black"
                                >
                                    Retour
                                </button>
                                <button 
                                    onClick={() => setOnboardingStep(3)}
                                    className="flex-[2] py-4 bg-brand-600 text-white rounded-2xl font-black shadow-lg hover:bg-brand-700 transition-all"
                                >
                                    Continuer
                                </button>
                            </div>
                        </div>
                    )}

                    {onboardingStep === 3 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div>
                                <h3 className="font-black text-gray-900 dark:text-white text-lg mb-2">Documents & Validation</h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Prenez une photo de vos documents pour finaliser votre demande.</p>
                            </div>

                            <div className="space-y-3">
                                <input 
                                    type="file" 
                                    ref={idCardInputRef} 
                                    className="hidden" 
                                    accept="image/*" 
                                    onChange={(e) => setIdCardFile(e.target.files?.[0] || null)}
                                />
                                <input 
                                    type="file" 
                                    ref={licenseInputRef} 
                                    className="hidden" 
                                    accept="image/*" 
                                    onChange={(e) => setLicenseFile(e.target.files?.[0] || null)}
                                />

                                <div 
                                    onClick={async () => {
                                      if (isCapacitor) {
                                        const file = await pickImage({ asFile: true });
                                        if (file instanceof File) setIdCardFile(file);
                                      } else {
                                        idCardInputRef.current?.click();
                                      }
                                    }}
                                    className={`p-4 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer transition-all ${idCardFile ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-brand-300'}`}
                                >
                                    {idCardFile ? (
                                        <>
                                            <CheckCircle2 className="text-brand-600 mb-2" size={24} />
                                            <p className="text-xs font-bold text-brand-700 dark:text-brand-400">Pièce d'identité sélectionnée</p>
                                            <p className="text-[10px] text-brand-500 truncate max-w-full px-4">{idCardFile.name}</p>
                                        </>
                                    ) : (
                                        <>
                                            <Upload className="text-brand-600 mb-2" size={24} />
                                            <p className="text-xs font-bold text-gray-900 dark:text-white">Photo de la pièce d'identité</p>
                                            <p className="text-[10px] text-gray-500">Recto / Verso visible</p>
                                        </>
                                    )}
                                </div>

                                {(deliveryVehicle === 'moto' || deliveryVehicle === 'voiture') && (
                                    <div 
                                    onClick={async () => {
                                      if (isCapacitor) {
                                        const file = await pickImage({ asFile: true });
                                        if (file instanceof File) setLicenseFile(file);
                                      } else {
                                        licenseInputRef.current?.click();
                                      }
                                    }}
                                        className={`p-4 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer transition-all ${licenseFile ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-brand-300'}`}
                                    >
                                        {licenseFile ? (
                                            <>
                                                <CheckCircle2 className="text-brand-600 mb-2" size={24} />
                                                <p className="text-xs font-bold text-brand-700 dark:text-brand-400">Permis sélectionné</p>
                                                <p className="text-[10px] text-brand-500 truncate max-w-full px-4">{licenseFile.name}</p>
                                            </>
                                        ) : (
                                            <>
                                                <Upload className="text-brand-600 mb-2" size={24} />
                                                <p className="text-xs font-bold text-gray-900 dark:text-white">Permis de conduire</p>
                                                <p className="text-[10px] text-gray-500">En cours de validité</p>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-3">
                                <button 
                                    onClick={() => setOnboardingStep(2)}
                                    className="flex-1 py-4 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-2xl font-black"
                                >
                                    Retour
                                </button>
                                <button 
                                    onClick={handleOnboardingSubmit}
                                    disabled={isSubmittingOnboarding}
                                    className="flex-[2] py-4 bg-brand-600 text-white rounded-2xl font-black shadow-lg hover:bg-brand-700 transition-all disabled:opacity-50 flex items-center justify-center"
                                >
                                    {isSubmittingOnboarding ? 'Envoi en cours...' : 'Finaliser ma demande'}
                                </button>
                            </div>
                        </div>
                    )}

                    {onboardingStep === 4 && (
                        <div className="text-center py-8 space-y-6 animate-in zoom-in duration-500">
                            <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 text-green-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                                <CheckCircle size={40} />
                            </div>
                            <div>
                                <h3 className="font-black text-gray-900 dark:text-white text-xl mb-2">Demande Envoyée !</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                                    Votre dossier est en cours d'examen par notre équipe. Vous recevrez une notification dès que votre compte sera activé.
                                </p>
                            </div>
                            <button 
                                onClick={() => setViewMode('list')}
                                className="w-full py-4 bg-brand-600 text-white rounded-2xl font-black shadow-lg hover:bg-brand-700 transition-all"
                            >
                                Retour à l'accueil
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
  };

  const restaurantsWithStories = restaurants.filter(r => promotionsMap[r.id] && promotionsMap[r.id].length > 0 && !r.isVerified);
  
  // Get list of verified restaurants (Network Ads)
  const verifiedNetworkAds = allRestaurants.filter(r => r.isVerified);

  return (
    <div className="min-h-screen pb-20 max-w-md mx-auto bg-gray-50 dark:bg-gray-900 shadow-2xl relative transition-colors duration-300">
      
      {/* STORY VIEWER OVERLAY */}
      {activeStoryRestaurant && promotionsMap[activeStoryRestaurant.id] && (
          <StoryViewer 
            key={`${activeStoryRestaurant.id}-${storyStartIndex}`}
            restaurant={activeStoryRestaurant}
            promotions={promotionsMap[activeStoryRestaurant.id]}
            onClose={closeStory}
            onVisitRestaurant={() => {
                closeStory();
                setSelectedRestaurant(activeStoryRestaurant);
                setViewMode('restaurant_detail');
            }}
            initialIndex={storyStartIndex}
          />
      )}

      {/* CHAT OVERLAY */}
      {activeChatOrder && (
          <ChatWindow 
            orderId={activeChatOrder.id}
            currentUser={{ id: user.id, role: 'client', name: user.name }}
            otherUserId={activeChatOrder.restaurant?.ownerId || ''}
            otherUserName={activeChatOrder.restaurant?.name || 'Restaurant'}
            otherUserPhone={activeChatOrder.restaurant?.phone_number || '+243999999999'}
            restaurantId={activeChatOrder.restaurantId}
            onClose={closeChat}
          />
      )}

      {/* SUCCESS OVERLAY */}
      {showSuccess && (
        <div className="absolute inset-0 z-[60] bg-brand-500 flex flex-col items-center justify-center text-white p-6 text-center animate-fade-in">
           <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mb-6 shadow-xl">
              <ShoppingBag className="text-brand-500" size={40} />
           </div>
           <h2 className="text-3xl font-bold mb-2">{t('order_received')}</h2>
           <p className="text-brand-100">Votre repas est en préparation.</p>
           <div className="mt-8 bg-white/20 p-4 rounded-xl backdrop-blur-sm">
             <p className="font-mono text-sm">Redirection vers le suivi...</p>
           </div>
        </div>
      )}

      {/* URGENT MODE OVERLAY */}
      {isSearchingUrgent && (
        <div className="absolute inset-0 z-[70] bg-black/80 flex flex-col items-center justify-center text-white p-6 text-center backdrop-blur-sm">
           <div className="w-24 h-24 rounded-full border-4 border-red-500 border-t-transparent animate-spin mb-6"></div>
           <h2 className="text-2xl font-black mb-2 animate-pulse">Recherche Express...</h2>
           <p className="text-gray-300">Nous cherchons le restaurant le plus rapide autour de vous !</p>
        </div>
      )}

      {urgentRestaurant && urgentMode && (
         <div className="absolute inset-0 z-[70] bg-black/90 flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in duration-300">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl border-2 border-red-500 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500 animate-pulse"></div>
                
                <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Zap size={40} className="text-red-600 fill-red-600 animate-bounce" />
                </div>
                
                <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-1">Trouvé !</h2>
                <h3 className="text-xl font-bold text-brand-600 mb-4">{urgentRestaurant.name}</h3>
                
                <div className="flex justify-center space-x-4 mb-6 text-sm">
                    <span className="flex items-center text-gray-600 dark:text-gray-300 font-bold bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-lg">
                        <Navigation size={14} className="mr-1"/> {formatDistance(urgentRestaurant.distance || 0)}
                    </span>
                    <span className="flex items-center text-red-600 font-bold bg-red-50 dark:bg-red-900/20 px-3 py-1 rounded-lg">
                        <Clock size={14} className="mr-1"/> ~{urgentRestaurant.preparationTime} min
                    </span>
                </div>

                <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
                    Ce restaurant est ouvert et peut préparer votre commande rapidement. Voulez-vous voir le menu ?
                </p>

                <div className="space-y-3">
                    <button 
                        onClick={() => {
                            setUrgentRestaurant(null);
                            navigateTo('restaurant_detail');
                        }}
                        className="w-full bg-red-600 text-white font-bold py-3 rounded-xl hover:bg-red-700 shadow-lg shadow-red-500/30 transition-transform active:scale-95"
                    >
                        {t('checkout').toUpperCase()} ⚡
                    </button>
                    <button 
                        onClick={() => {
                            setUrgentMode(false);
                            setUrgentRestaurant(null);
                        }}
                        className="w-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-bold py-3 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600"
                    >
                        Annuler
                    </button>
                </div>
            </div>
         </div>
      )}

      {/* HEADER */}
      <header className="sticky top-0 z-50 glass px-6 py-4 flex flex-col space-y-4 shadow-sm border-b border-gray-100 dark:border-white/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-brand-600 p-2 rounded-2xl shadow-lg rotate-3 group-hover:rotate-0 transition-transform duration-500">
               <img src={APP_LOGO_URL} alt="Logo" className="h-6 w-auto" />
            </div>
            <div>
              <h1 className="text-xl font-display font-black text-gray-900 dark:text-white tracking-tight uppercase italic leading-none">DashMeals</h1>
              <div className="flex items-center mt-1 space-x-2">
                <p className="text-[9px] font-black text-brand-600 dark:text-brand-400 uppercase tracking-[0.2em]">Kinshasa Food</p>
                {user.id === 'guest' ? (
                  <span className="flex items-center text-[9px] font-black text-amber-500 uppercase tracking-widest animate-in fade-in slide-in-from-left-2">
                    <span className="mx-1 opacity-30">•</span>
                    MODE INVITÉ
                  </span>
                ) : (
                  <span className="flex items-center text-[9px] font-black text-emerald-500 uppercase tracking-widest animate-in fade-in slide-in-from-left-2">
                    <span className="mx-1 opacity-30">•</span>
                    {user.name}
                    <span className="ml-2 w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" title="En ligne"></span>
                  </span>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <button onClick={() => setShowNotifications(true)} className="relative p-2.5 bg-gray-50 dark:bg-white/5 rounded-2xl text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-white/10 shadow-sm border border-gray-100 dark:border-white/5 transition-all active:scale-90">
                <Bell size={18} />
                {unreadCount > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-black h-4 w-4 flex items-center justify-center rounded-full border-2 border-white dark:border-gray-900 shadow-md">{unreadCount}</span>}
            </button>
            <button onClick={openCart} className="relative p-2.5 bg-gray-50 dark:bg-white/5 rounded-2xl text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-white/10 shadow-sm border border-gray-100 dark:border-white/5 transition-all active:scale-90">
                <ShoppingBag size={18} />
                {cart.length > 0 && <span className="absolute -top-1 -right-1 bg-brand-500 text-white text-[9px] font-black h-4 w-4 flex items-center justify-center rounded-full border-2 border-white dark:border-gray-900 shadow-md">{cart.length}</span>}
            </button>
            <div className="h-8 w-px bg-gray-100 dark:bg-white/10 mx-1"></div>
            <button onClick={() => navigateTo('settings')} className="p-2.5 text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors active:rotate-45 duration-500">
                <Settings size={20} />
            </button>
          </div>
        </div>
        
        {(viewMode === 'list' || viewMode === 'map') && (
            <div className="flex items-center space-x-3">
                <div className="flex-1 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-white/5 py-2.5 px-4 rounded-2xl border border-gray-100 dark:border-white/5 shadow-inner">
                  <div className="flex items-center truncate">
                    <MapPin size={12} className={`mr-2 flex-shrink-0 ${userState.locationError ? 'text-gray-400' : 'text-brand-500 animate-pulse'}`} />
                    <span className="truncate font-bold uppercase tracking-tight text-[10px]">
                      {userState.loadingLocation ? "Détection..." : userState.locationError ? "Kinshasa (Défaut)" : (detectedAddress || "Ma Position GPS")}
                    </span>
                  </div>
                  <button onClick={refreshLocation} className="ml-2 p-1.5 bg-white dark:bg-white/10 rounded-xl shadow-sm hover:shadow-md transition-all active:scale-90" title="Actualiser ma position">
                    <Navigation size={10} className={`text-brand-600 dark:text-brand-400 ${userState.loadingLocation ? 'animate-spin' : ''}`} />
                  </button>
                </div>
                <div className="relative">
                    <select className="bg-brand-50/50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-400 text-[10px] font-black py-2.5 pl-4 pr-10 rounded-2xl border border-brand-100 dark:border-brand-900/30 outline-none appearance-none cursor-pointer hover:bg-white dark:hover:bg-white/5 shadow-sm transition-all uppercase tracking-tighter" value={selectedCity} onChange={(e) => setSelectedCity(e.target.value)}>
                      <option value="Toutes">VILLES</option>
                      {CITIES_RDC.map(city => <option key={city} value={city}>{city}</option>)}
                    </select>
                    <ChevronRight className="absolute right-3 top-1/2 transform -translate-y-1/2 text-brand-500 pointer-events-none rotate-90" size={10} />
                </div>
            </div>
        )}
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 overflow-y-auto p-4 pt-2 pb-24">
        
        {viewMode === 'list' || viewMode === 'map' ? (
            <>
                {/* SEARCH BAR */}
                <div className="mb-6 flex items-center space-x-3 relative z-20">
                    <div className="flex-1 relative group">
                        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 group-focus-within:text-brand-500 transition-colors" size={20} />
                        <input 
                            type="text"
                            placeholder={activeTab === 'restaurants' ? "Rechercher un établissement..." : "Rechercher un plat..."}
                            className="w-full pl-12 pr-12 py-4 rounded-2xl border border-gray-200 dark:border-white/10 focus:ring-4 focus:ring-brand-500/10 outline-none text-sm bg-white dark:bg-white/5 text-gray-900 dark:text-white shadow-sm transition-all focus:shadow-xl font-medium"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                          <button 
                            onClick={() => setSearchQuery('')} 
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                          >
                            <X size={16} />
                          </button>
                        )}
                    </div>
                </div>

                {/* VIEW TOGGLE (Restaurants vs Plats) */}
                {!searchQuery && (
                    <div className="flex bg-gray-100/50 dark:bg-white/5 p-1.5 rounded-[22px] mb-10 shadow-inner border border-gray-200/50 dark:border-white/5 backdrop-blur-sm">
                        <button 
                            onClick={() => setActiveTab('restaurants')}
                            className={`flex-1 flex items-center justify-center py-3.5 text-[10px] font-black rounded-2xl transition-all duration-500 uppercase tracking-widest ${activeTab === 'restaurants' ? 'bg-white dark:bg-gray-800 text-brand-600 dark:text-brand-400 shadow-xl shadow-brand-500/10 transform scale-[1.02] border border-gray-100 dark:border-white/5' : 'text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                        >
                            Établissements
                        </button>
                        <button 
                            onClick={() => setActiveTab('items')}
                            className={`flex-1 flex items-center justify-center py-3.5 text-[10px] font-black rounded-2xl transition-all duration-500 uppercase tracking-widest ${activeTab === 'items' ? 'bg-white dark:bg-gray-800 text-brand-600 dark:text-brand-400 shadow-xl shadow-brand-500/10 transform scale-[1.02] border border-gray-100 dark:border-white/5' : 'text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                        >
                            Carte Menu
                        </button>
                    </div>
                )}

                {/* RE-ORDER SECTION (If history exists) */}
                {!searchQuery && activeTab === 'restaurants' && recentOrderedItems.length > 0 && (
                    <div className="mb-8 animate-in slide-in-from-left duration-700">
                        <h2 className="text-lg font-black text-gray-900 dark:text-white tracking-tight mb-4 flex items-center">
                            <Clock className="text-brand-600 mr-2" size={18} />
                            Commandez à nouveau
                        </h2>
                        <div className="flex overflow-x-auto no-scrollbar space-x-3 pb-2">
                            {recentOrderedItems.map(item => (
                                <div 
                                    key={item.id}
                                    onClick={() => { setSelectedRestaurant(item.restaurant); navigateTo('restaurant_detail'); }}
                                    className="flex-shrink-0 w-36 bg-white dark:bg-gray-800 rounded-2xl p-2 border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-all cursor-pointer"
                                >
                                    <img src={item.image} className="w-full h-24 object-cover rounded-xl mb-2" alt={item.name} />
                                    <h4 className="text-[10px] font-black text-gray-900 dark:text-white truncate mb-0.5">{item.name}</h4>
                                    <p className="text-[8px] text-gray-400 truncate mb-1.5">{item.restaurant.name}</p>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-bold text-brand-600">{item.restaurant.currency === 'CDF' ? `${item.price} FC` : `$${item.price}`}</span>
                                        <div className="flex items-center space-x-1">
                                            {cart.find(c => c.id === item.id) && (
                                                <span className="text-[10px] font-black text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded-md">x{cart.find(c => c.id === item.id)?.quantity}</span>
                                            )}
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); addToCart(item, item.restaurant); }}
                                                className="p-1 bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 rounded-lg hover:bg-brand-100 transition-colors active:scale-90"
                                            >
                                                <Plus size={14} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* MARKETING CAMPAIGN BANNER */}
                {!searchQuery && Object.values(promotionsMap).flat().length > 0 && (
                    <div className="mb-6 -mx-4 px-4">
                        <div className="bg-gradient-to-r from-orange-600 to-red-600 rounded-2xl p-0.5 shadow-lg shadow-orange-500/20 overflow-hidden">
                            <div className="bg-white dark:bg-gray-900 rounded-[14px] overflow-hidden relative">
                                <div className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar">
                                    {(Object.values(promotionsMap).flat() as Promotion[]).slice(0, 5).map((promo, idx) => {
                                        const resto = restaurants.find(r => r.id === promo.restaurantId);
                                        if (!resto) return null;
                                        return (
                                            <div 
                                                key={promo.id} 
                                                className="snap-center shrink-0 w-full flex items-center p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                                                onClick={() => {
                                                    setSelectedRestaurant(resto);
                                                    navigateTo('restaurant_detail');
                                                }}
                                            >
                                                <div className="relative w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 border-2 border-orange-100 dark:border-orange-900/30">
                                                    <img 
                                                        src={promo.mediaUrl} 
                                                        alt={promo.caption} 
                                                        className="w-full h-full object-cover"
                                                        referrerPolicy="no-referrer"
                                                    />
                                                    <div className="absolute inset-0 bg-black/10"></div>
                                                </div>
                                                <div className="ml-4 flex-1">
                                                    <div className="flex items-center gap-1.5 mb-1">
                                                        <span className="text-[10px] font-black bg-orange-500 text-white px-2 py-0.5 rounded-full uppercase tracking-wider">PROMO</span>
                                                        <span className="text-xs font-bold text-gray-400 dark:text-gray-500">• {resto.name}</span>
                                                    </div>
                                                    <h4 className="font-black text-gray-900 dark:text-white line-clamp-1 text-sm leading-tight uppercase italic tracking-tight">
                                                        {promo.caption || "Offre exceptionnelle !"}
                                                    </h4>
                                                    <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-1 mt-0.5">
                                                        Cliquez pour découvrir les délices de {resto.name}
                                                    </p>
                                                </div>
                                                <ChevronRight className="text-orange-500 ml-2" size={20} />
                                            </div>
                                        );
                                    })}
                                </div>
                                {/* Animated progress bar */}
                                <div className="absolute bottom-0 left-0 h-1 bg-orange-500/30 w-full">
                                    <div className="h-full bg-orange-500 animate-progress"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* NEARBY EXPLORATION SECTION - MOVED HIGHER FOR VISIBILITY */}
                {!searchQuery && nearbyRestaurants.length > 0 && (
                    <div className="mb-10 relative animate-in fade-in slide-in-from-right duration-1000">
                        <div className="flex items-center justify-between mb-5">
                            <div>
                                <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tighter flex items-center italic">
                                    <MapPin className="text-brand-600 mr-2" size={28} />
                                    EXPLOREZ À PIED
                                </h2>
                                <p className="text-[11px] uppercase font-black text-brand-500 dark:text-brand-400 tracking-[0.2em] mt-0.5 flex items-center">
                                    <Bike size={12} className="mr-1.5" /> À MOINS DE 3KM DE VOUS
                                </p>
                            </div>
                            <button 
                                onClick={() => {
                                    setSortBy('distance');
                                    const listEl = document.getElementById('restaurants-main-list');
                                    if (listEl) listEl.scrollIntoView({ behavior: 'smooth' });
                                }}
                                className="text-[10px] font-black text-white bg-black dark:bg-gray-700 px-4 py-2 rounded-xl hover:bg-brand-600 transition-all uppercase tracking-widest shadow-lg shadow-black/10 active:scale-95"
                            >
                                Voir tout
                            </button>
                        </div>

                        <div className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar space-x-4 -mx-4 px-4 pb-2">
                            {nearbyRestaurants.map(r => (
                                <div 
                                    key={r.id}
                                    onClick={() => { setSelectedRestaurant(r); navigateTo('restaurant_detail'); }}
                                    className="snap-center shrink-0 w-[240px] bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-all group"
                                >
                                    {/* Small Cover Image with Stats */}
                                    <div className="relative h-28 overflow-hidden">
                                        <img src={r.coverImage} alt={r.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"></div>
                                        <div className="absolute top-2 right-2">
                                            <div className="flex items-center space-x-1 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md px-1.5 py-0.5 rounded-md shadow-sm">
                                                <Star size={10} className="fill-amber-400 text-amber-400" />
                                                <span className="text-[10px] font-black text-gray-800 dark:text-white">{r.rating || 4.5}</span>
                                            </div>
                                        </div>
                                        <div className="absolute bottom-2 left-2 flex items-center gap-2">
                                            <span className="flex items-center bg-brand-500 text-white text-[10px] font-black px-2 py-0.5 rounded-md shadow-lg border border-white/20">
                                                <Footprints size={10} className="mr-1" /> {r.timeWalking ? formatTime(r.timeWalking) : '--'}
                                            </span>
                                            <span className="flex items-center bg-black/40 backdrop-blur-md text-white text-[10px] font-bold px-2 py-0.5 rounded-md border border-white/10">
                                                {formatDistance(r.distance || 0)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Content with Mini Menu */}
                                    <div className="p-3">
                                        <h3 className="font-black text-gray-900 dark:text-white text-sm truncate mb-2">{r.name}</h3>
                                        
                                        {/* Mini Menu (2 items) */}
                                        <div className="space-y-1.5 mb-2">
                                            {r.menu?.slice(0, 2).map(item => (
                                                <div key={item.id} className="flex items-center justify-between">
                                                    <span className="text-[10px] text-gray-500 dark:text-gray-400 truncate max-w-[140px] italic">{item.name}</span>
                                                    <span className="text-[10px] font-bold text-brand-600">{r.currency === 'CDF' ? `${item.price} FC` : `$${item.price}`}</span>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="pt-2 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                                            <div className="flex items-center text-[10px] text-gray-400 font-bold">
                                                <Zap size={10} className="mr-1 text-yellow-500 fill-yellow-500" />
                                                {r.preparationTime} min
                                            </div>
                                            <button className="text-[10px] font-black text-brand-600 bg-brand-50 dark:bg-brand-900/30 px-2 py-1 rounded-md">
                                                COMMANDER
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* FILTERS & SORTING */}
                <div className="mb-6 flex flex-col space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">Catégories</h3>
                        <div className="relative">
                            <select 
                                className="bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-medium py-1.5 pl-8 pr-8 rounded-lg border border-gray-200 dark:border-gray-700 outline-none appearance-none cursor-pointer shadow-sm focus:ring-2 focus:ring-brand-500"
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                            >
                                <option value="relevance">Pertinence</option>
                                <option value="rating">Mieux notés</option>
                                <option value="distance">Plus proches</option>
                                <option value="time">Livraison rapide</option>
                            </select>
                            <List className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
                            <ChevronRight className="absolute right-2.5 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none rotate-90" size={14} />
                        </div>
                    </div>
                    <div className="flex space-x-2 overflow-x-auto no-scrollbar pb-1 -mx-4 px-4">
                        <button
                            onClick={() => setOpenNow(!openNow)}
                            className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-bold transition-all shadow-sm border flex items-center ${
                                openNow 
                                ? 'bg-emerald-500 text-white border-emerald-500' 
                                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                            }`}
                        >
                            <Clock size={14} className="mr-1.5" /> Ouvert
                        </button>
                        <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 my-auto mx-1"></div>
                        {['Tous', 'Restaurant', 'Snack', 'Bar', 'Terrasse'].map((cat) => (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-bold transition-all shadow-sm border ${
                                    selectedCategory === cat 
                                    ? 'bg-brand-500 text-white border-brand-500' 
                                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                                }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>

                {/* FEATURED RESTAURANTS CAROUSEL (Verified Restaurants) - Hidden during search */}
                {!searchQuery && verifiedNetworkAds.length > 0 && (
                    <div className="mb-8 relative">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-lg font-black text-gray-900 dark:text-white tracking-tight flex items-center">
                                <Star className="text-yellow-500 mr-1.5" size={18} fill="currentColor" />
                                Sélection Premium
                            </h2>
                            <span className="text-[10px] font-bold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/30 px-2 py-1 rounded-md uppercase tracking-wider">Sponsorisé</span>
                        </div>
                        <div ref={carouselRef} className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar space-x-4 pb-4 -mx-4 px-4">
                            {verifiedNetworkAds.map(r => (
                                <div 
                                    key={r.id}
                                    onClick={() => { setSelectedRestaurant(r); navigateTo('restaurant_detail'); }}
                                    className="snap-center shrink-0 w-[90vw] sm:w-[500px] relative rounded-2xl overflow-hidden shadow-xl cursor-pointer group border border-gray-100 dark:border-gray-700"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent z-10"></div>
                                    <img src={r.coverImage} alt={r.name} className="w-full h-56 sm:h-64 object-cover group-hover:scale-105 transition-transform duration-700" />
                                    
                                    <div className="absolute top-4 left-4 z-20 flex gap-2">
                                        <span className="bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-lg shadow-lg flex items-center border border-white/20">
                                            <Star size={12} className="mr-1.5 fill-white" /> Premium
                                        </span>
                                        {subscribedRestaurants.includes(r.id) && (
                                            <span className="bg-brand-500/90 backdrop-blur-md text-white text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-lg shadow-lg flex items-center border border-white/20">
                                                <Bell size={12} className="mr-1.5 fill-white" /> Abonné
                                            </span>
                                        )}
                                    </div>
                                    
                                    <div className="absolute top-4 right-4 z-20">
                                        <button 
                                            disabled={isSubscribing === r.id}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleSubscription(r.id);
                                            }}
                                            className={`p-2 rounded-full shadow-lg backdrop-blur-md border transition-colors ${
                                                isSubscribing === r.id ? 'opacity-50 cursor-not-allowed' : ''
                                            } ${
                                                subscribedRestaurants.includes(r.id)
                                                ? 'bg-white/20 border-white/30 text-white'
                                                : 'bg-white border-white text-brand-600 hover:bg-brand-50'
                                            }`}
                                        >
                                            <Bell size={18} className={`${subscribedRestaurants.includes(r.id) ? 'fill-white' : ''} ${isSubscribing === r.id ? 'animate-spin' : ''}`} />
                                        </button>
                                    </div>

                                    <div className="absolute bottom-0 left-0 right-0 p-5 z-20">
                                        <h3 className="text-2xl font-black text-white mb-1.5 drop-shadow-lg">{r.name}</h3>
                                        <p className="text-gray-200 text-sm line-clamp-2 mb-4 drop-shadow-md">{r.description}</p>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center space-x-3 text-white/90 text-sm font-bold">
                                                <span className="flex items-center bg-black/40 backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-white/10"><Star size={14} className="text-amber-400 fill-amber-400 mr-1.5" /> {r.rating}</span>
                                                <span className="flex items-center bg-black/40 backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-white/10"><Clock size={14} className="mr-1.5" /> {r.estimatedDeliveryTime} min</span>
                                            </div>
                                            <button className="bg-brand-500 hover:bg-brand-600 text-white text-sm font-black px-5 py-2.5 rounded-xl shadow-lg transition-colors flex items-center">
                                                Commander <ChevronRight size={16} className="ml-1" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* STORIES BAR - Hidden during search */}
                {!searchQuery && restaurantsWithStories.length > 0 && (
                    <div className="mb-6 -mx-4 px-4 overflow-x-auto no-scrollbar">
                        <div className="flex space-x-4">
                            {restaurantsWithStories.map(r => (
                                <button 
                                    key={r.id} 
                                    onClick={() => {
                                        setStoryStartIndex(0);
                                        setActiveStoryRestaurant(r);
                                    }}
                                    className="flex flex-col items-center space-y-1 min-w-[64px]"
                                >
                                    <div className="w-16 h-16 rounded-full p-[2px] bg-gradient-to-tr from-brand-500 to-yellow-500">
                                        <div className="w-full h-full rounded-full border-2 border-white dark:border-gray-800 overflow-hidden">
                                            <img src={r.coverImage} className="w-full h-full object-cover" alt={r.name} />
                                        </div>
                                    </div>
                                    <span className="text-[10px] font-medium text-gray-600 dark:text-gray-300 truncate w-full text-center">{r.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}


                {/* FILTERS */}
                <div className="flex space-x-3 mb-6 overflow-x-auto no-scrollbar pb-1">
                    <button 
                        onClick={handleUrgentMode}
                        className={`flex items-center px-4 py-2 rounded-full font-bold text-sm shadow-sm transition-all border whitespace-nowrap ${urgentMode ? 'bg-brand-600 text-white border-brand-600 animate-pulse-fast' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700'}`}
                    >
                        <Zap size={16} className={`mr-1 ${urgentMode ? 'fill-white' : 'fill-none'}`} />
                        Urgent - J'ai faim !
                    </button>
                    <button className="px-4 py-2 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 font-medium text-sm whitespace-nowrap shadow-sm">🍖 Grillades</button>
                    <button className="px-4 py-2 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 font-medium text-sm whitespace-nowrap shadow-sm">🍗 Poulet</button>
                </div>

                {/* CONTENT */}
                {viewMode === 'list' && activeTab === 'restaurants' ? (
                    <div id="restaurants-main-list" className="space-y-8">
                        {paginatedRestaurants.length > 0 ? (
                            paginatedRestaurants.map(restaurant => (
                                <RestaurantCard 
                                    key={restaurant.id} 
                                    restaurant={restaurant} 
                                    onClick={() => { setSelectedRestaurant(restaurant); navigateTo('restaurant_detail'); }} 
                                    promotionsCount={promotionsMap[restaurant.id]?.length || 0}
                                    isSubscribed={subscribedRestaurants.includes(restaurant.id)}
                                    onSubscribe={(e) => {
                                        e.stopPropagation();
                                        toggleSubscription(restaurant.id);
                                    }}
                                    isSubscribing={isSubscribing === restaurant.id}
                                />
                            ))
                        ) : (
                            <div className="text-center py-20 px-10 animate-in fade-in zoom-in duration-700">
                                <div className="bg-gray-100 dark:bg-white/5 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <Search size={40} className="text-gray-300 dark:text-gray-600" />
                                </div>
                                <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2 uppercase tracking-tight">Oups ! Rien trouvé</h3>
                                <p className="text-sm text-gray-400 dark:text-gray-500 max-w-[200px] mx-auto">Nous n'avons trouvé aucun établissement correspondant à votre recherche.</p>
                                <button 
                                    onClick={() => setSearchQuery('')}
                                    className="mt-8 text-brand-600 font-black text-xs uppercase tracking-[0.2em] hover:opacity-80 transition-opacity"
                                >
                                    Tout réinitialiser
                                </button>
                            </div>
                        )}

                        {/* Pagination Controls */}
                        {totalPages > 1 && (
                            <div className="flex justify-center items-center space-x-4 py-4">
                                <button 
                                    onClick={() => {
                                        setCurrentPage(p => Math.max(1, p - 1));
                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                    }}
                                    disabled={currentPage === 1}
                                    className="px-4 py-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 disabled:opacity-50 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                >
                                    Précédent
                                </button>
                                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                    Page {currentPage} / {totalPages}
                                </span>
                                <button 
                                    onClick={() => {
                                        setCurrentPage(p => Math.min(totalPages, p + 1));
                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                    }}
                                    disabled={currentPage === totalPages}
                                    className="px-4 py-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 disabled:opacity-50 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                >
                                    Suivant
                                </button>
                            </div>
                        )}

                        {filteredRestaurants.length === 0 && (
                            <div className="text-center py-16 px-4 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                                <div className="bg-gray-100 dark:bg-gray-700 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Search size={24} className="text-gray-400" />
                                </div>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Aucun résultat trouvé</h3>
                                <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-sm mx-auto">
                                    Nous n'avons trouvé aucun établissement correspondant à vos critères {selectedCity !== 'Toutes' ? `à ${selectedCity}` : ''} {searchQuery ? `pour "${searchQuery}"` : ''}.
                                </p>
                            </div>
                        )}
                    </div>
                ) : viewMode === 'list' && activeTab === 'items' ? (
                    <div className="animate-in fade-in slide-in-from-bottom-8 duration-1000">
                        <div className="grid grid-cols-2 gap-5">
                            {(searchQuery 
                                ? discoverableItems.filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()) || item.restaurant.name.toLowerCase().includes(searchQuery.toLowerCase()))
                                : discoverableItems).map(item => (
                                <div 
                                    key={`${item.restaurant.id}-${item.id}`}
                                    className="glass rounded-[32px] overflow-hidden shadow-sm border border-white/40 dark:border-white/5 flex flex-col group hover:shadow-2xl hover:border-brand-500/30 transition-all duration-700 active:scale-[0.98] transform hover:-translate-y-2"
                                >
                                    <div className="relative h-40 sm:h-48 overflow-hidden">
                                        <img src={item.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" alt={item.name} />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-80 group-hover:opacity-40 transition-opacity duration-700"></div>
                                        <div className="absolute bottom-4 left-4 right-4">
                                            <p className="text-[9px] font-black text-white/90 uppercase drop-shadow-2xl truncate tracking-widest">{item.restaurant.name}</p>
                                        </div>
                                        <div className="absolute top-4 right-4">
                                            <div className="bg-black/40 backdrop-blur-xl px-3 py-1.5 rounded-2xl text-[11px] font-black text-white shadow-2xl border border-white/20 whitespace-nowrap">
                                                {formatDualPrice(item.price, item.restaurant.currency as 'USD' | 'CDF', item.restaurant.exchangeRate, item.restaurant.displayCurrencyMode)}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="p-5 flex-1 flex flex-col bg-white/50 dark:bg-black/20">
                                        <div className="flex-1 mb-4">
                                            <h4 className="text-[15px] font-display font-black text-gray-900 dark:text-white line-clamp-2 mb-1.5 uppercase tracking-tight leading-tight italic">{item.name}</h4>
                                            <p className="text-[10px] text-gray-400 dark:text-white/40 font-medium line-clamp-2 leading-relaxed">{item.description || "Une création signature par nos chefs."}</p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {cart.find(c => c.id === item.id) && (
                                                <div className="flex items-center bg-brand-600 text-white rounded-2xl px-3.5 py-2.5 shadow-lg shadow-brand-500/20">
                                                    <span className="text-xs font-black">x{cart.find(c => c.id === item.id)?.quantity}</span>
                                                </div>
                                            )}
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); addToCart(item, item.restaurant); }}
                                                className="flex-1 bg-brand-500 hover:bg-brand-600 text-white font-black py-3 rounded-2xl shadow-xl shadow-brand-500/20 transition-all flex items-center justify-center gap-2 text-[10px] uppercase tracking-widest active:scale-95 group/btn"
                                            >
                                                <Plus size={14} strokeWidth={4} className="group-hover/btn:rotate-90 transition-transform" /> {cart.find(c => c.id === item.id) ? 'AJOUTER' : 'COMMANDER'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {discoverableItems.length === 0 && (
                            <div className="text-center py-12">
                                <p className="text-gray-400 italic">Aucun plat disponible pour le moment.</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <MapView 
                        restaurants={filteredRestaurants} 
                        userLocation={userState.location} 
                        onSelect={(r) => { setSelectedRestaurant(r); navigateTo('restaurant_detail'); }}
                        onLocationChange={(loc) => setUserState(prev => ({ ...prev, location: loc, locationError: null }))}
                    />
                )}
            </>
        ) : viewMode === 'restaurant_detail' && selectedRestaurant ? (
            <div className="animate-in slide-in-from-right duration-300">
                <button onClick={() => window.history.back()} className="mb-4 flex items-center text-gray-600 dark:text-gray-300 font-medium hover:text-brand-600"><ArrowLeft size={18} className="mr-1" /> Retour</button>
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden mb-6">
                    <img src={selectedRestaurant.coverImage} className="w-full h-48 object-cover" alt="Cover" />
                    <div className="p-4">
                        <div className="flex justify-between items-start">
                           <div className="flex items-center flex-wrap gap-2">
                               <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{selectedRestaurant.name}</h1>
                               {selectedRestaurant.isVerified && (
                                   <span className="bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-md shadow-sm flex items-center">
                                       <Star size={10} className="mr-1 fill-white" /> Premium
                                   </span>
                               )}
                           </div>
                           <div className="flex flex-col items-end space-y-1">
                               <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded-lg font-medium">{selectedRestaurant.city}</span>
                               {selectedRestaurant.type && (
                                   <span className="text-[10px] bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">{selectedRestaurant.type}</span>
                               )}
                           </div>
                        </div>
                        <p className="text-gray-500 dark:text-gray-400 mb-4 mt-2">{selectedRestaurant.description}</p>
                        
                        {/* Action Buttons */}
                        <div className="flex items-center gap-3 mb-6">
                            <button 
                                disabled={isSubscribing === selectedRestaurant.id}
                                onClick={() => toggleSubscription(selectedRestaurant.id)}
                                className={`flex-1 flex items-center justify-center px-4 py-3 rounded-xl text-sm font-black transition-all shadow-md ${
                                    isSubscribing === selectedRestaurant.id ? 'opacity-50 cursor-not-allowed' : ''
                                } ${
                                    subscribedRestaurants.includes(selectedRestaurant.id)
                                    ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600'
                                    : 'bg-gradient-to-r from-brand-500 to-brand-600 text-white hover:from-brand-600 hover:to-brand-700 animate-pulse'
                                }`}
                            >
                                <Bell size={20} className={`mr-2 ${subscribedRestaurants.includes(selectedRestaurant.id) ? 'fill-gray-400' : ''} ${isSubscribing === selectedRestaurant.id ? 'animate-spin' : ''}`} />
                                {isSubscribing === selectedRestaurant.id ? 'Traitement...' : (subscribedRestaurants.includes(selectedRestaurant.id) ? 'Abonné aux offres' : "S'abonner aux offres")}
                            </button>

                            {subscribedRestaurants.includes(selectedRestaurant.id) && (
                                <button 
                                    onClick={() => {
                                        setActiveChatOrder({
                                            id: `sub-${user.id}-${selectedRestaurant.id}`,
                                            userId: user.id,
                                            restaurantId: selectedRestaurant.id,
                                            status: 'completed',
                                            paymentMethod: 'cash',
                                            paymentStatus: 'paid',
                                            totalAmount: 0,
                                            items: [],
                                            createdAt: new Date().toISOString(),
                                            restaurant: selectedRestaurant
                                        } as any);
                                    }}
                                    className="p-3 bg-blue-500 text-white rounded-xl shadow-md hover:bg-blue-600 transition-all flex items-center justify-center"
                                    title="Discuter avec le restaurant"
                                >
                                    <MessageSquare size={20} />
                                </button>
                            )}
                        </div>
                        
                        {/* Info & Contact Section */}
                        <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-xl mb-4 border border-gray-100 dark:border-gray-700">
                            <h3 className="text-sm font-bold text-gray-800 dark:text-white mb-3 flex items-center"><Info size={16} className="mr-2 text-brand-600"/> Informations & Contact</h3>
                            <div className="space-y-2">
                                <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                                    <MapPin size={16} className="mr-2 text-gray-400"/>
                                    <span>{selectedRestaurant.city || 'Kinshasa'}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                                        <Phone size={16} className="mr-2 text-gray-400"/>
                                        <span>{selectedRestaurant.phoneNumber || 'Numéro non disponible'}</span>
                                    </div>
                                    {selectedRestaurant.phoneNumber && (
                                        <button 
                                            onClick={() => window.open(`tel:${selectedRestaurant.phoneNumber}`)}
                                            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center shadow-md transition-transform active:scale-95"
                                        >
                                            <Phone size={14} className="mr-1"/> Appeler
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Loyalty Section */}
                        {user.role !== 'guest' && (
                            <div className="mt-6 p-5 bg-gradient-to-br from-brand-600 to-brand-800 rounded-2xl text-white shadow-lg relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                                <div className="relative z-10">
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="font-black text-sm flex items-center">
                                            <Star size={18} className="mr-2 text-yellow-400 fill-yellow-400" />
                                            Fidélité {selectedRestaurant.name}
                                        </h3>
                                        <span className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                                            {loyaltyPoints[selectedRestaurant.id] || 0} Points
                                        </span>
                                    </div>
                                    
                                    {loyaltyRewards[selectedRestaurant.id] && loyaltyRewards[selectedRestaurant.id].length > 0 ? (
                                        <div className="space-y-3">
                                            <p className="text-[10px] text-brand-100 font-bold uppercase tracking-wider">Récompenses disponibles :</p>
                                            <div className="flex space-x-3 overflow-x-auto pb-2 no-scrollbar">
                                                {loyaltyRewards[selectedRestaurant.id].map(reward => (
                                                    <div key={reward.id} className="flex-shrink-0 bg-white/10 backdrop-blur-sm border border-white/10 p-3 rounded-xl w-40">
                                                        <p className="text-xs font-bold truncate">{reward.name}</p>
                                                        <div className="flex justify-between items-end mt-2">
                                                            <span className="text-[10px] text-brand-200">{reward.points_required} pts</span>
                                                            <button 
                                                                onClick={() => handleClaimReward(reward)}
                                                                disabled={(loyaltyPoints[selectedRestaurant.id] || 0) < reward.points_required}
                                                                className={`text-[10px] font-black px-2 py-1 rounded-md ${(loyaltyPoints[selectedRestaurant.id] || 0) >= reward.points_required ? 'bg-white text-brand-600' : 'bg-white/20 text-white/50 cursor-not-allowed'}`}
                                                            >
                                                                Réclamer
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-xs text-brand-100 italic">Commandez pour gagner des points et débloquer des cadeaux !</p>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400 mb-4 mt-6">
                            <span className="flex items-center bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded"><Navigation size={14} className="mr-1"/> {formatDistance(selectedRestaurant.distance || 0)}</span>
                            <span className="flex items-center bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded"><Zap size={14} className="mr-1 text-yellow-500"/> {selectedRestaurant.preparationTime} min</span>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mb-2">
                             <div className="flex items-center p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg text-orange-700 dark:text-orange-400 border border-orange-100 dark:border-orange-900/30">
                                <Bike size={20} className="mr-3" />
                                <div><p className="text-[10px] font-bold uppercase tracking-wider opacity-70">En Moto</p><p className="font-bold text-lg leading-none">{selectedRestaurant.timeMoto ? formatTime(selectedRestaurant.timeMoto) : '--'}</p></div>
                            </div>
                            <div className="flex items-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-700 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30">
                                <Footprints size={20} className="mr-3" />
                                <div><p className="text-[10px] font-bold uppercase tracking-wider opacity-70">À pied</p><p className="font-bold text-lg leading-none">{selectedRestaurant.timeWalking ? formatTime(selectedRestaurant.timeWalking) : '--'}</p></div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* GALLERY SECTION */}
                {promotionsMap[selectedRestaurant.id] && promotionsMap[selectedRestaurant.id].length > 0 && (
                    <div className="mb-6">
                        <h3 className="text-lg font-bold mb-3 text-gray-800 dark:text-white flex items-center">
                            <ImageIcon className="mr-2 text-brand-600" size={18} />
                            Galerie ({promotionsMap[selectedRestaurant.id].length})
                        </h3>
                        <div className="grid grid-cols-3 gap-2">
                            {promotionsMap[selectedRestaurant.id].map((item, idx) => (
                                <button
                                    key={item.id}
                                    onClick={() => openStory(selectedRestaurant, idx)}
                                    className="relative aspect-square rounded-xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-700 group"
                                >
                                    {item.mediaType === 'video' ? (
                                        <>
                                            <video src={item.mediaUrl} className="w-full h-full object-cover opacity-90" muted />
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors">
                                                <PlayCircle className="text-white opacity-90" size={24} />
                                            </div>
                                        </>
                                    ) : (
                                        <img src={item.mediaUrl} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" alt="Gallery" />
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white">Menu</h3>
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                        {selectedRestaurant.menu.filter(item => selectedMenuCategory === 'Tous' || item.category === selectedMenuCategory).length} articles
                    </div>
                </div>

                {/* MENU CATEGORY FILTER */}
                <div className="flex space-x-2 overflow-x-auto no-scrollbar mb-4 -mx-4 px-4">
                    {['Tous', 'entrée', 'plat', 'dessert', 'boisson'].map((cat) => (
                        <button
                            key={cat}
                            onClick={() => setSelectedMenuCategory(cat)}
                            className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-bold transition-all shadow-sm border ${
                                selectedMenuCategory === cat 
                                ? 'bg-brand-500 text-white border-brand-500' 
                                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                            }`}
                        >
                            {cat === 'entrée' ? 'Entrées' : 
                             cat === 'plat' ? 'Plats' : 
                             cat === 'dessert' ? 'Desserts' : 
                             cat === 'boisson' ? 'Boissons' : 'Tout'}
                        </button>
                    ))}
                </div>

                <div className="space-y-3 pb-20">
                    {selectedRestaurant.menu.filter(item => selectedMenuCategory === 'Tous' || item.category === selectedMenuCategory).length === 0 && (
                        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
                            <ShoppingBag className="mx-auto text-gray-300 dark:text-gray-600 mb-2" size={32} />
                            <p className="text-gray-500 dark:text-gray-400 text-sm">Aucun article disponible dans cette catégorie.</p>
                        </div>
                    )}
                    {selectedRestaurant.menu
                        .filter(item => selectedMenuCategory === 'Tous' || item.category === selectedMenuCategory)
                        .map(item => (
                            <div key={item.id} className={`bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex space-x-3 ${!item.isAvailable ? 'opacity-60 grayscale' : ''}`}>
                            <img src={item.image} className="w-20 h-20 rounded-lg object-cover bg-gray-100 dark:bg-gray-700" alt={item.name} />
                            <div className="flex-1 flex flex-col justify-between">
                                <div>
                                    <h4 className="font-bold text-gray-800 dark:text-white">{item.name}</h4>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">{item.description}</p>
                                </div>
                                <div className="flex justify-between items-end mt-2">
                                    <span className="font-bold text-brand-600 text-sm whitespace-nowrap">
                                        {formatDualPrice(item.price || 0, selectedRestaurant?.currency as 'USD' | 'CDF' || 'USD', selectedRestaurant?.exchangeRate, selectedRestaurant?.displayCurrencyMode)}
                                    </span>
                                    <div className="flex items-center space-x-2">
                                        {cart.find(c => c.id === item.id) && (
                                            <span className="text-xs font-bold bg-brand-100 dark:bg-brand-900 text-brand-700 dark:text-brand-300 px-2 py-1 rounded-full">
                                                x{cart.find(c => c.id === item.id)?.quantity}
                                            </span>
                                        )}
                                        <button 
                                            onClick={() => addToCart(item, selectedRestaurant)} 
                                            className={`p-2 rounded-full transition-all active:scale-90 ${
                                                item.isAvailable 
                                                ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 hover:bg-brand-100' 
                                                : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 hover:bg-gray-200'
                                            }`}
                                        >
                                            <Plus size={16} />
                                        </button>
                                    </div>
                                    {!item.isAvailable && !cart.find(c => c.id === item.id) && (
                                        <span className="text-[10px] font-bold text-red-500 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded whitespace-nowrap ml-2">Épuisé</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* STICKY CART SUMMARY */}
                {cart.length > 0 && (
                    <div className="fixed bottom-0 left-0 right-0 p-4 z-50 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-2xl animate-slide-in-right max-w-md mx-auto">
                        <button 
                            onClick={openCart}
                            className="w-full bg-brand-600 text-white rounded-xl p-4 flex justify-between items-center shadow-lg hover:bg-brand-700 transition-colors"
                        >
                            <div className="flex items-center">
                                <div className="bg-white/20 w-8 h-8 rounded-full flex items-center justify-center mr-3 font-bold text-sm">
                                    {cart.reduce((acc, item) => acc + item.quantity, 0)}
                                </div>
                                <span className="font-bold">{t('view_cart')}</span>
                            </div>
                            <span className="font-black text-lg">
                                {formatDualPrice(cartTotal, selectedRestaurant?.currency as 'USD' | 'CDF' || 'USD', selectedRestaurant?.exchangeRate, selectedRestaurant?.displayCurrencyMode)}
                            </span>
                        </button>
                    </div>
                )}
            </div>
        ) : viewMode === 'orders' ? (
            <OrdersView 
                orders={orders} 
                onChat={openChat} 
                onBrowse={() => setViewMode('list')} 
                onOrderUpdated={fetchOrders}
                subscribedRestaurantIds={subscribedRestaurants}
                allRestaurants={allRestaurants}
            />
        ) : viewMode === 'settings' ? (
             <div className="animate-in slide-in-from-right duration-300">
                <button onClick={() => window.history.back()} className="mb-4 flex items-center text-gray-600 dark:text-gray-300 font-medium hover:text-brand-600"><ArrowLeft size={18} className="mr-1" /> {t('back_to_restaurants')}</button>
                <h2 className="text-2xl font-black text-gray-800 dark:text-white mb-6">{t('settings')}</h2>
                
                <div className="space-y-6">
                    {/* Help & Support */}
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                        <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center">
                            <HelpCircle size={20} className="mr-2 text-brand-600"/>
                            {t('help_and_support')}
                        </h3>
                        <div className="space-y-3">
                            <button 
                                onClick={openHelpCenter}
                                className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            >
                                <div className="flex items-center">
                                    <div className="p-2 bg-white dark:bg-gray-800 rounded-lg mr-3 shadow-sm">
                                        <Book size={18} className="text-brand-600" />
                                    </div>
                                    <div className="text-left">
                                        <p className="text-sm font-bold text-gray-900 dark:text-white">{t('help_center')}</p>
                                        <p className="text-[10px] text-gray-500">{t('help_guides')}</p>
                                    </div>
                                </div>
                                <ChevronRight size={18} className="text-gray-400" />
                            </button>

                            <a 
                                href="mailto:irmerveilkanku@gmail.com"
                                className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            >
                                <div className="flex items-center">
                                    <div className="p-2 bg-white dark:bg-gray-800 rounded-lg mr-3 shadow-sm">
                                        <Mail size={18} className="text-brand-600" />
                                    </div>
                                    <div className="text-left">
                                        <p className="text-sm font-bold text-gray-900 dark:text-white">{t('contact_support')}</p>
                                        <p className="text-[10px] text-gray-500">irmerveilkanku@gmail.com</p>
                                    </div>
                                </div>
                                <ExternalLink size={18} className="text-gray-400" />
                            </a>
                        </div>
                    </div>

                    {/* Theme Toggle */}
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                        <h3 className="font-bold text-gray-900 dark:text-white mb-3 flex items-center">
                            {theme === 'light' ? <Sun size={20} className="mr-2 text-orange-500"/> : <Moon size={20} className="mr-2 text-blue-400"/>}
                            {t('appearance')}
                        </h3>
                        <div className="flex space-x-2">
                            <button 
                                onClick={() => setTheme('light')}
                                className={`flex-1 py-3 px-4 rounded-lg font-bold text-sm border ${theme === 'light' ? 'bg-orange-50 border-orange-500 text-orange-700' : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300'}`}
                            >
                                {t('light')}
                            </button>
                            <button 
                                onClick={() => setTheme('dark')}
                                className={`flex-1 py-3 px-4 rounded-lg font-bold text-sm border ${theme === 'dark' ? 'bg-blue-900/20 border-blue-500 text-blue-400' : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300'}`}
                            >
                                {t('dark')}
                            </button>
                        </div>
                    </div>

                    {/* Language Toggle */}
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                        <h3 className="font-bold text-gray-900 dark:text-white mb-3 flex items-center">
                            <Globe size={20} className="mr-2 text-brand-600"/>
                            {t('language')}
                        </h3>
                        <div className="grid grid-cols-1 gap-2">
                             {(['fr', 'en', 'ln'] as const).map((lang) => (
                                <button
                                    key={lang} 
                                    onClick={() => setLanguage(lang)}
                                    className={`w-full text-left py-3 px-4 rounded-lg font-bold text-sm border flex justify-between items-center ${language === lang ? 'bg-brand-50 dark:bg-brand-900/20 border-brand-500 text-brand-700 dark:text-brand-400' : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300'}`}
                                >
                                    <span>{lang === 'fr' ? 'Français' : lang === 'en' ? 'English' : 'Lingala'}</span>
                                    {language === lang && <div className="w-2 h-2 rounded-full bg-brand-500"></div>}
                                </button>
                             ))}
                        </div>
                    </div>

                    {/* Become a Delivery Person */}
                    {user.role === 'client' && (
                        <div className="bg-gradient-to-br from-brand-50 to-orange-50 dark:from-brand-900/20 dark:to-orange-900/20 p-6 rounded-2xl shadow-sm border border-brand-100 dark:border-brand-900/50">
                            <div className="flex items-start justify-between mb-4">
                                <div>
                                    <h3 className="font-black text-xl text-brand-900 dark:text-brand-300 flex items-center">
                                        <Bike size={24} className="mr-2 text-brand-600"/>
                                        {t('earn_with_us')}
                                    </h3>
                                    <p className="text-xs text-brand-700 dark:text-brand-400 mt-1 leading-relaxed">
                                        {t('join_fleet')}
                                    </p>
                                </div>
                                <div className="bg-brand-600 text-white p-2 rounded-xl shadow-lg">
                                    <Zap size={20} />
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-3 mb-6">
                                <div className="bg-white/50 dark:bg-gray-800/50 p-3 rounded-xl border border-brand-100/50 dark:border-brand-900/30">
                                    <p className="text-[10px] font-bold text-brand-600 dark:text-brand-400 uppercase tracking-wider mb-1">{t('flexibility')}</p>
                                    <p className="text-xs font-black text-gray-900 dark:text-white">{t('work_when_you_want')}</p>
                                </div>
                                <div className="bg-white/50 dark:bg-gray-800/50 p-3 rounded-xl border border-brand-100/50 dark:border-brand-900/30">
                                    <p className="text-[10px] font-bold text-brand-600 dark:text-brand-400 uppercase tracking-wider mb-1">{t('earnings')}</p>
                                    <p className="text-xs font-black text-gray-900 dark:text-white">{t('paid_per_delivery')}</p>
                                </div>
                            </div>

                            <button 
                                onClick={() => {
                                    setViewMode('delivery_onboarding');
                                }}
                                className="w-full py-4 bg-brand-600 text-white rounded-2xl text-sm font-black hover:bg-brand-700 transition-all shadow-xl hover:shadow-brand-500/20 active:scale-95 flex items-center justify-center group"
                            >
                                {t('start_registration')}
                                <ArrowRight size={18} className="ml-2 group-hover:translate-x-1 transition-transform" />
                            </button>
                            
                            <p className="text-[10px] text-center text-brand-400 dark:text-brand-500 mt-4">
                                {t('terms_accept')}
                            </p>
                        </div>
                    )}

                    {/* Security Settings */}
                    {user.role !== 'guest' && (
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                            <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center">
                                <Shield size={20} className="mr-2 text-brand-600"/>
                                {t('security_and_access')}
                            </h3>
                            
                            <div className="space-y-4">
                                {/* App Lock */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center">
                                        <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg mr-3">
                                            <Lock size={18} className="text-gray-600 dark:text-gray-300" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-gray-900 dark:text-white">{t('app_lock')}</p>
                                            <p className="text-[10px] text-gray-500">{t('ask_pin')}</p>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => user.settings?.appLockEnabled ? updateSecuritySettings({ appLockEnabled: false }) : setIsPinSetupOpen(true)}
                                        className={`w-12 h-6 rounded-full transition-colors relative ${user.settings?.appLockEnabled ? 'bg-brand-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                                    >
                                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${user.settings?.appLockEnabled ? 'right-1' : 'left-1'}`}></div>
                                    </button>
                                </div>

                                {/* Biometrics */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center">
                                        <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg mr-3">
                                            <Fingerprint size={18} className="text-gray-600 dark:text-gray-300" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-gray-900 dark:text-white">{t('biometrics')}</p>
                                            <p className="text-[10px] text-gray-500">{t('use_phone_sensors')}</p>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => updateSecuritySettings({ biometricsEnabled: !user.settings?.biometricsEnabled })}
                                        className={`w-12 h-6 rounded-full transition-colors relative ${user.settings?.biometricsEnabled ? 'bg-brand-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                                    >
                                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${user.settings?.biometricsEnabled ? 'right-1' : 'left-1'}`}></div>
                                    </button>
                                </div>

                                {/* 2FA */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center">
                                        <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg mr-3">
                                            <Zap size={18} className="text-gray-600 dark:text-gray-300" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-gray-900 dark:text-white">Double Authentification (2FA)</p>
                                            <p className="text-[10px] text-gray-500">Sécurité renforcée lors de la connexion</p>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => updateSecuritySettings({ twoFactorEnabled: !user.settings?.twoFactorEnabled })}
                                        className={`w-12 h-6 rounded-full transition-colors relative ${user.settings?.twoFactorEnabled ? 'bg-brand-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                                    >
                                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${user.settings?.twoFactorEnabled ? 'right-1' : 'left-1'}`}></div>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Notifications Settings */}
                    {user.role !== 'guest' && (
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                            <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center">
                                <Bell size={20} className="mr-2 text-brand-600"/>
                                Notifications
                            </h3>
                            
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-bold text-gray-900 dark:text-white">Notifications Push</p>
                                        <p className="text-[10px] text-gray-500">Alertes en temps réel sur votre écran</p>
                                    </div>
                                    <button 
                                        onClick={async () => {
                                            if (!user.settings?.notifPush) {
                                                const granted = await requestNotificationPermission();
                                                if (granted) {
                                                    updateSecuritySettings({ notifPush: true });
                                                    sendPushNotification("Notifications activées", { body: "Vous recevrez désormais des alertes en temps réel." });
                                                } else {
                                                    const isInIframe = window.self !== window.top;
                                                    if (isInIframe) {
                                                        toast.error("Les notifications sont bloquées dans l'aperçu. Veuillez ouvrir l'application dans un nouvel onglet pour les activer.");
                                                    } else {
                                                        toast.error("Permission refusée ou non supportée.");
                                                    }
                                                }
                                            } else {
                                                updateSecuritySettings({ notifPush: false });
                                            }
                                        }}
                                        className={`w-12 h-6 rounded-full transition-colors relative ${user.settings?.notifPush ? 'bg-brand-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                                    >
                                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${user.settings?.notifPush ? 'right-1' : 'left-1'}`}></div>
                                    </button>
                                </div>

                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-bold text-gray-900 dark:text-white">Emails</p>
                                        <p className="text-[10px] text-gray-500">Récapitulatifs et factures par mail</p>
                                    </div>
                                    <button 
                                        onClick={() => updateSecuritySettings({ notifEmail: !user.settings?.notifEmail })}
                                        className={`w-12 h-6 rounded-full transition-colors relative ${user.settings?.notifEmail ? 'bg-brand-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                                    >
                                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${user.settings?.notifEmail ? 'right-1' : 'left-1'}`}></div>
                                    </button>
                                </div>

                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-bold text-gray-900 dark:text-white">SMS</p>
                                        <p className="text-[10px] text-gray-500">Alertes par message texte</p>
                                    </div>
                                    <button 
                                        onClick={() => updateSecuritySettings({ notifSms: !user.settings?.notifSms })}
                                        className={`w-12 h-6 rounded-full transition-colors relative ${user.settings?.notifSms ? 'bg-brand-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                                    >
                                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${user.settings?.notifSms ? 'right-1' : 'left-1'}`}></div>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Notifications */}
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                        <h3 className="font-bold text-gray-900 dark:text-white mb-3 flex items-center">
                            <Bell size={20} className="mr-2 text-brand-600"/>
                            Notifications Push
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Recevez une alerte quand le statut de votre commande change.</p>
                        <button 
                            onClick={async () => {
                                const granted = await requestNotificationPermission();
                                if (granted) {
                                    toast.success("Notifications activées avec succès !");
                                    sendPushNotification("Test de notification", { body: "Les notifications fonctionnent correctement." });
                                } else {
                                    toast.error("Permission refusée ou non supportée par votre appareil.");
                                }
                            }}
                            className="w-full bg-brand-50 hover:bg-brand-100 dark:bg-brand-900/20 dark:hover:bg-brand-900/40 text-brand-600 dark:text-brand-400 font-bold py-3 px-4 rounded-lg text-sm transition-colors"
                        >
                            Activer les notifications
                        </button>
                    </div>

                    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                        <button onClick={onLogout} className="w-full flex items-center justify-center space-x-2 text-red-500 p-2 rounded-lg font-bold">
                            <LogOut size={20}/>
                            <span>{t('logout')}</span>
                        </button>
                    </div>
                </div>
            </div>
        ) : viewMode === 'delivery_onboarding' ? (
            renderDeliveryOnboarding()
        ) : null}
      </main>

      {/* BOTTOM NAV */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-6 py-3 flex justify-around items-center z-40 max-w-md mx-auto transition-colors duration-300">
        <button onClick={() => navigateTo('list')} className={`flex flex-col items-center space-y-1 ${viewMode === 'list' || viewMode === 'restaurant_detail' ? 'text-brand-600 dark:text-brand-400' : 'text-gray-400 dark:text-gray-500'}`}><List size={22} /><span className="text-[10px] font-medium">Liste</span></button>
        <div className="relative -top-6"><button onClick={toggleUrgentMode} className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg border-4 border-gray-50 dark:border-gray-900 transition-all ${urgentMode ? 'bg-brand-600 text-white scale-110 shadow-brand-500/50' : 'bg-brand-500 text-white'}`}><Zap size={24} className={urgentMode ? 'animate-pulse' : ''} /></button></div>
        <button onClick={() => navigateTo('map')} className={`flex flex-col items-center space-y-1 ${viewMode === 'map' ? 'text-brand-600 dark:text-brand-400' : 'text-gray-400 dark:text-gray-500'}`}><Map size={22} /><span className="text-[10px] font-medium">Carte</span></button>
        <button onClick={() => navigateTo('orders')} className={`flex flex-col items-center space-y-1 ${viewMode === 'orders' ? 'text-brand-600 dark:text-brand-400' : 'text-gray-400 dark:text-gray-500'}`}><Receipt size={22} /><span className="text-[10px] font-medium">{t('orders')}</span></button>
      </nav>

      <CartDrawer 
        isOpen={isCartOpen} 
        onClose={closeCart} 
        items={cart} 
        onRemoveItem={removeFromCart}
        onUpdateQuantity={updateQuantity}
        onClearCart={() => setCart([])}
        onPlaceOrder={handleCheckout}
        restaurantPaymentConfig={allRestaurants.find(r => r.id === cart[0]?.restaurantId)?.paymentConfig}
        restaurantId={cart[0]?.restaurantId || ''}
        language={language}
      />

      {/* HELP CENTER OVERLAY */}
      {isHelpCenterOpen && (
          <HelpCenter 
            user={user}
            onClose={closeHelpCenter}
          />
      )}

      {/* NOTIFICATIONS MODAL */}
      {showNotifications && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowNotifications(false)}></div>
              <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden relative z-10 animate-in fade-in zoom-in duration-200 max-h-[80vh] flex flex-col">
                  <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-brand-600 text-white">
                      <div className="flex items-center">
                          <Bell size={18} className="mr-2" />
                          <h3 className="font-black uppercase tracking-tight italic">Notifications</h3>
                      </div>
                      <div className="flex items-center space-x-2">
                          {unreadCount > 0 && (
                              <button 
                                  onClick={markAllAsRead}
                                  className="text-[10px] font-bold bg-white/20 hover:bg-white/30 px-2 py-1 rounded-lg transition-colors"
                              >
                                  Tout lire
                              </button>
                          )}
                          <button onClick={() => setShowNotifications(false)} className="p-1 hover:bg-white/20 rounded-full transition-colors">
                              <X size={20} />
                          </button>
                      </div>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-2 space-y-2 no-scrollbar">
                      {notifications.length === 0 ? (
                          <div className="py-12 text-center">
                              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                                  <Bell size={32} className="text-gray-300 dark:text-gray-600" />
                              </div>
                              <p className="text-gray-500 dark:text-gray-400 font-bold">Aucune notification</p>
                              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Vous êtes à jour !</p>
                          </div>
                      ) : (
                          notifications.map((notif) => (
                              <div 
                                  key={notif.id} 
                                  className={`p-3 rounded-xl border transition-all cursor-pointer relative group ${
                                      notif.is_read 
                                      ? 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 opacity-80' 
                                      : 'bg-brand-50 dark:bg-brand-900/20 border-brand-100 dark:border-brand-900/30 shadow-sm'
                                  }`}
                                  onClick={() => {
                                      markNotificationAsRead(notif.id);
                                      if (notif.type === 'message' && notif.data?.order_id) {
                                          setShowNotifications(false);
                                          // If it's a subscriber chat
                                          if (notif.data.order_id.startsWith('sub-')) {
                                              // We need to find the restaurant to open the chat
                                              const restaurantId = notif.data.order_id.split('-').pop();
                                              const resto = allRestaurants.find(r => r.id === restaurantId);
                                              if (resto) {
                                                  setActiveChatOrder({
                                                      id: notif.data.order_id,
                                                      userId: user.id,
                                                      restaurantId: resto.id,
                                                      status: 'completed', // Dummy status
                                                      paymentMethod: 'cash',
                                                      paymentStatus: 'paid',
                                                      totalAmount: 0,
                                                      items: [],
                                                      createdAt: new Date().toISOString(),
                                                      restaurant: resto
                                                  } as any);
                                              }
                                          } else {
                                              // It's a real order chat
                                              const order = orders.find(o => o.id === notif.data.order_id);
                                              if (order) {
                                                  setActiveChatOrder(order);
                                              } else {
                                                  toast.error("Commande introuvable");
                                              }
                                          }
                                      }
                                  }}
                              >
                                  <div className="flex items-start">
                                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mr-3 ${
                                          notif.type === 'message' ? 'bg-blue-100 text-blue-600' : 
                                          notif.type === 'order_status' ? 'bg-orange-100 text-orange-600' :
                                          notif.type === 'new_order' ? 'bg-green-100 text-green-600' :
                                          notif.type === 'support' ? 'bg-purple-100 text-purple-600' :
                                          'bg-brand-100 text-brand-600'
                                      }`}>
                                          {notif.type === 'message' ? <MessageSquare size={16} /> : 
                                           notif.type === 'order_status' ? <ShoppingBag size={16} /> :
                                           notif.type === 'support' ? <HelpCircle size={16} /> :
                                           <Bell size={16} />}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                          <div className="flex justify-between items-start">
                                              <h4 className={`text-xs font-black truncate pr-4 ${notif.is_read ? 'text-gray-700 dark:text-gray-300' : 'text-gray-900 dark:text-white'}`}>
                                                  {notif.title}
                                              </h4>
                                              <span className="text-[9px] text-gray-400 dark:text-gray-500 whitespace-nowrap">
                                                  {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                              </span>
                                          </div>
                                          <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2 mt-0.5 leading-tight">
                                              {notif.message}
                                          </p>
                                      </div>
                                  </div>
                                  <button 
                                      onClick={(e) => {
                                          e.stopPropagation();
                                          deleteNotification(notif.id);
                                      }}
                                      className="absolute top-2 right-2 p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                      <X size={12} />
                                  </button>
                                  {!notif.is_read && (
                                      <div className="absolute left-1 top-1/2 -translate-y-1/2 w-1 h-8 bg-brand-500 rounded-full"></div>
                                  )}
                              </div>
                          ))
                      )}
                  </div>
              </div>
          </div>
      )}

      {/* PIN Setup Dialog */}
      <PinSetupDialog 
        isOpen={isPinSetupOpen}
        onClose={() => setIsPinSetupOpen(false)}
        onConfirm={handleSetPin}
      />

      {/* CART CONFLICT MODAL */}
      {cartConflict && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
              <div className="bg-white dark:bg-gray-900 w-full max-w-sm rounded-[32px] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
                  <div className="p-8 text-center">
                      <div className="w-20 h-20 bg-brand-50 dark:bg-brand-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                          <ShoppingBag size={40} className="text-brand-600 animate-bounce" />
                      </div>
                      <h3 className="text-xl font-black text-gray-900 dark:text-white leading-tight mb-4 uppercase italic">Changer de restaurant ?</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-8 leading-relaxed">
                          Votre panier contient déjà des plats de <span className="font-bold text-gray-900 dark:text-white italic">"{cart[0]?.restaurantName}"</span>. 
                          Voulez-vous le vider pour commander chez <span className="font-bold text-brand-600 italic">"{cartConflict.restaurant.name}"</span> ?
                      </p>
                      
                      <div className="space-y-3">
                          <button 
                              onClick={clearAndAddToCart}
                              className="w-full bg-brand-600 hover:bg-brand-700 text-white font-black py-4 rounded-2xl shadow-lg shadow-brand-200 transition-all uppercase tracking-widest text-sm"
                          >
                              Oui, vider et ajouter
                          </button>
                          <button 
                              onClick={() => setCartConflict(null)}
                              className="w-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 font-bold py-4 rounded-2xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-all text-sm"
                          >
                              Non, garder mon panier
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};