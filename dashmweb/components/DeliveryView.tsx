import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Order, User, Restaurant, OrderStatus } from '../types';
import { 
  Bike, 
  MapPin, 
  CheckCircle2, 
  Clock, 
  Navigation, 
  Phone, 
  MessageSquare,
  LogOut,
  User as UserIcon,
  Package,
  ChevronRight,
  AlertCircle,
  Wallet,
  Store,
  Star,
  Settings,
  Briefcase,
  Car,
  Footprints,
  Info,
  Check,
  Bell,
  Mic,
  MicOff
} from 'lucide-react';
import { processVoiceCommand } from '../lib/gemini';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

interface Props {
  user: User;
  onLogout: () => void;
}

type TabType = 'orders' | 'wallet' | 'restaurants' | 'profile';

export const DeliveryView: React.FC<Props> = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState<TabType>('orders');
  const [orders, setOrders] = useState<Order[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [isTracking, setIsTracking] = useState(false);
  const [watchId, setWatchId] = useState<number | null>(null);
  
  // Profile editing state
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [vehicleType, setVehicleType] = useState(user.deliveryInfo?.vehicleType || 'moto');
  const [bio, setBio] = useState(user.deliveryInfo?.bio || '');
  const [isAvailable, setIsAvailable] = useState(user.deliveryInfo?.isAvailable ?? true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition || !isVoiceActive) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'fr-FR';

    recognition.onresult = async (event: any) => {
      const last = event.results.length - 1;
      const result = event.results[last];
      
      if (result.isFinal) {
        const command = result[0].transcript.trim();
        if (command.length < 2) return;
        
        toast.promise(processVoiceCommand(command, "delivery"), {
          loading: 'Analyse...',
          success: (data) => {
            handleVoiceAction(data);
            return `Command: ${command}`;
          },
          error: 'Erreur assistant'
        });
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Delivery Voice Error:", event.error);
      if (event.error === 'not-allowed') {
        toast.error("Microphone non autorisé");
        setIsVoiceActive(false);
      }
    };

    recognition.onend = () => {
      if (isVoiceActive && recognitionRef.current) {
        setTimeout(() => {
          try {
            recognitionRef.current?.start();
          } catch (e) {
            console.error("Failed to restart delivery recognition:", e);
          }
        }, 300);
      }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      toast.success("Assistant vocal activé.");
    } catch (e) {
      console.error("Delivery recognition start error:", e);
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    };
  }, [isVoiceActive]);

  const handleVoiceAction = (data: any) => {
    if (!data || data.action === 'unknown') return;

    switch (data.action) {
      case 'update_status':
        const activeOrder = orders.find(o => o.status === 'ready' || o.status === 'delivering');
        if (activeOrder && data.status) {
           updateOrderStatus(activeOrder.id, data.status as OrderStatus);
        }
        break;
      case 'call_customer':
        const deliveringOrder = orders.find(o => o.status === 'delivering');
        if (deliveringOrder?.customer?.phone_number) {
          window.location.href = `tel:${deliveringOrder.customer.phone_number}`;
        }
        break;
      case 'navigate_to_customer':
        const navOrder = orders.find(o => o.status === 'delivering');
        if (navOrder?.deliveryLocation?.lat) {
          window.open(`https://www.google.com/maps/dir/?api=1&destination=${navOrder.deliveryLocation.lat},${navOrder.deliveryLocation.lng}`);
        }
        break;
    }
  };

  useEffect(() => {
    fetchAssignedOrders();
    fetchRestaurants();

    const subscription = supabase
      .channel('delivery_orders')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'orders',
        filter: `delivery_person_id=eq.${user.id}`
      }, () => {
        fetchAssignedOrders();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    };
  }, [user.id]);

  const fetchAssignedOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          restaurant:restaurants(name, phone_number, latitude, longitude, city),
          customer:profiles!orders_user_id_fkey(full_name, phone_number)
        `)
        .eq('delivery_person_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
      
      const delivering = data?.find(o => o.status === 'delivering');
      if (delivering) startTracking(delivering.id);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRestaurants = async () => {
    try {
      const { data, error } = await supabase
        .from('restaurants')
        .select('*')
        .eq('is_open', true)
        .limit(20);
      if (error) throw error;
      setRestaurants(data || []);
    } catch (error) {
      console.error('Error fetching restaurants:', error);
    }
  };

  const startTracking = (orderId: string) => {
    if (!navigator.geolocation || isTracking) return;

    setIsTracking(true);
    const id = navigator.geolocation.watchPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        await supabase
          .from('orders')
          .update({ delivery_lat: latitude, delivery_lng: longitude })
          .eq('id', orderId);
      },
      (error) => console.error('Geolocation error:', error),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
    );
    setWatchId(id);
  };

  const stopTracking = () => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }
    setIsTracking(false);
  };

  const DELIVERY_FEE_USD = 2.5; // Gain fixe par course

  const updateOrderStatus = async (orderId: string, newStatus: Order['status']) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId);

      if (error) throw error;

      // Update delivery profile stats if delivered
      if (newStatus === 'delivered' || newStatus === 'completed') {
        const currentCount = user.deliveryInfo?.completedOrders || 0;
        await supabase.from('profiles').update({
          delivery_info: {
            ...user.deliveryInfo,
            completedOrders: currentCount + 1
          }
        }).eq('id', user.id);
      }

      // Insert notification for the customer
      const order = orders.find(o => o.id === orderId);
      if (order && order.user_id) {
          const statusLabels: Record<string, string> = {
              'delivering': 'en cours de livraison',
              'delivered': 'livrée',
              'completed': 'terminée',
              'cancelled': 'annulée'
          };
          await supabase.from('notifications').insert({
              user_id: order.user_id,
              title: `Commande #${orderId.slice(0, 4)}`,
              message: `Votre commande est maintenant ${statusLabels[newStatus] || newStatus}.`,
              type: 'order_status',
              data: { order_id: orderId, status: newStatus }
          });
      }

      if (newStatus === 'delivering') {
        startTracking(orderId);
      } else if (newStatus === 'delivered' || newStatus === 'completed' || newStatus === 'cancelled') {
        stopTracking();
      }

      toast.success(`Statut mis à jour: ${newStatus}`);
      fetchAssignedOrders();
    } catch (error) {
      console.error('Error updating order status:', error);
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const handleUpdateProfile = async () => {
    setIsSavingProfile(true);
    try {
      const newDeliveryInfo = {
        ...user.deliveryInfo,
        vehicleType,
        bio,
        isAvailable
      };

      const { error } = await supabase
        .from('profiles')
        .update({ delivery_info: newDeliveryInfo })
        .eq('id', user.id);

      if (error) throw error;
      
      toast.success("Profil professionnel mis à jour !");
      setIsEditingProfile(false);
      // Note: In a real app, you'd update the global user state here
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error("Erreur lors de la mise à jour");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const renderOrders = () => (
    <div className="space-y-6">
      {/* Status Card */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-900">Disponibilité</h2>
          <button 
            onClick={() => setIsAvailable(!isAvailable)}
            className={`px-3 py-1 rounded-full text-xs font-bold flex items-center transition-colors ${isAvailable ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}
          >
            <div className={`w-2 h-2 rounded-full mr-2 ${isAvailable ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            {isAvailable ? 'Disponible' : 'Indisponible'}
          </button>
        </div>
        <p className="text-sm text-gray-500 leading-relaxed">
          {isAvailable 
            ? "Vous êtes visible par les restaurants. Vous recevrez des notifications pour les nouvelles commandes."
            : "Vous êtes en pause. Les restaurants ne peuvent pas vous assigner de nouvelles commandes."}
        </p>
      </div>

      <div className="space-y-4">
        <h2 className="font-black text-gray-900 flex items-center">
          <Package size={20} className="mr-2 text-brand-600" />
          Commandes en cours
        </h2>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
            <p className="text-sm text-gray-500 font-medium">Chargement...</p>
          </div>
        ) : orders.filter(o => o.status !== 'completed' && o.status !== 'cancelled').length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center border-2 border-dashed border-gray-200">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300">
              <AlertCircle size={32} />
            </div>
            <h3 className="font-bold text-gray-900">Aucune mission</h3>
            <p className="text-sm text-gray-500 mt-2">Attendez qu'un restaurant vous assigne une commande.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.filter(o => o.status !== 'completed' && o.status !== 'cancelled').map((order) => (
              <motion.div
                key={order.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`bg-white rounded-2xl overflow-hidden border ${
                  order.status === 'delivering' ? 'border-brand-500 ring-1 ring-brand-500' : 'border-gray-100'
                } shadow-sm`}
              >
                <div className="p-4">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                        order.status === 'delivering' ? 'bg-brand-100 text-brand-600' :
                        order.status === 'ready' ? 'bg-green-100 text-green-600' :
                        'bg-gray-100 text-gray-500'
                      }`}>
                        {order.status}
                      </span>
                      <h3 className="text-lg font-black text-gray-900 mt-1">#{order.id.slice(0, 8)}</h3>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-brand-600">{order.totalAmount} {order.items[0]?.restaurantName ? 'USD' : 'CDF'}</p>
                      <p className="text-[10px] text-gray-400 font-bold uppercase">{new Date(order.createdAt).toLocaleTimeString()}</p>
                    </div>
                  </div>

                  <div className="space-y-3 mb-6">
                    <div className="flex items-start space-x-3">
                      <div className="w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center text-orange-600 shrink-0">
                        <MapPin size={16} />
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Restaurant</p>
                            <p className="text-sm font-bold text-gray-800">{order.restaurant?.name || 'Restaurant'}</p>
                          </div>
                          {order.restaurant?.latitude && order.restaurant?.longitude && (
                            <a 
                              href={`https://www.google.com/maps/dir/?api=1&destination=${order.restaurant.latitude},${order.restaurant.longitude}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 bg-gray-50 text-gray-500 hover:text-brand-600 rounded-lg transition-colors"
                            >
                              <Navigation size={14} />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600 shrink-0">
                        <Navigation size={16} />
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Client</p>
                            <p className="text-sm font-bold text-gray-800">{order.customer?.full_name || 'Client'}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{order.deliveryLocation?.address || 'Adresse non spécifiée'}</p>
                          </div>
                          {order.deliveryLocation?.lat && order.deliveryLocation?.lng && (
                            <a 
                              href={`https://www.google.com/maps/dir/?api=1&destination=${order.deliveryLocation.lat},${order.deliveryLocation.lng}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 bg-gray-50 text-gray-500 hover:text-brand-600 rounded-lg transition-colors"
                            >
                              <Navigation size={14} />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {order.status === 'ready' && (
                      <button
                        onClick={() => updateOrderStatus(order.id, 'delivering')}
                        className="col-span-2 bg-brand-600 text-white py-3 rounded-xl font-black text-sm shadow-lg shadow-brand-200 flex items-center justify-center space-x-2"
                      >
                        <Bike size={18} />
                        <span>Commencer la livraison</span>
                      </button>
                    )}
                    
                    {order.status === 'delivering' && (
                      <>
                        <button
                          onClick={() => updateOrderStatus(order.id, 'delivered')}
                          className="bg-green-600 text-white py-3 rounded-xl font-black text-sm shadow-lg shadow-green-200 flex items-center justify-center space-x-2"
                        >
                          <CheckCircle2 size={18} />
                          <span>Marquer comme livré</span>
                        </button>
                        <a
                          href={`tel:${order.customer?.phone_number}`}
                          className="bg-gray-100 text-gray-800 py-3 rounded-xl font-black text-sm flex items-center justify-center space-x-2"
                        >
                          <Phone size={18} />
                          <span>Appeler</span>
                        </a>
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderWallet = () => {
    const completedOrdersCount = orders.filter(o => ['delivered', 'completed'].includes(o.status)).length;
    const totalEarnings = completedOrdersCount * DELIVERY_FEE_USD;

    return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-brand-600 to-brand-800 rounded-3xl p-6 text-white shadow-xl">
        <div className="flex justify-between items-start mb-8">
          <div>
            <p className="text-brand-100 text-sm font-medium">Gains cumulés</p>
            <h2 className="text-4xl font-black mt-1">
              {totalEarnings.toFixed(2)} USD
            </h2>
          </div>
          <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-md">
            <Wallet size={24} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white/10 rounded-2xl p-3 backdrop-blur-sm">
            <p className="text-[10px] font-bold text-brand-200 uppercase">Courses effectuées</p>
            <p className="text-lg font-black">{completedOrdersCount}</p>
          </div>
          <div className="bg-white/10 rounded-2xl p-3 backdrop-blur-sm">
            <p className="text-[10px] font-bold text-brand-200 uppercase">Tarif / Course</p>
            <p className="text-lg font-black">
              {DELIVERY_FEE_USD} USD
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="font-black text-gray-900">Historique des courses</h3>
        <div className="space-y-3">
          {orders.filter(o => ['delivered', 'completed'].includes(o.status)).map(order => (
            <div key={order.id} className="bg-white p-4 rounded-2xl border border-gray-100 flex justify-between items-center">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-green-50 text-green-600 rounded-full flex items-center justify-center">
                  <CheckCircle2 size={20} />
                </div>
                <div>
                  <p className="font-bold text-gray-900">{order.restaurant?.name || 'Restaurant'}</p>
                  <p className="text-xs text-gray-500">{new Date(order.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
              <p className="font-black text-green-600">+{DELIVERY_FEE_USD} USD</p>
            </div>
          ))}
        </div>
      </div>
    </div>
    );
  };

  const renderRestaurants = () => (
    <div className="space-y-6">
      <div className="bg-brand-50 p-4 rounded-2xl border border-brand-100">
        <div className="flex items-center space-x-3 mb-2">
          <Store className="text-brand-600" size={20} />
          <h3 className="font-bold text-brand-900">Marché des Restaurants</h3>
        </div>
        <p className="text-xs text-brand-700 leading-relaxed">
          Voici les restaurants actifs dans votre zone. Ils peuvent vous assigner des commandes si vous êtes à proximité et disponible.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {restaurants.map(resto => (
          <div key={resto.id} className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gray-100 rounded-xl overflow-hidden">
                {resto.cover_image ? (
                  <img src={resto.cover_image} alt={resto.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    <Store size={20} />
                  </div>
                )}
              </div>
              <div>
                <h4 className="font-bold text-gray-900">{resto.name}</h4>
                <div className="flex items-center text-xs text-gray-500 space-x-2">
                  <span className="flex items-center"><Star size={10} className="mr-1 fill-yellow-400 text-yellow-400" /> {resto.rating}</span>
                  <span>•</span>
                  <span>{resto.city}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {resto.phone_number && (
                <a 
                  href={`tel:${resto.phone_number}`}
                  className="p-2 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-full transition-colors"
                >
                  <Phone size={18} />
                </a>
              )}
              <button className="p-2 text-brand-600 hover:bg-brand-50 rounded-full transition-colors">
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderProfile = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 text-center">
        <div className="relative inline-block mb-4">
          <div className="w-24 h-24 bg-brand-100 rounded-full flex items-center justify-center text-brand-600 text-3xl font-black">
            {user.name.charAt(0)}
          </div>
          <div className="absolute bottom-0 right-0 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center text-brand-600">
            <Settings size={16} />
          </div>
        </div>
        <h2 className="text-xl font-black text-gray-900">{user.name}</h2>
        <p className="text-sm text-gray-500 font-medium">Livreur Professionnel • {user.city}</p>
        
        <div className="grid grid-cols-3 gap-4 mt-6">
          <div className="text-center">
            <p className="text-lg font-black text-gray-900">4.9</p>
            <p className="text-[10px] font-bold text-gray-400 uppercase">Note</p>
          </div>
          <div className="text-center border-x border-gray-100">
            <p className="text-lg font-black text-gray-900">{orders.filter(o => o.status === 'completed').length}</p>
            <p className="text-[10px] font-bold text-gray-400 uppercase">Courses</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-black text-gray-900">100%</p>
            <p className="text-[10px] font-bold text-gray-400 uppercase">Fiabilité</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="font-black text-gray-900 flex items-center">
            <Briefcase size={18} className="mr-2 text-brand-600" />
            Services & Véhicule
          </h3>
          <button 
            onClick={() => isEditingProfile ? handleUpdateProfile() : setIsEditingProfile(true)}
            className="text-brand-600 text-sm font-bold hover:underline"
          >
            {isSavingProfile ? 'Enregistrement...' : isEditingProfile ? 'Enregistrer' : 'Modifier'}
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2">Type de véhicule</label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { id: 'moto', icon: Bike, label: 'Moto' },
                { id: 'velo', icon: Bike, label: 'Vélo' },
                { id: 'voiture', icon: Car, label: 'Auto' },
                { id: 'pieton', icon: Footprints, label: 'Pied' }
              ].map(v => (
                <button
                  key={v.id}
                  disabled={!isEditingProfile}
                  onClick={() => setVehicleType(v.id as any)}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${
                    vehicleType === v.id 
                      ? 'border-brand-600 bg-brand-50 text-brand-600' 
                      : 'border-gray-100 text-gray-400 hover:border-gray-200'
                  } ${!isEditingProfile && 'opacity-80'}`}
                >
                  <v.icon size={20} />
                  <span className="text-[10px] font-bold mt-1">{v.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2">Bio / Présentation</label>
            {isEditingProfile ? (
              <textarea 
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none min-h-[100px]"
                placeholder="Décrivez votre expérience, votre zone de livraison..."
              />
            ) : (
              <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-xl italic">
                {bio || "Aucune description définie. Ajoutez-en une pour attirer plus de restaurants !"}
              </p>
            )}
          </div>
        </div>
      </div>

      <button 
        onClick={onLogout}
        className="w-full bg-red-50 text-red-600 font-bold py-4 rounded-2xl flex items-center justify-center space-x-2 hover:bg-red-100 transition-colors"
      >
        <LogOut size={20} />
        <span>Se déconnecter</span>
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 px-4 py-4">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-brand-200">
              <Bike size={24} />
            </div>
            <div>
              <h1 className="text-lg font-black text-gray-900">{user.name}</h1>
              <div className="flex items-center text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                <div className={`w-1.5 h-1.5 rounded-full mr-1.5 ${isAvailable ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                {isAvailable ? (
                  <span className="flex items-center">
                    EN LIGNE
                  </span>
                ) : 'Hors ligne'}
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button className="p-2 bg-gray-50 text-gray-400 rounded-full hover:text-brand-600 transition-colors">
              <Bell size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto p-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'orders' && renderOrders()}
            {activeTab === 'wallet' && renderWallet()}
            {activeTab === 'restaurants' && renderRestaurants()}
            {activeTab === 'profile' && renderProfile()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Voice Assistant for Delivery */}
      <div className="fixed bottom-24 right-4 z-40">
        <button
          onClick={() => setIsVoiceActive(!isVoiceActive)}
          className={`w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all transform hover:scale-110 ${
            isVoiceActive ? "bg-red-500 animate-pulse" : "bg-brand-600"
          } text-white`}
        >
          {isVoiceActive ? <MicOff size={24} /> : <Mic size={24} />}
        </button>
        {isVoiceActive && (
          <div className="absolute bottom-16 right-0 w-56 bg-white p-4 rounded-2xl shadow-2xl border border-brand-100 animate-in slide-in-from-bottom-4">
            <div className="flex items-center space-x-2 mb-2">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-ping"></div>
              <span className="text-[10px] font-bold text-gray-900 uppercase tracking-widest">
                Assistant Vocal
              </span>
            </div>
            <p className="text-[10px] text-gray-500 leading-tight">
              Dites "Je suis arrivé" ou "Appeler le client" pour l'aide mains-libres.
            </p>
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-6 py-3 z-50">
        <div className="max-w-md mx-auto flex justify-between items-center">
          <button 
            onClick={() => setActiveTab('orders')}
            className={`flex flex-col items-center space-y-1 transition-colors ${activeTab === 'orders' ? 'text-brand-600' : 'text-gray-400'}`}
          >
            <Package size={22} className={activeTab === 'orders' ? 'fill-brand-600/10' : ''} />
            <span className="text-[10px] font-bold uppercase tracking-tighter">Missions</span>
          </button>
          <button 
            onClick={() => setActiveTab('wallet')}
            className={`flex flex-col items-center space-y-1 transition-colors ${activeTab === 'wallet' ? 'text-brand-600' : 'text-gray-400'}`}
          >
            <Wallet size={22} className={activeTab === 'wallet' ? 'fill-brand-600/10' : ''} />
            <span className="text-[10px] font-bold uppercase tracking-tighter">Gains</span>
          </button>
          <button 
            onClick={() => setActiveTab('restaurants')}
            className={`flex flex-col items-center space-y-1 transition-colors ${activeTab === 'restaurants' ? 'text-brand-600' : 'text-gray-400'}`}
          >
            <Store size={22} className={activeTab === 'restaurants' ? 'fill-brand-600/10' : ''} />
            <span className="text-[10px] font-bold uppercase tracking-tighter">Marché</span>
          </button>
          <button 
            onClick={() => setActiveTab('profile')}
            className={`flex flex-col items-center space-y-1 transition-colors ${activeTab === 'profile' ? 'text-brand-600' : 'text-gray-400'}`}
          >
            <UserIcon size={22} className={activeTab === 'profile' ? 'fill-brand-600/10' : ''} />
            <span className="text-[10px] font-bold uppercase tracking-tighter">Profil</span>
          </button>
        </div>
      </nav>
    </div>
  );
};
