import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Receipt, ShoppingBag, Phone, MessageSquare, CheckCircle2, Circle, Bike, ChefHat, Clock, Camera, Star, X, Banknote, Smartphone, Zap, AlertCircle, MapPin, Navigation, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { Order, OrderStatus, Restaurant } from '../types';
import { formatDualPrice } from '../utils/format';
import { supabase } from '../lib/supabase';
import { DeliveryTrackingMap } from './DeliveryTrackingMap';

interface Props {
  orders: Order[];
  onChat: (order: Order) => void;
  onBrowse: () => void;
  onOrderUpdated?: () => void; // Callback to refresh orders
  subscribedRestaurantIds?: string[];
  allRestaurants?: Restaurant[];
}

export const OrdersView: React.FC<Props> = ({ orders, onChat, onBrowse, onOrderUpdated, subscribedRestaurantIds = [], allRestaurants = [] }) => {
  const [confirmingOrder, setConfirmingOrder] = useState<Order | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'past' | 'messages'>('active');

  const activeOrders = orders.filter(o => o.status !== 'completed' && o.status !== 'cancelled');
  const pastOrders = orders.filter(o => o.status === 'completed' || o.status === 'cancelled');
  
  // Get unique conversations from orders
  const orderConversations = orders.map(o => ({
      id: o.id,
      title: o.restaurant?.name || 'Restaurant',
      subtitle: `Commande #${o.id.slice(0, 4)}`,
      type: 'order',
      order: o,
      lastDate: o.createdAt
  }));

  // Get subscriber conversations
  const subscriberConversations = subscribedRestaurantIds.map(id => {
      const resto = allRestaurants.find(r => r.id === id);
      return {
          id: `sub-${orders[0]?.userId || 'user'}-${id}`,
          title: resto?.name || 'Restaurant',
          subtitle: 'Discussion directe',
          type: 'subscriber',
          restaurant: resto,
          lastDate: new Date().toISOString() // Fallback
      };
  });

  const allConversations = [...orderConversations, ...subscriberConversations];

  const displayedOrders = activeTab === 'active' ? activeOrders : pastOrders;

  const handleReuploadPaymentProof = async (orderId: string, file: File) => {
      try {
          toast.loading("Envoi de la nouvelle preuve...", { id: 'upload-proof' });
          
          const fileExt = file.name.split('.').pop();
          const fileName = `proof_${orderId}_${Date.now()}.${fileExt}`;
          const { error: uploadError } = await supabase.storage.from('images').upload(fileName, file);
          
          if (uploadError) throw uploadError;
          
          const { data: { publicUrl } } = supabase.storage.from('images').getPublicUrl(fileName);
          
          const order = orders.find(o => o.id === orderId);
          if (!order) throw new Error("Order not found");

          const newItems = order.items.map(item => ({
              ...item,
              paymentProof: publicUrl,
              paymentStatus: 'pending'
          }));

          if (orderId.startsWith('mock-')) {
              const localOrdersStr = localStorage.getItem('dashmeals_mock_orders');
              if (localOrdersStr) {
                  const localOrders = JSON.parse(localOrdersStr);
                  const updatedOrders = localOrders.map((o: any) => o.id === orderId ? { ...o, items: newItems, proof_url: publicUrl } : o);
                  localStorage.setItem('dashmeals_mock_orders', JSON.stringify(updatedOrders));
                  if (onOrderUpdated) onOrderUpdated();
              }
          } else {
              const { error } = await supabase
                  .from('orders')
                  .update({ 
                      items: newItems,
                      proof_url: publicUrl
                  })
                  .eq('id', orderId);

              if (error) throw error;
              if (onOrderUpdated) onOrderUpdated();
          }

          toast.success("Preuve envoyée avec succès", { id: 'upload-proof' });
      } catch (error) {
          console.error("Error uploading proof:", error);
          toast.error("Erreur lors de l'envoi de la preuve", { id: 'upload-proof' });
      }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
        case 'pending': return 'bg-gray-100 text-gray-700';
        case 'preparing': return 'bg-yellow-100 text-yellow-800';
        case 'ready': return 'bg-blue-100 text-blue-800';
        case 'delivering': return 'bg-orange-100 text-orange-800';
        case 'delivered': return 'bg-green-100 text-green-800';
        case 'completed': return 'bg-green-100 text-green-800';
        case 'cancelled': return 'bg-red-100 text-red-800';
        default: return 'bg-gray-100';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
        case 'pending': return 'En attente';
        case 'preparing': return 'En cuisine';
        case 'ready': return 'Prêt';
        case 'delivering': return 'En livraison';
        case 'delivered': return 'Livré (à confirmer)';
        case 'completed': return 'Livré & Confirmé';
        case 'cancelled': return 'Annulé';
        default: return status;
    }
  };

  const handleConfirmReceipt = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!confirmingOrder) return;
      setIsSubmitting(true);

      try {
          let proofUrl = null;

          // 1. Upload proof if exists
          if (proofFile) {
              const fileExt = proofFile.name.split('.').pop();
              const fileName = `proof_${confirmingOrder.id}_${Date.now()}.${fileExt}`;
              const { error: uploadError } = await supabase.storage.from('images').upload(fileName, proofFile);
              
              if (uploadError) {
                  console.error("Upload proof failed:", uploadError);
                  // Continue anyway
              } else {
                  const { data: { publicUrl } } = supabase.storage.from('images').getPublicUrl(fileName);
                  proofUrl = publicUrl;
              }
          }

          // 2. Update Order Status
          if (confirmingOrder.id.startsWith('mock-')) {
              const localOrdersStr = localStorage.getItem('dashmeals_mock_orders');
              if (localOrdersStr) {
                  const localOrders = JSON.parse(localOrdersStr);
                  const updatedOrders = localOrders.map((o: any) => o.id === confirmingOrder.id ? { ...o, status: 'completed', proof_url: proofUrl } : o);
                  localStorage.setItem('dashmeals_mock_orders', JSON.stringify(updatedOrders));
              }
          } else {
              const { error: updateError } = await supabase
                  .from('orders')
                  .update({ 
                      status: 'completed',
                      proof_url: proofUrl
                  })
                  .eq('id', confirmingOrder.id);

              if (updateError) throw updateError;
          }

          // 3. Insert Review
          if (!confirmingOrder.id.startsWith('mock-')) {
              const { error: reviewError } = await supabase
                  .from('reviews')
                  .insert({
                      order_id: confirmingOrder.id,
                      restaurant_id: confirmingOrder.restaurantId,
                      user_id: confirmingOrder.userId,
                      rating: rating,
                      comment: comment,
                      image_url: proofUrl
                  });

              if (reviewError) console.warn("Review insert failed:", reviewError);
          }

          // 4. Close and Refresh
          setConfirmingOrder(null);
          setProofFile(null);
          setComment('');
          setRating(5);
          if (onOrderUpdated) onOrderUpdated();

      } catch (err) {
          console.error("Error confirming receipt:", err);
          toast.error("Une erreur est survenue lors de la confirmation.");
      } finally {
          setIsSubmitting(false);
      }
  };

  // Composant interne pour une étape de la timeline
  const TimelineStep = ({ 
      active, 
      completed, 
      icon: Icon, 
      title, 
      isLast = false 
  }: { active: boolean, completed: boolean, icon: any, title: string, isLast?: boolean }) => (
      <div className="flex relative pb-6">
          {!isLast && (
              <div className={`absolute left-3 top-6 bottom-0 w-0.5 ${completed ? 'bg-brand-500' : 'bg-gray-200'}`}></div>
          )}
          <div className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center border-2 mr-4 flex-shrink-0 ${
              active || completed 
              ? 'bg-brand-500 border-brand-500 text-white shadow-md shadow-brand-200' 
              : 'bg-white border-gray-300 text-gray-300'
          }`}>
              <Icon size={12} />
          </div>
          <div>
              <p className={`text-xs font-bold ${active || completed ? 'text-gray-900' : 'text-gray-400'}`}>{title}</p>
              {active && <p className="text-[10px] text-brand-600 font-medium animate-pulse">En cours...</p>}
          </div>
      </div>
  );

  return (
    <div className="pb-20 relative">
        <h2 className="text-xl font-black text-gray-800 mb-4 flex items-center">
            <Receipt className="mr-2 text-brand-600"/> Mes Commandes
        </h2>

        <div className="flex bg-gray-100 p-1 rounded-xl mb-6">
            <button
                onClick={() => setActiveTab('active')}
                className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
                    activeTab === 'active' ? 'bg-white text-brand-600 shadow-sm' : 'text-gray-500'
                }`}
            >
                En cours ({activeOrders.length})
            </button>
            <button
                onClick={() => setActiveTab('past')}
                className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
                    activeTab === 'past' ? 'bg-white text-brand-600 shadow-sm' : 'text-gray-500'
                }`}
            >
                Historique ({pastOrders.length})
            </button>
            <button
                onClick={() => setActiveTab('messages')}
                className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
                    activeTab === 'messages' ? 'bg-white text-brand-600 shadow-sm' : 'text-gray-500'
                }`}
            >
                Messages
            </button>
        </div>

        {activeTab === 'messages' ? (
            <div className="space-y-3">
                {allConversations.length === 0 ? (
                    <div className="text-center py-10 text-gray-400">
                        <MessageSquare size={48} className="mx-auto mb-2 opacity-20"/>
                        <p className="font-bold">Aucune conversation</p>
                    </div>
                ) : (
                    allConversations.map((conv) => (
                        <div 
                            key={conv.id}
                            onClick={() => {
                                if (conv.type === 'order') {
                                    onChat(conv.order!);
                                } else {
                                    onChat({
                                        id: conv.id,
                                        userId: orders[0]?.userId || '',
                                        restaurantId: conv.restaurant?.id || '',
                                        status: 'completed',
                                        paymentMethod: 'cash',
                                        paymentStatus: 'paid',
                                        totalAmount: 0,
                                        items: [],
                                        createdAt: new Date().toISOString(),
                                        restaurant: conv.restaurant
                                    } as any);
                                }
                            }}
                            className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 flex items-center justify-between hover:shadow-md transition-all cursor-pointer group"
                        >
                            <div className="flex items-center space-x-3">
                                <div className="w-12 h-12 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-brand-600 dark:text-brand-400 font-black text-lg group-hover:scale-110 transition-transform">
                                    {conv.title.charAt(0)}
                                </div>
                                <div>
                                    <h4 className="font-bold text-gray-900 dark:text-white group-hover:text-brand-600 transition-colors">{conv.title}</h4>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">{conv.subtitle}</p>
                                </div>
                            </div>
                            <ChevronRight size={18} className="text-gray-300 group-hover:text-brand-600 transition-colors" />
                        </div>
                    ))
                )}
            </div>
        ) : displayedOrders.length === 0 ? (
            <div className="text-center text-gray-400 py-10">
                <ShoppingBag size={48} className="mx-auto mb-2 opacity-20"/>
                <p>{activeTab === 'active' ? 'Aucune commande en cours.' : 'Aucune commande passée.'}</p>
                <button onClick={onBrowse} className="mt-4 text-brand-600 font-bold underline">Commander un plat</button>
            </div>
        ) : (
            <div className="space-y-6">
                {displayedOrders.map(order => {
                   const isCompleted = order.status === 'completed';
                   const isCancelled = order.status === 'cancelled';
                   
                   // Déterminer l'état pour la timeline
                   const s = order.status;
                   const isPending = s === 'pending';
                   const isPrep = s === 'preparing';
                   const isReady = s === 'ready';
                   const isDelivering = s === 'delivering';
                   const isDelivered = s === 'delivered';
                   
                   // Logique un peu verbeuse pour la démo, mais claire
                   const step1Complete = !isPending && !isCancelled;
                   const step2Complete = (isReady || isDelivering || isDelivered || isCompleted) && !isCancelled;
                   const step3Complete = (isDelivering || isDelivered || isCompleted) && !isCancelled;
                   const step4Complete = isCompleted && !isCancelled;

                   return (
                    <div key={order.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        {/* Header de la carte */}
                        <div className="p-4 border-b border-gray-50 bg-gray-50/50">
                            <div className="flex justify-between items-start mb-1">
                                <div>
                                    <div className="flex items-center space-x-2">
                                        <h3 className="font-bold text-gray-800 text-lg">{order.restaurant?.name || 'Restaurant inconnu'}</h3>
                                        {order.isUrgent && (
                                            <span className="bg-red-500 text-white px-2 py-0.5 rounded text-[10px] font-bold uppercase flex items-center shadow-sm animate-pulse-fast">
                                                <Zap size={10} className="mr-1 fill-white" /> Urgent
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-gray-400">Commande #{order.id.slice(0,6)} • {new Date(order.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'})}</p>
                                </div>
                                <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wide ${getStatusColor(order.status)}`}>{getStatusLabel(order.status)}</span>
                            </div>
                            <div className="flex items-center space-x-2 mt-2">
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-gray-100 text-gray-600 flex items-center">
                                    {order.paymentMethod === 'cash' ? <Banknote size={10} className="mr-1"/> : <Smartphone size={10} className="mr-1"/>}
                                    {order.paymentMethod === 'cash' ? 'Cash' : `Mobile Money (${order.paymentNetwork?.toUpperCase()})`}
                                </span>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded flex items-center ${order.paymentStatus === 'paid' ? 'bg-green-100 text-green-700' : order.paymentStatus === 'failed' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                    {order.paymentStatus === 'paid' ? 'Payé' : order.paymentStatus === 'failed' ? 'Preuve refusée' : 'En attente de paiement'}
                                </span>
                            </div>
                        </div>

                        {/* Contenu principal */}
                        <div className="p-4">
                            {(order.paymentStatus === 'failed' || order.paymentStatus === 'pending') && order.status === 'pending' && order.paymentMethod !== 'cash' && (
                                <div className={`mb-4 p-3 border rounded-lg ${order.paymentStatus === 'failed' ? 'bg-red-50 border-red-100' : 'bg-blue-50 border-blue-100'}`}>
                                    <p className={`text-xs font-bold mb-2 flex items-center ${order.paymentStatus === 'failed' ? 'text-red-600' : 'text-blue-600'}`}>
                                        <AlertCircle size={14} className="mr-1" />
                                        {order.paymentStatus === 'failed' ? "La preuve de paiement a été refusée. Veuillez en renvoyer une nouvelle." : "Vous pouvez modifier votre preuve de paiement si nécessaire."}
                                    </p>
                                    <label className={`flex items-center justify-center w-full py-2 px-4 border-2 border-dashed rounded-lg cursor-pointer transition-colors text-xs font-bold ${order.paymentStatus === 'failed' ? 'border-red-300 hover:bg-red-100 text-red-600' : 'border-blue-300 hover:bg-blue-100 text-blue-600'}`}>
                                        <Camera size={16} className="mr-2" />
                                        {order.paymentStatus === 'failed' ? "Uploader une nouvelle preuve" : "Changer la preuve de paiement"}
                                        <input 
                                            type="file" 
                                            accept="image/*" 
                                            className="hidden" 
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) handleReuploadPaymentProof(order.id, file);
                                            }} 
                                        />
                                    </label>
                                </div>
                            )}

                            {/* TIMELINE DE SUIVI (Seulement si pas annulé) */}
                            {!isCancelled && !isCompleted && (
                                <div className="mb-6 pl-2 mt-2">
                                    <TimelineStep 
                                        active={isPending} 
                                        completed={step1Complete} 
                                        icon={Clock} 
                                        title="Commande reçue" 
                                    />
                                    <TimelineStep 
                                        active={isPrep} 
                                        completed={step2Complete} 
                                        icon={ChefHat} 
                                        title="Préparation en cuisine" 
                                    />
                                    <TimelineStep 
                                        active={isReady || isDelivering} 
                                        completed={step3Complete} 
                                        icon={Bike} 
                                        title="En route vers vous" 
                                    />
                                    <TimelineStep 
                                        active={isDelivered} 
                                        completed={step4Complete} 
                                        icon={CheckCircle2} 
                                        title="Livré et savouré" 
                                        isLast
                                    />
                                </div>
                            )}

                            {/* CARTE DE SUIVI EN TEMPS RÉEL (Seulement si en livraison) */}
                            {(isDelivering || isDelivered) && (
                                <div className="animate-in fade-in slide-in-from-top-4 duration-500 mb-6">
                                    <div className="flex items-center justify-between mb-2">
                                        <h4 className="text-xs font-black text-brand-600 uppercase tracking-widest flex items-center">
                                            <Navigation size={14} className="mr-1 animate-pulse" /> Suivi en direct
                                        </h4>
                                        <span className="text-[10px] bg-brand-100 text-brand-600 px-2 py-0.5 rounded-full font-bold">
                                            {isDelivered ? 'Livreur arrivé' : 'Livreur à proximité'}
                                        </span>
                                    </div>
                                    <DeliveryTrackingMap 
                                        order={order} 
                                        restaurant={order.restaurant ? {
                                            id: order.restaurantId,
                                            name: order.restaurant.name,
                                            latitude: order.restaurant.latitude || -4.312,
                                            longitude: order.restaurant.longitude || 15.310,
                                        } as any : null} 
                                    />
                                </div>
                            )}

                            {/* Liste des articles simplifiée */}
                            <div className="bg-gray-50 p-3 rounded-lg mb-4 text-sm">
                                {order.deliveryLocation && (
                                    <div className="mb-3 pb-3 border-b border-gray-200">
                                        <div className="flex items-start text-xs text-gray-600">
                                            <MapPin size={14} className="mr-1.5 mt-0.5 text-brand-600 flex-shrink-0"/> 
                                            <div>
                                                <span className="font-bold block text-gray-800">Adresse de livraison:</span>
                                                {order.deliveryLocation.address}
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {order.items.map((item, idx) => (
                                    <div key={idx} className="flex justify-between items-center mb-1 last:mb-0">
                                        <div className="flex items-center text-gray-600">
                                            <span className="font-bold mr-2 text-xs text-gray-400">x{item.quantity}</span>
                                            <span>{item.name}</span>
                                        </div>
                                        <span className="font-medium text-gray-800 text-xs">
                                            {formatDualPrice((item.price || 0) * (item.quantity || 1), order.restaurant?.currency as 'USD' | 'CDF' || 'USD', order.exchangeRate, order.restaurant?.displayCurrencyMode)}
                                        </span>
                                    </div>
                                ))}
                                <div className="flex justify-between items-center pt-2 mt-2 border-t border-gray-200">
                                    <span className="font-bold text-gray-600">Total</span>
                                    <span className="font-black text-brand-600 text-sm">
                                        {formatDualPrice(order.totalAmount || 0, order.restaurant?.currency as 'USD' | 'CDF' || 'USD', order.exchangeRate, order.restaurant?.displayCurrencyMode)}
                                    </span>
                                </div>
                            </div>

                            {/* Actions */}
                            {!isCompleted && !isCancelled && (
                                <div className="space-y-3">
                                    {/* Bouton de confirmation de réception (Visible seulement si livré) */}
                                    {isDelivered ? (
                                        <button 
                                            onClick={() => setConfirmingOrder(order)}
                                            className="w-full py-3 bg-green-600 text-white rounded-xl font-bold shadow-lg shadow-green-200 animate-pulse hover:animate-none transition-transform active:scale-95 flex items-center justify-center"
                                        >
                                            <CheckCircle2 className="mr-2" size={20}/> {order.paymentMethod === 'cash' ? 'Confirmer réception & paiement' : 'Confirmer la réception'}
                                        </button>
                                    ) : (
                                        <div className="bg-gray-100 p-3 rounded-lg text-center">
                                            <p className="text-xs text-gray-500 font-bold italic">
                                                {isPending ? "En attente de validation par le restaurant..." : 
                                                 isPrep ? "Le restaurant prépare votre commande..." : 
                                                 isReady ? "Votre commande est prête ! En attente d'un livreur..." :
                                                 "Le livreur est en route..."}
                                            </p>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 gap-3">
                                        <button 
                                            onClick={() => window.open(`tel:${order.restaurant?.phone_number || '+243999999999'}`)} 
                                            className="flex items-center justify-center py-3 bg-white border border-gray-200 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-50 transition-colors"
                                        >
                                            <Phone size={16} className="mr-2" /> Appeler
                                        </button>
                                        <button 
                                            onClick={() => onChat(order)} 
                                            className="flex items-center justify-center py-3 bg-brand-600 text-white rounded-xl text-xs font-bold hover:bg-brand-700 shadow-lg shadow-brand-200 transition-all active:scale-95 relative overflow-hidden group"
                                        >
                                            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                                            <MessageSquare size={16} className="mr-2 relative z-10" /> 
                                            <span className="relative z-10">Discuter avec le resto</span>
                                        </button>
                                    </div>
                                    <div className="bg-blue-50 p-3 rounded-lg flex items-start space-x-3">
                                        <div className="bg-blue-100 p-1.5 rounded-full text-blue-600 mt-0.5">
                                            <MessageSquare size={12} />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-blue-800">Besoin d'aide ?</p>
                                            <p className="text-[10px] text-blue-600 leading-tight mt-0.5">
                                                Vous pouvez contacter le restaurant directement pour toute modification ou question sur votre commande.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                            
                            {isCompleted && (
                                <div className="text-center bg-green-50 p-3 rounded-lg border border-green-100">
                                    <p className="text-green-800 font-bold text-sm flex items-center justify-center">
                                        <CheckCircle2 size={16} className="mr-2"/> Commande terminée
                                    </p>
                                    <button onClick={onBrowse} className="text-xs text-green-700 underline mt-1">Commander à nouveau</button>
                                </div>
                            )}
                        </div>
                    </div>
                   );
                })}
            </div>
        )}

        {/* Modal de Confirmation */}
        {confirmingOrder && (
            <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 overflow-hidden">
                {/* Backdrop - Fixed separately to ensure it covers everything */}
                <div 
                    className="fixed inset-0 bg-black/70 backdrop-blur-md" 
                    style={{ zIndex: -1 }}
                    onClick={() => setConfirmingOrder(null)}
                ></div>
                
                {/* Modal Content */}
                <div 
                    className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-sm relative shadow-2xl overflow-hidden border border-white/20"
                >
                    <div className="bg-brand-600 p-6 text-white text-center relative">
                        <button 
                            onClick={() => setConfirmingOrder(null)} 
                            className="absolute top-4 right-4 p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors"
                        >
                            <X size={20} />
                        </button>
                        <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                            <CheckCircle2 size={32} className="text-white" />
                        </div>
                        <h3 className="text-2xl font-black mb-1">
                            {confirmingOrder.paymentMethod === 'cash' ? 'Commande Payée ?' : 'Commande Reçue ?'}
                        </h3>
                        <p className="text-brand-100 text-sm">Confirmez la réception de votre plat</p>
                    </div>
                    
                    <form onSubmit={handleConfirmReceipt} className="p-6 space-y-6">
                        {/* Note */}
                        <div className="text-center">
                            <label className="block text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Notez l'expérience</label>
                            <div className="flex justify-center space-x-3">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <button 
                                        key={star} 
                                        type="button"
                                        onClick={() => setRating(star)}
                                        className={`transition-all duration-200 transform hover:scale-125 ${rating >= star ? 'text-yellow-400' : 'text-gray-200'}`}
                                    >
                                        <Star size={36} fill={rating >= star ? "currentColor" : "none"} strokeWidth={2} />
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Commentaire */}
                        <div>
                            <label className="block text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">Votre avis</label>
                            <textarea 
                                className="w-full p-4 bg-gray-50 dark:bg-gray-700 border-none rounded-2xl text-sm focus:ring-2 focus:ring-brand-500 outline-none resize-none transition-all"
                                rows={3}
                                placeholder="Dites-nous ce que vous en avez pensé..."
                                value={comment}
                                onChange={e => setComment(e.target.value)}
                            />
                        </div>

                        {/* Preuve Photo */}
                        <div>
                            <label className="block text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">Photo (Optionnel)</label>
                            <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-2xl cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-all group">
                                {proofFile ? (
                                    <div className="text-center p-2">
                                        <CheckCircle2 className="mx-auto mb-1 text-green-500" size={24} />
                                        <p className="text-green-600 font-bold text-xs truncate max-w-[200px]">{proofFile.name}</p>
                                    </div>
                                ) : (
                                    <div className="text-center text-gray-400 group-hover:text-brand-500 transition-colors">
                                        <Camera size={28} className="mx-auto mb-2" />
                                        <p className="text-xs font-medium">Prendre une photo</p>
                                    </div>
                                )}
                                <input type="file" accept="image/*" className="hidden" onChange={e => setProofFile(e.target.files?.[0] || null)} />
                            </label>
                        </div>

                        <button 
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full bg-brand-600 hover:bg-brand-700 text-white font-black py-4 rounded-2xl shadow-xl shadow-brand-500/20 transition-all active:scale-95 flex items-center justify-center disabled:opacity-50 disabled:scale-100"
                        >
                            {isSubmitting ? (
                                <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                                'Confirmer la réception'
                            )}
                        </button>
                    </form>
                </div>
            </div>
        )}
    </div>
  );
};