import React, { useState, useEffect } from 'react';
import { 
  Users, Store, ShoppingBag, DollarSign, Activity, 
  Search, CheckCircle, XCircle, LogOut, Shield, 
  Trash2, AlertTriangle, Database, Type, Sun, Moon, Menu, X, Bell,
  Eye, EyeOff, Download, FileText, Mail, MessageSquare, MessageCircle,
  Settings, UserPlus, UserMinus, ShieldCheck, ShieldAlert, RefreshCw, Bike,
  CreditCard, Calendar
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { APP_LOGO_URL } from '../constants';
import { formatDualPrice } from '../utils/format';
import { User, Restaurant, Order, Theme, Language, AppFont, AppSettings } from '../types';
import { toast } from 'sonner';
import { sendEmail, sendVerificationStatusEmail, sendSupportReplyEmail } from '../lib/email';
import { useTranslation } from '../lib/i18n';

interface Props {
  user: User;
  onLogout: () => void;
  theme?: Theme;
  setTheme?: (t: Theme) => void;
  language?: Language;
  setLanguage?: (l: Language) => void;
  font?: AppFont;
  setFont?: (f: AppFont) => void;
}

type AdminView = 'overview' | 'users' | 'restaurants' | 'publications' | 'verifications' | 'products' | 'support' | 'messages' | 'settings' | 'requests';

export const SuperAdminDashboard: React.FC<Props> = ({ user, onLogout, theme, setTheme, language, setLanguage, font, setFont }) => {
  const t = useTranslation(language || 'fr');
  const [activeView, setActiveView] = useState<AdminView>('overview');
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalRestaurants: 0,
    totalOrders: 0,
    totalRevenue: 0,
    pendingVerifications: 0,
    openTickets: 0,
    subscriptionRequests: 0
  });
  const [users, setUsers] = useState<any[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [pendingVerifications, setPendingVerifications] = useState<Restaurant[]>([]);
  const [publications, setPublications] = useState<any[]>([]);
  const [supportTickets, setSupportTickets] = useState<any[]>([]);
  const [orderMessages, setOrderMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDocument, setSelectedDocument] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [emailModal, setEmailModal] = useState<{ isOpen: boolean; to: string; subject: string; body: string } | null>(null);
  const [subscriptionModal, setSubscriptionModal] = useState<{ isOpen: boolean; restaurant: Restaurant | null }>({ isOpen: false, restaurant: null });
  const [selectedTier, setSelectedTier] = useState<string>('free');
  const [subEndDate, setSubEndDate] = useState<string>('');
  const [appSettings, setAppSettings] = useState<AppSettings>({
    support_email: '',
    support_phone: '',
    support_whatsapp: '',
    office_address: ''
  });

  useEffect(() => {
    fetchStats();
    
    // Listen for realtime changes
    const channel = supabase
      .channel('superadmin_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_tickets' }, (payload) => {
        console.log("Ticket change detected:", payload);
        fetchStats();
        // Since this effect doesn't depend on activeView, we can't easily call fetchSupportTickets() here
        // unless we use a ref for activeView or just fetch it anyway if needed.
        // For simplicity, we'll rely on the other useEffect to fetch when the view is active.
        
        if (payload.eventType === 'INSERT') {
          toast.info("Nouveau ticket de support reçu !", {
            description: (payload.new as any).subject,
            duration: 5000
          });
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurants' }, () => {
        console.log("Restaurant change detected");
        fetchStats();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        console.log("Order change detected");
        fetchStats();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        console.log("Message change detected");
        // We'll let the other useEffect or manual refresh handles the data
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []); // Only once at mount

  useEffect(() => {
    if (activeView === 'users') fetchUsers();
    if (activeView === 'restaurants') fetchRestaurants();
    if (activeView === 'verifications') fetchPendingVerifications();
    if (activeView === 'publications') fetchPublications();
    if (activeView === 'support') fetchSupportTickets();
    if (activeView === 'messages') fetchOrderMessages();
    if (activeView === 'settings') fetchAppSettings();
    if (activeView === 'requests') {
        fetchPendingVerifications();
        fetchSupportTickets();
    }
  }, [activeView]);

  const fetchAppSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('id', 'global')
        .single();
      
      if (error) throw error;
      if (data?.value) {
        setAppSettings(data.value as AppSettings);
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
    }
    setLoading(false);
  };

  const updateAppSettings = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('app_settings')
        .update({ value: appSettings })
        .eq('id', 'global');
      
      if (error) throw error;
      toast.success("Paramètres mis à jour avec succès !");
    } catch (error: any) {
      console.error("Error updating settings:", error);
      toast.error("Erreur : " + error.message);
    }
    setLoading(false);
  };

  const handleNavigation = (view: AdminView) => {
      setActiveView(view);
      setIsMobileMenuOpen(false);
  };

  const fetchStats = async () => {
    try {
      const { count: userCount, error: err1 } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
      const { count: restoCount, error: err2 } = await supabase.from('restaurants').select('*', { count: 'exact', head: true });
      const { count: orderCount, error: err3 } = await supabase.from('orders').select('*', { count: 'exact', head: true });
      const { count: verificationCount, error: err4 } = await supabase.from('restaurants').select('*', { count: 'exact', head: true }).eq('verification_status', 'pending');
      const { count: ticketCount, error: err5 } = await supabase.from('support_tickets').select('*', { count: 'exact', head: true }).eq('status', 'open');
      const { count: subCount } = await supabase.from('support_tickets').select('*', { count: 'exact', head: true }).eq('status', 'open').ilike('subject', '%abonnement%');
      
      if (err1 || err2 || err3 || err4 || err5) {
          console.error("Stats fetching errors:", { err1, err2, err3, err4, err5 });
      }

      setStats({
        totalUsers: userCount || 0,
        totalRestaurants: restoCount || 0,
        totalOrders: orderCount || 0,
        totalRevenue: (orderCount || 0) * 25,
        pendingVerifications: verificationCount || 0,
        openTickets: ticketCount || 0,
        subscriptionRequests: subCount || 0
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      if (data) setUsers(data);
    } catch (error: any) {
      console.error("Error fetching users:", error);
      toast.error(t('error') + " : " + (error.message || "Erreur inconnue"));
    }
    setLoading(false);
  };

  const fetchRestaurants = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('restaurants').select('*').order('created_at', { ascending: false });
      
      if (error) throw error;
      if (data) setRestaurants(data.map((r: any) => ({
          ...r,
          ownerId: r.owner_id,
          reviewCount: r.review_count,
          preparationTime: r.preparation_time,
          estimatedDeliveryTime: r.estimated_delivery_time,
          deliveryAvailable: r.delivery_available,
          coverImage: r.cover_image,
          isVerified: r.is_verified === true,
          isOpen: r.is_open === true,
          isActive: r.is_active !== false,
          subscriptionTier: r.subscription_tier,
          subscriptionStatus: r.subscription_status,
          subscriptionEndDate: r.subscription_end_date,
          menu: []
      })));
    } catch (error: any) {
      console.error("Error fetching restaurants:", error);
      toast.error("Erreur chargement restaurants: " + error.message);
    }
    setLoading(false);
  };

  const fetchPendingVerifications = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
          .from('restaurants')
          .select('*')
          .eq('verification_status', 'pending')
          .order('created_at', { ascending: false });
          
      if (error) throw error;
      
      if (data) setPendingVerifications(data.map((r: any) => ({
          ...r,
          ownerId: r.owner_id,
          reviewCount: r.review_count,
          preparationTime: r.preparation_time,
          estimatedDeliveryTime: r.estimated_delivery_time,
          deliveryAvailable: r.delivery_available,
          coverImage: r.cover_image,
          isVerified: r.is_verified === true,
          isOpen: r.is_open === true,
          isActive: r.is_active !== false,
          verificationStatus: r.verification_status,
          verificationDocs: r.verification_docs,
          verificationPaymentStatus: r.verification_payment_status,
          subscriptionTier: r.subscription_tier,
          subscriptionStatus: r.subscription_status,
          subscriptionEndDate: r.subscription_end_date,
          menu: []
      })));
    } catch (error: any) {
      console.error("Error fetching verifications:", error);
      toast.error("Erreur lors du chargement des vérifications : " + error.message);
    }
    setLoading(false);
  };

  const cleanVerificationData = async () => {
    setLoading(true);
    try {
      // On récupère tous les 'pending' pour vérifier localement car les filtres JSON complexes sont limités en RLS/RPC
      const { data: pending, error: fetchError } = await supabase
        .from('restaurants')
        .select('id, verification_docs')
        .eq('verification_status', 'pending');
        
      if (fetchError) throw fetchError;
      
      const toReset = pending?.filter(r => 
        !r.verification_docs || 
        !r.verification_docs.registryNumber || 
        r.verification_docs.registryNumber.trim() === ""
      ).map(r => r.id) || [];
      
      if (toReset.length > 0) {
        const { error: updateError } = await supabase
          .from('restaurants')
          .update({ 
            verification_status: 'unverified',
            verification_requested: false 
          })
          .in('id', toReset);
          
        if (updateError) throw updateError;
        toast.success(`${toReset.length} demande(s) nettoyée(s) !`);
      } else {
        toast.info("Aucune donnée orpheline trouvée.");
      }
      
      fetchPendingVerifications();
      fetchRestaurants();
    } catch (error: any) {
      console.error("Cleanup error:", error);
      toast.error("Erreur lors du nettoyage : " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchPublications = async () => {
    setLoading(true);
    try {
      const { data: menuData, error: menuError } = await supabase
          .from('menu_items')
          .select('*, restaurants(name, currency, exchange_rate, display_currency_mode)')
          .order('created_at', { ascending: false });
          
      if (menuError) throw menuError;

      const { data: promoData, error: promoError } = await supabase
          .from('promotions')
          .select('*, restaurants(name, currency, exchange_rate, display_currency_mode)')
          .order('created_at', { ascending: false });
          
      if (promoError) throw promoError;

      const combined = [
          ...(menuData || []).map((m: any) => ({ ...m, pubType: 'menu_item', restaurantName: m.restaurants?.name, restaurantCurrency: m.restaurants?.currency, restaurantExchangeRate: m.restaurants?.exchange_rate, restaurantDisplayCurrencyMode: m.restaurants?.display_currency_mode })),
          ...(promoData || []).map((p: any) => ({ ...p, pubType: 'promotion', restaurantName: p.restaurants?.name, restaurantCurrency: p.restaurants?.currency, restaurantExchangeRate: p.restaurants?.exchange_rate, restaurantDisplayCurrencyMode: p.restaurants?.display_currency_mode }))
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      setPublications(combined);
    } catch (error: any) {
      console.error("Error fetching publications:", error);
      toast.error("Erreur chargement publications: " + error.message);
    }
    setLoading(false);
  };

  const fetchSupportTickets = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*, profiles(full_name, email)')
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      if (data) setSupportTickets(data);
    } catch (error: any) {
      console.error("Error fetching tickets:", error);
      toast.error("Erreur chargement tickets: " + error.message);
    }
    setLoading(false);
  };

  const fetchOrderMessages = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*, profiles:sender_id(full_name, email)')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      if (data) {
          // Fetch order info manually for those that have it
          const orderIds = data.filter(m => m.order_id && !m.order_id.startsWith('sub-')).map(m => m.order_id);
          let ordersMap = new Map();
          
          if (orderIds.length > 0) {
              const { data: ordersData } = await supabase
                .from('orders')
                .select('id, total_amount')
                .in('id', orderIds);
              ordersData?.forEach(o => ordersMap.set(o.id, o));
          }
          
          const enrichedMessages = data.map(m => ({
              ...m,
              orders: ordersMap.get(m.order_id) || null
          }));
          
          setOrderMessages(enrichedMessages);
      }
    } catch (error) {
      console.error("Error fetching messages:", error);
    }
    setLoading(false);
  };

  const deleteOrderMessage = async (messageId: string) => {
      if (!window.confirm("Voulez-vous vraiment supprimer ce message ?")) return;
      
      setLoading(true);
      try {
          console.log("🗑️ Suppression du message:", messageId);
          const { error } = await supabase.from('messages').delete().eq('id', messageId);
          if (error) {
              console.error("Supabase delete message error:", error);
              throw error;
          }
          toast.success("Message supprimé");
          await fetchOrderMessages();
      } catch (error: any) {
          console.error("Delete message error:", error);
          toast.error("Erreur lors de la suppression : " + (error.message || "Vérifiez vos permissions"));
      } finally {
          setLoading(false);
      }
  };

  const updateTicketStatus = async (ticketId: string, status: string, notes?: string) => {
    try {
      const { error } = await supabase
        .from('support_tickets')
        .update({ status, admin_notes: notes || selectedTicket?.admin_notes })
        .eq('id', ticketId);
      
      if (error) throw error;
      toast.success("Ticket mis à jour");

      // Insert notification for the user
      if (selectedTicket) {
          const statusLabels: Record<string, string> = {
              'open': 'ouvert',
              'in_progress': 'en cours',
              'resolved': 'résolu',
              'closed': 'fermé'
          };

          await supabase.from('notifications').insert({
              user_id: selectedTicket.user_id,
              title: `Support: ${selectedTicket.subject}`,
              message: notes || `Votre ticket est maintenant ${statusLabels[status] || status}.`,
              type: 'support',
              data: { ticket_id: ticketId, status }
          });
      }

      // Send email if notes are added or status is resolved
      if (selectedTicket && (notes || status === 'resolved')) {
          const { data: userProfile } = await supabase.from('profiles').select('full_name, email').eq('id', selectedTicket.user_id).single();
          if (userProfile?.email) {
              sendSupportReplyEmail(
                  userProfile.full_name || 'Utilisateur',
                  userProfile.email,
                  selectedTicket.subject || 'Votre demande de support',
                  notes || selectedTicket.admin_notes || 'Votre ticket a été mis à jour.'
              );
          }
      }

      fetchSupportTickets();
      fetchStats();
      setSelectedTicket(null);
    } catch (error) {
      toast.error("Erreur lors de la mise à jour");
    }
  };

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    isLoading?: boolean;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const deleteVerificationRequest = async (restoId: string) => {
    console.log("🛠️ deleteVerificationRequest for:", restoId);
    setConfirmModal({
        isOpen: true,
        title: "Supprimer la demande",
        message: "Voulez-vous supprimer définitivement cette demande de vérification ?",
        onConfirm: async () => {
            setConfirmModal(prev => ({ ...prev, isLoading: true }));
            try {
                console.log("🗑️ Updating identity verification status to unverified for:", restoId);
                const { error } = await supabase.from('restaurants').update({
                    verification_status: 'unverified',
                    verification_requested: false,
                    verification_docs: null
                }).eq('id', restoId);
                
                if (error) throw error;
                
                toast.success('Demande de vérification supprimée');
                fetchPendingVerifications();
                fetchStats();
                setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: () => {} });
            } catch (error: any) {
                console.error("Delete verification error:", error);
                toast.error("Erreur: " + (error.message || "Permissions ?"));
                setConfirmModal(prev => ({ ...prev, isLoading: false }));
            }
        }
    });
  };

  const deleteTicket = async (ticketId: string) => {
    console.log("🛠️ deleteTicket for:", ticketId);
    setConfirmModal({
        isOpen: true,
        title: "Supprimer le ticket",
        message: "Voulez-vous vraiment supprimer ce ticket ? Cette action est irréversible.",
        onConfirm: async () => {
            setConfirmModal(prev => ({ ...prev, isLoading: true }));
            try {
                console.log("🗑️ Deleting ticket row:", ticketId);
                const { error } = await supabase.from('support_tickets').delete().eq('id', ticketId);
                if (error) throw error;
                
                toast.success("Ticket supprimé avec succès");
                fetchSupportTickets();
                fetchStats();
                setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: () => {} });
            } catch (error: any) {
                console.error("Delete ticket error:", error);
                toast.error("Erreur: " + (error.message || "Permissions ?"));
                setConfirmModal(prev => ({ ...prev, isLoading: false }));
            }
        }
    });
  };

  const togglePublicationStatus = async (pub: any) => {
      const table = pub.pubType === 'menu_item' ? 'menu_items' : 'promotions';
      const currentStatus = pub.pubType === 'menu_item' ? pub.is_available : pub.is_active;
      const updateField = pub.pubType === 'menu_item' ? { is_available: !currentStatus } : { is_active: !currentStatus };
      
      const { error } = await supabase.from(table).update(updateField).eq('id', pub.id);
      if (error) {
          if (error.code === '42703') {
              toast.error("La colonne is_active n'existe pas encore pour les promotions. Veuillez exécuter la commande SQL fournie.");
          } else {
              toast.error("Erreur lors de la modification");
          }
      } else {
          toast.success("Statut mis à jour !");
          fetchPublications();
      }
  };

  const deletePublication = async (pub: any) => {
      if (!window.confirm("Voulez-vous vraiment supprimer cette publication ?")) return;
      
      setLoading(true);
      try {
          const table = pub.pubType === 'menu_item' ? 'menu_items' : 'promotions';
          console.log("🗑️ Suppression de la publication:", pub.id, "Table:", table);
          const { error } = await supabase.from(table).delete().eq('id', pub.id);
          if (error) {
              console.error("Supabase delete publication error:", error);
              throw error;
          }
          toast.success("Publication supprimée !");
          await fetchPublications();
      } catch (error: any) {
          console.error("Delete publication error:", error);
          toast.error("Erreur lors de la suppression : " + (error.message || "Vérifiez vos permissions"));
      } finally {
          setLoading(false);
      }
  };

  const handleVerification = async (restoId: string, status: 'verified' | 'rejected') => {
      setLoading(true);
      try {
          const { error } = await supabase.from('restaurants').update({
              verification_status: status,
              is_verified: status === 'verified',
              verification_requested: false // Reset request flag after decision
          }).eq('id', restoId);
          
          if (error) {
              console.error("Update error:", error);
              toast.error("Erreur de mise à jour : " + error.message);
              return;
          }
          
          toast.success(`Restaurant ${status === 'verified' ? 'vérifié' : 'rejeté'} avec succès !`);
          
          // Send email and platform notification to owner
          const { data: resto } = await supabase.from('restaurants').select('name, owner_id').eq('id', restoId).single();
          if (resto && resto.owner_id) {
              // Platform Notification
              await supabase.from('notifications').insert({
                  user_id: resto.owner_id,
                  restaurant_id: restoId,
                  title: status === 'verified' ? "Compte Vérifié !" : "Demande de vérification rejetée",
                  message: status === 'verified' 
                      ? `Félicitations ! Votre restaurant "${resto.name}" est désormais vérifié.` 
                      : `Votre demande de vérification pour "${resto.name}" a été rejetée. Veuillez vérifier vos documents.`,
                  type: 'verification_result',
                  data: { restaurant_id: restoId, status }
              });

              // Email Notification
              const { data: owner } = await supabase.from('profiles').select('email').eq('id', resto.owner_id).single();
              if (owner?.email) {
                  sendVerificationStatusEmail(resto.name, owner.email, status);
              }
          }

          fetchPendingVerifications();
          fetchRestaurants();
          fetchStats(); // Update counters
      } catch (error: any) {
          console.error("Verification error:", error);
          toast.error("Erreur : " + (error.message || "Erreur inconnue"));
      } finally {
          setLoading(false);
      }
  };

  const sendVerificationRequest = async (restoId: string) => {
      setLoading(true);
      try {
          // Get restaurant owner_id
          const { data: restoData, error: fetchError } = await supabase
              .from('restaurants')
              .select('owner_id, name')
              .eq('id', restoId)
              .single();
          
          if (fetchError) throw fetchError;

          // Update restaurant to mark verification as requested
          const { error: updateError } = await supabase.from('restaurants').update({
              verification_requested: true,
              verification_status: 'unverified' // Ensure it's not 'pending' yet
          }).eq('id', restoId);
          
          if (updateError) throw updateError;

          // Create notification for the owner
          const { error: notifError } = await supabase.from('notifications').insert({
              user_id: restoData.owner_id,
              title: "Vérification requise",
              message: `L'administrateur demande la vérification de votre restaurant "${restoData.name}". Veuillez soumettre vos documents dans les paramètres.`,
              type: 'verification_request',
              data: { restaurant_id: restoId }
          });

          if (notifError) console.error("Notification error:", notifError);
          
          toast.success("Demande de vérification envoyée !");
          fetchRestaurants();
      } catch (error: any) {
          console.error("Verification request error:", error);
          toast.error("Erreur : " + error.message);
      } finally {
          setLoading(false);
      }
  };

  const toggleRestaurantStatus = async (restoId: string, currentStatus: boolean) => {
      const { error } = await supabase.from('restaurants').update({ is_active: !currentStatus }).eq('id', restoId);
      if (error) {
          toast.error("Erreur lors de la modification du statut");
      } else {
          toast.success(`Restaurant ${!currentStatus ? 'affiché' : 'masqué'}`);
          fetchRestaurants();
      }
  };

  const deleteRestaurant = async (restoId: string) => {
      if (!window.confirm("Voulez-vous vraiment supprimer définitivement ce restaurant ?")) return;
      
      setLoading(true);
      try {
          const { error } = await supabase.from('restaurants').delete().eq('id', restoId);
          if (error) {
              console.error("Delete restaurant error:", error);
              throw new Error(error.message);
          }
          toast.success("Restaurant supprimé avec succès");
          await fetchRestaurants();
          await fetchStats();
      } catch (error: any) {
          console.error("Delete restaurant catch error:", error);
          toast.error("Erreur lors de la suppression : " + (error.message || "Vérifiez les contraintes de base de données"));
      } finally {
          setLoading(false);
      }
  };

  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
      const { error } = await supabase.from('profiles').update({ is_active: !currentStatus }).eq('id', userId);
      if (error) {
          toast.error("Erreur lors de la modification du statut");
      } else {
          toast.success(`Utilisateur ${!currentStatus ? 'activé' : 'désactivé'}`);
          fetchUsers();
      }
  };

  const changeUserRole = async (userId: string, currentRole: string) => {
      const newRole = currentRole === 'business' ? 'client' : 'business';
      
      const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
      if (error) {
          toast.error("Erreur lors du changement de rôle");
          console.error(error);
      } else {
          toast.success(`Rôle changé avec succès en ${newRole}`);
          fetchUsers();
      }
  };

  const deleteUser = async (userId: string) => {
      setConfirmModal({
          isOpen: true,
          title: "Supprimer l'utilisateur",
          message: "Voulez-vous vraiment supprimer définitivement cet utilisateur et son profil ?",
          onConfirm: async () => {
              setConfirmModal(prev => ({ ...prev, isLoading: true }));
              try {
                  console.log("🗑️ Deleting user account:", userId);
                  // Try to use RPC for full account deletion
                  const { error: rpcError } = await supabase.rpc('delete_user_account', { user_id: userId });
                  
                  if (rpcError) {
                      console.warn("RPC delete failed, falling back to profile delete:", rpcError);
                      // Fallback to just deleting the profile
                      const { error: profileError } = await supabase.from('profiles').delete().eq('id', userId);
                      if (profileError) throw profileError;
                  }
                  
                  toast.success("Utilisateur supprimé avec succès");
                  await fetchUsers();
                  await fetchStats();
                  setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: () => {} });
              } catch (error: any) {
                  console.error("Delete user error:", error);
                  toast.error("Erreur lors de la suppression : " + (error.message || "Erreur inconnue"));
                  setConfirmModal(prev => ({ ...prev, isLoading: false }));
              }
          }
      });
  };

  const updateSubscription = async () => {
    if (!subscriptionModal.restaurant) return;
    setLoading(true);
    try {
        const { error } = await supabase
            .from('restaurants')
            .update({
                subscription_tier: selectedTier,
                subscription_end_date: subEndDate || null,
                subscription_status: 'active'
            })
            .eq('id', subscriptionModal.restaurant.id);
        
        if (error) throw error;
        toast.success("Abonnement mis à jour !");
        setSubscriptionModal({ isOpen: false, restaurant: null });
        fetchRestaurants();
    } catch (error: any) {
        toast.error("Erreur : " + error.message);
    }
    setLoading(false);
  };

  const viewDocument = async (documentUrl: string) => {
      if (!documentUrl) {
          toast.error("Aucun document disponible");
          return;
      }
      setSelectedDocument(documentUrl);
      window.open(documentUrl, '_blank');
  };

  const downloadDocument = async (documentUrl: string, fileName: string) => {
      try {
          const response = await fetch(documentUrl);
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
          toast.success("Téléchargement démarré");
      } catch (error) {
          console.error("Download error:", error);
          toast.error("Erreur lors du téléchargement");
      }
  };

  // Filtrer les utilisateurs par recherche
  const filteredUsers = users.filter(u => {
      const search = searchTerm.toLowerCase();
      const fullName = (u.full_name || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      const id = (u.id || '').toLowerCase();
      
      return (fullName.includes(search) || email.includes(search) || id.includes(search)) && u.role !== 'superadmin';
  });

  const syncUsers = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.rpc('sync_users_to_profiles');
      if (error) throw error;
      toast.success("Utilisateurs synchronisés !");
      fetchUsers();
      fetchStats();
    } catch (error) {
      console.error("Sync error:", error);
      toast.error("Erreur lors de la synchronisation");
    } finally {
      setLoading(false);
    }
  };

  const renderSupport = () => (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden animate-in fade-in">
        <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
            <div>
                <h3 className="font-bold text-lg text-gray-800 dark:text-white">Centre de Support</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Gérez les demandes d'assistance des utilisateurs</p>
            </div>
            <button onClick={fetchSupportTickets} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
                <Activity size={20} className="text-gray-400" />
            </button>
        </div>
        
        <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 font-bold uppercase text-xs">
                    <tr>
                        <th className="px-6 py-4">Utilisateur</th>
                        <th className="px-6 py-4">Sujet</th>
                        <th className="px-6 py-4">Statut</th>
                        <th className="px-6 py-4">Date</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {supportTickets.length === 0 ? (
                        <tr>
                            <td colSpan={5} className="p-12 text-center text-gray-500 dark:text-gray-400">
                                <Mail size={48} className="mx-auto mb-3 opacity-20" />
                                Aucun ticket de support pour le moment
                            </td>
                        </tr>
                    ) : (
                        supportTickets.map(ticket => (
                            <tr key={ticket.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="font-bold text-gray-900 dark:text-white">{ticket.profiles?.full_name || 'Inconnu'}</div>
                                    <div className="text-xs text-gray-400">{ticket.profiles?.email}</div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="font-medium text-gray-800 dark:text-gray-200">{ticket.subject}</div>
                                    <div className="text-xs text-gray-500 truncate max-w-xs">{ticket.message}</div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase ${
                                        ticket.status === 'open' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                        ticket.status === 'in_progress' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                        'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                    }`}>
                                        {ticket.status === 'open' ? 'Ouvert' : ticket.status === 'in_progress' ? 'En cours' : 'Résolu'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-gray-500 dark:text-gray-400 text-xs">
                                    {new Date(ticket.created_at).toLocaleString()}
                                </td>
                                <td className="px-6 py-4 text-right space-x-2">
                                    <button 
                                        onClick={() => setSelectedTicket(ticket)}
                                        className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                        title="Répondre / Gérer"
                                    >
                                        <MessageCircle size={18} />
                                    </button>
                                    <button 
                                        onClick={() => deleteTicket(ticket.id)}
                                        disabled={loading}
                                        className="p-2 text-gray-400 hover:text-red-500 rounded-lg transition-colors disabled:opacity-50"
                                        title="Supprimer"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>

        {/* Ticket Detail Modal */}
        {selectedTicket && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                <div className="bg-white dark:bg-gray-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                    <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50">
                        <div>
                            <h3 className="font-black text-gray-900 dark:text-white">Détails du Ticket</h3>
                            <p className="text-xs text-gray-500">ID: {selectedTicket.id}</p>
                        </div>
                        <button onClick={() => setSelectedTicket(null)} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                    <div className="p-6 space-y-4">
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800">
                            <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase mb-1">Message de l'utilisateur</p>
                            <p className="text-sm text-gray-800 dark:text-gray-200 font-medium leading-relaxed">{selectedTicket.message}</p>
                        </div>
                        
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Notes Admin / Réponse</label>
                            <textarea 
                                className="w-full p-4 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none dark:text-white min-h-[120px]"
                                placeholder="Saisissez vos notes ou la réponse ici..."
                                value={selectedTicket.admin_notes || ''}
                                onChange={(e) => setSelectedTicket({...selectedTicket, admin_notes: e.target.value})}
                            />
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            <button 
                                onClick={() => updateTicketStatus(selectedTicket.id, 'open')}
                                className={`py-2 rounded-lg text-xs font-bold transition-all ${selectedTicket.status === 'open' ? 'bg-red-600 text-white shadow-lg' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}
                            >
                                Ouvert
                            </button>
                            <button 
                                onClick={() => updateTicketStatus(selectedTicket.id, 'in_progress')}
                                className={`py-2 rounded-lg text-xs font-bold transition-all ${selectedTicket.status === 'in_progress' ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}
                            >
                                En cours
                            </button>
                            <button 
                                onClick={() => updateTicketStatus(selectedTicket.id, 'resolved')}
                                className={`py-2 rounded-lg text-xs font-bold transition-all ${selectedTicket.status === 'resolved' ? 'bg-green-600 text-white shadow-lg' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}
                            >
                                Résolu
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}
    </div>
  );

  const renderMessages = () => (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden animate-in fade-in">
        <div className="p-6 border-b border-gray-100 dark:border-gray-700">
            <h3 className="font-bold text-lg text-gray-800 dark:text-white">Messages des Commandes</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Surveillez les échanges entre clients, restaurants et livreurs</p>
        </div>
        <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 font-bold uppercase text-xs">
                    <tr>
                        <th className="px-6 py-4">Expéditeur</th>
                        <th className="px-6 py-4">Commande</th>
                        <th className="px-6 py-4">Message</th>
                        <th className="px-6 py-4">Date</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {orderMessages.length === 0 ? (
                        <tr>
                            <td colSpan={4} className="p-12 text-center text-gray-500 dark:text-gray-400">
                                <MessageSquare size={48} className="mx-auto mb-3 opacity-20" />
                                Aucun message de commande trouvé
                            </td>
                        </tr>
                    ) : (
                        orderMessages.map(msg => (
                            <tr key={msg.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="font-bold text-gray-900 dark:text-white">{msg.profiles?.full_name || 'Inconnu'}</div>
                                    <div className="text-xs text-gray-400">{msg.profiles?.email}</div>
                                </td>
                                <td className="px-6 py-4">
                                    {msg.order_id?.startsWith('sub-') ? (
                                        <div className="flex items-center text-xs font-bold text-blue-600 dark:text-blue-400">
                                            <Users size={12} className="mr-1" /> Chat Abonné
                                        </div>
                                    ) : (
                                        <>
                                            <div className="text-xs font-bold text-brand-600 dark:text-brand-400">#{msg.orders?.id?.slice(0, 8) || msg.order_id?.slice(0, 8)}</div>
                                            <div className="text-[10px] text-gray-400">{msg.orders?.total_amount || '0'} USD</div>
                                        </>
                                    )}
                                </td>
                                <td className="px-6 py-4">
                                    <div className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">{msg.content}</div>
                                </td>
                                <td className="px-6 py-4 text-gray-500 dark:text-gray-400 text-xs">
                                    {new Date(msg.created_at).toLocaleString()}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button 
                                        onClick={() => deleteOrderMessage(msg.id)}
                                        className="p-2 text-gray-400 hover:text-red-500 rounded-lg transition-colors"
                                        title="Supprimer"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    </div>
  );

  const handleSendManualEmail = async () => {
      if (!emailModal) return;
      if (!emailModal.subject || !emailModal.body) {
          toast.error("Veuillez remplir tous les champs");
          return;
      }

      setLoading(true);
      try {
          const result = await sendEmail({
              to: emailModal.to,
              subject: emailModal.subject,
              html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                  <div style="background: #ea580c; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
                    <h1 style="margin: 0; font-size: 20px;">Message de l'administration DashMeals</h1>
                  </div>
                  <div style="padding: 20px; border: 1px solid #eee; border-top: none; border-radius: 0 0 8px 8px;">
                    <div style="line-height: 1.6; color: #333;">
                      ${emailModal.body.replace(/\n/g, '<br/>')}
                    </div>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
                    <p style="font-size: 12px; color: #666;">Ceci est un message officiel de l'équipe DashMeals.</p>
                  </div>
                </div>
              `
          });

          if (result) {
              toast.success("E-mail envoyé avec succès !");
              setEmailModal(null);
          } else {
              toast.error("Erreur lors de l'envoi de l'e-mail");
          }
      } catch (error) {
          toast.error("Erreur lors de l'envoi");
      } finally {
          setLoading(false);
      }
  };

  const renderEmailModal = () => {
      if (!emailModal) return null;
      return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
              <div className="bg-white dark:bg-gray-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                      <h3 className="font-black text-gray-900 dark:text-white">Envoyer un E-mail</h3>
                      <button onClick={() => setEmailModal(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
                          <X size={20} />
                      </button>
                  </div>
                  <div className="p-6 space-y-4">
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Destinataire</label>
                          <input 
                              type="text" 
                              disabled 
                              value={emailModal.to}
                              className="w-full p-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm opacity-70"
                          />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Sujet</label>
                          <input 
                              type="text" 
                              placeholder="Sujet de l'e-mail"
                              value={emailModal.subject}
                              onChange={(e) => setEmailModal({...emailModal, subject: e.target.value})}
                              className="w-full p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none dark:text-white"
                          />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Message</label>
                          <textarea 
                              placeholder="Écrivez votre message ici..."
                              value={emailModal.body}
                              onChange={(e) => setEmailModal({...emailModal, body: e.target.value})}
                              className="w-full p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none dark:text-white min-h-[150px]"
                          />
                      </div>
                      <button 
                          onClick={handleSendManualEmail}
                          disabled={loading}
                          className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold shadow-lg shadow-brand-500/20 transition-all flex items-center justify-center gap-2"
                      >
                          {loading ? <RefreshCw size={18} className="animate-spin" /> : <Mail size={18} />}
                          Envoyer l'e-mail
                      </button>
                  </div>
              </div>
          </div>
      );
  };

  const renderOverview = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-in fade-in">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div className="bg-blue-100 dark:bg-blue-900/20 p-3 rounded-xl text-blue-600 dark:text-blue-400">
            <Users size={24} />
          </div>
          <span className="text-xs font-bold text-gray-400 uppercase">Utilisateurs</span>
        </div>
        <p className="text-3xl font-black text-gray-900 dark:text-white">{stats.totalUsers}</p>
        <p className="text-xs text-green-500 font-bold mt-2 flex items-center"><Activity size={12} className="mr-1"/> Actifs</p>
      </div>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div className="bg-orange-100 dark:bg-orange-900/20 p-3 rounded-xl text-orange-600 dark:text-orange-400">
            <Store size={24} />
          </div>
          <span className="text-xs font-bold text-gray-400 uppercase">Restaurants</span>
        </div>
        <p className="text-3xl font-black text-gray-900 dark:text-white">{stats.totalRestaurants}</p>
        <p className="text-xs text-gray-400 font-bold mt-2">Partenaires actifs</p>
      </div>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div className="bg-purple-100 dark:bg-purple-900/20 p-3 rounded-xl text-purple-600 dark:text-purple-400">
            <ShoppingBag size={24} />
          </div>
          <span className="text-xs font-bold text-gray-400 uppercase">Commandes</span>
        </div>
        <p className="text-3xl font-black text-gray-900 dark:text-white">{stats.totalOrders}</p>
        <p className="text-xs text-green-500 font-bold mt-2 flex items-center"><Activity size={12} className="mr-1"/> Total</p>
      </div>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 cursor-pointer hover:border-brand-500 transition-colors" onClick={() => setActiveView('requests')}>
        <div className="flex items-center justify-between mb-4">
          <div className="bg-red-100 dark:bg-red-900/20 p-3 rounded-xl text-red-600 dark:text-red-400">
            <Mail size={24} />
          </div>
          <span className="text-xs font-bold text-gray-400 uppercase">Demandes</span>
        </div>
        <p className="text-3xl font-black text-gray-900 dark:text-white">{stats.pendingVerifications + stats.subscriptionRequests}</p>
        <p className="text-xs text-red-500 font-bold mt-2 flex items-center">
            <AlertTriangle size={12} className="mr-1"/> 
            {stats.pendingVerifications} vérif. + {stats.subscriptionRequests} abonn.
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 cursor-pointer hover:border-brand-500 transition-colors" onClick={() => setActiveView('support')}>
        <div className="flex items-center justify-between mb-4">
          <div className="bg-brand-100 dark:bg-brand-900/20 p-3 rounded-xl text-brand-600 dark:text-brand-400">
            <MessageSquare size={24} />
          </div>
          <span className="text-xs font-bold text-gray-400 uppercase">Support</span>
        </div>
        <p className="text-3xl font-black text-gray-900 dark:text-white">{stats.openTickets}</p>
        <p className="text-xs text-brand-500 font-bold mt-2 flex items-center"><Activity size={12} className="mr-1"/> {stats.openTickets} tickets ouverts</p>
      </div>
    </div>
  );

  const renderUsers = () => (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden animate-in fade-in">
        <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-4">
                <h3 className="font-bold text-lg text-gray-800 dark:text-white">Gestion Utilisateurs</h3>
                <button 
                    onClick={syncUsers}
                    disabled={loading}
                    className="p-2 text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-lg transition-all flex items-center gap-2 text-xs font-bold border border-brand-100 dark:border-brand-900/30"
                    title="Synchroniser avec Auth"
                >
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    Sync
                </button>
            </div>
            <div className="relative w-full md:w-auto">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                <input 
                    type="text" 
                    placeholder="Rechercher..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full md:w-64 pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-700 border-none rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none dark:text-white" 
                />
            </div>
        </div>
        
        <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 font-bold uppercase text-xs">
                    <tr>
                        <th className="px-6 py-4">Utilisateur</th>
                        <th className="px-6 py-4 text-center">Statut</th>
                        <th className="px-6 py-4">Email</th>
                        <th className="px-6 py-4">Rôle</th>
                        <th className="px-6 py-4">Ville</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {filteredUsers.length === 0 ? (
                        <tr>
                            <td colSpan={6} className="p-12 text-center text-gray-500 dark:text-gray-400">
                                <div className="flex flex-col items-center">
                                    <Users size={48} className="text-gray-200 dark:text-gray-700 mb-4" />
                                    <p className="font-bold">Aucun utilisateur trouvé</p>
                                    <p className="text-xs">
                                        {searchTerm ? "Aucun résultat pour votre recherche." : "Les utilisateurs inscrits apparaîtront ici."}
                                    </p>
                                </div>
                            </td>
                        </tr>
                    ) : (
                        filteredUsers.map(u => {
                        // Logic for user status colors:
                        // Green: Online (always for now if active)
                        // Red: Inactive/Disconnected
                        // Black: Blocked (if we had a field, but we'll use a logic)
                        const isOnline = u.is_active !== false; 
                        
                        return (
                            <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="font-bold text-gray-900 dark:text-white">{u.full_name || 'Sans nom'}</div>
                                    <div className="text-xs text-gray-400">{u.id.slice(0, 8)}...</div>
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <div 
                                        className={`w-3 h-3 rounded-full mx-auto shadow-sm ${
                                            u.is_active === false ? 'bg-black' : // Bloqué
                                            'bg-emerald-500 animate-pulse' // En ligne
                                        }`}
                                        title={u.is_active === false ? 'Bloqué / Supprimé' : 'En ligne'}
                                    ></div>
                                </td>
                                <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{u.email || '-'}</td>
                            <td className="px-6 py-4">
                                <span className={`px-2 py-1 rounded-md text-xs font-bold ${
                                    u.role === 'business' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400' : 
                                    u.role === 'delivery' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400' :
                                    u.role === 'superadmin' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' :
                                    'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                                }`}>
                                    {u.role === 'business' ? 'Restaurateur' : 
                                     u.role === 'delivery' ? 'Livreur' : 
                                     u.role === 'superadmin' ? 'Admin' : 'Client'}
                                </span>
                                {u.role === 'delivery' && (
                                    <div className="text-[10px] font-black text-orange-600 mt-1 flex items-center">
                                        <Bike size={10} className="mr-1" />
                                        {u.delivery_info?.completedOrders || 0} courses
                                    </div>
                                )}
                            </td>
                            <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{u.city || '-'}</td>
                            <td className="px-6 py-4 text-right space-x-2">
                                <button 
                                    onClick={() => {
                                        navigator.clipboard.writeText(u.id);
                                        toast.success("ID copié !");
                                    }} 
                                    className="p-2 text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-lg transition-all" 
                                    title="Copier l'ID"
                                >
                                    <Database size={16} />
                                </button>
                                <button 
                                    onClick={() => setEmailModal({ isOpen: true, to: u.email, subject: '', body: '' })} 
                                    className="p-2 text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-lg transition-all" 
                                    title="Envoyer un e-mail"
                                    disabled={!u.email}
                                >
                                    <Mail size={18} />
                                </button>
                                 <button 
                                    onClick={() => toggleUserStatus(u.id, u.is_active !== false)} 
                                    className={`p-2 rounded-lg transition-all ${u.is_active !== false ? 'text-gray-400 hover:text-orange-500' : 'text-orange-600 bg-orange-50'}`} 
                                    title={u.is_active !== false ? "Désactiver" : "Activer"}
                                >
                                    {u.is_active !== false ? <Eye size={18} /> : <XCircle size={18} />}
                                </button>
                                <button 
                                    onClick={() => changeUserRole(u.id, u.role)} 
                                    className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all" 
                                    title="Changer le rôle"
                                >
                                    <ShieldCheck size={18} />
                                </button>
                                <button 
                                    onClick={() => deleteUser(u.id)} 
                                    className="p-2 text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all" 
                                    title="Supprimer"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </td>
                        </tr>
                        );
                    })
                    )}
                </tbody>
            </table>
        </div>

        <div className="md:hidden p-4 space-y-4">
            {filteredUsers.map(u => (
                <div key={u.id} className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4 border border-gray-100 dark:border-gray-600 shadow-sm">
                    <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-3">
                            <div 
                                className={`w-2.5 h-2.5 rounded-full shadow-sm ${
                                    u.is_active === false ? 'bg-black' : 'bg-emerald-500 animate-pulse'
                                }`}
                                title={u.is_active === false ? 'Bloqué / Supprimé' : 'En ligne'}
                            ></div>
                            <div>
                                <div className="font-bold text-gray-900 dark:text-white">{u.full_name || 'Sans nom'}</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">{u.email}</div>
                            </div>
                        </div>
                        <span className={`px-2 py-1 rounded-md text-xs font-bold ${
                            u.role === 'business' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400' : 
                            u.role === 'delivery' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400' :
                            'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                        }`}>
                            {u.role === 'business' ? 'Restaurateur' : u.role === 'delivery' ? 'Livreur' : 'Client'}
                        </span>
                    </div>
                    
                    {u.role === 'delivery' && (
                        <div className="bg-orange-50 dark:bg-orange-900/20 p-2 rounded-lg mb-3 flex items-center justify-between">
                            <span className="text-[10px] font-bold text-orange-700 dark:text-orange-400 uppercase tracking-wider">Courses effectuées</span>
                            <div className="flex items-center text-orange-600 font-black">
                                <Bike size={12} className="mr-1" />
                                {u.delivery_info?.completedOrders || 0}
                            </div>
                        </div>
                    )}
                    
                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-400 mb-4">
                        <div className="flex items-center">
                            <span className="text-gray-400 dark:text-gray-500 mr-1">Ville:</span> {u.city || '-'}
                        </div>
                        <div className="flex items-center">
                            <span className="text-gray-400 dark:text-gray-500 mr-1">ID:</span> {u.id.slice(0, 8)}...
                        </div>
                    </div>

                    <div className="flex justify-end space-x-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                        <button onClick={() => changeUserRole(u.id, u.role)} className="p-2 bg-white dark:bg-gray-800 rounded-lg text-gray-400 hover:text-blue-600 shadow-sm border border-gray-200 dark:border-gray-600">
                            <Users size={16} />
                        </button>
                        <button onClick={() => deleteUser(u.id)} className="p-2 bg-white dark:bg-gray-800 rounded-lg text-gray-400 hover:text-red-500 shadow-sm border border-gray-200 dark:border-gray-600">
                            <Trash2 size={16} />
                        </button>
                    </div>
                </div>
            ))}
        </div>
    </div>
  );

  const renderVerifications = () => (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden animate-in fade-in">
        <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
            <div>
                <h3 className="font-bold text-lg text-gray-800 dark:text-white">Demandes de Vérification</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Consultez les documents et validez ou rejetez les demandes</p>
            </div>
            <button 
                onClick={cleanVerificationData}
                disabled={loading}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-all text-xs font-bold disabled:opacity-50"
                title="Nettoyer les demandes sans documents"
            >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                <span>Nettoyer</span>
            </button>
        </div>
        <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 font-bold uppercase text-xs">
                    <tr>
                        <th className="px-6 py-4">Restaurant</th>
                        <th className="px-6 py-4">Propriétaire</th>
                        <th className="px-6 py-4">Documents</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {pendingVerifications.length === 0 ? (
                        <tr>
                            <td colSpan={4} className="p-8 text-center text-gray-500 dark:text-gray-400">
                                <CheckCircle size={48} className="mx-auto mb-3 text-green-500" />
                                Aucune demande en attente
                            </td>
                        </tr>
                    ) : (
                        pendingVerifications.map(r => (
                            <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="font-bold text-gray-900 dark:text-white">{r.name}</div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">{r.city}</div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="text-sm text-gray-700 dark:text-gray-300">ID: {r.ownerId?.slice(0, 8)}...</div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="space-y-2">
                                        <div className="text-xs text-gray-600 dark:text-gray-400">
                                            <span className="font-bold">RCCM:</span> {r.verificationDocs?.registryNumber || 'N/A'}
                                        </div>
                                        {r.verificationDocs?.idCardUrl && (
                                            <div className="flex space-x-2">
                                                <button 
                                                    onClick={() => viewDocument(r.verificationDocs.idCardUrl)}
                                                    className="text-blue-600 dark:text-blue-400 hover:underline text-xs flex items-center"
                                                >
                                                    <Eye size={12} className="mr-1"/> Voir carte d'identité
                                                </button>
                                                <button 
                                                    onClick={() => downloadDocument(r.verificationDocs.idCardUrl, `id_card_${r.name}.pdf`)}
                                                    className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 text-xs flex items-center"
                                                >
                                                    <Download size={12} className="mr-1"/> Télécharger
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-right space-x-2">
                                    <button 
                                        onClick={() => handleVerification(r.id, 'verified')}
                                        className="bg-green-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-green-700 transition-colors inline-flex items-center"
                                    >
                                        <CheckCircle size={14} className="mr-1" /> Valider
                                    </button>
                                    <button 
                                        onClick={() => handleVerification(r.id, 'rejected')}
                                        className="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-4 py-2 rounded-lg text-xs font-bold hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors inline-flex items-center"
                                    >
                                        <XCircle size={14} className="mr-1" /> Rejeter
                                    </button>
                                    <button 
                                        onClick={() => deleteVerificationRequest(r.id)}
                                        disabled={loading}
                                        className="p-2 text-gray-400 hover:text-red-500 transition-colors inline-flex items-center disabled:opacity-50"
                                        title="Supprimer définitivement"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>

        <div className="p-6 border-t border-gray-100 dark:border-gray-700 bg-green-50/30 dark:bg-green-900/10">
            <h3 className="font-bold text-lg text-green-800 dark:text-green-400 mb-4 flex items-center">
                <CheckCircle size={20} className="mr-2" />
                Restaurants Vérifiés
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {restaurants.filter(r => r.isVerified).length === 0 ? (
                    <div className="col-span-full p-4 text-center text-gray-500 text-xs italic">
                        Aucun restaurant n'est encore vérifié.
                    </div>
                ) : (
                    restaurants.filter(r => r.isVerified).map(r => (
                        <div key={r.id} className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-green-100 dark:border-green-900/30 flex items-center justify-between shadow-sm">
                            <div className="flex items-center">
                                <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-600 flex items-center justify-center mr-3">
                                    <CheckCircle size={20} />
                                </div>
                                <div>
                                    <p className="font-bold text-gray-900 dark:text-white text-sm">{r.name}</p>
                                    <p className="text-[10px] text-green-600 font-bold uppercase tracking-wider">Vérifié</p>
                                </div>
                            </div>
                            <div className="text-[10px] text-gray-400 italic">
                                Badge actif
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>

        <div className="p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/10">
            <h3 className="font-bold text-lg text-gray-800 dark:text-white mb-4">Tous les Restaurants Non Vérifiés</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {restaurants.filter(r => !r.isVerified).length === 0 ? (
                    <div className="col-span-full p-4 text-center text-gray-500 text-xs italic">
                        Tous les restaurants sont déjà vérifiés.
                    </div>
                ) : (
                    restaurants.filter(r => !r.isVerified).map(r => (
                        <div key={r.id} className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 flex items-center justify-between shadow-sm">
                            <div className="flex items-center">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center mr-3 ${r.verificationRequested ? 'bg-brand-100 text-brand-600' : 'bg-gray-100 dark:bg-gray-700 text-gray-400'}`}>
                                    {r.verificationRequested ? <Mail size={20} /> : <ShieldAlert size={20} />}
                                </div>
                                <div>
                                    <p className="font-bold text-gray-900 dark:text-white text-sm">{r.name}</p>
                                    <p className="text-[10px] text-gray-500">
                                        {r.verificationRequested ? 'Demande déjà envoyée' : 'Aucune demande envoyée'}
                                    </p>
                                </div>
                            </div>
                            <button 
                                onClick={() => sendVerificationRequest(r.id)}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all shadow-sm flex items-center ${
                                    r.verificationRequested 
                                    ? 'bg-gray-100 dark:bg-gray-700 text-gray-500 cursor-not-allowed' 
                                    : 'bg-brand-600 text-white hover:bg-brand-700'
                                }`}
                                disabled={r.verificationRequested}
                            >
                                <Mail size={12} className="mr-1.5" />
                                {r.verificationRequested ? 'Envoyée' : 'Demander'}
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    </div>
  );

  const renderRestaurants = () => (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden animate-in fade-in">
        <div className="p-6 border-b border-gray-100 dark:border-gray-700">
            <h3 className="font-bold text-lg text-gray-800 dark:text-white">Gestion Restaurants</h3>
        </div>
        <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 font-bold uppercase text-xs">
                    <tr>
                        <th className="px-6 py-4">Restaurant</th>
                        <th className="px-6 py-4">Type</th>
                        <th className="px-6 py-4">Ville</th>
                        <th className="px-6 py-4">Statut</th>
                        <th className="px-6 py-4">Plan</th>
                        <th className="px-6 py-4 font-center">Vérifié</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {restaurants.length === 0 ? (
                        <tr>
                            <td colSpan={7} className="p-12 text-center text-gray-500 dark:text-gray-400">
                                <div className="flex flex-col items-center">
                                    <Store size={48} className="text-gray-200 dark:text-gray-700 mb-4" />
                                    <p className="font-bold">Aucun restaurant trouvé</p>
                                    <p className="text-xs">Les restaurants inscrits apparaîtront ici.</p>
                                </div>
                            </td>
                        </tr>
                    ) : (
                        restaurants.map(r => (
                        <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                            <td className="px-6 py-4">
                                <div className="flex items-center">
                                    <img src={r.coverImage} className="w-10 h-10 rounded-lg object-cover mr-3" alt="" />
                                    <div>
                                        <div className="font-bold text-gray-900 dark:text-white">{r.name}</div>
                                    </div>
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-md text-xs font-medium uppercase text-gray-700 dark:text-gray-300">{r.type}</span>
                            </td>
                            <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{r.city}</td>
                            <td className="px-6 py-4">
                                <div className="flex justify-center">
                                    <div 
                                        className={`w-3 h-3 rounded-full shadow-sm ${
                                            !r.isActive ? 'bg-black' : // Bloqué ou Supprimé
                                            !r.isOpen ? 'bg-gray-400' : // Indisponible
                                            'bg-emerald-500 animate-pulse' // En ligne
                                        }`}
                                        title={
                                            !r.isActive ? 'Bloqué / Supprimé' : 
                                            !r.isOpen ? 'Indisponible' : 
                                            'En ligne'
                                        }
                                    ></div>
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                <div className="flex flex-col">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase w-fit ${
                                        r.subscriptionTier === 'enterprise' ? 'bg-purple-100 text-purple-700' :
                                        r.subscriptionTier === 'premium' ? 'bg-orange-100 text-orange-700' :
                                        r.subscriptionTier === 'basic' ? 'bg-blue-100 text-blue-700' :
                                        'bg-gray-100 text-gray-700'
                                    }`}>
                                        {r.subscriptionTier || 'free'}
                                    </span>
                                    {r.subscriptionEndDate && (
                                        <span className="text-[9px] text-gray-500 mt-0.5">
                                            Expire le: {new Date(r.subscriptionEndDate).toLocaleDateString()}
                                        </span>
                                    )}
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                <div className="flex justify-center">
                                    {r.isVerified ? (
                                        <CheckCircle size={16} className="text-green-500" />
                                    ) : (
                                        <XCircle size={16} className="text-gray-400" />
                                    )}
                                </div>
                            </td>
                            <td className="px-6 py-4 text-right space-x-2">
                                {!r.isVerified && !r.verificationRequested && (
                                    <button 
                                        onClick={() => sendVerificationRequest(r.id)}
                                        className="p-2 text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-lg transition-all"
                                        title="Envoyer demande de vérification"
                                    >
                                        <ShieldAlert size={18} />
                                    </button>
                                )}
                                <button 
                                    onClick={() => {
                                        setSelectedTier(r.subscriptionTier || 'free');
                                        setSubEndDate(r.subscriptionEndDate ? r.subscriptionEndDate.split('T')[0] : '');
                                        setSubscriptionModal({ isOpen: true, restaurant: r });
                                    }}
                                    className="p-2 text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                                    title="Gérer l'abonnement"
                                >
                                    <CreditCard size={18} />
                                </button>
                                <button className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                                    <Eye size={18} />
                                </button>
                                <button 
                                    onClick={() => toggleRestaurantStatus(r.id, r.isActive)}
                                    className={`p-2 rounded-lg transition-all ${r.isActive ? 'text-gray-400 hover:text-orange-500' : 'text-orange-600 bg-orange-50'}`}
                                    title={r.isActive ? "Masquer" : "Afficher"}
                                >
                                    {r.isActive ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                                <button 
                                    onClick={() => deleteRestaurant(r.id)}
                                    className="p-2 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                                    title="Supprimer le restaurant"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </td>
                        </tr>
                    )))
                    }
                </tbody>
            </table>
        </div>
    </div>
  );

  const renderPublications = () => (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden animate-in fade-in">
        <div className="p-6 border-b border-gray-100 dark:border-gray-700">
            <h3 className="font-bold text-lg text-gray-800 dark:text-white">Toutes les Publications</h3>
        </div>
        <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">
                        <th className="p-4 font-medium">Type</th>
                        <th className="p-4 font-medium">Restaurant</th>
                        <th className="p-4 font-medium">Contenu</th>
                        <th className="p-4 font-medium">Date</th>
                        <th className="p-4 font-medium">Statut</th>
                        <th className="p-4 font-medium text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {publications.map((pub: any) => (
                        <tr key={pub.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                            <td className="p-4">
                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${pub.pubType === 'menu_item' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'}`}>
                                    {pub.pubType === 'menu_item' ? 'Plat' : 'Promotion'}
                                </span>
                            </td>
                            <td className="p-4 font-medium text-gray-900 dark:text-white">{pub.restaurantName || 'Inconnu'}</td>
                            <td className="p-4 text-gray-600 dark:text-gray-300">
                                {pub.pubType === 'menu_item' ? (
                                    <div>
                                        <p className="font-bold text-gray-900 dark:text-white">{pub.name}</p>
                                        <p className="text-xs font-bold text-brand-600">
                                            {formatDualPrice(pub.price || 0, (pub.restaurantCurrency || pub.currency) as 'USD' | 'CDF' || 'USD', pub.restaurantExchangeRate, pub.restaurantDisplayCurrencyMode)}
                                        </p>
                                    </div>
                                ) : (
                                    <div>
                                        <p className="text-sm truncate max-w-xs">{pub.caption || 'Sans légende'}</p>
                                        {pub.media_url && (
                                            <a href={pub.media_url} target="_blank" rel="noreferrer" className="text-xs text-brand-600 dark:text-brand-400 hover:underline">
                                                Voir le média
                                            </a>
                                        )}
                                    </div>
                                )}
                            </td>
                            <td className="p-4 text-gray-500 dark:text-gray-400 text-sm">{new Date(pub.created_at).toLocaleDateString()}</td>
                            <td className="p-4">
                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${(pub.pubType === 'menu_item' ? pub.is_available : pub.is_active) ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-400'}`}>
                                    {(pub.pubType === 'menu_item' ? pub.is_available : pub.is_active) ? 'Visible' : 'Masqué'}
                                </span>
                            </td>
                            <td className="p-4 text-right space-x-2">
                                <button 
                                    onClick={() => togglePublicationStatus(pub)}
                                    className="p-2 text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-lg transition-colors"
                                    title={(pub.pubType === 'menu_item' ? pub.is_available : pub.is_active) ? "Masquer" : "Afficher"}
                                >
                                    {(pub.pubType === 'menu_item' ? pub.is_available : pub.is_active) ? <XCircle size={18} /> : <CheckCircle size={18} />}
                                </button>
                                <button 
                                    onClick={() => deletePublication(pub)}
                                    className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                    title="Supprimer"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </td>
                        </tr>
                    ))}
                    {publications.length === 0 && !loading && (
                        <tr>
                            <td colSpan={6} className="p-8 text-center text-gray-500 dark:text-gray-400">Aucune publication trouvée</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex relative transition-colors duration-300">
      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-gray-900 dark:bg-gray-950 text-white flex flex-col transition-transform duration-300 ease-in-out md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} overflow-y-auto`}>
        <div className="p-6 border-b border-gray-800 flex justify-between items-center">
            <div className="flex items-center space-x-3">
                <div className="bg-white p-1 rounded-lg shadow-sm shadow-brand-900/50">
                    <img src={APP_LOGO_URL} alt="DashMeals" className="h-8 w-auto object-contain" />
                </div>
                <div>
                    <h1 className="text-xl font-black tracking-tight text-white leading-none">DashMeals</h1>
                    <span className="text-[10px] text-brand-400 font-bold uppercase tracking-wider">Admin</span>
                </div>
            </div>
            <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-gray-400 hover:text-white">
              <X size={24} />
            </button>
        </div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto custom-scrollbar">
            <button onClick={() => handleNavigation('overview')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${activeView === 'overview' ? 'bg-brand-600 text-white font-bold' : 'text-gray-400 hover:bg-gray-800'}`}>
                <Activity size={20} /> <span>Vue d'ensemble</span>
            </button>
            <button onClick={() => handleNavigation('requests')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${activeView === 'requests' ? 'bg-orange-600 text-white font-bold' : 'text-gray-400 hover:bg-gray-800'}`}>
                <Bell size={20} /> <span>Demandes</span>
                {(stats.pendingVerifications + stats.subscriptionRequests) > 0 && (
                    <span className="bg-white text-orange-600 text-[10px] font-black px-2 py-0.5 rounded-full ml-auto animate-pulse">
                        {stats.pendingVerifications + stats.subscriptionRequests}
                    </span>
                )}
            </button>
            <button onClick={() => handleNavigation('users')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${activeView === 'users' ? 'bg-brand-600 text-white font-bold' : 'text-gray-400 hover:bg-gray-800'}`}>
                <Users size={20} /> <span>Utilisateurs</span>
            </button>
            <button onClick={() => handleNavigation('restaurants')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${activeView === 'restaurants' ? 'bg-brand-600 text-white font-bold' : 'text-gray-400 hover:bg-gray-800'}`}>
                <Store size={20} /> <span>Restaurants</span>
            </button>
            <button onClick={() => handleNavigation('publications')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${activeView === 'publications' ? 'bg-brand-600 text-white font-bold' : 'text-gray-400 hover:bg-gray-800'}`}>
                <Database size={20} /> <span>Publications</span>
            </button>
            <button onClick={() => handleNavigation('support')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${activeView === 'support' ? 'bg-brand-600 text-white font-bold' : 'text-gray-400 hover:bg-gray-800'}`}>
                <Mail size={20} /> <span>Support</span>
                {stats.openTickets > 0 && <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full ml-auto">{stats.openTickets}</span>}
            </button>
            <button onClick={() => handleNavigation('messages')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${activeView === 'messages' ? 'bg-brand-600 text-white font-bold' : 'text-gray-400 hover:bg-gray-800'}`}>
                <MessageSquare size={20} /> <span>Messages</span>
            </button>
            <button onClick={() => handleNavigation('verifications')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${activeView === 'verifications' ? 'bg-brand-600 text-white font-bold' : 'text-gray-400 hover:bg-gray-800'}`}>
                <Shield size={20} /> <span>Vérifications</span>
                {stats.pendingVerifications > 0 && <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full ml-auto">{stats.pendingVerifications}</span>}
            </button>
            <button onClick={() => handleNavigation('settings')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${activeView === 'settings' ? 'bg-brand-600 text-white font-bold' : 'text-gray-400 hover:bg-gray-800'}`}>
                <Settings size={20} /> <span>Paramètres App</span>
            </button>
        </nav>
        <div className="p-4 border-t border-gray-800">
            <div className="mb-4">
                <label className="text-[10px] text-gray-500 mb-1 block uppercase font-bold">Apparence</label>
                <div className="flex bg-gray-800 rounded-lg p-1">
                    <button 
                        onClick={() => setTheme && setTheme('light')}
                        className={`flex-1 py-1.5 rounded-md text-xs font-bold flex items-center justify-center transition-colors ${theme === 'light' ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        <Sun size={14} className="mr-1"/> Clair
                    </button>
                    <button 
                        onClick={() => setTheme && setTheme('dark')}
                        className={`flex-1 py-1.5 rounded-md text-xs font-bold flex items-center justify-center transition-colors ${theme === 'dark' ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        <Moon size={14} className="mr-1"/> Sombre
                    </button>
                </div>
            </div>

            {font && setFont && (
                <div className="mb-4">
                    <label className="text-[10px] text-gray-500 mb-1 block uppercase font-bold">Police</label>
                    <select 
                        value={font} 
                        onChange={(e) => setFont(e.target.value as AppFont)}
                        className="w-full bg-gray-800 text-gray-300 text-xs p-2 rounded-lg border border-gray-700 outline-none focus:border-brand-500"
                    >
                        <option value="facebook">Facebook (Défaut)</option>
                        <option value="inter">Inter</option>
                        <option value="roboto">Roboto</option>
                        <option value="opensans">Open Sans</option>
                        <option value="lato">Lato</option>
                        <option value="montserrat">Montserrat</option>
                        <option value="poppins">Poppins</option>
                        <option value="quicksand">Quicksand</option>
                        <option value="playfair">Playfair Display</option>
                    </select>
                </div>
            )}
            <button onClick={onLogout} className="w-full flex items-center justify-center space-x-2 text-red-400 hover:bg-red-900/20 p-2 rounded-lg transition-colors font-medium text-sm">
                <LogOut size={16} /> <span>Déconnexion</span>
            </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 md:ml-64 p-4 md:p-8 transition-all duration-300 overflow-y-auto h-screen">
         <div className="md:hidden mb-6 flex items-center justify-between bg-white dark:bg-gray-800 p-4 -mx-4 -mt-4 border-b border-gray-100 dark:border-gray-700 sticky top-0 z-30">
          <div className="flex items-center space-x-3">
            <button 
              onClick={() => setIsMobileMenuOpen(true)} 
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl text-gray-600 dark:text-gray-300 transition-colors"
            >
              <Menu size={24} />
            </button>
            <span className="font-black text-lg text-gray-900 dark:text-white tracking-tighter">DashMeals Admin</span>
          </div>
          
          <div className="flex items-center space-x-3">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-bold text-gray-900 dark:text-white leading-none">{user.name}</p>
              <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest">Active</span>
            </div>
            <button 
              onClick={onLogout} 
              className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
              title="Déconnexion"
            >
              <LogOut size={20} />
            </button>
          </div>
         </div>

         <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-8 gap-4">
             <div>
                 <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
                     {activeView === 'overview' && 'Tableau de bord'}
                     {activeView === 'users' && 'Utilisateurs'}
                     {activeView === 'restaurants' && 'Restaurants Partenaires'}
                     {activeView === 'publications' && 'Publications'}
                     {activeView === 'verifications' && 'Vérifications'}
                     {activeView === 'support' && 'Support Client'}
                     {activeView === 'messages' && 'Messages Commandes'}
                     {activeView === 'settings' && 'Paramètres de l\'Application'}
                 </h2>
                 <p className="text-gray-500 dark:text-gray-400 text-sm">Bienvenue, {user.name}</p>
             </div>
             <div className="flex items-center space-x-4">
                 <div className="flex items-center px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-xs font-bold">
                     <CheckCircle size={14} className="mr-1" /> Système Opérationnel
                 </div>
                 <button 
                   onClick={() => {
                       fetchStats();
                       if (activeView === 'users') fetchUsers();
                       if (activeView === 'restaurants') fetchRestaurants();
                       if (activeView === 'verifications') fetchPendingVerifications();
                       if (activeView === 'publications') fetchPublications();
                       if (activeView === 'support') fetchSupportTickets();
                       if (activeView === 'messages') fetchOrderMessages();
                       if (activeView === 'requests') { fetchPendingVerifications(); fetchSupportTickets(); }
                       toast.success("Données actualisées");
                   }}
                   className="p-2 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-all shadow-sm"
                   title="Actualiser les données"
                 >
                   <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                 </button>
                 <button 
                   onClick={onLogout}
                   className="hidden md:flex items-center space-x-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/40 transition-all font-bold text-sm"
                 >
                   <LogOut size={16} />
                   <span>Déconnexion</span>
                 </button>
             </div>
         </header>

         {activeView === 'overview' && renderOverview()}
         {activeView === 'requests' && (
           <div className="space-y-6">
               <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-brand-100 dark:border-brand-900/30 overflow-hidden">
                   <div className="p-4 bg-brand-50 dark:bg-brand-900/10 border-b border-brand-100 dark:border-brand-900/30">
                       <h3 className="font-black text-brand-600 dark:text-brand-400 flex items-center gap-2">
                           <Shield size={18} />
                           Vérifications d'Identité ({pendingVerifications.length})
                       </h3>
                   </div>
                   {renderVerifications()}
               </div>

               <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-orange-100 dark:border-orange-900/30 overflow-hidden">
                   <div className="p-4 bg-orange-50 dark:bg-orange-900/10 border-b border-orange-100 dark:border-orange-900/30">
                       <h3 className="font-black text-orange-600 dark:text-orange-400 flex items-center gap-2">
                           <CreditCard size={18} />
                           Demandes d'Abonnement Manuel ({supportTickets.filter(t => t.status === 'open' && (t.subject?.toLowerCase().includes('abonnement') || t.message?.toLowerCase().includes('abonne'))).length})
                       </h3>
                   </div>
                   <div className="overflow-x-auto">
                       <table className="w-full text-left text-sm">
                           <thead className="bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 font-bold uppercase text-[10px]">
                               <tr>
                                   <th className="px-6 py-4">Utilisateur</th>
                                   <th className="px-6 py-4">Détails de la demande</th>
                                   <th className="px-6 py-4 text-right">Action</th>
                               </tr>
                           </thead>
                           <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                               {supportTickets.filter(t => t.status === 'open' && (t.subject?.toLowerCase().includes('abonnement') || t.message?.toLowerCase().includes('abonne'))).length === 0 ? (
                                   <tr>
                                       <td colSpan={3} className="p-8 text-center text-gray-500 italic">Aucune demande d'abonnement en attente</td>
                                   </tr>
                               ) : (
                                   supportTickets.filter(t => t.status === 'open' && (t.subject?.toLowerCase().includes('abonnement') || t.message?.toLowerCase().includes('abonne'))).map(ticket => (
                                       <tr key={ticket.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                           <td className="px-6 py-4">
                                               <div className="font-bold text-gray-900 dark:text-white">{ticket.profiles?.full_name}</div>
                                               <div className="text-[10px] text-gray-400">{ticket.profiles?.email}</div>
                                           </td>
                                           <td className="px-6 py-4">
                                               <div className="font-bold text-orange-600 text-xs">{ticket.subject}</div>
                                               <div className="text-xs text-gray-500 line-clamp-1">{ticket.message}</div>
                                           </td>
                                           <td className="px-6 py-4 text-right space-x-2">
                                               <button 
                                                   onClick={() => {
                                                       const restoIdMatch = (ticket.message || '').match(/ID: ([a-f0-9-]+)/i);
                                                       const restoId = restoIdMatch ? restoIdMatch[1] : null;
                                                       const resto = restaurants.find(r => r.id === restoId);
                                                       if (resto) {
                                                           setSelectedTier(ticket.subject?.toUpperCase().includes('BASIC') ? 'basic' : ticket.subject?.toUpperCase().includes('PREMIUM') ? 'premium' : 'enterprise');
                                                           setSubEndDate(''); // Admin chooses
                                                           setSubscriptionModal({ isOpen: true, restaurant: resto });
                                                       } else {
                                                           setSelectedTicket(ticket);
                                                           setActiveView('support');
                                                       }
                                                   }}
                                                   className="bg-brand-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-brand-700 shadow-md inline-flex items-center"
                                               >
                                                   Gérer
                                               </button>
                                                <button 
                                                    onClick={() => deleteTicket(ticket.id)}
                                                    className="p-2 text-gray-400 hover:text-red-500 transition-colors inline-flex items-center"
                                                    title="Supprimer la demande"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                           </td>
                                       </tr>
                                   ))
                               )}
                           </tbody>
                       </table>
                   </div>
               </div>
           </div>
         )}
         {activeView === 'users' && renderUsers()}
         {activeView === 'restaurants' && renderRestaurants()}
         {activeView === 'publications' && renderPublications()}
         {activeView === 'verifications' && renderVerifications()}
         {activeView === 'support' && renderSupport()}
         {activeView === 'messages' && renderMessages()}
         {activeView === 'settings' && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden animate-in fade-in">
              <div className="p-6 border-b border-gray-100 dark:border-gray-700">
                <h3 className="font-bold text-lg text-gray-800 dark:text-white">Paramètres Généraux</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Configurez les informations globales de l'application</p>
              </div>
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">E-mail de Support</label>
                    <input 
                      type="email"
                      value={appSettings.support_email}
                      onChange={(e) => setAppSettings({...appSettings, support_email: e.target.value})}
                      className="w-full p-4 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none dark:text-white"
                      placeholder="support@dashmeals.cd"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Téléphone (Urgent)</label>
                    <input 
                      type="text"
                      value={appSettings.support_phone}
                      onChange={(e) => setAppSettings({...appSettings, support_phone: e.target.value})}
                      className="w-full p-4 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none dark:text-white"
                      placeholder="+243 81 000 0000"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">WhatsApp Support</label>
                    <input 
                      type="text"
                      value={appSettings.support_whatsapp}
                      onChange={(e) => setAppSettings({...appSettings, support_whatsapp: e.target.value})}
                      className="w-full p-4 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none dark:text-white"
                      placeholder="+243 81 000 0001"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Adresse du Siège</label>
                    <input 
                      type="text"
                      value={appSettings.office_address}
                      onChange={(e) => setAppSettings({...appSettings, office_address: e.target.value})}
                      className="w-full p-4 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none dark:text-white"
                      placeholder="Kinshasa, Gombe"
                    />
                  </div>
                </div>
                <div className="flex justify-end pt-4">
                  <button 
                    onClick={updateAppSettings}
                    disabled={loading}
                    className="px-8 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold font-display shadow-lg shadow-brand-500/20 active:scale-95 transition-all flex items-center gap-2"
                  >
                    {loading ? <RefreshCw size={18} className="animate-spin" /> : <Settings size={18} />}
                    Enregistrer les modifications
                  </button>
                </div>
              </div>
            </div>
          )}

          {renderEmailModal()}

          {/* Subscription Management Modal */}
          {subscriptionModal.isOpen && subscriptionModal.restaurant && (
              <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
                  <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                      <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                          <div>
                              <h3 className="font-black text-gray-900 dark:text-white text-lg">Gérer l'Abonnement</h3>
                              <p className="text-xs text-gray-500">{subscriptionModal.restaurant.name}</p>
                          </div>
                          <button onClick={() => setSubscriptionModal({ isOpen: false, restaurant: null })} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
                              <X size={20} />
                          </button>
                      </div>
                      <div className="p-6 space-y-5">
                          <div className="space-y-2">
                              <label className="block text-xs font-bold text-gray-500 uppercase">Niveau de Forfait</label>
                              <div className="grid grid-cols-2 gap-2">
                                  {['free', 'basic', 'premium', 'enterprise'].map(tier => (
                                      <button
                                          key={tier}
                                          onClick={() => setSelectedTier(tier as any)}
                                          className={`py-3 rounded-xl border-2 text-sm font-bold capitalize transition-all ${
                                              selectedTier === tier 
                                              ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-400' 
                                              : 'border-gray-100 dark:border-gray-700 text-gray-500 hover:border-gray-200'
                                          }`}
                                      >
                                          {tier}
                                      </button>
                                  ))}
                              </div>
                          </div>

                          <div className="space-y-2">
                              <label className="block text-xs font-bold text-gray-500 uppercase">Date d'expiration</label>
                              <div className="relative">
                                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                  <input 
                                      type="date"
                                      value={subEndDate}
                                      onChange={(e) => setSubEndDate(e.target.value)}
                                      className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-100 dark:border-gray-600 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none dark:text-white"
                                  />
                              </div>
                              <p className="text-[10px] text-gray-400">Laissez vide pour un accès permanent (ou gérez manuellement)</p>
                          </div>

                          <div className="pt-4 flex gap-3">
                              <button 
                                  onClick={() => setSubscriptionModal({ isOpen: false, restaurant: null })}
                                  className="flex-1 py-3 text-gray-500 font-bold hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-all"
                              >
                                  Annuler
                              </button>
                              <button 
                                  onClick={updateSubscription}
                                  disabled={loading}
                                  className="flex-1 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold shadow-lg shadow-brand-500/20 transition-all flex items-center justify-center gap-2"
                              >
                                  {loading && <RefreshCw size={16} className="animate-spin" />}
                                  Enregistrer
                              </button>
                          </div>
                      </div>
                  </div>
              </div>
          )}

        {/* Confirmation Modal */}
        {confirmModal.isOpen && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
                <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                    <div className="p-6 text-center">
                        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Trash2 size={32} />
                        </div>
                        <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2">{confirmModal.title}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{confirmModal.message}</p>
                        <div className="flex gap-3">
                            <button 
                                onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                                className="flex-1 py-3 text-gray-500 dark:text-gray-400 font-bold hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-all"
                            >
                                Annuler
                            </button>
                            <button 
                                onClick={confirmModal.onConfirm}
                                disabled={confirmModal.isLoading}
                                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-red-500/20 flex items-center justify-center gap-2"
                            >
                                {confirmModal.isLoading && <RefreshCw size={16} className="animate-spin" />}
                                Supprimer
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}
      </main>
    </div>
  );
};