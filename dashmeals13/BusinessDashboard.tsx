import React, { useState, useEffect, useRef } from "react";
import { supabase } from "./lib/supabase";
import { APP_LOGO_URL } from "./constants";
import {
  Restaurant,
  MenuItem,
  User,
  UserRole,
  Order,
  OrderStatus,
  Promotion,
  Theme,
  Language,
  AppFont,
  RestaurantPaymentConfig,
} from "./types";
import { getBusinessInsights, getSmartSupportResponse } from "./lib/gemini";
import { useNativePicker } from "./utils/useNativePicker";
import {
  Plus,
  Trash2,
  Power,
  LogOut,
  Coffee,
  DollarSign,
  Clock,
  Truck,
  Receipt,
  CheckCircle,
  CheckCircle2,
  ChefHat,
  Bike,
  LayoutDashboard,
  Settings,
  TrendingUp,
  Users,
  ShoppingBag,
  X,
  Save,
  Image as ImageIcon,
  MapPin,
  MessageSquare,
  Phone,
  Megaphone,
  Video,
  PlayCircle,
  Upload,
  AlertCircle,
  AlertTriangle,
  Bell,
  Moon,
  Sun,
  Globe,
  RefreshCw,
  Type,
  Shield,
  ShieldAlert,
  ShieldCheck,
  FileText,
  Download,
  Activity,
  ArrowRight,
  Lock,
  Eye,
  EyeOff,
  Smartphone,
  UserX,
  ToggleLeft,
  ToggleRight,
  Zap,
  User as UserIcon,
  Package,
  ChevronRight,
  ChevronDown,
  Edit3,
  Star,
  Heart,
  UserPlus,
  Award,
  ShoppingCart,
  Gift,
  Fingerprint,
  Search,
  Store,
  ExternalLink,
  Info,
  HelpCircle,
  Book,
  Mail,
  Lightbulb,
  Brain,
  Bot,
  Send,
  Navigation,
  Mic,
  MicOff,
  CreditCard,
  Banknote,
  Headphones,
} from "lucide-react";
import { ChatWindow } from "./components/ChatWindow";
import { HelpCenter } from "./components/HelpCenter";
import { useTranslation } from "./lib/i18n";
import {
  requestNotificationPermission,
  sendPushNotification,
} from "./utils/notifications";
import { PinSetupDialog } from "./components/PinSetupDialog";
import { StripePayment } from "./components/StripePayment";
import { sendOrderStatusUpdateEmail, sendEmail } from "./lib/email";
import { formatDualPrice } from "./utils/format";
import { toast } from "sonner";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

interface Props {
  user: User;
  restaurant: Restaurant;
  onUpdateRestaurant: (updated: Restaurant) => void;
  onUpdateUser: (updated: User) => void;
  onLogout: () => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
  language: Language;
  setLanguage: (l: Language) => void;
  font?: AppFont;
  setFont?: (f: AppFont) => void;
}

type DashboardView =
  | "overview"
  | "orders"
  | "menu"
  | "sales"
  | "settings"
  | "marketing"
  | "marketplace"
  | "subscribers"
  | "team"
  | "reviews"
  | "analytics"
  | "support"
  | "billing";

const TIER_FEATURES = {
  free: {
    name: "Gratuit",
    features: ["basicMenu", "directOrders", "basicStats"],
    limits: { promotions: 1, staff: 0, menuItems: 10 },
  },
  basic: {
    name: "Starter",
    features: [
      "basicMenu",
      "directOrders",
      "advancedStats",
      "prioritySupport",
      "weeklyPost",
    ],
    limits: { promotions: 3, staff: 2, menuItems: 30 },
  },
  premium: {
    name: "Pro",
    features: [
      "basicMenu",
      "directOrders",
      "advancedStats",
      "prioritySupport",
      "aiInsights",
      "autoMarketing",
      "unlimitedPosts",
      "searchPriority",
    ],
    limits: { promotions: 10, staff: 5, menuItems: 100 },
  },
  enterprise: {
    name: "Elite",
    features: [
      "basicMenu",
      "directOrders",
      "advancedStats",
      "prioritySupport",
      "aiInsights",
      "autoMarketing",
      "unlimitedPosts",
      "searchPriority",
      "staffManagement",
      "apiAccess",
      "dedicatedManager",
      "networkAds",
    ],
    limits: { promotions: 100, staff: 50, menuItems: 1000 },
  },
};

const PLANS = [
  {
    id: "free",
    name: "Gratuit",
    price: 0,
    color: "gray",
    features: [
      "Menu digital illimité (10 articles)",
      "Commandes en direct",
      "Support par email",
      "Statistiques de base",
    ],
  },
  {
    id: "basic",
    name: "Starter",
    price: 5,
    color: "blue",
    features: [
      "Tout Gratuit",
      "30 articles menu",
      "Statistiques avancées",
      "Support prioritaire",
      "3 Stories actives",
    ],
  },
  {
    id: "premium",
    name: "Pro",
    price: 20,
    color: "purple",
    features: [
      "Tout Starter",
      "100 articles menu",
      "IA Insights clients",
      "Marketing automatique",
      "10 Stories actives",
      "Priorité recherche",
    ],
  },
  {
    id: "enterprise",
    name: "Elite",
    price: 50,
    color: "brand",
    features: [
      "Tout Pro",
      "Articles illimités",
      "Multi-comptes staff",
      "Accès API",
      "Gestionnaire de compte dédié",
      "Publicité réseau incluse",
    ],
  },
];

const hasFeature = (
  restaurant: Restaurant | undefined,
  feature: string,
): boolean => {
  if (!restaurant) return false;

  const tier = restaurant.subscriptionTier || "free";
  const status = restaurant.subscriptionStatus || "active";

  // If it's a paid tier but not active, only allow free features
  const effectiveTier = tier !== "free" && status !== "active" ? "free" : tier;

  const features =
    TIER_FEATURES[effectiveTier as keyof typeof TIER_FEATURES]?.features || [];
  return features.includes(feature);
};

const DashboardContext = React.createContext<{
  restaurant: Restaurant;
  setActiveView: (view: DashboardView) => void;
  setSettingsSubView: (view: any) => void;
} | null>(null);

const FeatureGate: React.FC<{
  feature: string;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}> = ({ feature, fallback, children }) => {
  const context = React.useContext(DashboardContext);
  if (!context) return <>{children}</>;

  const { restaurant, setActiveView, setSettingsSubView } = context;
  const isAllowed = hasFeature(restaurant, feature);

  if (isAllowed) return <>{children}</>;

  if (fallback) return <>{fallback}</>;

  return (
    <div className="relative group">
      <div className="filter blur-[2px] pointer-events-none opacity-50">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center bg-white/10 dark:bg-black/10 backdrop-blur-[1px] rounded-2xl z-10 transition-all group-hover:backdrop-blur-[2px]">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 text-center max-w-xs transform transition-all group-hover:scale-105">
          <div className="w-12 h-12 bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock size={24} />
          </div>
          <h4 className="font-black text-gray-900 dark:text-white mb-2">
            Fonctionnalité Verrouillée
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 text-balance">
            Cette option est disponible dans les forfaits supérieurs.
          </p>
          <button
            onClick={() => {
              setActiveView("settings");
              setSettingsSubView("subscription");
            }}
            className="bg-brand-600 text-white px-4 py-2 rounded-xl text-xs font-black hover:bg-brand-700 transition-all shadow-lg shadow-brand-500/20"
          >
            Voir les Forfaits
          </button>
        </div>
      </div>
    </div>
  );
};

interface Notification {
  id: string;
  user_id: string;
  restaurant_id?: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  data: any;
  created_at: string;
}

export const BusinessDashboard: React.FC<Props> = ({
  user,
  restaurant,
  onUpdateRestaurant,
  onUpdateUser,
  onLogout,
  theme,
  setTheme,
  language,
  setLanguage,
  font,
  setFont,
}) => {
  const t = useTranslation(language);
  const { isCapacitor, pickImage, pickFile } = useNativePicker();

  // RBAC Helper Functions
  const canAccessView = (view: DashboardView): boolean => {
    // Owner (business role) sees everything
    if (user.role === "business") return true;

    // Staff roles
    if (user.role === "staff") {
      if (user.staffRole === "cook") {
        return ["orders", "menu"].includes(view);
      }
      if (user.staffRole === "admin" || user.staffRole === "manager") {
        // Admin/Manager sees 80% (everything except team management and billing)
        return !["team", "billing"].includes(view);
      }
    }

    // Default fallback (should not happen for valid business/staff users)
    return ["overview", "orders", "menu", "reviews"].includes(view);
  };

  const getDefaultView = (): DashboardView => {
    if (user.role === "business") return "overview";
    if (user.role === "staff") {
      if (user.staffRole === "cook") return "orders";
      return "overview";
    }
    return "overview";
  };

  const checkLimit = (
    type: "promotions" | "staff" | "menuItems",
    currentCount: number,
  ) => {
    const tier = restaurant.subscriptionTier || "free";
    const status = restaurant.subscriptionStatus || "active";
    const effectiveTier =
      tier !== "free" && status !== "active" ? "free" : tier;
    const limit =
      TIER_FEATURES[effectiveTier as keyof typeof TIER_FEATURES].limits[type];

    if (currentCount >= limit) {
      const tierName =
        TIER_FEATURES[effectiveTier as keyof typeof TIER_FEATURES].name;
      const typeLabel =
        type === "promotions"
          ? "promotion(s)"
          : type === "staff"
            ? "membre(s)"
            : "article(s)";

      if (tier !== "free" && status !== "active") {
        toast.error(
          `Votre abonnement ${TIER_FEATURES[tier as keyof typeof TIER_FEATURES].name} n'est pas actif. Vous êtes limité aux limites du forfait Gratuit (${limit} ${typeLabel}).`,
        );
      } else {
        toast.error(
          `Votre forfait ${tierName} est limité à ${limit} ${typeLabel}. Veuillez passer au forfait supérieur.`,
        );
      }
      setActiveView("settings");
      setSettingsSubView("subscription");
      return false;
    }
    return true;
  };

  const [activeView, setActiveView] = useState<DashboardView>(getDefaultView());
  const [settingsSubView, setSettingsSubView] = useState<
    | "menu"
    | "verification"
    | "content"
    | "privacy"
    | "delivery"
    | "hours"
    | "notifications"
    | "payments"
    | "subscription"
    | "sales_support"
  >("menu");
  const [selectedMarketplaceProduct, setSelectedMarketplaceProduct] =
    useState<any>(null);
  const [isMarketplaceModalOpen, setIsMarketplaceModalOpen] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeChatOrder, setActiveChatOrder] = useState<Order | null>(null);
  const [activeChatSubscriber, setActiveChatSubscriber] = useState<any | null>(
    null,
  );
  const [salesStartDate, setSalesStartDate] = useState<string>("");
  const [salesEndDate, setSalesEndDate] = useState<string>("");

  const [isPinSetupOpen, setIsPinSetupOpen] = useState(false);
  const [isHelpCenterOpen, setIsHelpCenterOpen] = useState(false);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [confirmingDeleteOrder, setConfirmingDeleteOrder] = useState<
    string | null
  >(null);
  const [userSearchId, setUserSearchId] = useState("");
  const [isPayingSubscription, setIsPayingSubscription] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<{
    id: string;
    name: string;
    price: number;
  } | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<
    "card" | "mobile_money"
  >("card");
  const [searchedUser, setSearchedUser] = useState<any>(null);
  const [isSearchingUser, setIsSearchingUser] = useState(false);
  const [profilesCache, setProfilesCache] = useState<Record<string, any>>({});
  const [isPaymentFormExpanded, setIsPaymentFormExpanded] = useState(true);

  const handleSubscriptionSuccess = async () => {
    if (!selectedPlan) return;
    try {
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);

      const { error } = await supabase
        .from("restaurants")
        .update({
          subscription_tier: selectedPlan.id,
          subscription_status: "active",
          subscription_end_date: nextMonth.toISOString(),
        })
        .eq("id", restaurant.id);

      if (error) throw error;

      onUpdateRestaurant({
        ...restaurant,
        subscriptionTier: selectedPlan.id as any,
        subscriptionStatus: "active",
        subscriptionEndDate: nextMonth.toISOString(),
      });

      toast.success(`Abonnement ${selectedPlan.name} activé avec succès !`);
      setIsPayingSubscription(false);
      setSelectedPlan(null);
    } catch (err) {
      console.error("Error updating subscription:", err);
      toast.error("Erreur lors de la mise à jour de l'abonnement.");
    }
  };
  const [pinVerification, setPinVerification] = useState<{
    isOpen: boolean;
    onSuccess: () => void;
    title: string;
    error: string;
    value: string;
    isLoading: boolean;
  }>({
    isOpen: false,
    onSuccess: () => {},
    title: "",
    error: "",
    value: "",
    isLoading: false,
  });

  const unreadNotificationsCount = notifications.filter(
    (n) => !n.is_read,
  ).length;

  const renderNotificationsModal = () => {
    if (!isNotificationsOpen) return null;

    return (
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
          <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="bg-brand-100 dark:bg-brand-900/30 p-2 rounded-xl text-brand-600 dark:text-brand-400">
                <Bell size={24} />
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Notifications
              </h2>
            </div>
            <button
              onClick={() => setIsNotificationsOpen(false)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
            >
              <X size={20} className="text-gray-500" />
            </button>
          </div>

          <div className="max-h-[60vh] overflow-y-auto p-4 space-y-3">
            {notifications.length === 0 ? (
              <div className="py-12 text-center">
                <div className="bg-gray-50 dark:bg-gray-900/50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Bell size={32} className="text-gray-300" />
                </div>
                <p className="text-gray-500 dark:text-gray-400">
                  Aucune notification pour le moment
                </p>
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                    notif.is_read
                      ? "bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 opacity-75"
                      : "bg-brand-50/50 dark:bg-brand-900/10 border-brand-100 dark:border-brand-900/30 shadow-sm"
                  }`}
                  onClick={() => {
                    markNotificationAsRead(notif.id);
                    if (notif.type === "verification_request") {
                      setActiveView("settings");
                      setSettingsSubView("verification");
                      setIsNotificationsOpen(false);
                    } else if (
                      notif.type === "message" &&
                      notif.data?.order_id
                    ) {
                      const order = orders.find(
                        (o) => o.id === notif.data.order_id,
                      );
                      if (order) {
                        setActiveChatOrder(order);
                        setIsNotificationsOpen(false);
                      } else if (notif.data.order_id.startsWith("sub-")) {
                        // Direct chat with subscriber
                        setActiveChatSubscriber({
                          user_id: notif.data.order_id.split("-")[1],
                        });
                        setIsNotificationsOpen(false);
                      }
                    } else if (notif.type === "new_order") {
                      setActiveView("orders");
                      setIsNotificationsOpen(false);
                    }
                  }}
                >
                  <div className="flex justify-between items-start mb-1">
                    <h4
                      className={`font-bold text-sm ${notif.is_read ? "text-gray-700 dark:text-gray-300" : "text-gray-900 dark:text-white"}`}
                    >
                      {notif.title}
                    </h4>
                    {!notif.is_read && (
                      <div className="w-2 h-2 bg-brand-600 rounded-full" />
                    )}
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-2 leading-relaxed">
                    {notif.message}
                  </p>
                  <span className="text-[10px] text-gray-400 font-medium">
                    {new Date(notif.created_at).toLocaleString("fr-FR", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              ))
            )}
          </div>

          {notifications.length > 0 && (
            <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30">
              <button
                onClick={async () => {
                  const { error } = await supabase
                    .from("notifications")
                    .update({ is_read: true })
                    .eq("user_id", user.id);
                  if (!error) {
                    setNotifications((prev) =>
                      prev.map((n) => ({ ...n, is_read: true })),
                    );
                  }
                }}
                className="w-full py-2 text-sm font-bold text-brand-600 dark:text-brand-400 hover:bg-brand-100 dark:hover:bg-brand-900/20 rounded-xl transition-all"
              >
                Tout marquer comme lu
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const openHelpCenter = () => {
    window.history.pushState({ view: activeView, help: true }, "", "#help");
    setIsHelpCenterOpen(true);
  };

  const closeHelpCenter = () => {
    if (window.history.state?.help) window.history.back();
    else setIsHelpCenterOpen(false);
  };

  // Fetch notifications
  useEffect(() => {
    const fetchNotifications = async (retryCount = 0) => {
      if (!user.id || user.id === 'guest' || !restaurant?.id) {
          console.log("[Business Notifications] Bypass fetch pour ID invalide");
          return;
      }
      
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .or(`user_id.eq.${user.id},restaurant_id.eq.${restaurant.id}`)
        .order("created_at", { ascending: false });

      if (error) {
        console.warn(`Erreur lecture notifications (Tentative ${retryCount + 1}):`, error.message);
        const isNetworkError = error.message?.includes('Failed to fetch') || error.message?.includes('network');
        if (isNetworkError && retryCount < 2) {
          setTimeout(() => fetchNotifications(retryCount + 1), 2000);
          return;
        }
      }

      if (!error && data) {
        setNotifications(data);
      }
    };

    fetchNotifications();

    // Real-time notifications
    const channel = supabase
      .channel(`notifications:${restaurant.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
        },
        (payload) => {
          console.log("[Business Notifications] Reçu:", payload.new);
          const newNotif = payload.new as Notification;

          // Only add if it's for this user or this restaurant
          if (
            newNotif.user_id === user.id ||
            newNotif.restaurant_id === restaurant.id
          ) {
            setNotifications((prev) => [newNotif, ...prev]);
            toast.info(`🔔 ${newNotif.title}`, {
              description: newNotif.message,
              action: {
                label: "Voir",
                onClick: () => setIsNotificationsOpen(true),
              },
            });
          }
          // Play sound if possible
          try {
            const audio = new Audio(
              "https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3",
            );
            audio.play().catch(() => {});
          } catch (e) {}
        },
      )
      .subscribe((status) => {
        console.log(`[Business Notifications] Statut: ${status}`);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user.id]);

  const markNotificationAsRead = async (id: string) => {
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id);

    if (!error) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
      );
    }
  };

  useEffect(() => {
    const defaultView = getDefaultView();
    const currentHash = window.location.hash.replace("#", "") as DashboardView;

    if (!window.history.state) {
      const initialView =
        currentHash && canAccessView(currentHash) ? currentHash : defaultView;
      window.history.replaceState({ view: initialView }, "", `#${initialView}`);
      setActiveView(initialView);
    } else if (
      window.history.state.view &&
      !canAccessView(window.history.state.view)
    ) {
      window.history.replaceState({ view: defaultView }, "", `#${defaultView}`);
      setActiveView(defaultView);
    }

    const onPopState = (e: PopStateEvent) => {
      const state = e.state;
      if (state?.view) {
        if (canAccessView(state.view)) {
          setActiveView(state.view);
        } else {
          // Redirect to default view if unauthorized
          const defaultView = getDefaultView();
          window.history.replaceState(
            { view: defaultView },
            "",
            `#${defaultView}`,
          );
          setActiveView(defaultView);
        }
      }
      if (!state?.chat) setActiveChatOrder(null);
      if (!state?.help) setIsHelpCenterOpen(false);
      setIsSidebarOpen(!!state?.sidebar);
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [activeView]);

  const navigateTo = (view: DashboardView) => {
    if (view === activeView) return;
    if (!canAccessView(view)) {
      toast.error("Vous n'avez pas la permission d'accéder à cette section.");
      return;
    }
    window.history.pushState({ view }, "", `#${view}`);
    setActiveView(view);
    setIsSidebarOpen(false);
  };

  const openChat = (order: Order) => {
    window.history.pushState({ view: activeView, chat: true }, "", "#chat");
    setActiveChatOrder(order);
  };

  const openSubscriberChat = (subscriber: any) => {
    window.history.pushState({ view: activeView, chat: true }, "", "#chat");
    setActiveChatSubscriber(subscriber);
  };

  const closeChat = () => {
    if (window.history.state?.chat) window.history.back();
    else {
      setActiveChatOrder(null);
      setActiveChatSubscriber(null);
    }
  };

  const toggleSidebar = () => {
    if (!isSidebarOpen) {
      window.history.pushState(
        { view: activeView, sidebar: true },
        "",
        "#menu",
      );
      setIsSidebarOpen(true);
    } else {
      if (window.history.state?.sidebar) window.history.back();
      else setIsSidebarOpen(false);
    }
  };

  const closeSidebar = () => {
    if (window.history.state?.sidebar) window.history.back();
    else setIsSidebarOpen(false);
  };

  // Menu Management State
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [updatingTimes, setUpdatingTimes] = useState(false);

  const formatPrice = (price: number) => {
    return formatDualPrice(price, restaurant.currency as 'USD' | 'CDF' || 'USD', restaurant.exchangeRate, restaurant.displayCurrencyMode);
  };

  // Marketing State
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [newPromoUrl, setNewPromoUrl] = useState("");
  const [newPromoType, setNewPromoType] = useState<"image" | "video">("image");
  const [newPromoCaption, setNewPromoCaption] = useState("");
  const [isAddingPromo, setIsAddingPromo] = useState(false);
  const [promoFile, setPromoFile] = useState<File | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);

  // Automated Campaigns State
  const [isAddingCampaign, setIsAddingCampaign] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<any | null>(null);

  // Email Modal State
  const [emailModal, setEmailModal] = useState<{
    isOpen: boolean;
    recipientEmail: string;
    recipientName: string;
    subject: string;
    message: string;
    isSending: boolean;
  }>({
    isOpen: false,
    recipientEmail: "",
    recipientName: "",
    subject: "",
    message: "",
    isSending: false,
  });
  const [newCampaignName, setNewCampaignName] = useState("");
  const [newCampaignTrigger, setNewCampaignTrigger] = useState<
    | "abandoned_cart"
    | "dormant_30_days"
    | "birthday"
    | "new_customer"
    | "loyal_customer"
  >("abandoned_cart");
  const [newCampaignMessage, setNewCampaignMessage] = useState("");
  const [newCampaignDiscount, setNewCampaignDiscount] = useState(10);
  const [isSavingCampaign, setIsSavingCampaign] = useState(false);

  // Settings State
  const [settingsForm, setSettingsForm] = useState({
    name: restaurant.name || "",
    description: restaurant.description || "",
    coverImage: restaurant.coverImage || "",
    city: restaurant.city || "",
    latitude: restaurant.latitude || 0,
    longitude: restaurant.longitude || 0,
    phoneNumber: restaurant.phoneNumber || "",
    currency: restaurant.currency || "USD",
    exchangeRate: restaurant.exchangeRate || 2850,
    displayCurrencyMode: restaurant.displayCurrencyMode || "dual",
    paymentConfig: restaurant.paymentConfig || {
      acceptCash: true,
      acceptMobileMoney: false,
    },
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null);

  // Verification State
  const [idCardFile, setIdCardFile] = useState<File | null>(null);
  const [registryNumber, setRegistryNumber] = useState(
    restaurant.verificationDocs?.registryNumber || "",
  );
  const [isSubmittingVerification, setIsSubmittingVerification] =
    useState(false);
  const [otherProducts, setOtherProducts] = useState<any[]>([]);
  const [followers, setFollowers] = useState<any[]>([]);
  const [staffMembers, setStaffMembers] = useState<any[]>([]);
  const [isAddingStaff, setIsAddingStaff] = useState(false);
  const [editingStaff, setEditingStaff] = useState<any | null>(null);
  const [newStaffName, setNewStaffName] = useState("");
  const [newStaffRole, setNewStaffRole] = useState<
    "admin" | "manager" | "cook" | "delivery"
  >("cook");
  const [newStaffPin, setNewStaffPin] = useState("");
  const [isSavingStaff, setIsSavingStaff] = useState(false);
  const [teamTab, setTeamTab] = useState<"staff" | "delivery">("staff");
  const [automatedCampaigns, setAutomatedCampaigns] = useState<any[]>([]);
  const [loyaltyRewards, setLoyaltyRewards] = useState<any[]>([]);
  const [loyaltyPoints, setLoyaltyPoints] = useState<any[]>([]);
  const [isAddingReward, setIsAddingReward] = useState(false);
  const [newRewardName, setNewRewardName] = useState("");
  const [newRewardPoints, setNewRewardPoints] = useState(500);
  const [newRewardDesc, setNewRewardDesc] = useState("");
  const [isSavingReward, setIsSavingReward] = useState(false);
  const [reviews, setReviews] = useState<any[]>([]);
  const [deliveryPersonnel, setDeliveryPersonnel] = useState<User[]>([]);
  const [isAssigningDelivery, setIsAssigningDelivery] = useState<string | null>(
    null,
  );
  const [isReplyingTo, setIsReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [isSavingReply, setIsSavingReply] = useState(false);
  const [businessInsights, setBusinessInsights] = useState<any[]>([]);
  const [loadingInsights, setLoadingInsights] = useState(false);

  const fetchInsights = async () => {
    if (orders.length === 0) return;
    setLoadingInsights(true);
    try {
      const insightsData = await getBusinessInsights(orders.slice(0, 50));
      if (insightsData && insightsData.insights) {
        setBusinessInsights(insightsData.insights);
      }
    } catch (err) {
      console.error("Error fetching insights:", err);
    } finally {
      setLoadingInsights(false);
    }
  };

  useEffect(() => {
    if (activeView === "analytics") {
      fetchInsights();
    }
  }, [activeView]);

  useEffect(() => {
    if (activeView === "marketplace") {
      fetchOtherProducts();
    }
    if (activeView === "subscribers" && restaurant?.id) {
      fetchFollowers();

      // Subscribe to real-time updates for followers
      const channel = supabase
        .channel(`followers_${restaurant.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "followers",
            filter: `restaurant_id=eq.${restaurant.id}`,
          },
          () => {
            console.log("Real-time update for followers detected");
            fetchFollowers();
          },
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
    if (activeView === "overview") {
      fetchDeliveryPersonnel();
    }
    if (activeView === "team") {
      fetchStaff();
      fetchDeliveryPersonnel();
    }
    if (activeView === "marketing") {
      fetchCampaigns();
    }
    if (activeView === "reviews") {
      fetchReviews();
    }
    if (activeView === "marketing") {
      fetchMarketingData();
    }
  }, [activeView, restaurant?.id]);

  const handleSearchUser = async () => {
    const searchId = userSearchId.trim();
    if (!searchId) return;

    // Validation du format UUID (8-4-4-4-12 caractères hexadécimaux)
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(searchId)) {
      toast.error(
        "Format d'ID invalide. Un ID utilisateur doit être un UUID complet (ex: 550e8400-e29b-41d4-a716-446655440000)",
      );
      return;
    }

    setIsSearchingUser(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", searchId)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setSearchedUser(data);
        setProfilesCache((prev) => ({ ...prev, [data.id]: data }));
        toast.success(`Utilisateur trouvé : ${data.full_name || "Sans nom"}`);
      } else {
        toast.error(
          "Aucun utilisateur ne correspond à cet ID dans la base de données.",
        );
        setSearchedUser(null);
      }
    } catch (err) {
      console.error("User not found:", err);
      toast.error("Erreur lors de la recherche dans la base de données.");
      setSearchedUser(null);
    } finally {
      setIsSearchingUser(false);
    }
  };

  const fetchMarketingData = async () => {
    if (!restaurant?.id) return;

    try {
      // Fetch campaigns
      const { data: campaigns } = await supabase
        .from("automated_campaigns")
        .select("*")
        .eq("restaurant_id", restaurant.id);
      setAutomatedCampaigns(campaigns || []);

      // Fetch rewards
      const { data: rewards } = await supabase
        .from("loyalty_rewards")
        .select("*")
        .eq("restaurant_id", restaurant.id);
      setLoyaltyRewards(rewards || []);

      // Fetch points
      const { data: rawPoints } = await supabase
        .from("loyalty_points")
        .select("*")
        .eq("restaurant_id", restaurant.id)
        .order("points", { ascending: false })
        .limit(10);

      if (rawPoints && rawPoints.length > 0) {
        const userIds = Array.from(
          new Set(rawPoints.map((p) => p.user_id)),
        ).filter(Boolean);
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", userIds);

        const profilesMap: Record<string, any> = {};
        if (profilesData) {
          profilesData.forEach((p) => (profilesMap[p.id] = p));
          setProfilesCache((prev) => ({ ...prev, ...profilesMap }));
        }

        const enrichedPoints = rawPoints.map((p) => ({
          ...p,
          profiles: profilesMap[p.user_id] || null,
        }));

        setLoyaltyPoints(enrichedPoints);
      } else {
        setLoyaltyPoints([]);
      }
    } catch (error) {
      console.error("Error fetching marketing data:", error);
    }
  };

  // Subscribe to real-time updates for the current restaurant
  useEffect(() => {
    if (!restaurant?.id) return;

    const restoChannel = supabase
      .channel(`restaurant_updates_${restaurant.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "restaurants",
          filter: `id=eq.${restaurant.id}`,
        },
        (payload) => {
          console.log("Real-time update for restaurant detected:", payload.new);
          const updatedData = payload.new;
          onUpdateRestaurant({
            ...restaurant,
            isVerified: updatedData.is_verified,
            verificationStatus: updatedData.verification_status,
            verificationRequested: updatedData.verification_requested,
            verificationPaymentStatus: updatedData.verification_payment_status,
            verificationDocs: updatedData.verification_docs,
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(restoChannel);
    };
  }, [restaurant?.id]);

  const fetchDeliveryPersonnel = async () => {
    try {
      // 1. Fetch independent delivery personnel
      const { data: independent, error: independentError } = await supabase
        .from("profiles")
        .select("*, delivery_info")
        .eq("role", "delivery");

      if (independentError) throw independentError;

      // 2. Fetch staff delivery personnel for this restaurant
      const { data: staff, error: staffError } = await supabase
        .from("staff_members")
        .select("*")
        .eq("restaurant_id", restaurant.id)
        .eq("role", "delivery");

      if (staffError) throw staffError;

      const allDelivery = [
        ...(independent || []).map((p: any) => ({
          id: p.id,
          name: p.full_name,
          email: "",
          role: "delivery" as UserRole,
          city: p.city,
          phoneNumber: p.phone_number,
          deliveryInfo: p.delivery_info,
        })),
        ...(staff || []).map((s: any) => ({
          id: s.id,
          name: `${s.name} (Interne)`,
          email: "",
          role: "staff" as UserRole,
          staffRole: "delivery" as any,
          city: restaurant.city,
          phoneNumber: "",
          deliveryInfo: { isAvailable: true, vehicleType: "moto" },
        })),
      ];

      setDeliveryPersonnel(allDelivery);
    } catch (err) {
      console.error("Error fetching delivery personnel:", err);
    }
  };

  const assignDeliveryPerson = async (
    orderId: string,
    deliveryPersonId: string,
  ) => {
    try {
      const { error } = await supabase
        .from("orders")
        .update({
          delivery_person_id: deliveryPersonId,
          status: "ready", // Ensure it's ready if not already
        })
        .eq("id", orderId);

      if (error) throw error;

      toast.success("Livreur assigné avec succès !");
      setIsAssigningDelivery(null);
      refreshOrders();
    } catch (err) {
      console.error("Error assigning delivery person:", err);
      toast.error("Erreur lors de l'assignation");
    }
  };

  const fetchStaff = async () => {
    try {
      const { data, error } = await supabase
        .from("staff_members")
        .select("*")
        .eq("restaurant_id", restaurant.id);
      if (error) throw error;
      setStaffMembers(data || []);
    } catch (err) {
      console.error("Error fetching staff:", err);
    }
  };

  const handleSaveStaff = async () => {
    if (!newStaffName.trim()) {
      toast.error("Le nom du membre est requis.");
      return;
    }

    setIsSavingStaff(true);
    try {
      const payload = {
        restaurant_id: restaurant.id,
        name: newStaffName,
        role: newStaffRole,
        pin_code: newStaffPin || null,
      };

      if (editingStaff) {
        const { error } = await supabase
          .from("staff_members")
          .update(payload)
          .eq("id", editingStaff.id);

        if (error) throw error;

        setStaffMembers(
          staffMembers.map((s) =>
            s.id === editingStaff.id ? { ...s, ...payload } : s,
          ),
        );
        toast.success("Membre modifié avec succès.");
      } else {
        const { data, error } = await supabase
          .from("staff_members")
          .insert(payload)
          .select()
          .single();

        if (error) throw error;

        setStaffMembers([...staffMembers, data]);
        toast.success("Membre ajouté avec succès.");
      }

      setIsAddingStaff(false);
      setEditingStaff(null);
      setNewStaffName("");
      setNewStaffRole("cook");
      setNewStaffPin("");
    } catch (err) {
      console.error("Error saving staff:", err);
      toast.error("Erreur lors de l'enregistrement du membre.");
    } finally {
      setIsSavingStaff(false);
    }
  };

  const handleDeleteStaff = async (staffId: string) => {
    if (user.role !== "business") {
      toast.error(
        "Seul le propriétaire peut supprimer des membres de l'équipe.",
      );
      return;
    }
    try {
      const { error } = await supabase
        .from("staff_members")
        .delete()
        .eq("id", staffId);
      if (error) throw error;
      setStaffMembers(staffMembers.filter((s) => s.id !== staffId));
      toast.success("Membre supprimé.");
    } catch (err) {
      console.error("Error deleting staff:", err);
      toast.error("Erreur lors de la suppression.");
    }
  };

  const fetchCampaigns = async () => {
    try {
      const { data, error } = await supabase
        .from("automated_campaigns")
        .select("*")
        .eq("restaurant_id", restaurant.id);
      if (error) throw error;
      setAutomatedCampaigns(data || []);
    } catch (err) {
      console.error("Error fetching campaigns:", err);
    }
  };

  const fetchReviews = async () => {
    try {
      const { data: rawReviews, error } = await supabase
        .from("reviews")
        .select("*")
        .eq("restaurant_id", restaurant.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (rawReviews && rawReviews.length > 0) {
        const userIds = Array.from(
          new Set(rawReviews.map((r) => r.user_id)),
        ).filter(Boolean);
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", userIds);

        const profilesMap: Record<string, any> = {};
        if (profilesData) {
          profilesData.forEach((p) => (profilesMap[p.id] = p));
          setProfilesCache((prev) => ({ ...prev, ...profilesMap }));
        }

        const enrichedReviews = rawReviews.map((r) => ({
          ...r,
          profiles: profilesMap[r.user_id] || null,
        }));

        setReviews(enrichedReviews);
      } else {
        setReviews([]);
      }
    } catch (err) {
      console.error("Error fetching reviews:", err);
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    if (user.role !== "business") {
      toast.error("Seul le propriétaire peut supprimer des avis.");
      return;
    }
    if (!window.confirm("Voulez-vous vraiment supprimer cet avis ?")) return;
    try {
      const { error } = await supabase
        .from("reviews")
        .delete()
        .eq("id", reviewId);
      if (error) throw error;
      setReviews(reviews.filter((r) => r.id !== reviewId));
      toast.success("Avis supprimé avec succès.");
    } catch (err) {
      console.error("Error deleting review:", err);
      toast.error("Erreur lors de la suppression de l'avis.");
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    // Seul le proprio ou un admin/manager peut supprimer
    const isOwner = user.role === "business";
    const isStaffAdmin =
      user.role === "staff" &&
      (user.staffRole === "admin" || user.staffRole === "manager");

    if (!isOwner && !isStaffAdmin) {
      toast.error(t("insufficient_permissions"));
      return;
    }

    // Vérifier si un mot de passe de suppression est configuré
    const hasDeletionPassword = !!restaurant.settings?.orderDeletionPassword;

    // Si c'est un membre de l'équipe OU si le proprio a configuré un mot de passe, on le demande
    if ((user.role === "staff" && !isOwner) || hasDeletionPassword) {
      setConfirmingDeleteOrder(null); // Fermer le modal de confirmation d'abord
      setPinVerification({
        isOpen: true,
        title: "Mot de passe requis",
        onSuccess: () => executeDeleteOrder(orderId),
        error: "",
        value: "",
        isLoading: false,
      });
      return;
    }

    // Sinon exécution directe après confirmation simple
    setConfirmingDeleteOrder(null);
    executeDeleteOrder(orderId);
  };

  const executeDeleteOrder = async (orderId: string) => {
    try {
      if (orderId.startsWith("mock-")) {
        const localOrdersStr = localStorage.getItem("dashmeals_mock_orders");
        if (localOrdersStr) {
          const localOrders = JSON.parse(localOrdersStr);
          const updatedOrders = localOrders.filter(
            (o: any) => o.id !== orderId,
          );
          localStorage.setItem(
            "dashmeals_mock_orders",
            JSON.stringify(updatedOrders),
          );
          setOrders((prev) => prev.filter((o) => o.id !== orderId));
        }
        toast.success("Commande locale supprimée.");
        setConfirmingDeleteOrder(null);
        return;
      }

      toast.loading("Suppression en cours...", { id: "delete-order" });

      // 1. Supprimer les messages liés
      await supabase.from("messages").delete().eq("order_id", orderId);

      // 2. Supprimer les avis liés
      await supabase.from("reviews").delete().eq("order_id", orderId);

      // 3. Supprimer les notifications liées
      await supabase
        .from("notifications")
        .delete()
        .filter("data->>order_id", "eq", orderId);

      // 4. Supprimer la commande
      const { error } = await supabase
        .from("orders")
        .delete()
        .eq("id", orderId);

      if (error) {
        console.error("Supabase Delete Error (Order):", error);
        if (error.code === "23503") {
          toast.error(
            "Impossible de supprimer : d'autres données dépendent encore de cette commande.",
            { id: "delete-order" },
          );
        } else {
          toast.error(`Erreur Supabase: ${error.message}`, {
            id: "delete-order",
          });
        }
        throw error;
      }

      console.log("Order deleted successfully from Supabase:", orderId);
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
      toast.success(t("delete_order_success"));
      setConfirmingDeleteOrder(null);
    } catch (err) {
      console.error("Error deleting order:", err);
      toast.error(t("delete_order_error"));
    }
  };

  const handleVerifyPin = async () => {
    setPinVerification((prev) => ({ ...prev, isLoading: true, error: "" }));
    try {
      // Récupérer le mot de passe le plus récent depuis la base de données pour être sûr
      const { data: resto, error } = await supabase
        .from("restaurants")
        .select("settings")
        .eq("id", restaurant.id)
        .single();

      if (error) throw error;

      const latestPassword = resto?.settings?.orderDeletionPassword;

      if (latestPassword && pinVerification.value === latestPassword) {
        setPinVerification((prev) => ({ ...prev, isOpen: false }));
        pinVerification.onSuccess();
      } else if (!latestPassword) {
        setPinVerification((prev) => ({
          ...prev,
          error: "Mot de passe non configuré par le propriétaire.",
          isLoading: false,
        }));
      } else {
        setPinVerification((prev) => ({
          ...prev,
          error: "Mot de passe incorrect",
          isLoading: false,
        }));
      }
    } catch (err) {
      console.error("PIN verification error:", err);
      setPinVerification((prev) => ({
        ...prev,
        error: "Erreur de vérification",
        isLoading: false,
      }));
    }
  };

  const renderPinVerificationModal = () => {
    if (!pinVerification.isOpen) return null;

    return (
      <div className="fixed inset-0 z-[11000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
          <div className="p-6 text-center">
            <div className="bg-brand-100 dark:bg-brand-900/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-brand-600 dark:text-brand-400">
              <Lock size={32} />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              {pinVerification.title}
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
              Veuillez entrer le mot de passe de suppression configuré par le
              propriétaire.
            </p>

            <div className="space-y-4">
              <input
                type="password"
                placeholder="Mot de passe"
                className="w-full text-center text-2xl font-bold py-4 bg-gray-50 dark:bg-gray-900 border-2 border-transparent focus:border-brand-500 rounded-2xl outline-none transition-all"
                value={pinVerification.value}
                onChange={(e) =>
                  setPinVerification((prev) => ({
                    ...prev,
                    value: e.target.value,
                    error: "",
                  }))
                }
                autoFocus
              />

              {pinVerification.error && (
                <p className="text-red-500 text-sm font-bold animate-shake">
                  {pinVerification.error}
                </p>
              )}

              <div className="flex space-x-3">
                <button
                  onClick={() =>
                    setPinVerification((prev) => ({ ...prev, isOpen: false }))
                  }
                  className="flex-1 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleVerifyPin}
                  disabled={!pinVerification.value || pinVerification.isLoading}
                  className="flex-1 py-3 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 transition-all disabled:opacity-50 flex items-center justify-center"
                >
                  {pinVerification.isLoading ? (
                    <RefreshCw size={20} className="animate-spin" />
                  ) : (
                    "Confirmer"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const handleReplyReview = async (reviewId: string) => {
    if (!replyText.trim()) return;
    setIsSavingReply(true);
    try {
      const { error } = await supabase
        .from("reviews")
        .update({
          reply: replyText,
          reply_at: new Date().toISOString(),
        })
        .eq("id", reviewId);

      if (error) throw error;

      setReviews(
        reviews.map((r) =>
          r.id === reviewId
            ? { ...r, reply: replyText, reply_at: new Date().toISOString() }
            : r,
        ),
      );
      toast.success("Réponse envoyée !");
      setIsReplyingTo(null);
      setReplyText("");
    } catch (err) {
      console.error("Error replying to review:", err);
      toast.error("Erreur lors de l'envoi de la réponse.");
    } finally {
      setIsSavingReply(false);
    }
  };

  const handleSaveCampaign = async () => {
    if (!newCampaignName.trim() || !newCampaignMessage.trim()) {
      toast.error("Veuillez remplir tous les champs.");
      return;
    }

    setIsSavingCampaign(true);
    try {
      const payload = {
        restaurant_id: restaurant.id,
        name: newCampaignName,
        trigger_type: newCampaignTrigger,
        message_body: newCampaignMessage,
        discount_percentage: newCampaignDiscount,
        is_active: editingCampaign ? editingCampaign.is_active : true,
      };

      if (editingCampaign) {
        const { error } = await supabase
          .from("automated_campaigns")
          .update(payload)
          .eq("id", editingCampaign.id);

        if (error) throw error;

        setAutomatedCampaigns(
          automatedCampaigns.map((c) =>
            c.id === editingCampaign.id ? { ...c, ...payload } : c,
          ),
        );
        toast.success("Campagne modifiée avec succès.");
      } else {
        const { data, error } = await supabase
          .from("automated_campaigns")
          .insert(payload)
          .select()
          .single();

        if (error) throw error;

        setAutomatedCampaigns([...automatedCampaigns, data]);
        toast.success("Campagne créée avec succès.");
      }

      setIsAddingCampaign(false);
      setEditingCampaign(null);
      setNewCampaignName("");
      setNewCampaignMessage("");
      setNewCampaignDiscount(10);
    } catch (err) {
      console.error("Error saving campaign:", err);
      toast.error("Erreur lors de l'enregistrement de la campagne.");
    } finally {
      setIsSavingCampaign(false);
    }
  };

  const handleSaveReward = async () => {
    if (!restaurant?.id || !newRewardName) return;

    setIsSavingReward(true);
    try {
      const payload = {
        restaurant_id: restaurant.id,
        name: newRewardName,
        points_required: newRewardPoints,
        description: newRewardDesc,
        is_active: true,
      };

      const { data, error } = await supabase
        .from("loyalty_rewards")
        .insert(payload)
        .select()
        .single();

      if (error) throw error;

      setLoyaltyRewards([...loyaltyRewards, data]);
      setIsAddingReward(false);
      setNewRewardName("");
      setNewRewardPoints(500);
      setNewRewardDesc("");
      toast.success("Récompense ajoutée !");
    } catch (error: any) {
      toast.error("Erreur: " + error.message);
    } finally {
      setIsSavingReward(false);
    }
  };

  const handleDeleteReward = async (id: string) => {
    if (user.role !== "business") {
      toast.error("Seul le propriétaire peut supprimer des récompenses.");
      return;
    }
    try {
      const { error } = await supabase
        .from("loyalty_rewards")
        .delete()
        .eq("id", id);

      if (error) throw error;
      setLoyaltyRewards(loyaltyRewards.filter((r) => r.id !== id));
      toast.success("Récompense supprimée");
    } catch (error: any) {
      toast.error("Erreur: " + error.message);
    }
  };
  const handleToggleCampaign = async (
    campaignId: string,
    currentStatus: boolean,
  ) => {
    try {
      const { error } = await supabase
        .from("automated_campaigns")
        .update({ is_active: !currentStatus })
        .eq("id", campaignId);

      if (error) throw error;

      setAutomatedCampaigns(
        automatedCampaigns.map((c) =>
          c.id === campaignId ? { ...c, is_active: !currentStatus } : c,
        ),
      );
      toast.success(`Campagne ${!currentStatus ? "activée" : "désactivée"}.`);
    } catch (err) {
      console.error("Error toggling campaign:", err);
      toast.error("Erreur lors de la modification du statut.");
    }
  };

  const handleDeleteCampaign = async (campaignId: string) => {
    if (user.role !== "business") {
      toast.error("Seul le propriétaire peut supprimer des campagnes.");
      return;
    }
    try {
      const { error } = await supabase
        .from("automated_campaigns")
        .delete()
        .eq("id", campaignId);
      if (error) throw error;
      setAutomatedCampaigns(
        automatedCampaigns.filter((c) => c.id !== campaignId),
      );
      toast.success("Campagne supprimée.");
    } catch (err) {
      console.error("Error deleting campaign:", err);
      toast.error("Erreur lors de la suppression.");
    }
  };

  // CORRECTION: Fonction fetchOtherProducts améliorée
  const fetchOtherProducts = async () => {
    try {
      console.log("🔍 Chargement des produits marketplace...");

      // Récupérer les produits des autres restaurants
      const { data: products, error: productsError } = await supabase
        .from("menu_items")
        .select("*")
        .neq("restaurant_id", restaurant.id)
        .limit(20);

      if (productsError) {
        console.error("Erreur produits:", productsError);
        toast.error("Erreur lors du chargement des produits");
        setOtherProducts([]);
        return;
      }

      if (!products || products.length === 0) {
        console.log("Aucun produit trouvé");
        setOtherProducts([]);
        return;
      }

      // Récupérer les restaurants associés
      const restaurantIds = [...new Set(products.map((p) => p.restaurant_id))];

      const { data: restaurantsData, error: restaurantsError } = await supabase
        .from("restaurants")
        .select("id, name, city, cover_image, is_open")
        .in("id", restaurantIds);

      if (restaurantsError) {
        console.error("Erreur restaurants:", restaurantsError);
        setOtherProducts(products.map((p) => ({ ...p, restaurants: null })));
        return;
      }

      // Fusionner les données
      const restaurantsMap = new Map();
      restaurantsData?.forEach((r) => restaurantsMap.set(r.id, r));

      const enrichedProducts = products.map((p) => ({
        ...p,
        restaurants: restaurantsMap.get(p.restaurant_id) || null,
      }));

      console.log(`✅ ${enrichedProducts.length} produits trouvés`);
      setOtherProducts(enrichedProducts);
    } catch (err) {
      console.error("Erreur fetchOtherProducts:", err);
      setOtherProducts([]);
    }
  };

  const fetchFollowers = async () => {
    try {
      if (!restaurant?.id) return;

      const { data: rawFollowers, error } = await supabase
        .from("followers")
        .select("*")
        .eq("restaurant_id", restaurant.id);

      if (error) throw error;

      if (rawFollowers && rawFollowers.length > 0) {
        const userIds = Array.from(
          new Set(rawFollowers.map((f) => f.user_id)),
        ).filter(Boolean);
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", userIds);

        const profilesMap: Record<string, any> = {};
        if (profilesData) {
          profilesData.forEach((p) => (profilesMap[p.id] = p));
          setProfilesCache((prev) => ({ ...prev, ...profilesMap }));
        }

        const enrichedFollowers = rawFollowers.map((f) => ({
          ...f,
          profiles: profilesMap[f.user_id] || null,
        }));

        setFollowers(enrichedFollowers);
      } else {
        setFollowers([]);
      }
    } catch (err) {
      console.error("Error fetching followers:", err);
    }
  };

  const submitVerificationStep1 = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!idCardFile && !restaurant.verificationDocs?.idCardUrl) {
      toast.error("Veuillez télécharger une photo de votre carte d'identité.");
      return;
    }
    if (!registryNumber) {
      toast.error("Veuillez entrer votre numéro de registre de commerce.");
      return;
    }

    setIsSubmittingVerification(true);
    try {
      let idCardUrl = restaurant.verificationDocs?.idCardUrl || "";

      if (idCardFile) {
        toast.info("Téléchargement de la carte d'identité en cours...");
        const uploaded = await uploadImage(idCardFile, "images");

        if (uploaded) {
          idCardUrl = uploaded;
          toast.success("Carte d'identité téléchargée avec succès !");
        } else {
          throw new Error("Échec du téléchargement de la carte d'identité");
        }
      }

      const payload = {
        verification_status: "pending",
        verification_payment_status: "free",
        verification_docs: {
          idCardUrl,
          registryNumber,
        },
      };

      const { error } = await supabase
        .from("restaurants")
        .update(payload)
        .eq("id", restaurant.id);

      if (error) {
        console.error("Supabase update error:", error);
        throw new Error(`Erreur base de données: ${error.message}`);
      }

      onUpdateRestaurant({
        ...restaurant,
        verificationStatus: "pending",
        verificationDocs: { idCardUrl, registryNumber },
      });

      toast.success(
        "Documents envoyés ! Un administrateur les examinera sous 24-48h.",
      );
    } catch (err: any) {
      console.error("Verification Error:", err);
      toast.error(
        `Erreur: ${err.message || "Erreur lors de l'envoi des documents"}`,
      );
    } finally {
      setIsSubmittingVerification(false);
    }
  };

  const uploadVerificationDocument = async (
    file: File,
    type: "id_card" | "business_license",
  ): Promise<string | null> => {
    try {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Fichier trop volumineux. Maximum 5MB.");
        return null;
      }

      const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/jpg",
        "application/pdf",
      ];
      if (!allowedTypes.includes(file.type)) {
        toast.error("Format non supporté. Utilisez JPG, PNG ou PDF.");
        return null;
      }

      const fileExt = file.name.split(".").pop();
      const fileName = `verification/${restaurant.id}_${type}_${Date.now()}.${fileExt}`;

      console.log(`📤 Upload document vérification: ${fileName}`);

      const { error: uploadError } = await supabase.storage
        .from("images")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        toast.error(`Erreur upload: ${uploadError.message}`);
        return null;
      }

      const { data: publicUrlData } = supabase.storage
        .from("images")
        .getPublicUrl(fileName);
      console.log(`✅ Document uploadé: ${publicUrlData.publicUrl}`);
      return publicUrlData.publicUrl;
    } catch (error) {
      console.error("Upload exception:", error);
      toast.error("Erreur lors de l'upload");
      return null;
    }
  };

  const handleUpdatePaymentConfig = async (
    newConfig: RestaurantPaymentConfig,
  ) => {
    try {
      const { error } = await supabase
        .from("restaurants")
        .update({ payment_config: newConfig })
        .eq("id", restaurant.id);

      if (error) throw error;

      onUpdateRestaurant({
        ...restaurant,
        paymentConfig: newConfig,
      });
      toast.success("Configuration de paiement mise à jour !");
    } catch (err) {
      console.error("Error updating payment config:", err);
      toast.error("Erreur lors de la mise à jour");
    }
  };

  const [prepTime, setPrepTime] = useState(
    restaurant.preparationTime?.toString() || "",
  );
  const [deliveryTime, setDeliveryTime] = useState(
    restaurant.estimatedDeliveryTime?.toString() || "",
  );

  const [newItemName, setNewItemName] = useState("");
  const [newItemDesc, setNewItemDesc] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [newItemStock, setNewItemStock] = useState("");
  const [newItemLowStockThreshold, setNewItemLowStockThreshold] = useState("");
  const [newItemCategory, setNewItemCategory] =
    useState<MenuItem["category"]>("plat");
  const [newItemImageFile, setNewItemImageFile] = useState<File | null>(null);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  const [orderFilter, setOrderFilter] = useState<
    "all" | "active" | "completed"
  >("active");

  const pendingOrdersCount = orders.filter(
    (o) => o.status === "pending",
  ).length;

  const filteredOrders = orders.filter((order) => {
    if (orderFilter === "all") return true;
    if (orderFilter === "active")
      return [
        "pending",
        "preparing",
        "ready",
        "delivering",
        "delivered",
      ].includes(order.status);
    if (orderFilter === "completed")
      return ["completed", "cancelled"].includes(order.status);
    return true;
  });

  const refreshOrders = async () => {
    setIsRefreshing(true);
    await fetchRestaurantOrders();
    setIsRefreshing(false);
  };

  const uploadImage = async (
    file: File,
    bucket: string = "images",
  ): Promise<string | null> => {
    try {
      let maxSize = 50 * 1024 * 1024;
      let allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
        "image/jpg",
      ];

      if (file.type === "application/pdf") {
        maxSize = 10 * 1024 * 1024;
        allowedTypes = ["application/pdf"];
      }

      if (file.size > maxSize) {
        toast.error(
          `Fichier trop volumineux. Maximum ${maxSize / (1024 * 1024)}MB.`,
        );
        return null;
      }

      if (
        !allowedTypes.includes(file.type) &&
        !file.type.startsWith("image/")
      ) {
        toast.error(
          `Type de fichier non supporté. Types acceptés: images et PDF`,
        );
        return null;
      }

      const fileExt = file.name.split(".").pop();
      const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
      const filePath =
        file.type === "application/pdf"
          ? `verification_documents/${fileName}`
          : `restaurant_uploads/${fileName}`;

      console.log(`📤 Upload vers bucket '${bucket}': ${filePath}`);

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        console.error("Upload error details:", uploadError);

        if (
          uploadError.message.includes("row-level security policy") ||
          uploadError.message.includes("permission denied")
        ) {
          toast.error(
            "❌ Erreur de permission. Vérifiez que vous êtes connecté et que les politiques RLS sont configurées.",
          );
        } else if (uploadError.message.includes("bucket not found")) {
          toast.error(`❌ Bucket '${bucket}' introuvable.`);
        } else {
          toast.error(`Erreur upload: ${uploadError.message}`);
        }
        return null;
      }

      const { data: publicUrlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

      console.log(`✅ Upload réussi: ${publicUrlData.publicUrl}`);
      return publicUrlData.publicUrl;
    } catch (error) {
      console.error("Upload exception:", error);
      toast.error(
        "Erreur lors de l'upload. Vérifiez votre connexion internet.",
      );
      return null;
    }
  };

  useEffect(() => {
    // Request notification permission silently on dashboard load
    const checkNotifs = async () => {
      const granted = await requestNotificationPermission();
      setNotifPush(granted);
    };
    checkNotifs();

    fetchRestaurantOrders();
    fetchPromotions();

    const channel = supabase
      .channel(`orders-dashboard-${restaurant.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `restaurant_id=eq.${restaurant.id}`,
        },
        (payload) => {
          console.log("Mise à jour commande reçue:", payload);
          fetchRestaurantOrders();

          if (payload.eventType === "INSERT") {
            const audio = new Audio(
              "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3",
            );
            audio.play().catch((e) => console.log("Audio play failed", e));
            setShowNotification(true);
            setTimeout(() => setShowNotification(false), 8000);

            sendPushNotification(t("new_order_received"), {
              body: t("client_placed_order"),
              tag: "new-order",
              requireInteraction: true,
            });
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurant.id]);

  useEffect(() => {
    setSettingsForm({
      name: restaurant.name,
      description: restaurant.description,
      coverImage: restaurant.coverImage,
      city: restaurant.city,
      phoneNumber: restaurant.phoneNumber || "",
      currency: restaurant.currency || "USD",
      exchangeRate: restaurant.exchangeRate || 2850,
      paymentConfig: restaurant.paymentConfig || {
        acceptCash: true,
        acceptMobileMoney: false,
      },
    });
  }, [restaurant]);

  const fetchPromotions = async () => {
    try {
      const { data, error } = await supabase
        .from("promotions")
        .select("*")
        .eq("restaurant_id", restaurant.id)
        .order("created_at", { ascending: false });

      if (data) {
        setPromotions(
          data.map((p: any) => ({
            id: p.id,
            restaurantId: p.restaurant_id,
            mediaUrl: p.media_url,
            mediaType: p.media_type,
            caption: p.caption,
            createdAt: p.created_at,
          })),
        );
      }
    } catch (err) {
      console.warn("Promotions fetch error", err);
    }
  };

  const fetchRestaurantOrders = async () => {
    try {
      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select("*")
        .eq("restaurant_id", restaurant.id)
        .order("created_at", { ascending: false });

      if (ordersError) {
        console.warn("Fetch orders failed:", ordersError.message);
        const localOrdersStr = localStorage.getItem("dashmeals_mock_orders");
        if (localOrdersStr) {
          const localOrders = JSON.parse(localOrdersStr);
          const restaurantLocalOrders = localOrders.filter(
            (o: any) => o.restaurant_id === restaurant.id,
          );
          console.log("Local orders found:", restaurantLocalOrders.length);
          if (restaurantLocalOrders.length > 0) {
            setOrders(
              restaurantLocalOrders.map((o: any) => ({
                id: o.id,
                userId: o.user_id,
                restaurantId: o.restaurant_id,
                status: o.status,
                totalAmount: o.total_amount,
                isUrgent:
                  o.items && o.items.length > 0 ? o.items[0].isUrgent : false,
                paymentMethod:
                  o.items && o.items.length > 0
                    ? o.items[0].paymentMethod
                    : "cash",
                paymentNetwork:
                  o.items && o.items.length > 0
                    ? o.items[0].paymentNetwork
                    : undefined,
                paymentStatus:
                  o.items && o.items.length > 0
                    ? o.items[0].paymentStatus
                    : "pending",
                paymentProof:
                  o.items && o.items.length > 0
                    ? o.items[0].paymentProof
                    : undefined,
                deliveryLocation:
                  o.items && o.items.length > 0
                    ? o.items[0].deliveryLocation
                    : undefined,
                proof_url: o.proof_url,
                items: o.items,
                createdAt: o.created_at,
                customer: {
                  full_name:
                    (o.items && o.items.length > 0
                      ? o.items[0].customerName
                      : null) || "Client Local",
                  phone_number:
                    (o.items && o.items.length > 0
                      ? o.items[0].customerPhone
                      : null) || "",
                },
              })),
            );
          }
        }
        return;
      }

      let allOrders = ordersData || [];

      const localOrdersStr = localStorage.getItem("dashmeals_mock_orders");
      if (localOrdersStr) {
        try {
          const localOrders = JSON.parse(localOrdersStr);
          const restaurantLocalOrders = localOrders.filter(
            (o: any) => o.restaurant_id === restaurant.id,
          );
          allOrders = [...restaurantLocalOrders, ...allOrders];
        } catch (e) {
          console.error("Error parsing local orders", e);
        }
      }

      if (allOrders.length >= 0) {
        const userIds = Array.from(
          new Set(allOrders.map((o: any) => o.user_id)),
        ).filter(Boolean);
        const validUserIds = userIds.filter(
          (id: any) => typeof id === "string" && id.length === 36,
        );

        let profilesMap: Record<string, any> = {};
        if (validUserIds.length > 0) {
          const { data: profilesData, error: profilesError } = await supabase
            .from("profiles")
            .select("*")
            .in("id", validUserIds);

          if (profilesData) {
            profilesData.forEach((p: any) => {
              profilesMap[p.id] = p;
            });
          }
        }

        const formattedOrders = allOrders.map((o: any) => {
          let parsedItems = o.items;
          if (typeof o.items === "string") {
            try {
              parsedItems = JSON.parse(o.items);
            } catch (e) {
              parsedItems = [];
            }
          }

          const fallbackName =
            parsedItems && parsedItems.length > 0
              ? parsedItems[0].customerName
              : null;
          const fallbackPhone =
            parsedItems && parsedItems.length > 0
              ? parsedItems[0].customerPhone
              : null;

          return {
            id: o.id,
            userId: o.user_id,
            restaurantId: o.restaurant_id,
            status: o.status,
            totalAmount: o.total_amount,
            isUrgent:
              parsedItems && parsedItems.length > 0
                ? parsedItems[0].isUrgent
                : false,
            paymentMethod:
              parsedItems && parsedItems.length > 0
                ? parsedItems[0].paymentMethod
                : "cash",
            paymentNetwork:
              parsedItems && parsedItems.length > 0
                ? parsedItems[0].paymentNetwork
                : undefined,
            paymentStatus:
              parsedItems && parsedItems.length > 0
                ? parsedItems[0].paymentStatus
                : "pending",
            paymentProof:
              parsedItems && parsedItems.length > 0
                ? parsedItems[0].paymentProof
                : undefined,
            deliveryLocation:
              parsedItems && parsedItems.length > 0
                ? parsedItems[0].deliveryLocation
                : undefined,
            proof_url: o.proof_url,
            items: parsedItems,
            createdAt: o.created_at,
            customer: {
              full_name:
                profilesMap[o.user_id]?.full_name ||
                fallbackName ||
                "Client Inconnu",
              phone_number:
                profilesMap[o.user_id]?.phone_number || fallbackPhone || "",
              email:
                profilesMap[o.user_id]?.email ||
                (parsedItems && parsedItems.length > 0
                  ? parsedItems[0].customerEmail
                  : null),
            },
          };
        });

        formattedOrders.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        setOrders(formattedOrders);
      }
    } catch (err) {
      console.error("Error fetching restaurant orders:", err);
    }
  };

  const updateOrderItemQuantity = async (
    orderId: string,
    itemIndex: number,
    newQuantity: number,
  ) => {
    try {
      const order = orders.find((o) => o.id === orderId);
      if (!order) return;

      const newItems = [...order.items];
      if (newQuantity <= 0) {
        if (newItems.length === 1) {
          toast.error(
            "Impossible de supprimer le dernier article. Utilisez le bouton 'Refuser' pour annuler la commande.",
          );
          return;
        }
        newItems.splice(itemIndex, 1);
      } else {
        newItems[itemIndex] = { ...newItems[itemIndex], quantity: newQuantity };
      }

      const newTotalAmount = newItems.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0,
      );

      if (orderId.startsWith("mock-")) {
        const localOrdersStr = localStorage.getItem("dashmeals_mock_orders");
        if (localOrdersStr) {
          const localOrders = JSON.parse(localOrdersStr);
          const updatedOrders = localOrders.map((o: any) =>
            o.id === orderId
              ? { ...o, items: newItems, total_amount: newTotalAmount }
              : o,
          );
          localStorage.setItem(
            "dashmeals_mock_orders",
            JSON.stringify(updatedOrders),
          );
          setOrders((prev) =>
            prev.map((o) =>
              o.id === orderId
                ? { ...o, items: newItems, totalAmount: newTotalAmount }
                : o,
            ),
          );
        }
        return;
      }

      const { error } = await supabase
        .from("orders")
        .update({ items: newItems, total_amount: newTotalAmount })
        .eq("id", orderId);

      if (error) {
        toast.error("Erreur lors de la mise à jour de la commande");
      } else {
        setOrders((prev) =>
          prev.map((o) =>
            o.id === orderId
              ? { ...o, items: newItems, totalAmount: newTotalAmount }
              : o,
          ),
        );
        toast.success("Quantité mise à jour");
      }
    } catch (err) {
      console.error("Error updating order items:", err);
    }
  };

  const updatePaymentStatus = async (
    orderId: string,
    newStatus: "pending" | "paid" | "failed",
  ) => {
    try {
      const order = orders.find((o) => o.id === orderId);
      if (!order) return;

      const newItems = order.items.map((item) => ({
        ...item,
        paymentStatus: newStatus,
      }));

      if (orderId.startsWith("mock-")) {
        const localOrdersStr = localStorage.getItem("dashmeals_mock_orders");
        if (localOrdersStr) {
          const localOrders = JSON.parse(localOrdersStr);
          const updatedOrders = localOrders.map((o: any) =>
            o.id === orderId ? { ...o, items: newItems } : o,
          );
          localStorage.setItem(
            "dashmeals_mock_orders",
            JSON.stringify(updatedOrders),
          );
          setOrders((prev) =>
            prev.map((o) =>
              o.id === orderId
                ? { ...o, paymentStatus: newStatus, items: newItems }
                : o,
            ),
          );
        }
        return;
      }

      const { error } = await supabase
        .from("orders")
        .update({ items: newItems })
        .eq("id", orderId);

      if (error) {
        toast.error("Erreur lors de la mise à jour du paiement");
      } else {
        setOrders((prev) =>
          prev.map((o) =>
            o.id === orderId
              ? { ...o, paymentStatus: newStatus, items: newItems }
              : o,
          ),
        );

        // Notify customer
        if (order.customer?.email) {
          const subject =
            newStatus === "paid"
              ? "Paiement confirmé"
              : "Problème avec votre paiement";
          const message =
            newStatus === "paid"
              ? "Votre paiement a été confirmé par le restaurant. Votre commande est en cours de traitement."
              : "Le restaurant a signalé un problème avec votre preuve de paiement. Veuillez en envoyer une nouvelle via l'application.";

          sendEmail({
            to: order.customer.email,
            subject: `[DashMeals] ${subject} - Commande #${order.id.slice(0, 8)}`,
            html: `
                  <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                    <h1 style="color: #ea580c;">${subject}</h1>
                    <p>${message}</p>
                    <p>Commande <strong>#${order.id.slice(0, 8)}</strong></p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
                    <p style="font-size: 12px; color: #666;">DashMeals - Votre service de livraison préféré.</p>
                  </div>
                `,
          });
        }

        if (newStatus === "failed") {
          toast.success("Client notifié pour corriger la preuve de paiement");
        } else {
          toast.success("Statut de paiement mis à jour");
        }
      }
    } catch (err) {
      console.error("Error updating payment status:", err);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: OrderStatus) => {
    try {
      if (orderId.startsWith("mock-")) {
        const localOrdersStr = localStorage.getItem("dashmeals_mock_orders");
        if (localOrdersStr) {
          const localOrders = JSON.parse(localOrdersStr);
          const updatedOrders = localOrders.map((o: any) =>
            o.id === orderId ? { ...o, status: newStatus } : o,
          );
          localStorage.setItem(
            "dashmeals_mock_orders",
            JSON.stringify(updatedOrders),
          );
          setOrders((prev) =>
            prev.map((o) =>
              o.id === orderId ? { ...o, status: newStatus } : o,
            ),
          );
        }
        return;
      }

      const { error } = await supabase
        .from("orders")
        .update({ status: newStatus })
        .eq("id", orderId);

      if (error) {
        toast.error("Erreur lors de la mise à jour du statut");
      } else {
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o)),
        );

        // Send status update email
        const order = orders.find((o) => o.id === orderId);
        if (order && order.customer?.email) {
          sendOrderStatusUpdateEmail(order, order.customer.email, newStatus);
        }

        // Insert notification for the customer
        if (order && order.userId && !orderId.startsWith("mock-")) {
          const statusLabels: Record<string, string> = {
            preparing: "en préparation",
            ready: "prête",
            delivering: "en cours de livraison",
            delivered: "livrée",
            completed: "terminée",
            cancelled: "annulée",
          };

          await supabase.from("notifications").insert({
            user_id: order.userId,
            title: `Commande #${orderId.slice(0, 4)}`,
            message: `Votre commande est maintenant ${statusLabels[newStatus] || newStatus}.`,
            type: "order_status",
            data: { order_id: orderId, status: newStatus },
          });
        }

        if (newStatus === "completed" || newStatus === "delivered") {
          const order = orders.find((o) => o.id === orderId);
          if (order && !orderId.startsWith("mock-")) {
            // 1. Update loyalty points
            if (order.userId) {
              const pointsToAdd = Math.floor(order.totalAmount * 10);
              try {
                const { data: existingPoints } = await supabase
                  .from("loyalty_points")
                  .select("points")
                  .eq("user_id", order.userId)
                  .eq("restaurant_id", restaurant.id)
                  .maybeSingle();

                if (existingPoints) {
                  await supabase
                    .from("loyalty_points")
                    .update({
                      points: existingPoints.points + pointsToAdd,
                      updated_at: new Date().toISOString(),
                    })
                    .eq("user_id", order.userId)
                    .eq("restaurant_id", restaurant.id);
                } else {
                  await supabase.from("loyalty_points").insert({
                    user_id: order.userId,
                    restaurant_id: restaurant.id,
                    points: pointsToAdd,
                  });
                }

                if (activeView === "marketing") {
                  fetchMarketingData();
                }
              } catch (err) {
                console.error("Error updating loyalty points:", err);
              }
            }

            // 2. Update stock
            const updatedMenu = [...restaurant.menu];
            let stockUpdated = false;

            for (const item of order.items) {
              const menuIndex = updatedMenu.findIndex((m) => m.id === item.id);
              if (
                menuIndex !== -1 &&
                updatedMenu[menuIndex].stock !== undefined
              ) {
                updatedMenu[menuIndex] = {
                  ...updatedMenu[menuIndex],
                  stock: Math.max(
                    0,
                    updatedMenu[menuIndex].stock! - item.quantity,
                  ),
                };
                stockUpdated = true;

                await supabase
                  .from("menu_items")
                  .update({ stock: updatedMenu[menuIndex].stock })
                  .eq("id", item.id);
              }
            }

            if (stockUpdated) {
              onUpdateRestaurant({ ...restaurant, menu: updatedMenu });
            }
          }
        }
      }
    } catch (err) {
      console.error("Error updating status:", err);
    }
  };

  const addPromotion = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check tier limits
    if (!checkLimit("promotions", promotions.length)) return;

    setLoading(true);
    setPromoError(null);

    let urlToUse = newPromoUrl;

    if (promoFile) {
      const isVideo = promoFile.type.startsWith("video/");
      const isImage = promoFile.type.startsWith("image/");

      if (newPromoType === "video" && !isVideo) {
        setPromoError("Le fichier sélectionné n'est pas une vidéo valide.");
        setLoading(false);
        return;
      }
      if (newPromoType === "image" && !isImage) {
        setPromoError("Le fichier sélectionné n'est pas une image valide.");
        setLoading(false);
        return;
      }

      const maxSize =
        newPromoType === "video" ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
      if (promoFile.size > maxSize) {
        setPromoError(
          `Fichier trop volumineux. Maximum ${newPromoType === "video" ? "50MB" : "10MB"}.`,
        );
        setLoading(false);
        return;
      }

      const uploaded = await uploadImage(promoFile, "images");
      if (uploaded) {
        urlToUse = uploaded;
      } else {
        setPromoError("Échec du téléchargement du média vers le serveur.");
        setLoading(false);
        return;
      }
    }

    if (!urlToUse) {
      setPromoError(
        "Veuillez fournir une URL ou sélectionner un fichier média.",
      );
      setLoading(false);
      return;
    }

    const payload = {
      restaurant_id: restaurant.id,
      media_url: urlToUse,
      media_type: newPromoType,
      caption: newPromoCaption,
    };

    try {
      const { data, error } = await supabase
        .from("promotions")
        .insert(payload)
        .select()
        .single();

      if (error) {
        console.error("Supabase insert error:", error);
        if (error.code === "42501") {
          throw new Error(
            "Permission refusée (RLS). Vous n'avez pas le droit d'ajouter des promotions.",
          );
        }
        throw new Error(error.message);
      }

      if (data) {
        const newPromo: Promotion = {
          id: data.id,
          restaurantId: restaurant.id,
          mediaUrl: data.media_url,
          mediaType: data.media_type,
          caption: data.caption,
          createdAt: data.created_at,
        };
        setPromotions([newPromo, ...promotions]);
        setNewPromoUrl("");
        setNewPromoCaption("");
        setPromoFile(null);
        setIsAddingPromo(false);
        toast.success("Story publiée avec succès ! (Visible 24h)");
      }
    } catch (err: any) {
      console.error("Error adding promo:", err);
      setPromoError(
        `Erreur lors de la publication : ${err.message || "Vérifiez votre connexion internet"}`,
      );
    } finally {
      setLoading(false);
    }
  };

  const deletePromotion = async (id: string) => {
    if (user.role !== "business") {
      toast.error("Seul le propriétaire peut supprimer des stories.");
      return;
    }
    if (!confirm("Supprimer cette publicité ?")) return;
    try {
      await supabase.from("promotions").delete().eq("id", id);
      setPromotions(promotions.filter((p) => p.id !== id));
    } catch (err) {
      setPromotions(promotions.filter((p) => p.id !== id));
    }
  };

  const updateTimes = async () => {
    setUpdatingTimes(true);
    try {
      const newPrep = parseInt(prepTime) || 0;
      const newDeliv = parseInt(deliveryTime) || 0;

      const { error } = await supabase
        .from("restaurants")
        .update({
          preparation_time: newPrep,
          estimated_delivery_time: newDeliv,
        })
        .eq("id", restaurant.id);
      if (error) throw error;

      onUpdateRestaurant({
        ...restaurant,
        preparationTime: newPrep,
        estimatedDeliveryTime: newDeliv,
      });
      toast.success("Temps mis à jour !");
    } catch (err) {
      onUpdateRestaurant({
        ...restaurant,
        preparationTime: parseInt(prepTime),
        estimatedDeliveryTime: parseInt(deliveryTime),
      });
    } finally {
      setUpdatingTimes(false);
    }
  };

  const toggleOpen = async () => {
    try {
      const newState = !restaurant.isOpen;
      const { error } = await supabase
        .from("restaurants")
        .update({ is_open: newState })
        .eq("id", restaurant.id);
      if (error) throw error;
      onUpdateRestaurant({ ...restaurant, isOpen: newState });
    } catch (err) {
      onUpdateRestaurant({ ...restaurant, isOpen: !restaurant.isOpen });
    }
  };

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);

    let imageUrl = settingsForm.coverImage;

    if (coverImageFile) {
      const uploadedUrl = await uploadImage(coverImageFile, "images");
      if (uploadedUrl) {
        imageUrl = uploadedUrl;
      } else {
        setIsSavingSettings(false);
        return;
      }
    }

    const updatePayload: any = {
      name: settingsForm.name,
      description: settingsForm.description,
      cover_image: imageUrl,
      city: settingsForm.city,
      latitude: settingsForm.latitude,
      longitude: settingsForm.longitude,
      phone_number: settingsForm.phoneNumber,
      currency: settingsForm.currency,
      exchange_rate: settingsForm.exchangeRate,
      display_currency_mode: settingsForm.displayCurrencyMode,
      payment_config: settingsForm.paymentConfig,
    };

    try {
      const { error } = await supabase
        .from("restaurants")
        .update(updatePayload)
        .eq("id", restaurant.id);

      if (error) {
        if (error.code === "42703") {
          console.warn(
            "Missing columns in restaurants table, retrying without currency/payment_config/phone_number/exchange_rate",
          );
          delete updatePayload.currency;
          delete updatePayload.payment_config;
          delete updatePayload.phone_number;
          delete updatePayload.exchange_rate;
          delete updatePayload.display_currency_mode;
          const { error: retryError } = await supabase
            .from("restaurants")
            .update(updatePayload)
            .eq("id", restaurant.id);
          if (retryError) throw retryError;
        } else {
          throw error;
        }
      }

      onUpdateRestaurant({
        ...restaurant,
        name: settingsForm.name,
        description: settingsForm.description,
        city: settingsForm.city,
        latitude: settingsForm.latitude,
        longitude: settingsForm.longitude,
        phoneNumber: settingsForm.phoneNumber,
        currency: settingsForm.currency,
        exchangeRate: settingsForm.exchangeRate,
        displayCurrencyMode: settingsForm.displayCurrencyMode,
        coverImage: imageUrl,
      });

      setCoverImageFile(null);
      toast.success("✅ Paramètres enregistrés avec succès !");
    } catch (err: any) {
      console.error("Error Saving Settings:", err);
      toast.error(
        `Erreur de sauvegarde: ${err.message || "Problème de connexion"}`,
      );
      onUpdateRestaurant({
        ...restaurant,
        name: settingsForm.name,
        description: settingsForm.description,
        city: settingsForm.city,
        latitude: settingsForm.latitude,
        longitude: settingsForm.longitude,
        phoneNumber: settingsForm.phoneNumber,
        currency: settingsForm.currency,
        exchangeRate: settingsForm.exchangeRate,
        displayCurrencyMode: settingsForm.displayCurrencyMode,
        coverImage: imageUrl,
      });
    } finally {
      setIsSavingSettings(false);
    }
  };

  const startEditItem = (item: MenuItem) => {
    setNewItemName(item.name || "");
    setNewItemDesc(item.description || "");
    setNewItemPrice(item.price?.toString() || "");
    setNewItemStock(item.stock?.toString() || "");
    setNewItemLowStockThreshold(item.lowStockThreshold?.toString() || "");
    setNewItemCategory(item.category);
    setEditingItem(item);
    setIsAddingItem(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const toggleItemAvailability = async (item: MenuItem) => {
    try {
      const newState = !item.isAvailable;
      const { error } = await supabase
        .from("menu_items")
        .update({ is_available: newState })
        .eq("id", item.id);
      if (error) throw error;

      const updatedMenu = restaurant.menu.map((m) =>
        m.id === item.id ? { ...m, isAvailable: newState } : m,
      );
      onUpdateRestaurant({ ...restaurant, menu: updatedMenu });
    } catch (err) {
      console.error("Error toggling availability:", err);
      const updatedMenu = restaurant.menu.map((m) =>
        m.id === item.id ? { ...m, isAvailable: !item.isAvailable } : m,
      );
      onUpdateRestaurant({ ...restaurant, menu: updatedMenu });
    }
  };

  const handleQuickStockUpdate = async (itemId: string, newStock: number) => {
    try {
      // If we add stock, we likely want the item to be available
      const { error } = await supabase
        .from("menu_items")
        .update({
          stock: newStock,
          is_available: newStock > 0,
        })
        .eq("id", itemId);

      if (error) throw error;

      const updatedMenu = restaurant.menu.map((m) =>
        m.id === itemId
          ? { ...m, stock: newStock, isAvailable: newStock > 0 }
          : m,
      );
      onUpdateRestaurant({ ...restaurant, menu: updatedMenu });
    } catch (err) {
      console.error("Error updating stock:", err);
      toast.error("Erreur lors de la mise à jour du stock.");
    }
  };

  const deleteItem = async (itemId: string) => {
    if (user.role !== "business") {
      toast.error("Seul le propriétaire peut supprimer des articles du menu.");
      return;
    }
    if (!window.confirm("Supprimer cet élément ?")) return;
    try {
      const { error } = await supabase
        .from("menu_items")
        .delete()
        .eq("id", itemId);
      if (error) throw error;
      onUpdateRestaurant({
        ...restaurant,
        menu: restaurant.menu.filter((m) => m.id !== itemId),
      });
    } catch (err) {
      onUpdateRestaurant({
        ...restaurant,
        menu: restaurant.menu.filter((m) => m.id !== itemId),
      });
    }
  };

  const addItem = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check tier limits
    if (!editingItem && !checkLimit("menuItems", restaurant.menu.length)) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const price = parseFloat(newItemPrice);
    const stock = newItemStock ? parseInt(newItemStock) : undefined;
    const lowStockThreshold = newItemLowStockThreshold
      ? parseInt(newItemLowStockThreshold)
      : undefined;

    try {
      let imageUrl = editingItem ? editingItem.image : null;

      if (newItemImageFile) {
        const uploadedUrl = await uploadImage(newItemImageFile, "images");
        if (uploadedUrl) {
          imageUrl = uploadedUrl;
        } else {
          setLoading(false);
          return;
        }
      }

      if (!imageUrl) {
        imageUrl = `https://picsum.photos/200/200?random=${Date.now()}`;
      }

      const payload = {
        name: newItemName,
        description: newItemDesc,
        price: price,
        stock: stock,
        low_stock_threshold: lowStockThreshold,
        category: newItemCategory,
        image: imageUrl,
        is_available: true,
      };

      if (editingItem) {
        const { error } = await supabase
          .from("menu_items")
          .update(payload)
          .eq("id", editingItem.id);
        if (error) throw error;

        const updatedMenu = restaurant.menu.map((m) =>
          m.id === editingItem.id ? { ...m, ...payload, lowStockThreshold } : m,
        );
        onUpdateRestaurant({ ...restaurant, menu: updatedMenu });
        toast.success("Plat modifié avec succès !");
      } else {
        const newPayload = { ...payload, restaurant_id: restaurant.id };
        const { data, error } = await supabase
          .from("menu_items")
          .insert(newPayload)
          .select()
          .single();
        if (error) throw error;

        if (data) {
          const newItem: MenuItem = {
            id: data.id,
            name: data.name,
            description: data.description,
            price: data.price,
            stock: data.stock,
            lowStockThreshold: data.low_stock_threshold,
            category: data.category as any,
            isAvailable: data.is_available,
            image: data.image,
          };
          onUpdateRestaurant({
            ...restaurant,
            menu: [...restaurant.menu, newItem],
          });
          toast.success("Plat ajouté avec succès !");
        }
      }
    } catch (err: any) {
      console.error("Error saving item:", err);
      toast.error(
        `Erreur: ${err.message || "Impossible d'enregistrer le plat"}`,
      );
      if (editingItem) {
        const updatedMenu = restaurant.menu.map((m) =>
          m.id === editingItem.id
            ? {
                ...m,
                name: newItemName,
                description: newItemDesc,
                price,
                stock,
                lowStockThreshold,
                category: newItemCategory,
              }
            : m,
        );
        onUpdateRestaurant({ ...restaurant, menu: updatedMenu });
      } else {
        const mockItem: MenuItem = {
          id: `mock-item-${Date.now()}`,
          name: newItemName,
          description: newItemDesc,
          price: price,
          stock: stock,
          lowStockThreshold: lowStockThreshold,
          category: newItemCategory,
          isAvailable: true,
          image: `https://picsum.photos/200/200?random=${Date.now()}`,
        };
        onUpdateRestaurant({
          ...restaurant,
          menu: [...restaurant.menu, mockItem],
        });
      }
    } finally {
      setNewItemName("");
      setNewItemDesc("");
      setNewItemPrice("");
      setNewItemStock("");
      setNewItemLowStockThreshold("");
      setIsAddingItem(false);
      setLoading(false);
      setNewItemImageFile(null);
      setEditingItem(null);
    }
  };

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case "pending":
        return (
          <span className="bg-gray-200 text-gray-700 px-2 py-1 rounded text-xs font-bold">
            En attente
          </span>
        );
      case "preparing":
        return (
          <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded text-xs font-bold animate-pulse">
            En cuisine
          </span>
        );
      case "ready":
        return (
          <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold">
            Prêt
          </span>
        );
      case "delivering":
        return (
          <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded text-xs font-bold">
            Livraison
          </span>
        );
      case "delivered":
        return (
          <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">
            Livré
          </span>
        );
      case "completed":
        return (
          <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">
            Terminé
          </span>
        );
      case "cancelled":
        return (
          <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold">
            Annulé
          </span>
        );
    }
  };

  const completedOrders = orders.filter((o) => o.status === "completed");
  const revenue = completedOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const activeOrders = orders.filter((o) =>
    ["pending", "preparing", "ready", "delivering", "delivered"].includes(
      o.status,
    ),
  );

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  const dailyRevenue = completedOrders
    .filter(
      (o) => new Date(o.createdAt).toISOString().split("T")[0] === todayStr,
    )
    .reduce((sum, o) => sum + o.totalAmount, 0);

  const monthlyRevenue = completedOrders
    .filter((o) => {
      const orderDate = new Date(o.createdAt);
      return (
        orderDate.getMonth() === currentMonth &&
        orderDate.getFullYear() === currentYear
      );
    })
    .reduce((sum, o) => sum + o.totalAmount, 0);

  const productSales: Record<
    string,
    { name: string; quantity: number; revenue: number }
  > = {};
  completedOrders.forEach((order) => {
    order.items.forEach((item) => {
      if (!productSales[item.id]) {
        productSales[item.id] = { name: item.name, quantity: 0, revenue: 0 };
      }
      productSales[item.id].quantity += item.quantity;
      productSales[item.id].revenue += item.price * item.quantity;
    });
  });
  const topSellingProducts = Object.values(productSales)
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);

  const renderSidebarItem = (
    view: DashboardView,
    icon: React.ReactNode,
    label: string,
    badge?: number,
  ) => {
    if (!canAccessView(view)) return null;

    const isActive = activeView === view;

    // Feature gating for sidebar
    let isLocked = false;
    if (view === "analytics") isLocked = !hasFeature(restaurant, "aiInsights");
    if (view === "marketing")
      isLocked = !hasFeature(restaurant, "autoMarketing");
    if (view === "team") isLocked = !hasFeature(restaurant, "staffManagement");
    if (view === "sales") isLocked = !hasFeature(restaurant, "advancedStats");

    return (
      <button
        onClick={() => navigateTo(view)}
        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all font-medium group active:scale-95 ${isActive ? "bg-brand-600 text-white font-bold shadow-lg shadow-brand-200 dark:shadow-brand-900/20" : "text-gray-500 dark:text-gray-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 hover:text-brand-600 dark:hover:text-brand-400"}`}
      >
        <div className="flex items-center space-x-3">
          <div
            className={`transition-transform duration-300 ${isActive ? "scale-110" : "group-hover:scale-110"}`}
          >
            {icon}
          </div>
          <span className="text-sm">{label}</span>
        </div>
        <div className="flex items-center space-x-2">
          {isLocked && (
            <Lock
              size={12}
              className={isActive ? "text-white/70" : "text-gray-400"}
            />
          )}
          {badge && badge > 0 ? (
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm ${isActive ? "bg-white text-brand-600" : "bg-brand-600 text-white animate-pulse"}`}
            >
              {badge}
            </span>
          ) : null}
        </div>
      </button>
    );
  };

  const renderBillingView = () => {
    const isExpired = restaurant.subscriptionEndDate
      ? new Date(restaurant.subscriptionEndDate) < new Date()
      : false;

    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-2">
                Votre Abonnement
              </h2>
              <p className="text-gray-500 dark:text-gray-400">
                Gérez votre forfait et vos paiements Stripe.
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <div
                className={`px-4 py-2 rounded-full font-bold text-sm tracking-wide ${isExpired ? "bg-red-100 text-red-600" : "bg-green-100 text-green-600"}`}
              >
                {isExpired ? "Expiré" : "Actif"}
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-gray-400">
                  Prochain renouvellement
                </p>
                <p className="font-bold text-gray-900 dark:text-white">
                  {restaurant.subscriptionEndDate
                    ? new Date(
                        restaurant.subscriptionEndDate,
                      ).toLocaleDateString()
                    : "Non défini"}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {PLANS.map((plan) => (
              <div
                key={plan.id}
                className={`relative p-6 rounded-3xl border-2 transition-all duration-300 ${
                  restaurant.subscriptionTier === plan.id
                    ? "border-brand-600 bg-brand-50/30 dark:bg-brand-900/10"
                    : "border-gray-100 dark:border-gray-700 hover:border-brand-200"
                }`}
              >
                {restaurant.subscriptionTier === plan.id && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-600 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">
                    Plan Actuel
                  </div>
                )}
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                  {plan.name}
                </h3>
                <div className="flex items-baseline space-x-1 mb-6">
                  <span className="text-3xl font-bold text-gray-900 dark:text-white">
                    ${plan.price}
                  </span>
                  <span className="text-gray-500 text-sm">/mois</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((f, i) => (
                    <li
                      key={i}
                      className="text-[10px] text-gray-600 dark:text-gray-400 flex items-start"
                    >
                      <CheckCircle2
                        size={12}
                        className="mr-2 text-brand-600 mt-0.5 flex-shrink-0"
                      />
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => {
                    if (plan.id === "free") {
                      onUpdateRestaurant({
                        ...restaurant,
                        subscriptionTier: "free",
                        subscriptionStatus: "active",
                      });
                      toast.success("Passage au forfait gratuit effectué.");
                      return;
                    }
                    setSelectedPlan(plan);
                    setIsPayingSubscription(true);
                  }}
                  disabled={
                    restaurant.subscriptionTier === plan.id && !isExpired
                  }
                  className={`w-full py-3 rounded-xl font-bold transition-all ${
                    restaurant.subscriptionTier === plan.id && !isExpired
                      ? "bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed"
                      : "bg-brand-600 text-white hover:bg-brand-700 shadow-lg shadow-brand-200 active:scale-95"
                  }`}
                >
                  {restaurant.subscriptionTier === plan.id
                    ? "Renouveler"
                    : "Choisir ce plan"}
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-brand-600 rounded-3xl p-8 text-white shadow-xl overflow-hidden relative">
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="max-w-md">
              <h3 className="text-2xl font-black mb-2">
                Paiements Sécurisés par Stripe
              </h3>
              <p className="text-brand-100 leading-relaxed">
                Nous utilisons Stripe pour garantir la sécurité de vos
                transactions. Vos informations bancaires ne sont jamais stockées
                sur nos serveurs.
              </p>
            </div>
            <div className="flex -space-x-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="w-12 h-12 rounded-full border-4 border-brand-600 bg-white/20 backdrop-blur-md flex items-center justify-center"
                >
                  <Shield size={20} />
                </div>
              ))}
            </div>
          </div>
          <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
        </div>
      </div>
    );
  };

  const renderOverview = () => {
    const isVerified = restaurant.isVerified;
    const verificationRequested = restaurant.verificationRequested;
    const createdAt = restaurant.createdAt
      ? new Date(restaurant.createdAt)
      : new Date();
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
    const isMandatory = createdAt < twoMonthsAgo;

    return (
      <div className="space-y-10 animate-in fade-in duration-700 pb-20">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-4xl font-display font-bold text-gray-900 dark:text-white tracking-tighter italic">
              Tableau de{" "}
              <span className="text-brand-600 drop-shadow-[0_0_15px_rgba(225,29,72,0.5)]">
                bord Nexus
              </span>
            </h2>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold tracking-widest mt-2">
              Flux de données en temps réel • {restaurant.name}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="glass p-8 rounded-[32px] border border-white/20 dark:border-white/5 shadow-2xl group hover:border-green-500/30 transition-all relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/5 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-green-500/10 transition-all duration-700"></div>
            <div className="flex items-center justify-between relative z-10">
              <div>
                <p className="text-[10px] font-bold text-gray-400 tracking-wide mb-1">
                  Chiffre d'affaires
                </p>
                <h3 className="text-xl font-display font-bold text-gray-900 dark:text-white italic tracking-tighter">
                  {formatDualPrice(revenue || 0, restaurant.currency as 'USD' | 'CDF' || 'USD', restaurant.exchangeRate, restaurant.displayCurrencyMode)}
                </h3>
              </div>
              <div className="w-14 h-14 bg-green-500/10 rounded-2xl flex items-center justify-center text-green-500 border border-green-500/20 shadow-inner group-hover:scale-110 transition-transform">
                <DollarSign size={28} />
              </div>
            </div>
          </div>

          <div className="glass p-8 rounded-[32px] border border-white/20 dark:border-white/5 shadow-2xl group hover:border-orange-500/30 transition-all relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-orange-500/10 transition-all duration-700"></div>
            <div className="flex items-center justify-between relative z-10">
              <div>
                <p className="text-[10px] font-bold text-gray-400 tracking-wide mb-1">
                  Commandes actives
                </p>
                <h3 className="text-3xl font-display font-bold text-gray-900 dark:text-white italic tracking-tighter">
                  {activeOrders.length}
                </h3>
              </div>
              <div className="w-14 h-14 bg-orange-500/10 rounded-2xl flex items-center justify-center text-orange-500 border border-orange-500/20 shadow-inner group-hover:scale-110 transition-transform">
                <Clock size={28} />
              </div>
            </div>
          </div>

          <div className="glass p-8 rounded-[32px] border border-white/20 dark:border-white/5 shadow-2xl group hover:border-blue-500/30 transition-all relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-blue-500/10 transition-all duration-700"></div>
            <div className="flex items-center justify-between relative z-10">
              <div>
                <p className="text-[10px] font-bold text-gray-400 tracking-wide mb-1">
                  Volume total
                </p>
                <h3 className="text-3xl font-display font-bold text-gray-900 dark:text-white italic tracking-tighter">
                  {orders.length}
                </h3>
              </div>
              <div className="w-14 h-14 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-500 border border-blue-500/20 shadow-inner group-hover:scale-110 transition-transform">
                <ShoppingBag size={28} />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="glass p-10 rounded-[40px] border border-white/20 dark:border-white/5 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/5 rounded-full blur-[80px] -mr-32 -mt-32"></div>
            <h3 className="font-display font-bold text-xl text-gray-900 dark:text-white mb-8 flex items-center italic tracking-tight relative z-10">
              <Brain
                size={24}
                className="mr-4 text-brand-600 drop-shadow-[0_0_10px_rgba(225,29,72,0.4)]"
              />{" "}
              Analyse stratégique IA
            </h3>
            <div className="relative z-10">
              {businessInsights.length > 0 ? (
                <div className="space-y-4">
                  {businessInsights.slice(0, 2).map((insight, i) => (
                    <div
                      key={i}
                      className="p-5 bg-white/40 dark:bg-black/20 rounded-2xl border border-white/20 dark:border-white/5 group/insight hover:border-brand-500/30 transition-all"
                    >
                      <p className="text-[10px] font-bold text-brand-600 dark:text-brand-400 tracking-wide mb-1">
                        {insight.title}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-300 font-medium line-clamp-2 leading-relaxed">
                        {insight.description}
                      </p>
                    </div>
                  ))}
                  <button
                    onClick={() => navigateTo("analytics")}
                    className="w-full mt-4 text-brand-600 dark:text-brand-400 text-[10px] font-bold tracking-widest hover:tracking-[0.4em] transition-all flex items-center justify-center py-2"
                  >
                    Explorer l'intelligence{" "}
                    <ChevronRight size={14} className="ml-2" />
                  </button>
                </div>
              ) : (
                <div className="text-center py-12 flex flex-col items-center">
                  <div className="w-16 h-16 bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-4 text-gray-400">
                    <Brain size={32} />
                  </div>
                  <p className="text-xs text-gray-400 dark:text-gray-500 font-medium max-w-[200px] mb-6">
                    Prêt pour l'extraction de données stratégiques.
                  </p>
                  <button
                    onClick={() => navigateTo("analytics")}
                    className="bg-brand-600 text-white px-8 py-3 rounded-full text-[10px] font-bold tracking-widest hover:bg-brand-700 shadow-lg shadow-brand-500/20 transition-all"
                  >
                    Lancer l'analyse
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="glass p-10 rounded-[40px] border border-white/20 dark:border-white/5 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/5 rounded-full blur-[80px] -mr-32 -mt-32"></div>
            <h3 className="font-display font-bold text-xl text-gray-900 dark:text-white mb-8 flex items-center italic tracking-tight relative z-10">
              <AlertTriangle
                size={24}
                className="mr-4 text-orange-500 drop-shadow-[0_0_10px_rgba(249,115,22,0.4)]"
              />{" "}
              État critique des stocks
            </h3>
            <div className="relative z-10">
              <div className="space-y-4">
                {restaurant.menu
                  .filter(
                    (i) =>
                      i.stock !== undefined &&
                      i.stock! <= (i.lowStockThreshold || 5),
                  )
                  .slice(0, 3)
                  .map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-5 bg-red-500/5 dark:bg-red-500/10 rounded-2xl border border-red-500/10 group/item hover:bg-red-500/10 transition-all"
                    >
                      <span className="text-sm font-display font-bold text-red-600 dark:text-red-400 italic tracking-tight">
                        {item.name}
                      </span>
                      <span className="text-[10px] font-bold text-red-700 dark:text-red-300 bg-red-500/10 px-3 py-1 rounded-full">
                        {item.stock} réserves
                      </span>
                    </div>
                  ))}
                {restaurant.menu.filter(
                  (i) =>
                    i.stock !== undefined &&
                    i.stock! <= (i.lowStockThreshold || 5),
                ).length === 0 ? (
                  <div className="text-center py-12 flex flex-col items-center">
                    <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mb-4 text-green-500 border border-green-500/20">
                      <CheckCircle size={32} />
                    </div>
                    <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 tracking-wide">
                      Opérations sécurisées • Flux de stock nominal
                    </p>
                  </div>
                ) : (
                  <button
                    onClick={() => navigateTo("menu")}
                    className="w-full mt-4 text-orange-500 dark:text-orange-400 text-[10px] font-bold tracking-widest hover:tracking-[0.4em] transition-all flex items-center justify-center py-2"
                  >
                    Restaurer les réserves{" "}
                    <ChevronRight size={14} className="ml-2" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="glass p-10 rounded-[40px] border border-white/20 dark:border-white/5 shadow-2xl relative overflow-hidden group lg:col-span-1">
            <h3 className="font-display font-bold text-xl text-gray-900 dark:text-white mb-8 flex items-center italic tracking-tight">
              <Power
                size={24}
                className={`mr-4 ${restaurant.isOpen ? "text-green-500 drop-shadow-[0_0_10px_rgba(34,197,94,0.4)]" : "text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.4)]"}`}
              />{" "}
              Statut de diffusion
            </h3>
            <div className="flex flex-col space-y-6">
              <div
                className={`p-6 rounded-3xl transition-all duration-500 border relative overflow-hidden ${restaurant.isOpen ? "bg-green-500 text-white border-white/20 shadow-[0_20px_40px_-10px_rgba(34,197,94,0.3)]" : "bg-red-500 text-white border-white/20"}`}
              >
                <div className="flex items-center justify-between mb-4 relative z-10">
                  <p className="font-display font-bold text-2xl italic tracking-tighter">
                    {restaurant.isOpen ? "Ouvert" : "Fermé"}
                  </p>
                  <div
                    className={`w-3 h-3 rounded-full bg-white ${restaurant.isOpen ? "animate-pulse shadow-[0_0_10px_#fff]" : ""}`}
                  ></div>
                </div>
                <p className="text-[10px] font-bold tracking-wide opacity-80 mb-6 relative z-10">
                  {restaurant.isOpen
                    ? "Le nexus est visible par les clients."
                    : "Visibilité client suspendue."}
                </p>
                <button
                  onClick={toggleOpen}
                  className="w-full bg-white text-gray-900 py-4 rounded-2xl font-display font-bold italic tracking-wide text-xs hover:scale-[1.02] active:scale-95 transition-all shadow-xl relative z-10"
                >
                  Bascule de flux
                </button>
              </div>

              <div className="space-y-4 pt-4">
                <div className="group/input">
                  <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 block mb-2 px-1">
                    Préparation (min)
                  </label>
                  <input
                    type="number"
                    className="w-full p-4 glass border border-white/20 rounded-2xl focus:ring-4 focus:ring-brand-500/20 dark:text-white outline-none font-display font-black text-lg transition-all"
                    value={prepTime}
                    onChange={(e) => setPrepTime(e.target.value)}
                  />
                </div>
                <div className="group/input">
                  <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 block mb-2 px-1">
                    Logistique (min)
                  </label>
                  <input
                    type="number"
                    className="w-full p-4 glass border border-white/20 rounded-2xl focus:ring-4 focus:ring-brand-500/20 dark:text-white outline-none font-display font-black text-lg transition-all"
                    value={deliveryTime}
                    onChange={(e) => setDeliveryTime(e.target.value)}
                  />
                </div>
                <button
                  onClick={updateTimes}
                  disabled={updatingTimes}
                  className="w-full bg-brand-600/10 text-brand-600 dark:text-brand-400 font-display font-bold italic tracking-wide text-xs py-4 rounded-2xl hover:bg-brand-600 hover:text-white transition-all border border-brand-500/20"
                >
                  {updatingTimes ? "Transmission..." : "Sync chrono"}
                </button>
              </div>
            </div>
          </div>

          <div className="glass p-10 rounded-[40px] border border-white/20 dark:border-white/5 shadow-2xl relative overflow-hidden group lg:col-span-2">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
              <h3 className="font-display font-bold text-xl text-gray-900 dark:text-white flex items-center italic tracking-tight">
                <TrendingUp
                  size={24}
                  className="mr-4 text-blue-500 drop-shadow-[0_0_10px_rgba(59,130,246,0.4)]"
                />{" "}
                Flux d'Activité Récent
              </h3>
              <button
                onClick={() => navigateTo("orders")}
                className="text-[10px] font-bold text-gray-400 tracking-widest hover:text-brand-600 transition-colors flex items-center"
              >
                Historique complet <ArrowRight size={14} className="ml-2" />
              </button>
            </div>

            <div className="space-y-4">
              {orders.slice(0, 5).map((order) => (
                <div
                  key={order.id}
                  className="glass p-6 rounded-3xl border border-white/10 dark:bg-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-blue-500/30 transition-all cursor-pointer group/order"
                  onClick={() => navigateTo("orders")}
                >
                  <div className="flex items-center space-x-5">
                    <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center font-display font-black text-2xl text-gray-400 group-hover/order:text-blue-500 transition-colors relative overflow-hidden">
                      {order.customer?.full_name?.charAt(0) || "U"}
                      <div className="absolute inset-0 bg-blue-500/5 group-hover/order:bg-blue-500/10 transition-all"></div>
                    </div>
                    <div>
                      <p className="font-display font-bold text-lg text-gray-900 dark:text-white italic tracking-tight">
                        {order.customer?.full_name}
                      </p>
                      <div className="flex items-center text-[10px] text-gray-500 font-bold mt-1">
                        <Clock size={12} className="mr-1.5 opacity-60" />
                        {new Date(order.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-6 w-full sm:w-auto justify-between sm:justify-end">
                    <div className="text-right">
                      <p className="font-display font-bold text-lg text-gray-900 dark:text-white italic tracking-tighter">
                        {formatDualPrice(order.totalAmount || 0, restaurant.currency as 'USD' | 'CDF' || 'USD', order.exchangeRate || restaurant.exchangeRate, restaurant.displayCurrencyMode)}
                      </p>
                    </div>
                    <div
                      className={`px-4 py-1.5 rounded-full text-[10px] font-bold ${
                        order.status === "completed"
                          ? "bg-green-500/10 text-green-500 border border-green-500/20"
                          : "bg-blue-500/10 text-blue-500 border border-blue-500/20"
                      }`}
                    >
                      {order.status}
                    </div>
                  </div>
                </div>
              ))}
              {orders.length === 0 && (
                <div className="flex flex-col items-center py-16 opacity-40">
                  <Plus size={48} className="text-gray-300 mb-4" />
                  <p className="text-[10px] font-bold text-gray-500 tracking-wide">
                    En attente des premiers signaux transactionnels
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderMenu = () => (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
          Menu & carte
        </h2>
        <button
          onClick={() => setIsAddingItem(!isAddingItem)}
          className="flex items-center bg-brand-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-brand-700 transition-colors shadow-lg"
        >
          <Plus size={18} className="mr-2" /> Ajouter un plat
        </button>
      </div>

      {isAddingItem && (
        <form
          onSubmit={addItem}
          className="bg-brand-50 dark:bg-brand-900/10 p-6 rounded-2xl border border-brand-100 dark:border-brand-900 shadow-sm animate-slide-in-down"
        >
          <h4 className="font-bold text-brand-800 dark:text-brand-400 mb-4">
            {editingItem ? "Modifier le Plat" : "Nouveau Plat"}
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">
                Nom du plat
              </label>
              <input
                type="text"
                required
                className="w-full p-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg"
                placeholder="Ex: Poulet Mayo"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">
                Prix ($)
              </label>
              <input
                type="number"
                step="0.1"
                required
                className="w-full p-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg"
                placeholder="Ex: 15.0"
                value={newItemPrice}
                onChange={(e) => setNewItemPrice(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">
                Stock (Optionnel)
              </label>
              <input
                type="number"
                className="w-full p-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg"
                placeholder="Ex: 50"
                value={newItemStock}
                onChange={(e) => setNewItemStock(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">
                Alerte Stock Bas (Optionnel)
              </label>
              <input
                type="number"
                className="w-full p-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg"
                placeholder="Ex: 10"
                value={newItemLowStockThreshold}
                onChange={(e) => setNewItemLowStockThreshold(e.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">
                Description
              </label>
              <textarea
                className="w-full p-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg"
                placeholder="Description appétissante..."
                value={newItemDesc}
                onChange={(e) => setNewItemDesc(e.target.value)}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">
                Photo du plat
              </label>
              <div className="flex items-center space-x-2">
                <label className="cursor-pointer bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-lg font-bold flex items-center relative">
                  <Upload size={16} className="mr-2" />
                  {newItemImageFile
                    ? "Photo sélectionnée"
                    : "Choisir une photo"}
                  <input
                    type="file"
                    id="new-item-image-input"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) =>
                      setNewItemImageFile(e.target.files?.[0] || null)
                    }
                  />
                  <button
                    type="button"
                    className="absolute inset-0 w-full h-full opacity-0 z-10"
                    onClick={async (e) => {
                      e.preventDefault();
                      if (isCapacitor) {
                        const file = await pickImage({ asFile: true });
                        if (file instanceof File) setNewItemImageFile(file);
                      } else {
                        document.getElementById('new-item-image-input')?.click();
                      }
                    }}
                  />
                </label>
                {newItemImageFile && (
                  <span className="text-xs text-brand-600">
                    {newItemImageFile.name}
                  </span>
                )}
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">
                Catégorie
              </label>
              <div className="flex space-x-2 overflow-x-auto pb-2">
                {(["entrée", "plat", "dessert", "boisson"] as const).map(
                  (cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setNewItemCategory(cat)}
                      className={`px-4 py-2 rounded-lg font-bold capitalize whitespace-nowrap ${newItemCategory === cat ? "bg-brand-600 text-white" : "bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300"}`}
                    >
                      {cat}
                    </button>
                  ),
                )}
              </div>
            </div>
          </div>
          <div className="flex justify-end mt-4 space-x-3">
            <button
              type="button"
              onClick={() => setIsAddingItem(false)}
              className="px-6 py-3 rounded-xl font-bold text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 rounded-xl font-bold bg-brand-600 text-white hover:bg-brand-700 shadow-lg"
            >
              {loading
                ? "Sauvegarde..."
                : editingItem
                  ? "Mettre à jour"
                  : "Ajouter au menu"}
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {restaurant.menu.map((item) => (
          <div
            key={item.id}
            className={`bg-white dark:bg-gray-800 p-4 rounded-xl border ${item.isAvailable ? "border-gray-100 dark:border-gray-700" : "border-red-200 bg-red-50 dark:bg-red-900/10"} shadow-sm flex space-x-4 hover:border-brand-200 transition-colors group relative`}
          >
            <img
              src={item.image}
              className={`w-24 h-24 rounded-lg object-cover bg-gray-100 dark:bg-gray-700 ${!item.isAvailable && "grayscale opacity-50"}`}
              alt={item.name}
            />
            <div className="flex-1">
              <div className="flex justify-between items-start">
                <h4 className="font-bold text-gray-800 dark:text-white text-lg">
                  {item.name}
                </h4>
                <div className="flex space-x-1">
                  <button
                    onClick={() => toggleItemAvailability(item)}
                    className={`p-1 rounded-md ${item.isAvailable ? "text-green-600 bg-green-100" : "text-red-600 bg-red-100"}`}
                    title={
                      item.isAvailable
                        ? "Marquer comme épuisé"
                        : "Marquer comme disponible"
                    }
                  >
                    {item.isAvailable ? (
                      <CheckCircle size={14} />
                    ) : (
                      <X size={14} />
                    )}
                  </button>
                  <span className="text-xs font-bold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded capitalize">
                    {item.category}
                  </span>
                </div>
              </div>
              <p className="text-gray-500 dark:text-gray-400 text-sm line-clamp-2 mt-1">
                {item.description}
              </p>
              <div className="flex justify-between items-end mt-3">
                <div className="flex flex-col">
                  <span className="font-black text-brand-600 text-xl">
                    {formatPrice(item.price)}
                  </span>
                  {item.stock !== undefined && (
                    <div className="flex flex-col mt-1">
                      <div
                        className={`text-xs font-bold px-2 py-1 rounded-full w-fit ${item.stock > (item.lowStockThreshold || 5) ? "bg-green-100 text-green-700" : item.stock > 0 ? "bg-orange-100 text-orange-700" : "bg-red-100 text-red-700"}`}
                      >
                        Stock: {item.stock}{" "}
                        {item.lowStockThreshold
                          ? `(Alerte: ${item.lowStockThreshold})`
                          : ""}
                      </div>
                      <div className="flex items-center space-x-1 mt-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const newStock = Math.max(0, (item.stock || 0) - 1);
                            handleQuickStockUpdate(item.id, newStock);
                          }}
                          className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                        >
                          <span className="text-sm font-bold">-1</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const newStock = (item.stock || 0) + 1;
                            handleQuickStockUpdate(item.id, newStock);
                          }}
                          className="p-1 text-gray-400 hover:text-green-500 hover:bg-green-50 rounded"
                        >
                          <span className="text-sm font-bold">+1</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const newStock = (item.stock || 0) + 10;
                            handleQuickStockUpdate(item.id, newStock);
                          }}
                          className="p-1 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded"
                        >
                          <span className="text-sm font-bold">+10</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex space-x-2 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      startEditItem(item);
                    }}
                    className="p-2 text-blue-500 hover:text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-full transition-colors flex items-center justify-center shadow-sm"
                    title="Modifier les détails et le stock"
                  >
                    <Settings size={18} />
                  </button>
                  {user.role === "business" && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteItem(item.id);
                      }}
                      className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // Advanced Settings State
  const [privacyProfile, setPrivacyProfile] = useState<"public" | "private">(
    restaurant.settings?.privacyProfile || "public",
  );
  const [privacyStories, setPrivacyStories] = useState<
    "everyone" | "followers"
  >(restaurant.settings?.privacyStories || "everyone");
  const [notifPush, setNotifPush] = useState(
    restaurant.settings?.notifPush ?? true,
  );
  const [notifEmail, setNotifEmail] = useState(
    restaurant.settings?.notifEmail ?? true,
  );
  const [notifSms, setNotifSms] = useState(
    restaurant.settings?.notifSms ?? false,
  );
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(
    restaurant.settings?.twoFactorEnabled ?? false,
  );
  const [appLockEnabled, setAppLockEnabled] = useState(
    restaurant.settings?.appLockEnabled ?? false,
  );
  const [appLockPin, setAppLockPin] = useState(
    restaurant.settings?.appLockPin ?? null,
  );
  const [biometricsEnabled, setBiometricsEnabled] = useState(
    restaurant.settings?.biometricsEnabled ?? false,
  );
  const [orderDeletionPassword, setOrderDeletionPassword] = useState(
    restaurant.settings?.orderDeletionPassword ?? "",
  );
  const [businessHours, setBusinessHours] = useState<any>(
    restaurant.settings?.hours || {
      Lundi: { open: "09:00", close: "22:00", isOpen: true },
      Mardi: { open: "09:00", close: "22:00", isOpen: true },
      Mercredi: { open: "09:00", close: "22:00", isOpen: true },
      Jeudi: { open: "09:00", close: "22:00", isOpen: true },
      Vendredi: { open: "09:00", close: "22:00", isOpen: true },
      Samedi: { open: "09:00", close: "22:00", isOpen: true },
      Dimanche: { open: "09:00", close: "22:00", isOpen: true },
    },
  );

  // Sync settings when restaurant prop changes
  useEffect(() => {
    if (restaurant.settings) {
      setPrivacyProfile(restaurant.settings.privacyProfile || "public");
      setPrivacyStories(restaurant.settings.privacyStories || "everyone");
      setNotifPush(restaurant.settings.notifPush ?? true);
      setNotifEmail(restaurant.settings.notifEmail ?? true);
      setNotifSms(restaurant.settings.notifSms ?? false);
      setTwoFactorEnabled(restaurant.settings.twoFactorEnabled ?? false);
      setAppLockEnabled(restaurant.settings.appLockEnabled ?? false);
      setAppLockPin(restaurant.settings.appLockPin ?? null);
      setBiometricsEnabled(restaurant.settings.biometricsEnabled ?? false);
      setOrderDeletionPassword(
        restaurant.settings.orderDeletionPassword ?? "",
      );
      setBusinessHours(
        restaurant.settings.hours || {
          Lundi: { open: "09:00", close: "22:00", isOpen: true },
          Mardi: { open: "09:00", close: "22:00", isOpen: true },
          Mercredi: { open: "09:00", close: "22:00", isOpen: true },
          Jeudi: { open: "09:00", close: "22:00", isOpen: true },
          Vendredi: { open: "09:00", close: "22:00", isOpen: true },
          Samedi: { open: "09:00", close: "22:00", isOpen: true },
          Dimanche: { open: "09:00", close: "22:00", isOpen: true },
        },
      );
    }
  }, [restaurant.settings]);

  const saveAdvancedSettings = async (updates: any) => {
    const newSettings = {
      privacyProfile,
      privacyStories,
      notifPush,
      notifEmail,
      notifSms,
      twoFactorEnabled,
      appLockEnabled,
      appLockPin,
      biometricsEnabled,
      orderDeletionPassword,
      ...updates,
    };

    try {
      const { error } = await supabase
        .from("restaurants")
        .update({ settings: newSettings })
        .eq("id", restaurant.id);

      if (error) throw error;

      // Mettre à jour l'état parent pour que les changements soient immédiats
      onUpdateRestaurant({
        ...restaurant,
        settings: newSettings,
      });
    } catch (err) {
      console.error("Error saving advanced settings:", err);
    }
  };

  const renderVerification = () => (
    <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 max-w-2xl">
      <h3 className="font-bold text-gray-800 dark:text-white mb-6 border-b pb-2 dark:border-gray-700 flex items-center">
        <Shield size={20} className="mr-2 text-brand-600" /> Vérification du
        Compte
      </h3>

      {restaurant.isVerified ? (
        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-xl border border-green-200 dark:border-green-800 flex items-center text-green-700 dark:text-green-400">
          <CheckCircle size={24} className="mr-3" />
          <div>
            <p className="font-bold">Compte Vérifié</p>
            <p className="text-sm">
              Votre établissement porte le badge de confiance.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-200 dark:border-blue-800 mb-6">
            <p className="text-sm text-blue-800 dark:text-blue-300 mb-2 font-bold">
              Pourquoi vérifier votre compte ?
            </p>
            <ul className="list-disc list-inside text-xs text-blue-700 dark:text-blue-400 space-y-1">
              <li>Badge orange "Vérifié" visible par les clients</li>
              <li>Meilleur référencement dans les recherches</li>
              <li>Confiance accrue des utilisateurs</li>
            </ul>
          </div>

          <div
            className={`p-6 rounded-2xl border ${restaurant.verificationStatus === "pending" || restaurant.verificationStatus === "verified" ? "bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-700 opacity-50" : "bg-white dark:bg-gray-800 border-brand-200 dark:border-brand-900 shadow-md animate-in zoom-in-95 duration-300"}`}
          >
            <div className="flex items-center justify-between mb-6">
              <h4 className="font-black text-gray-900 dark:text-white flex items-center">
                <FileText size={20} className="mr-2 text-brand-600" />
                Documents de Vérification
              </h4>
              <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">
                Gratuit
              </span>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                  Numéro Registre Commerce (RCCM)
                </label>
                <input
                  type="text"
                  className="w-full p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none transition-all dark:text-white font-medium"
                  placeholder="Ex: CD/KIN/RCCM/20-B-01234"
                  value={registryNumber}
                  onChange={(e) => setRegistryNumber(e.target.value)}
                  disabled={restaurant.verificationStatus === "pending"}
                />
              </div>

              <div>
                <label className="block text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                  Photo Carte d'Identité / Passeport du Gérant
                </label>
                <div className="relative group">
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    id="id-card-upload"
                    onChange={(e) => setIdCardFile(e.target.files?.[0] || null)}
                    disabled={restaurant.verificationStatus === "pending"}
                  />
                  <button
                    type="button"
                    disabled={restaurant.verificationStatus === "pending"}
                    className="absolute inset-0 w-full h-full opacity-0 z-10"
                    onClick={async (e) => {
                      e.preventDefault();
                      if (isCapacitor) {
                        const file = await pickImage({ asFile: true });
                        if (file instanceof File) setIdCardFile(file);
                      } else {
                        document.getElementById('id-card-upload')?.click();
                      }
                    }}
                  />
                  <label
                    htmlFor="id-card-upload"
                    className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-2xl cursor-pointer transition-all ${idCardFile ? "border-brand-500 bg-brand-50/30 dark:bg-brand-900/10" : "border-gray-200 dark:border-gray-700 hover:border-brand-400 hover:bg-gray-50 dark:hover:bg-gray-700/50"}`}
                  >
                    {idCardFile ? (
                      <div className="flex items-center text-brand-600 dark:text-brand-400 font-bold">
                        <CheckCircle size={20} className="mr-2" />
                        {idCardFile.name}
                      </div>
                    ) : (
                      <>
                        <Download
                          size={24}
                          className="text-gray-400 mb-2 group-hover:text-brand-500 transition-colors"
                        />
                        <span className="text-xs text-gray-500 dark:text-gray-400 font-bold">
                          Cliquez pour télécharger (JPG, PNG, PDF)
                        </span>
                      </>
                    )}
                  </label>
                </div>
              </div>

              {restaurant.verificationStatus !== "pending" && (
                <button
                  onClick={submitVerificationStep1}
                  disabled={
                    isSubmittingVerification || !registryNumber || !idCardFile
                  }
                  className="w-full bg-brand-600 text-white py-4 rounded-xl font-black text-sm hover:bg-brand-700 shadow-lg shadow-brand-200 dark:shadow-none transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {isSubmittingVerification ? (
                    <Activity className="animate-spin mr-2" size={18} />
                  ) : (
                    <ShieldCheck className="mr-2" size={18} />
                  )}
                  {isSubmittingVerification
                    ? "Envoi en cours..."
                    : "Soumettre pour Vérification"}
                </button>
              )}

              {restaurant.verificationStatus === "pending" && (
                <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-xl border border-orange-100 dark:border-orange-800 flex items-start">
                  <Clock
                    size={18}
                    className="text-orange-600 dark:text-orange-400 mr-3 mt-0.5"
                  />
                  <div>
                    <p className="text-sm font-bold text-orange-900 dark:text-orange-100">
                      Vérification en cours
                    </p>
                    <p className="text-xs text-orange-700 dark:text-orange-300">
                      Nos administrateurs examinent vos documents. Vous recevrez
                      une notification dès que votre statut sera mis à jour.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderMarketplace = () => (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
            Marketplace
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Découvrez ce que les autres vendeurs proposent.
          </p>
        </div>
        <div className="flex items-center bg-white dark:bg-gray-800 p-1 rounded-xl border border-gray-100 dark:border-gray-700">
          <button className="px-4 py-2 bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 rounded-lg text-xs font-bold">
            Tout
          </button>
          <button className="px-4 py-2 text-gray-500 dark:text-gray-400 text-xs font-bold hover:text-brand-600">
            Populaire
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {otherProducts && otherProducts.length > 0 ? (
          otherProducts.map((item) => {
            const restaurantData = item.restaurants;
            const restaurantName = restaurantData?.name || "Restaurant inconnu";
            const restaurantCity = restaurantData?.city || "Ville inconnue";

            return (
              <div
                key={item.id}
                className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-700 group hover:shadow-xl transition-all duration-300"
              >
                <div className="relative h-48 overflow-hidden">
                  <img
                    src={
                      item.image || "https://picsum.photos/seed/food/400/300"
                    }
                    alt={item.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        "https://picsum.photos/seed/food/400/300";
                    }}
                  />
                  <div className="absolute top-3 right-3 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-black text-brand-600 shadow-sm">
                    {formatPrice(item.price)}
                  </div>
                  <div className="absolute bottom-3 left-3 bg-black/50 backdrop-blur-sm px-2 py-1 rounded text-[10px] font-bold text-white flex items-center">
                    <MapPin size={10} className="mr-1" /> {restaurantCity}
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-bold text-gray-900 dark:text-white truncate flex-1">
                      {item.name}
                    </h4>
                    <div className="flex items-center text-orange-500">
                      <Star size={12} fill="currentColor" />
                      <span className="text-[10px] font-bold ml-1">4.5</span>
                    </div>
                  </div>
                  <p className="text-xs text-brand-600 font-bold mb-2 flex items-center truncate">
                    <ChefHat size={12} className="mr-1 flex-shrink-0" />
                    <span className="truncate">{restaurantName}</span>
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-4 h-8">
                    {item.description || "Aucune description"}
                  </p>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setSelectedMarketplaceProduct(item);
                      setIsMarketplaceModalOpen(true);
                    }}
                    className="w-full py-2 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white rounded-xl text-xs font-bold hover:bg-brand-600 hover:text-white transition-colors flex items-center justify-center"
                  >
                    <ShoppingBag size={14} className="mr-2" /> Voir l'article
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full py-20 text-center">
            <div className="bg-gray-100 dark:bg-gray-800 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
              <Package size={32} />
            </div>
            <p className="text-gray-500 dark:text-gray-400 font-bold">
              Aucun article trouvé pour le moment.
            </p>
            <p className="text-xs text-gray-400 mt-1">
              D'autres restaurants n'ont pas encore publié de produits.
            </p>
          </div>
        )}
      </div>

      {isMarketplaceModalOpen && selectedMarketplaceProduct && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-300 border border-gray-100 dark:border-gray-700 max-h-[90vh] flex flex-col">
            <div className="relative h-64 flex-shrink-0">
              <img
                src={
                  selectedMarketplaceProduct.image ||
                  "https://picsum.photos/seed/food/800/600"
                }
                alt={selectedMarketplaceProduct.name}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <button
                onClick={() => setIsMarketplaceModalOpen(false)}
                className="absolute top-4 right-4 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
              >
                <X size={20} />
              </button>
              <div className="absolute bottom-4 left-4 bg-brand-600 text-white px-3 py-1 rounded-full text-sm font-bold shadow-lg">
                {formatPrice(selectedMarketplaceProduct.price)}
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <div className="flex items-center space-x-2 mb-2">
                <span className="px-2 py-0.5 bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 text-[10px] font-bold rounded uppercase tracking-wider">
                  {selectedMarketplaceProduct.category || "Catégorie"}
                </span>
              </div>
              <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-2">
                {selectedMarketplaceProduct.name}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-6 leading-relaxed">
                {selectedMarketplaceProduct.description ||
                  "Aucune description disponible pour cet article."}
              </p>

              <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 mb-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-brand-100 dark:bg-brand-900/30 rounded-full flex items-center justify-center text-brand-600 dark:text-brand-400">
                      <Store size={20} />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-tighter">
                        Restaurant Partenaire
                      </p>
                      <p className="font-bold text-gray-900 dark:text-white">
                        {selectedMarketplaceProduct.restaurants?.name ||
                          "Restaurant"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                    <MapPin size={12} className="mr-1" />
                    {selectedMarketplaceProduct.restaurants?.city || "Ville"}
                  </div>
                </div>
                <div className="flex items-center space-x-2 text-xs text-brand-600 dark:text-brand-400 font-bold">
                  <CheckCircle2 size={14} />
                  <span>Partenaire Vérifié DashMeals</span>
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => setIsMarketplaceModalOpen(false)}
                  className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Fermer
                </button>
                <button
                  onClick={() => {
                    toast.success("Redirection vers le restaurant...");
                    setIsMarketplaceModalOpen(false);
                    // In a real app, we'd navigate to the restaurant's public page
                  }}
                  className="flex-1 py-3 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 transition-colors shadow-lg shadow-brand-600/20 flex items-center justify-center"
                >
                  <ExternalLink size={18} className="mr-2" /> Visiter
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
  const handleSendManualEmail = async () => {
    if (!emailModal.subject || !emailModal.message) {
      toast.error("Veuillez remplir tous les champs");
      return;
    }

    setEmailModal((prev) => ({ ...prev, isSending: true }));
    try {
      const success = await sendEmail({
        to: emailModal.recipientEmail,
        subject: emailModal.subject,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <div style="text-align: center; margin-bottom: 20px;">
              <h1 style="color: #ea580c; margin: 0;">${restaurant.name}</h1>
            </div>
            <p>Bonjour <strong>${emailModal.recipientName}</strong>,</p>
            <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
              ${emailModal.message.replace(/\n/g, "<br>")}
            </div>
            <p style="color: #6b7280; font-size: 14px;">
              Cet email vous a été envoyé par l'administration de ${restaurant.name} via DashMeals.
            </p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="font-size: 12px; color: #9ca3af; text-align: center;">
              &copy; ${new Date().getFullYear()} DashMeals. Tous droits réservés.
            </p>
          </div>
        `,
      });

      if (success) {
        toast.success("Email envoyé avec succès");
        setEmailModal((prev) => ({ ...prev, isOpen: false }));
      } else {
        toast.error("Erreur lors de l'envoi de l'email");
      }
    } catch (error) {
      console.error("Error sending manual email:", error);
      toast.error("Erreur lors de l'envoi");
    } finally {
      setEmailModal((prev) => ({ ...prev, isSending: false }));
    }
  };

  const renderSubscribers = () => (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center">
            <Users className="mr-3 text-brand-600" size={28} />
            Mes Abonnés
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Gérez votre communauté et fidélisez vos clients.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={fetchFollowers}
            className="p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            title="Rafraîchir la liste"
          >
            <RefreshCw size={20} />
          </button>
          <div className="bg-brand-600 text-white px-4 py-2 rounded-xl font-bold text-sm shadow-lg shadow-brand-200 dark:shadow-brand-900/20 flex items-center">
            <Users size={18} className="mr-2" /> {followers.length} Abonnés
          </div>
        </div>
      </div>

      {/* Recherche Client par ID */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
        <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center">
          <Search size={18} className="mr-2 text-brand-600" />
          Rechercher un client par ID
        </h3>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Collez l'ID de l'utilisateur ici (ex: 7b...)"
            className="flex-1 bg-gray-50 dark:bg-gray-900 border-0 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-500 outline-none"
            value={userSearchId}
            onChange={(e) => setUserSearchId(e.target.value)}
          />
          <button
            onClick={handleSearchUser}
            disabled={isSearchingUser || !userSearchId.trim()}
            className="bg-brand-600 text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-brand-700 transition-all disabled:opacity-50 flex items-center"
          >
            {isSearchingUser ? (
              <RefreshCw size={18} className="animate-spin" />
            ) : (
              "Rechercher"
            )}
          </button>
        </div>

        {searchedUser && (
          <div className="mt-6 p-4 bg-brand-50 dark:bg-brand-900/20 rounded-2xl border border-brand-100 dark:border-brand-800 animate-in slide-in-from-top-2 duration-300">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-full bg-brand-600 text-white flex items-center justify-center font-black text-xl">
                  {searchedUser.full_name?.charAt(0) || "U"}
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 dark:text-white">
                    {searchedUser.full_name || "Utilisateur"}
                  </h4>
                  <p className="text-xs text-gray-500">
                    {searchedUser.email || "Email non renseigné"}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-1 font-mono">
                    ID: {searchedUser.id}
                  </p>
                </div>
              </div>
              <button
                onClick={() =>
                  openSubscriberChat({
                    user_id: searchedUser.id,
                    profiles: searchedUser,
                  })
                }
                className="bg-white dark:bg-gray-800 p-3 rounded-xl shadow-sm text-brand-600 hover:bg-brand-50 transition-colors"
              >
                <MessageSquare size={20} />
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {followers.map((follow) => {
          const profileData =
            (Array.isArray(follow.profiles)
              ? follow.profiles[0]
              : follow.profiles) || profilesCache[follow.user_id];
          const displayName =
            profileData?.full_name ||
            profileData?.email ||
            (follow.user_id
              ? `Client #${follow.user_id.substring(0, 5)}`
              : "Utilisateur");

          return (
            <div
              key={follow.id}
              className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 flex items-center justify-between hover:shadow-md transition-shadow group"
            >
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-brand-600 dark:text-brand-400 font-bold text-lg group-hover:scale-110 transition-transform">
                  {displayName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                    {displayName}
                  </h4>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 flex items-center">
                    <Clock size={10} className="mr-1" /> Abonné depuis le{" "}
                    {new Date(follow.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => {
                    setEmailModal({
                      isOpen: true,
                      recipientEmail: profileData?.email || "",
                      recipientName: displayName,
                      subject: `Message de ${restaurant.name}`,
                      message: "",
                      isSending: false,
                    });
                  }}
                  className="p-2 text-gray-400 hover:text-brand-600 transition-colors"
                  title="Envoyer un email"
                >
                  <Mail size={18} />
                </button>
                <button
                  onClick={() => openSubscriberChat(follow)}
                  className="p-2 text-gray-400 hover:text-brand-600 transition-colors"
                  title="Ouvrir le chat"
                >
                  <MessageSquare size={18} />
                </button>
              </div>
            </div>
          );
        })}
        {followers.length === 0 && (
          <div className="col-span-full py-20 text-center bg-white dark:bg-gray-800 rounded-3xl border border-dashed border-gray-200 dark:border-gray-700">
            <div className="bg-brand-50 dark:bg-brand-900/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-brand-600">
              <Heart size={32} />
            </div>
            <p className="text-gray-500 dark:text-gray-400 font-bold">
              Vous n'avez pas encore d'abonnés.
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Publiez des promotions pour attirer plus de clients !
            </p>
          </div>
        )}
      </div>
    </div>
  );

  const renderReviews = () => (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center">
            <Star className="mr-3 text-yellow-500" size={28} />
            Avis Clients
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Consultez les retours de vos clients et répondez-y.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={fetchReviews}
            className="p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <RefreshCw size={20} />
          </button>
          <div className="bg-yellow-500 text-white px-4 py-2 rounded-xl font-bold text-sm shadow-lg shadow-yellow-200 dark:shadow-yellow-900/20 flex items-center">
            <Star size={18} className="mr-2 fill-white" /> {reviews.length} Avis
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {reviews.map((review) => {
          const profileData =
            (Array.isArray(review.profiles)
              ? review.profiles[0]
              : review.profiles) || profilesCache[review.user_id];
          const displayName =
            profileData?.full_name ||
            profileData?.email ||
            (review.user_id
              ? `Client #${review.user_id.substring(0, 5)}`
              : "Utilisateur");

          return (
            <div
              key={review.id}
              className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center font-bold text-brand-600 dark:text-brand-400">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 dark:text-white">
                      {displayName}
                    </h4>
                    <div className="flex items-center text-yellow-400 mt-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          size={14}
                          fill={review.rating >= star ? "currentColor" : "none"}
                        />
                      ))}
                      <span className="text-xs text-gray-400 ml-2 font-medium">
                        {new Date(review.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
                {review.order_id && (
                  <button
                    onClick={() => {
                      const order = orders.find(
                        (o) => o.id === review.order_id,
                      );
                      if (order) {
                        setOrderFilter("all");
                        navigateTo("orders");
                        // Scroll to order would be nice but complex here
                      } else {
                        toast.info("Détails de la commande non disponibles.");
                      }
                    }}
                    className="text-[10px] font-bold text-brand-600 bg-brand-50 dark:bg-brand-900/20 px-2 py-1 rounded hover:underline"
                  >
                    Voir Commande
                  </button>
                )}
              </div>

              <p className="text-gray-700 dark:text-gray-300 text-sm italic mb-4">
                "{review.comment || "Aucun commentaire"}"
              </p>

              {review.image_url && (
                <div className="mb-4">
                  <img
                    src={review.image_url}
                    alt="Avis client"
                    className="w-full max-w-xs h-48 object-cover rounded-xl border border-gray-100 dark:border-gray-700"
                    referrerPolicy="no-referrer"
                  />
                </div>
              )}

              {review.reply ? (
                <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-xl border-l-4 border-brand-500">
                  <div className="flex justify-between items-center mb-1">
                    <p className="text-xs font-bold text-brand-600 dark:text-brand-400">
                      Votre réponse :
                    </p>
                    <span className="text-[10px] text-gray-400">
                      {new Date(review.reply_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {review.reply}
                  </p>
                </div>
              ) : (
                <div className="mt-2">
                  {isReplyingTo === review.id ? (
                    <div className="space-y-3 animate-in slide-in-from-top-2">
                      <textarea
                        className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none resize-none"
                        rows={3}
                        placeholder="Répondez à votre client..."
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                      />
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => setIsReplyingTo(null)}
                          className="px-4 py-2 text-xs font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                        >
                          Annuler
                        </button>
                        <button
                          onClick={() => handleReplyReview(review.id)}
                          disabled={isSavingReply}
                          className="px-4 py-2 bg-brand-600 text-white rounded-lg text-xs font-bold hover:bg-brand-700 shadow-md disabled:opacity-50"
                        >
                          {isSavingReply ? "Envoi..." : "Répondre"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => setIsReplyingTo(review.id)}
                        className="text-xs font-bold text-brand-600 hover:underline flex items-center"
                      >
                        <MessageSquare size={14} className="mr-1" /> Répondre à
                        cet avis
                      </button>
                      {user.role === "business" && (
                        <button
                          onClick={() => handleDeleteReview(review.id)}
                          className="text-xs font-bold text-red-500 hover:text-red-700 flex items-center ml-4"
                        >
                          <Trash2 size={14} className="mr-1" /> Supprimer
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {reviews.length === 0 && (
          <div className="py-20 text-center bg-white dark:bg-gray-800 rounded-3xl border border-dashed border-gray-200 dark:border-gray-700">
            <Star className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-gray-500 dark:text-gray-400 font-bold">
              Aucun avis pour le moment.
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Les avis apparaîtront ici une fois que les clients auront noté
              leurs commandes.
            </p>
          </div>
        )}
      </div>
    </div>
  );

  const renderTeam = () => (
    <FeatureGate feature="staffManagement">
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
              Gestion de l'Équipe
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Gérez les accès de votre personnel et vos livreurs.
            </p>
          </div>
          {teamTab === "staff" && (
            <button
              onClick={() => {
                const currentStaffCount = (restaurant.staff || []).length;
                if (!checkLimit("staff", currentStaffCount)) return;
                setIsAddingStaff(true);
              }}
              className="bg-brand-600 text-white px-4 py-2 rounded-xl font-bold text-sm shadow-lg shadow-brand-200 dark:shadow-brand-900/20 flex items-center hover:bg-brand-700 transition-colors"
            >
              <Plus size={18} className="mr-2" /> Ajouter un membre
            </button>
          )}
        </div>

        <div className="flex border-b border-gray-100 dark:border-gray-700">
          <button
            onClick={() => setTeamTab("staff")}
            className={`px-6 py-3 text-sm font-bold transition-all border-b-2 ${teamTab === "staff" ? "border-brand-600 text-brand-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            Personnel Interne
          </button>
          <button
            onClick={() => setTeamTab("delivery")}
            className={`px-6 py-3 text-sm font-bold transition-all border-b-2 ${teamTab === "delivery" ? "border-brand-600 text-brand-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            Livreurs
          </button>
        </div>

        {teamTab === "staff" ? (
          <>
            {(isAddingStaff || editingStaff) && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                    {editingStaff ? "Modifier le membre" : "Ajouter un membre"}
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Nom complet
                      </label>
                      <input
                        type="text"
                        value={newStaffName}
                        onChange={(e) => setNewStaffName(e.target.value)}
                        className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                        placeholder="Jean Dupont"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Rôle
                      </label>
                      <select
                        value={newStaffRole}
                        onChange={(e) => setNewStaffRole(e.target.value as any)}
                        className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                      >
                        <option value="cook">Cuisinier</option>
                        <option value="manager">Gérant</option>
                        <option value="admin">Administrateur</option>
                        <option value="delivery">Livreur Interne</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Code PIN (Optionnel)
                      </label>
                      <input
                        type="text"
                        value={newStaffPin}
                        onChange={(e) => setNewStaffPin(e.target.value)}
                        className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                        placeholder="1234"
                        maxLength={4}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Utilisé pour se connecter au système de caisse (POS).
                      </p>
                    </div>
                  </div>
                  <div className="mt-6 flex justify-end space-x-3">
                    <button
                      onClick={() => {
                        setIsAddingStaff(false);
                        setEditingStaff(null);
                        setNewStaffName("");
                        setNewStaffRole("cook");
                        setNewStaffPin("");
                      }}
                      className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl font-medium transition-colors"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={handleSaveStaff}
                      disabled={isSavingStaff}
                      className="px-4 py-2 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 transition-colors disabled:opacity-50"
                    >
                      {isSavingStaff
                        ? "Enregistrement..."
                        : editingStaff
                          ? "Modifier"
                          : "Ajouter"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700">
                      <th className="p-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Nom
                      </th>
                      <th className="p-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Rôle
                      </th>
                      <th className="p-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Code PIN (POS)
                      </th>
                      <th className="p-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center">
                          <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 flex items-center justify-center font-bold mr-3">
                            {user.name.charAt(0)}
                          </div>
                          <span className="font-bold text-gray-900 dark:text-white">
                            {user.name} (Vous)
                          </span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
                          Propriétaire
                        </span>
                      </td>
                      <td className="p-4 text-gray-500 dark:text-gray-400 text-sm">
                        -
                      </td>
                      <td className="p-4 text-right">
                        <span className="text-xs text-gray-400 italic">
                          Non modifiable
                        </span>
                      </td>
                    </tr>
                    {staffMembers.map((staff) => (
                      <tr
                        key={staff.id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                      >
                        <td className="p-4">
                          <div className="flex items-center">
                            <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 flex items-center justify-center font-bold mr-3">
                              {staff.name.charAt(0)}
                            </div>
                            <span className="font-bold text-gray-900 dark:text-white">
                              {staff.name}
                            </span>
                          </div>
                        </td>
                        <td className="p-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              staff.role === "admin"
                                ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                                : staff.role === "manager"
                                  ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                                  : staff.role === "delivery"
                                    ? "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300"
                                    : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                            }`}
                          >
                            {staff.role === "admin"
                              ? "Administrateur"
                              : staff.role === "manager"
                                ? "Gérant"
                                : staff.role === "delivery"
                                  ? "Livreur"
                                  : "Cuisinier"}
                          </span>
                        </td>
                        <td className="p-4 text-gray-900 dark:text-white font-mono text-sm">
                          {staff.pin_code ? "••••" : "Non défini"}
                        </td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() => {
                              setEditingStaff(staff);
                              setNewStaffName(staff.name);
                              setNewStaffRole(staff.role);
                              setNewStaffPin(staff.pin_code || "");
                            }}
                            className="text-gray-400 hover:text-brand-600 transition-colors p-1"
                          >
                            <Settings size={16} />
                          </button>
                          {user.role === "business" && (
                            <button
                              onClick={() => handleDeleteStaff(staff.id)}
                              className="text-gray-400 hover:text-red-600 transition-colors p-1 ml-2"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {staffMembers.length === 0 && (
                  <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                    <Users size={32} className="mx-auto mb-3 opacity-50" />
                    <p>Vous êtes le seul membre de l'équipe pour le moment.</p>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="space-y-6">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-2xl border border-blue-100 dark:border-blue-900/50">
              <div className="flex items-start">
                <div className="bg-blue-100 dark:bg-blue-900/40 p-3 rounded-xl text-blue-600 dark:text-blue-400 mr-4">
                  <Info size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-blue-900 dark:text-blue-300 mb-1">
                    Comment ajouter un livreur ?
                  </h3>
                  <p className="text-sm text-blue-700 dark:text-blue-400 leading-relaxed">
                    Les livreurs sont des comptes indépendants. Pour qu'un
                    livreur apparaisse dans votre liste d'assignation :
                  </p>
                  <ol className="list-decimal list-inside mt-3 text-sm text-blue-700 dark:text-blue-400 space-y-2">
                    <li>Le livreur doit se déconnecter de l'application.</li>
                    <li>
                      Sur l'écran de connexion, il doit cliquer sur{" "}
                      <strong>"S'inscrire"</strong>.
                    </li>
                    <li>
                      Il doit sélectionner l'onglet <strong>"Livreur"</strong>{" "}
                      et remplir ses informations.
                    </li>
                    <li>
                      Une fois son compte créé, il apparaîtra automatiquement
                      dans votre liste lors de l'assignation d'une commande.
                    </li>
                  </ol>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
              <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center">
                  <Bike size={18} className="mr-2 text-brand-600" /> Livreurs
                  inscrits sur la plateforme
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700">
                      <th className="p-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Nom
                      </th>
                      <th className="p-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Ville
                      </th>
                      <th className="p-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Téléphone
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {deliveryPersonnel.length === 0 ? (
                      <tr>
                        <td
                          colSpan={3}
                          className="p-8 text-center text-gray-400"
                        >
                          Aucun livreur trouvé.
                        </td>
                      </tr>
                    ) : (
                      deliveryPersonnel.map((p) => (
                        <tr
                          key={p.id}
                          className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                        >
                          <td className="p-4">
                            <div className="flex items-center">
                              <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-brand-400 flex items-center justify-center font-bold text-xs mr-3">
                                {p.name.charAt(0)}
                              </div>
                              <div>
                                <span className="font-medium text-gray-900 dark:text-white block">
                                  {p.name}
                                </span>
                                <div className="flex items-center space-x-2 mt-0.5">
                                  <span
                                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                                      p.deliveryInfo?.isAvailable
                                        ? "bg-green-100 text-green-600"
                                        : "bg-red-100 text-red-600"
                                    }`}
                                  >
                                    {p.deliveryInfo?.isAvailable
                                      ? "Disponible"
                                      : "Occupé"}
                                  </span>
                                  <span className="text-[10px] text-gray-400 font-medium uppercase">
                                    {p.deliveryInfo?.vehicleType || "Moto"}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="p-4 text-sm text-gray-500 dark:text-gray-400">
                            {p.city}
                          </td>
                          <td className="p-4 text-sm text-gray-500 dark:text-gray-400">
                            <div className="flex items-center space-x-2">
                              <span>{p.phoneNumber || "-"}</span>
                              {p.phoneNumber && (
                                <a
                                  href={`tel:${p.phoneNumber}`}
                                  className="p-1 text-brand-600 hover:bg-brand-50 rounded transition-colors"
                                >
                                  <Phone size={14} />
                                </a>
                              )}
                            </div>
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
      </div>
    </FeatureGate>
  );

  const renderSettings = () => {
    if (settingsSubView === "menu") {
      return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
          <div className="mb-10 text-center">
            <h3 className="text-4xl font-display font-bold text-gray-900 dark:text-white italic tracking-tighter mb-4 scale-up-center">
              Configuration système
            </h3>
            <div className="flex items-center justify-center space-x-4">
              <span className="h-[1px] w-12 bg-gradient-to-r from-transparent to-brand-500"></span>
              <p className="text-gray-500 dark:text-gray-400 text-[10px] font-bold tracking-widest">
                Écosystème • Sécurité • Rétention
              </p>
              <span className="h-[1px] w-12 bg-gradient-to-l from-transparent to-brand-500"></span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <button
              onClick={() => setSettingsSubView("subscription")}
              className="glass flex items-center justify-between p-8 rounded-[32px] border border-white/20 dark:border-white/5 hover:border-brand-500/50 transition-all hover:scale-[1.02] shadow-xl group relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-brand-500/10 transition-colors"></div>
              <div className="flex items-center relative z-10">
                <div className="bg-brand-500/10 p-5 rounded-2xl mr-6 text-brand-600 dark:text-brand-400 group-hover:bg-brand-600 group-hover:text-white transition-all duration-500 shadow-inner">
                  <Zap size={28} />
                </div>
                <div className="text-left">
                  <p className="font-display font-bold text-lg text-gray-900 dark:text-white italic tracking-tight">
                    Abonnement
                  </p>
                  <p className="text-[10px] text-gray-400 font-bold tracking-wide mt-1">
                    Plan Elite • Facturation
                  </p>
                </div>
              </div>
              <ChevronRight
                size={20}
                className="text-gray-300 group-hover:translate-x-1 transition-transform relative z-10"
              />
            </button>

            <button
              onClick={() => setSettingsSubView("verification")}
              className="glass flex items-center justify-between p-8 rounded-[32px] border border-white/20 dark:border-white/5 hover:border-orange-500/50 transition-all hover:scale-[1.02] shadow-xl group relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-orange-500/10 transition-colors"></div>
              <div className="flex items-center relative z-10">
                <div className="bg-orange-500/10 p-5 rounded-2xl mr-6 text-orange-600 dark:text-orange-400 group-hover:bg-orange-600 group-hover:text-white transition-all duration-500 shadow-inner">
                  <Shield size={28} />
                </div>
                <div className="text-left">
                  <p className="font-display font-bold text-lg text-gray-900 dark:text-white italic tracking-tight">
                    Vérification
                  </p>
                  <p className="text-[10px] text-gray-400 font-bold tracking-wide mt-1">
                    Badge • KYC • Documents
                  </p>
                </div>
              </div>
              <ChevronRight
                size={20}
                className="text-gray-300 group-hover:translate-x-1 transition-transform relative z-10"
              />
            </button>

            <button
              onClick={() => setSettingsSubView("content")}
              className="glass flex items-center justify-between p-8 rounded-[32px] border border-white/20 dark:border-white/5 hover:border-blue-500/50 transition-all hover:scale-[1.02] shadow-xl group relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-blue-500/10 transition-colors"></div>
              <div className="flex items-center relative z-10">
                <div className="bg-blue-500/10 p-5 rounded-2xl mr-6 text-blue-600 dark:text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition-all duration-500 shadow-inner">
                  <Edit3 size={28} />
                </div>
                <div className="text-left">
                  <p className="font-display font-bold text-lg text-gray-900 dark:text-white italic tracking-tight">
                    Profil public
                  </p>
                  <p className="text-[10px] text-gray-400 font-bold tracking-widest mt-1">
                    Identité • Media • Bio
                  </p>
                </div>
              </div>
              <ChevronRight
                size={20}
                className="text-gray-300 group-hover:translate-x-1 transition-transform relative z-10"
              />
            </button>

            <button
              onClick={() => setSettingsSubView("privacy")}
              className="glass flex items-center justify-between p-8 rounded-[32px] border border-white/20 dark:border-white/5 hover:border-purple-500/50 transition-all hover:scale-[1.02] shadow-xl group relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-purple-500/10 transition-colors"></div>
              <div className="flex items-center relative z-10">
                <div className="bg-purple-500/10 p-5 rounded-2xl mr-6 text-purple-600 dark:text-purple-400 group-hover:bg-purple-600 group-hover:text-white transition-all duration-500 shadow-inner">
                  <Settings size={28} />
                </div>
                <div className="text-left">
                  <p className="font-display font-bold text-lg text-gray-900 dark:text-white italic tracking-tight">
                    Système & privacy
                  </p>
                  <p className="text-[10px] text-gray-400 font-bold tracking-widest mt-1">
                    Sécurité • Apparence • IA
                  </p>
                </div>
              </div>
              <ChevronRight
                size={20}
                className="text-gray-300 group-hover:translate-x-1 transition-transform relative z-10"
              />
            </button>

            <button
              onClick={() => setSettingsSubView("delivery")}
              className="glass flex items-center justify-between p-8 rounded-[32px] border border-white/20 dark:border-white/5 hover:border-green-500/50 transition-all hover:scale-[1.02] shadow-xl group relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-green-500/10 transition-colors"></div>
              <div className="flex items-center relative z-10">
                <div className="bg-green-500/10 p-5 rounded-2xl mr-6 text-green-600 dark:text-green-400 group-hover:bg-green-600 group-hover:text-white transition-all duration-500 shadow-inner">
                  <Truck size={28} />
                </div>
                <div className="text-left">
                  <p className="font-display font-bold text-lg text-gray-900 dark:text-white italic tracking-tight">
                    Logistique
                  </p>
                  <p className="text-[10px] text-gray-400 font-bold tracking-widest mt-1">
                    Rayons • Frais • Livraison
                  </p>
                </div>
              </div>
              <ChevronRight
                size={20}
                className="text-gray-300 group-hover:translate-x-1 transition-transform relative z-10"
              />
            </button>

            <button
              onClick={() => setSettingsSubView("hours")}
              className="glass flex items-center justify-between p-8 rounded-[32px] border border-white/20 dark:border-white/5 hover:border-yellow-500/50 transition-all hover:scale-[1.02] shadow-xl group relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-yellow-500/10 transition-colors"></div>
              <div className="flex items-center relative z-10">
                <div className="bg-yellow-500/10 p-5 rounded-2xl mr-6 text-yellow-600 dark:text-yellow-400 group-hover:bg-yellow-600 group-hover:text-white transition-all duration-500 shadow-inner">
                  <Clock size={28} />
                </div>
                <div className="text-left">
                  <p className="font-display font-bold text-lg text-gray-900 dark:text-white italic tracking-tight">
                    Temporalité
                  </p>
                  <p className="text-[10px] text-gray-400 font-bold tracking-widest mt-1">
                    Horaires • Jours fériés
                  </p>
                </div>
              </div>
              <ChevronRight
                size={20}
                className="text-gray-300 group-hover:translate-x-1 transition-transform relative z-10"
              />
            </button>

            <button
              onClick={() => setSettingsSubView("notifications")}
              className="glass flex items-center justify-between p-8 rounded-[32px] border border-white/20 dark:border-white/5 hover:border-pink-500/50 transition-all hover:scale-[1.02] shadow-xl group relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-pink-500/10 transition-colors"></div>
              <div className="flex items-center relative z-10">
                <div className="bg-pink-500/10 p-5 rounded-2xl mr-6 text-pink-600 dark:text-pink-400 group-hover:bg-pink-600 group-hover:text-white transition-all duration-500 shadow-inner">
                  <Bell size={28} />
                </div>
                <div className="text-left">
                  <p className="font-display font-bold text-lg text-gray-900 dark:text-white italic tracking-tight">
                    Alertes IA
                  </p>
                  <p className="text-[10px] text-gray-400 font-bold tracking-widest mt-1">
                    Push • E-mail • In-app
                  </p>
                </div>
              </div>
              <ChevronRight
                size={20}
                className="text-gray-300 group-hover:translate-x-1 transition-transform relative z-10"
              />
            </button>

            <button
              onClick={() => setSettingsSubView("payments")}
              className="glass flex items-center justify-between p-8 rounded-[32px] border border-white/20 dark:border-white/5 hover:border-indigo-500/50 transition-all hover:scale-[1.02] shadow-xl group relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-indigo-500/10 transition-colors"></div>
              <div className="flex items-center relative z-10">
                <div className="bg-indigo-500/10 p-5 rounded-2xl mr-6 text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500 shadow-inner">
                  <CreditCard size={28} />
                </div>
                <div className="text-left">
                  <p className="font-display font-bold text-lg text-gray-900 dark:text-white italic tracking-tight">
                    Flux financiers
                  </p>
                  <p className="text-[10px] text-gray-400 font-bold tracking-widest mt-1">
                    Modes de paiement • Gateway
                  </p>
                </div>
              </div>
              <ChevronRight
                size={20}
                className="text-gray-300 group-hover:translate-x-1 transition-transform relative z-10"
              />
            </button>

            <button
              onClick={() => setIsHelpCenterOpen(true)}
              className="glass flex items-center justify-between p-8 rounded-[32px] border border-white/20 dark:border-white/5 hover:border-brand-500/50 transition-all hover:scale-[1.02] shadow-xl group relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-brand-500/10 transition-colors"></div>
              <div className="flex items-center relative z-10">
                <div className="bg-brand-500/10 p-5 rounded-2xl mr-6 text-brand-600 dark:text-brand-400 group-hover:bg-brand-600 group-hover:text-white transition-all duration-500 shadow-inner">
                  <HelpCircle size={28} />
                </div>
                <div className="text-left">
                  <p className="font-display font-bold text-lg text-gray-900 dark:text-white italic tracking-tight">
                    Nexus support
                  </p>
                  <p className="text-[10px] text-gray-400 font-bold tracking-wide mt-1">
                    Documentation • Conciergerie
                  </p>
                </div>
              </div>
              <ChevronRight
                size={20}
                className="text-gray-300 group-hover:translate-x-1 transition-transform relative z-10"
              />
            </button>

            <div className="flex items-end">
              <button
                onClick={onLogout}
                className="w-full flex items-center justify-center p-8 bg-red-500/10 text-red-600 dark:text-red-400 rounded-[32px] border border-red-500/20 hover:bg-red-600 hover:text-white transition-all font-display font-bold italic tracking-wide shadow-xl active:scale-95"
              >
                <LogOut size={24} className="mr-4" />
                Session termination
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (settingsSubView === "subscription") {
      return (
        <div className="space-y-8 animate-in fade-in slide-in-from-right duration-500 max-w-5xl mx-auto">
          <button
            onClick={() => setSettingsSubView("menu")}
            className="group flex items-center text-brand-600 font-display font-black uppercase italic tracking-widest text-sm hover:text-brand-700 transition-all mb-8"
          >
            <Plus
              className="rotate-45 mr-2 group-hover:-translate-x-1 transition-transform"
              size={20}
            />{" "}
            Retour Système
          </button>

          <div className="glass p-10 rounded-[40px] shadow-2xl border border-white/20 dark:border-white/5 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/10 rounded-full blur-3xl -mr-32 -mt-32"></div>

            <div className="flex flex-col md:flex-row items-center justify-between gap-8 mb-12 relative z-10">
              <div>
                <h3 className="font-display font-bold text-4xl text-gray-900 dark:text-white flex items-center italic tracking-tighter">
                  <Zap
                    size={40}
                    className="mr-4 text-brand-500 animate-pulse"
                  />
                  Forfaits élite
                </h3>
                <p className="text-gray-500 dark:text-gray-400 font-medium mt-2 max-w-md tracking-wider text-xs">
                  Propulsez votre établissement dans une nouvelle dimension de
                  performance.
                </p>
              </div>
              <div className="px-8 py-4 bg-brand-500/10 text-brand-600 dark:text-brand-400 rounded-2xl font-display font-black uppercase italic tracking-[0.2em] border border-brand-500/20 shadow-lg">
                Statut: {restaurant.subscriptionTier || "Standard"}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
              {PLANS.map((plan) => (
                <div
                  key={plan.id}
                  className={`relative p-8 rounded-[36px] border-2 transition-all duration-500 transform hover:scale-[1.03] flex flex-col ${restaurant.subscriptionTier === plan.id ? "border-brand-500 bg-brand-500/5 shadow-[0_0_40px_rgba(59,130,246,0.2)]" : "border-white/10 dark:border-white/5 hover:border-brand-500/30 glass"}`}
                >
                  {restaurant.subscriptionTier === plan.id && (
                    <div
                      className={`absolute -top-4 left-1/2 -translate-x-1/2 text-white text-[10px] font-black px-6 py-2 rounded-full uppercase tracking-[0.2em] shadow-xl z-20 ${restaurant.subscriptionStatus === "active" ? "bg-brand-600" : "bg-red-600"}`}
                    >
                      {restaurant.subscriptionStatus === "active"
                        ? "Operational"
                        : "Access Denied"}
                    </div>
                  )}
                  <div className="flex justify-between items-start mb-8">
                    <div>
                      <h4 className="font-bold text-2xl text-gray-900 dark:text-white tracking-tight">
                        {plan.name}
                      </h4>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-1">
                        {plan.id === "free"
                          ? "Indépendance"
                          : "Dominance Market"}
                      </p>
                    </div>
                    <div className="flex flex-col items-end">
                      <div className="flex items-baseline">
                        <span className="text-3xl font-bold text-gray-900 dark:text-white tracking-tighter">
                          ${plan.price}
                        </span>
                        <span className="text-[10px] text-gray-500 uppercase font-bold ml-1 tracking-widest">
                          USD
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-400 font-bold mt-1">
                        Mensuel
                      </span>
                    </div>
                  </div>
                  <ul className="space-y-4 mb-10 flex-grow">
                    {plan.features.map((f, i) => (
                      <li
                        key={i}
                        className="text-[11px] text-gray-600 dark:text-gray-300 flex items-start font-bold uppercase tracking-wide"
                      >
                        <div className="mr-3 mt-0.5 bg-green-500/20 p-1 rounded-full">
                          <CheckCircle size={10} className="text-green-500" />
                        </div>
                        {f}
                      </li>
                    ))}
                  </ul>
                  {plan.id === "free" ? (
                    <button
                      disabled={restaurant.subscriptionTier === plan.id}
                      onClick={() => {
                        toast.success(
                          `Activation du forfait ${plan.name} confirmée.`,
                        );
                        onUpdateRestaurant({
                          ...restaurant,
                          subscriptionTier: "free",
                          subscriptionStatus: "active",
                        });
                      }}
                      className={`w-full py-5 rounded-[24px] font-bold text-sm transition-all duration-500 ${restaurant.subscriptionTier === plan.id ? "bg-white/5 text-gray-500 cursor-not-allowed border border-white/10" : "bg-brand-600 text-white hover:bg-brand-700 shadow-[0_10px_30px_rgba(59,130,246,0.3)] hover:shadow-brand-500/50 active:scale-95"}`}
                    >
                      {restaurant.subscriptionTier === plan.id
                        ? "Actif"
                        : "Sélectionner"}
                    </button>
                  ) : (
                    <button
                      disabled={
                        restaurant.subscriptionTier === plan.id &&
                        restaurant.subscriptionStatus === "active"
                      }
                      onClick={() => {
                        setSelectedPlan(plan);
                        setIsPayingSubscription(true);
                      }}
                      className={`w-full py-5 rounded-[24px] font-bold text-sm transition-all duration-500 ${restaurant.subscriptionTier === plan.id && restaurant.subscriptionStatus === "active" ? "bg-green-500/10 text-green-500 cursor-not-allowed border border-green-500/20" : "bg-brand-600 text-white hover:bg-brand-700 shadow-[0_10px_30px_rgba(59,130,246,0.3)] hover:shadow-brand-500/50 active:scale-95"}`}
                    >
                      {restaurant.subscriptionTier === plan.id &&
                      restaurant.subscriptionStatus === "active"
                        ? "Activé"
                        : "Upgrade Now"}
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-12 p-8 bg-brand-500/5 dark:bg-white/5 rounded-[32px] border border-dashed border-brand-500/20 flex flex-col md:flex-row items-center justify-between gap-6 relative z-10 overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-brand-500/5 to-transparent pointer-events-none"></div>
              <div className="flex items-center">
                <div className="bg-brand-500/20 p-4 rounded-2xl mr-5">
                  <HelpCircle size={32} className="text-brand-500" />
                </div>
                <div>
                  <h4 className="font-display font-bold text-xl text-gray-900 dark:text-white italic tracking-tight">
                    Configuration customisée
                  </h4>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold tracking-widest mt-1">
                    Multi-enseignes • Besoins spécifiques • Support VIP
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSettingsSubView("sales_support")}
                className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-8 py-4 rounded-2xl font-display font-black uppercase italic tracking-widest text-xs border border-white/20 hover:scale-105 transition-all shadow-lg whitespace-nowrap"
              >
                Open Ticket →
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (settingsSubView === "verification") {
      return (
        <div className="space-y-6 animate-in slide-in-from-right duration-300">
          <button
            onClick={() => setSettingsSubView("menu")}
            className="flex items-center text-brand-600 font-bold mb-4"
          >
            <Plus className="rotate-45 mr-1" size={20} /> Retour
          </button>
          {renderVerification()}
        </div>
      );
    }

    if (settingsSubView === "content") {
      return (
        <div className="space-y-8 animate-in fade-in slide-in-from-right duration-500 max-w-4xl mx-auto pb-20">
          <button
            onClick={() => setSettingsSubView("menu")}
            className="group flex items-center text-brand-600 font-display font-black uppercase italic tracking-widest text-sm hover:text-brand-700 transition-all mb-8"
          >
            <Plus
              className="rotate-45 mr-2 group-hover:-translate-x-1 transition-transform"
              size={20}
            />{" "}
            Retour Système
          </button>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Information du Responsable */}
            <div className="glass p-8 rounded-[40px] border border-white/20 dark:border-white/5 shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-orange-500/10 transition-colors"></div>
              <h3 className="font-bold text-xl text-gray-900 dark:text-white mb-8 flex items-center relative z-10">
                <Users size={24} className="mr-3 text-orange-500" /> Responsable
              </h3>
              <div className="space-y-6 relative z-10">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-3 ml-1">
                    {t("full_name")}
                  </label>
                  <div className="flex space-x-3">
                    <input
                      type="text"
                      className="flex-1 px-6 py-4 bg-white/5 border border-white/10 dark:text-white rounded-[20px] focus:ring-2 focus:ring-orange-500 outline-none transition-all font-bold text-sm"
                      defaultValue={user.name}
                      id="owner_name_input"
                    />
                    <button
                      onClick={async () => {
                        const newName = (
                          document.getElementById(
                            "owner_name_input",
                          ) as HTMLInputElement
                        ).value;
                        if (!newName) return;
                        try {
                          const { error } = await supabase
                            .from("profiles")
                            .update({ full_name: newName })
                            .eq("id", user.id);
                          if (error) throw error;
                          toast.success(t("update_success"));
                          onUpdateUser({ ...user, name: newName });
                        } catch (err) {
                          toast.error(t("update_error"));
                        }
                      }}
                      className="bg-orange-600 text-white px-6 rounded-[20px] font-bold text-xs hover:bg-orange-700 transition-all shadow-lg active:scale-95 whitespace-nowrap"
                    >
                      Update
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-3 ml-1">
                    Email Nexus
                  </label>
                  <div className="px-6 py-4 bg-black/5 dark:bg-white/5 border border-white/10 text-gray-400 rounded-[20px] font-bold text-sm select-none opacity-60">
                    {user.email || "N/A"}
                  </div>
                </div>
              </div>
            </div>

            {/* Account Security */}
            <div className="glass p-8 rounded-[40px] border border-white/20 dark:border-white/5 shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-blue-500/10 transition-colors"></div>
              <h3 className="font-bold text-xl text-gray-900 dark:text-white mb-8 flex items-center relative z-10">
                <Lock size={24} className="mr-3 text-blue-500" /> Crypter
                l'Accès
              </h3>
              <div className="space-y-6 relative z-10">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-3 ml-1">
                    {t("new_password")}
                  </label>
                  <div className="flex space-x-3">
                    <input
                      type="password"
                      className="flex-1 px-6 py-4 bg-white/5 border border-white/10 dark:text-white rounded-[20px] focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold text-sm"
                      placeholder="••••••••"
                      id="new_password_input"
                    />
                    <button
                      onClick={async () => {
                        const newPassword = (
                          document.getElementById(
                            "new_password_input",
                          ) as HTMLInputElement
                        ).value;
                        if (!newPassword || newPassword.length < 6) {
                          toast.error(t("password_length_error"));
                          return;
                        }
                        try {
                          const { error } = await supabase.auth.updateUser({
                            password: newPassword,
                          });
                          if (error) throw error;
                          toast.success(t("update_success"));
                          (
                            document.getElementById(
                              "new_password_input",
                            ) as HTMLInputElement
                          ).value = "";
                        } catch (err) {
                          toast.error(t("update_error"));
                        }
                      }}
                      className="bg-blue-600 text-white px-6 rounded-[20px] font-display font-black uppercase italic text-xs hover:bg-blue-700 transition-all shadow-lg active:scale-95 whitespace-nowrap"
                    >
                      Sync
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Restaurant Config */}
          <div className="glass p-10 rounded-[40px] border border-white/20 dark:border-white/5 shadow-2xl relative overflow-hidden">
            <div className="absolute bottom-0 right-0 w-64 h-64 bg-brand-500/5 rounded-full blur-[100px] -mr-32 -mb-32"></div>
            <h3 className="font-bold text-3xl text-gray-900 dark:text-white mb-10 flex items-center tracking-tighter relative z-10">
              <Edit3 size={32} className="mr-4 text-brand-500" /> Configuration
              identitaire
            </h3>

            <form onSubmit={saveSettings} className="space-y-8 relative z-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-3 ml-1">
                      {t("establishment_name")}
                    </label>
                    <input
                      type="text"
                      className="w-full px-6 py-4 bg-white/5 border border-white/10 dark:text-white rounded-[20px] focus:ring-2 focus:ring-brand-500 outline-none transition-all font-bold text-sm"
                      value={settingsForm.name}
                      onChange={(e) =>
                        setSettingsForm({
                          ...settingsForm,
                          name: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-3 ml-1">
                      {t("phone_public")}
                    </label>
                    <input
                      type="tel"
                      className="w-full px-6 py-4 bg-white/5 border border-white/10 dark:text-white rounded-[20px] focus:ring-2 focus:ring-brand-500 outline-none transition-all font-bold text-sm"
                      placeholder="+243..."
                      value={settingsForm.phoneNumber}
                      onChange={(e) =>
                        setSettingsForm({
                          ...settingsForm,
                          phoneNumber: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-3 ml-1">
                      Légende & Bio
                    </label>
                    <textarea
                      className="w-full px-6 py-4 bg-white/5 border border-white/10 dark:text-white rounded-[20px] focus:ring-2 focus:ring-brand-500 outline-none transition-all h-[156px] resize-none font-bold text-sm"
                      placeholder="Racontez votre histoire..."
                      value={settingsForm.description}
                      onChange={(e) =>
                        setSettingsForm({
                          ...settingsForm,
                          description: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-3 ml-1">
                        Devise par défaut
                      </label>
                      <select
                        className="w-full px-6 py-4 bg-white/5 border border-white/10 dark:text-white rounded-[20px] focus:ring-2 focus:ring-brand-500 outline-none transition-all font-bold text-sm appearance-none cursor-pointer"
                        value={settingsForm.currency}
                        onChange={(e) =>
                          setSettingsForm({
                            ...settingsForm,
                            currency: e.target.value as any,
                          })
                        }
                      >
                        <option value="USD" className="dark:bg-gray-900">USD ($)</option>
                        <option value="CDF" className="dark:bg-gray-900">CDF (FC)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-3 ml-1">
                        Taux de change ($1 = ?)
                      </label>
                      <input
                        type="number"
                        className="w-full px-6 py-4 bg-white/5 border border-white/10 dark:text-white rounded-[20px] focus:ring-2 focus:ring-brand-500 outline-none transition-all font-bold text-sm"
                        placeholder="2850"
                        value={settingsForm.exchangeRate}
                        onChange={(e) =>
                          setSettingsForm({
                            ...settingsForm,
                            exchangeRate: parseFloat(e.target.value),
                          })
                        }
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-3 ml-1">
                      Mode d'affichage monétaire
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                        {[
                            { id: 'dual', label: 'Duo ($ / FC)' },
                            { id: 'usd', label: 'Uniquement ($)' },
                            { id: 'cdf', label: 'Uniquement (FC)' }
                        ].map((mode) => (
                            <button
                                key={mode.id}
                                type="button"
                                onClick={() => setSettingsForm({ ...settingsForm, displayCurrencyMode: mode.id as any })}
                                className={`py-3 px-2 rounded-xl text-[10px] font-bold border transition-all ${settingsForm.displayCurrencyMode === mode.id ? 'bg-brand-500 text-white border-brand-600 shadow-lg' : 'bg-white/5 dark:bg-white/5 border-white/10 text-gray-400'}`}
                            >
                                {mode.label}
                            </button>
                        ))}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-4 ml-1">
                  {t("cover_photo")}
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="md:col-span-2">
                    <input
                      type="text"
                      className="w-full px-6 py-4 bg-white/5 border border-white/10 dark:text-white rounded-[20px] focus:ring-2 focus:ring-brand-500 outline-none transition-all font-bold text-sm"
                      value={settingsForm.coverImage}
                      onChange={(e) =>
                        setSettingsForm({
                          ...settingsForm,
                          coverImage: e.target.value,
                        })
                      }
                      placeholder="https://images.unsplash.com/..."
                    />
                  </div>
                  <label className="cursor-pointer bg-brand-500/10 hover:bg-brand-500 text-brand-500 hover:text-white px-6 py-4 rounded-[20px] font-bold text-xs flex items-center justify-center border border-brand-500/20 transition-all active:scale-95 shadow-lg group relative">
                    <Upload
                      size={18}
                      className="mr-3 group-hover:-translate-y-1 transition-transform"
                    />
                    {coverImageFile ? "Prêt à synchroniser" : "Charger Image"}
                    <input
                      type="file"
                      id="cover-image-upload"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) =>
                        setCoverImageFile(e.target.files?.[0] || null)
                      }
                    />
                    <button
                      type="button"
                      className="absolute inset-0 w-full h-full opacity-0 z-10"
                      onClick={async (e) => {
                        e.preventDefault();
                        if (isCapacitor) {
                          const file = await pickImage({ asFile: true });
                          if (file instanceof File) setCoverImageFile(file);
                        } else {
                          document.getElementById('cover-image-upload')?.click();
                        }
                      }}
                    />
                  </label>
                </div>
              </div>

              <div className="pt-8 border-t border-white/10 flex justify-end">
                <button
                  type="submit"
                  disabled={isSavingSettings}
                  className="bg-brand-600 text-white font-bold py-5 px-12 rounded-[24px] hover:bg-brand-700 shadow-[0_10px_30px_rgba(59,130,246,0.3)] hover:shadow-brand-500/50 transition-all flex items-center active:scale-95 disabled:opacity-50"
                >
                  {isSavingSettings ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-3"></div>
                      Traitement...
                    </>
                  ) : (
                    <>
                      <Save className="mr-3" size={20} />
                      Mettre à jour
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      );
    }

    if (settingsSubView === "privacy") {
      return (
        <div className="space-y-8 animate-in fade-in slide-in-from-right duration-500 max-w-4xl mx-auto pb-20">
          <button
            onClick={() => setSettingsSubView("menu")}
            className="group flex items-center text-brand-600 font-display font-black uppercase italic tracking-widest text-sm hover:text-brand-700 transition-all mb-8"
          >
            <Plus
              className="rotate-45 mr-2 group-hover:-translate-x-1 transition-transform"
              size={20}
            />{" "}
            Retour Système
          </button>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div className="glass p-8 rounded-[40px] border border-white/20 dark:border-white/5 shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full blur-3xl -mr-16 -mt-16"></div>
              <h3 className="font-display font-black text-xl text-gray-900 dark:text-white mb-6 flex items-center uppercase italic tracking-tight relative z-10">
                {theme === "light" ? (
                  <Sun size={24} className="mr-3 text-orange-500" />
                ) : (
                  <Moon size={24} className="mr-3 text-blue-400" />
                )}
                Spectre Visuel
              </h3>
              <div className="flex space-x-3 relative z-10">
                <button
                  onClick={() => setTheme("light")}
                  className={`flex-1 py-4 px-6 rounded-[20px] font-display font-black uppercase italic tracking-widest text-[10px] border transition-all ${theme === "light" ? "bg-orange-500 text-white border-orange-600 shadow-lg" : "bg-white/5 dark:bg-white/5 border-white/10 text-gray-400 hover:border-orange-500/50"}`}
                >
                  Solar
                </button>
                <button
                  onClick={() => setTheme("dark")}
                  className={`flex-1 py-4 px-6 rounded-[20px] font-display font-black uppercase italic tracking-widest text-[10px] border transition-all ${theme === "dark" ? "bg-blue-600 text-white border-blue-700 shadow-lg" : "bg-white/5 dark:bg-white/5 border-white/10 text-gray-400 hover:border-blue-500/50"}`}
                >
                  Eclipse
                </button>
              </div>
            </div>

            <div className="glass p-8 rounded-[40px] border border-white/20 dark:border-white/5 shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500/5 rounded-full blur-3xl -mr-16 -mt-16"></div>
              <h3 className="font-display font-black text-xl text-gray-900 dark:text-white mb-6 flex items-center uppercase italic tracking-tight relative z-10">
                <Type size={24} className="mr-3 text-brand-500" /> Typographie
              </h3>
              {font && setFont && (
                <div className="relative z-10">
                  <select
                    value={font}
                    onChange={(e) => setFont(e.target.value as AppFont)}
                    className="w-full bg-white/5 dark:bg-white/5 text-gray-900 dark:text-white font-bold text-sm p-4 rounded-[20px] border border-white/10 outline-none focus:border-brand-500 transition-all appearance-none cursor-pointer"
                  >
                    <option value="facebook" className="dark:bg-gray-900">
                      Facebook Standard
                    </option>
                    <option value="inter" className="dark:bg-gray-900">
                      Inter Precision
                    </option>
                    <option value="roboto" className="dark:bg-gray-900">
                      Roboto Clean
                    </option>
                    <option value="opensans" className="dark:bg-gray-900">
                      Open Sans Flow
                    </option>
                    <option value="lato" className="dark:bg-gray-900">
                      Lato Modern
                    </option>
                    <option value="montserrat" className="dark:bg-gray-900">
                      Montserrat Display
                    </option>
                    <option value="poppins" className="dark:bg-gray-900">
                      Poppins Soft
                    </option>
                    <option value="quicksand" className="dark:bg-gray-900">
                      Quicksand Bold
                    </option>
                    <option value="playfair" className="dark:bg-gray-900">
                      Playfair High-End
                    </option>
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                    <ChevronRight size={16} className="rotate-90" />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="glass rounded-[40px] border border-white/20 dark:border-white/5 shadow-2xl overflow-hidden min-h-[400px]">
            <div className="p-10 border-b border-white/10 bg-white/5 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-[100px] -mr-32 -mt-32"></div>
              <h3 className="font-display font-bold text-3xl text-gray-900 dark:text-white flex items-center italic tracking-tighter relative z-10">
                <Shield size={36} className="mr-4 text-blue-500" /> Protocoles &
                privacy
              </h3>
              <p className="text-[10px] text-gray-400 font-bold tracking-widest mt-2 ml-1 relative z-10">
                Gouvernance de donnée • Sécurité quantum
              </p>
            </div>

            <div className="p-10 space-y-12 relative z-10">
              {/* Visibilité */}
              <div className="space-y-8">
                <h4 className="font-display font-bold text-gray-400 dark:text-gray-500 text-[10px] tracking-widest mb-8 flex items-center">
                  <Eye size={16} className="mr-3" /> Paramètres de visibilité
                </h4>

                <div className="flex items-center justify-between group">
                  <div className="max-w-md">
                    <p className="font-display font-bold text-lg text-gray-900 dark:text-white italic tracking-tight underline decoration-2 underline-offset-4 decoration-blue-500/20">
                      Signal public
                    </p>
                    <p className="text-[10px] text-gray-500 font-bold tracking-widest mt-1">
                      Contrôlez l'accessibilité de votre nexus restaurant.
                    </p>
                  </div>
                  <div className="flex bg-black/5 dark:bg-white/10 p-1.5 rounded-[20px] border border-white/5 shadow-inner">
                    <button
                      onClick={() => {
                        setPrivacyProfile("public");
                        saveAdvancedSettings({ privacyProfile: "public" });
                      }}
                      className={`px-6 py-3 rounded-[15px] text-[10px] font-display font-bold italic tracking-widest transition-all ${privacyProfile === "public" ? "bg-blue-600 text-white shadow-lg" : "text-gray-400 hover:text-gray-200"}`}
                    >
                      Public
                    </button>
                    <button
                      onClick={() => {
                        setPrivacyProfile("private");
                        saveAdvancedSettings({ privacyProfile: "private" });
                      }}
                      className={`px-6 py-3 rounded-[15px] text-[10px] font-display font-bold italic tracking-widest transition-all ${privacyProfile === "private" ? "bg-orange-600 text-white shadow-lg" : "text-gray-400 hover:text-gray-200"}`}
                    >
                      Stealth
                    </button>
                  </div>
                </div>
              </div>

              {/* Notifications */}
              <div className="pt-10 border-t border-white/10 space-y-8">
                <h4 className="font-display font-bold text-gray-400 dark:text-gray-500 text-[10px] tracking-widest flex items-center">
                  <Bell size={16} className="mr-3" /> Flux de notifications
                </h4>

                <div className="flex items-center justify-between group">
                  <div className="max-w-md">
                    <p className="font-display font-bold text-lg text-gray-900 dark:text-white italic tracking-tight underline decoration-2 underline-offset-4 decoration-green-500/20">
                      Alertes push
                    </p>
                    <p className="text-[10px] text-gray-500 font-bold tracking-widest mt-1">
                      Réception instantanée des flux de commandes et messages.
                    </p>
                  </div>
                  <button
                    onClick={async () => {
                      const granted = await requestNotificationPermission();
                      setNotifPush(granted);
                      saveAdvancedSettings({ notifPush: granted });
                      if (granted) {
                        toast.success("Synchronisation des alertes validée.");
                        sendPushNotification("Nexus Connecté", {
                          body: "Flux de données opérationnel.",
                        });
                      } else {
                        if (window.self !== window.top) {
                          toast.error(
                            "Veuillez transférer l'instance dans un nouvel onglet.",
                          );
                        } else {
                          toast.error("Protocole de permission révoqué.");
                        }
                      }
                    }}
                    className={`px-8 py-3 rounded-[20px] text-[10px] font-display font-bold italic tracking-widest transition-all ${notifPush ? "bg-green-600 text-white shadow-lg" : "bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:border-brand-500"}`}
                  >
                    {notifPush ? "Activé" : "Sync flux"}
                  </button>
                </div>
              </div>

              {/* Sécurité Avancée */}
              <div className="pt-10 border-t border-white/10 space-y-8">
                <h4 className="font-display font-bold text-gray-400 dark:text-gray-500 text-[10px] tracking-widest flex items-center">
                  <Lock size={16} className="mr-3" /> Coffre-fort digital
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* App Lock */}
                  <div className="flex flex-col justify-between p-8 bg-white/5 dark:bg-white/5 rounded-[30px] border border-white/10 hover:border-brand-500/30 transition-all group">
                    <div className="flex items-center mb-6">
                      <div className="bg-brand-500/10 p-3 rounded-2xl mr-4 text-brand-500 group-hover:scale-110 transition-transform">
                        <Lock size={20} />
                      </div>
                      <p className="font-display font-bold text-lg text-gray-900 dark:text-white italic tracking-tight">
                        App lock
                      </p>
                    </div>
                    <p className="text-[10px] text-gray-500 font-bold tracking-widest mb-6">
                      Verrouillage par PIN nexus (4 chiffres).
                    </p>
                    <div
                      className="relative inline-flex items-center cursor-pointer group self-start"
                      onClick={() => {
                        if (appLockEnabled) {
                          setAppLockEnabled(false);
                          saveAdvancedSettings({ appLockEnabled: false });
                        } else {
                          const pin = prompt(
                            "Définissez un PIN Nexus (4 chiffres) :",
                          );
                          if (pin && pin.length === 4) {
                            setAppLockEnabled(true);
                            setAppLockPin(pin);
                            saveAdvancedSettings({
                              appLockEnabled: true,
                              appLockPin: pin,
                            });
                            toast.success("Coffre-fort activé.");
                          } else {
                            toast.error("Format PIN invalide.");
                          }
                        }
                      }}
                    >
                      <div
                        className={`w-14 h-7 rounded-full transition-all duration-300 ${appLockEnabled ? "bg-brand-600" : "bg-black/20"}`}
                      >
                        <div
                          className={`w-5 h-5 bg-white rounded-full mt-1 transition-all duration-300 ${appLockEnabled ? "ml-8" : "ml-1"}`}
                        ></div>
                      </div>
                    </div>
                  </div>

                  {/* Biometrics */}
                  <div className="flex flex-col justify-between p-8 bg-white/5 dark:bg-white/5 rounded-[30px] border border-white/10 hover:border-blue-500/30 transition-all group">
                    <div className="flex items-center mb-6">
                      <div className="bg-blue-500/10 p-3 rounded-2xl mr-4 text-blue-500 group-hover:scale-110 transition-transform">
                        <Fingerprint size={20} />
                      </div>
                      <p className="font-display font-bold text-lg text-gray-900 dark:text-white italic tracking-tight">
                        Biométrie
                      </p>
                    </div>
                    <p className="text-[10px] text-gray-500 font-bold tracking-widest mb-6">
                      Touch ID / Face ID pour l'authentification.
                    </p>
                    <div
                      className="relative inline-flex items-center cursor-pointer group self-start"
                      onClick={() => {
                        const newVal = !biometricsEnabled;
                        setBiometricsEnabled(newVal);
                        saveAdvancedSettings({ biometricsEnabled: newVal });
                      }}
                    >
                      <div
                        className={`w-14 h-7 rounded-full transition-all duration-300 ${biometricsEnabled ? "bg-blue-600" : "bg-black/20"}`}
                      >
                        <div
                          className={`w-5 h-5 bg-white rounded-full mt-1 transition-all duration-300 ${biometricsEnabled ? "ml-8" : "ml-1"}`}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2FA & Deletion Pass */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-8 bg-blue-500/5 dark:bg-blue-500/5 rounded-[30px] border border-blue-500/10 group">
                    <div className="flex items-center mb-4">
                      <Smartphone size={20} className="mr-3 text-blue-500" />
                      <p className="font-bold text-sm text-blue-900 dark:text-blue-300">
                        2fa Nexus
                      </p>
                    </div>
                    <p className="text-[10px] text-blue-800 dark:text-blue-400 font-bold tracking-widest mb-6 leading-relaxed">
                      Double sécurité par canal SMS chiffré.
                    </p>
                    <button
                      onClick={() => {
                        const val = !twoFactorEnabled;
                        setTwoFactorEnabled(val);
                        saveAdvancedSettings({ twoFactorEnabled: val });
                      }}
                      className={`px-6 py-3 rounded-[15px] text-[10px] font-bold transition-all ${twoFactorEnabled ? "bg-blue-600 text-white" : "bg-white/10 text-blue-400 border border-blue-500/20"}`}
                    >
                      {twoFactorEnabled ? "Sécurisé" : "Activer"}
                    </button>
                  </div>

                  <div className="p-8 bg-orange-500/5 dark:bg-orange-500/5 rounded-[30px] border border-orange-500/10">
                    <div className="flex items-center mb-4">
                      <Trash2 size={20} className="mr-3 text-orange-500" />
                      <p className="font-display font-bold text-sm text-orange-900 dark:text-orange-300 italic tracking-widest">
                        Master delete
                      </p>
                    </div>
                    <p className="text-[10px] text-orange-800 dark:text-orange-400 font-bold tracking-widest mb-4">
                      Code requis pour l'annulation de commande.
                    </p>
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        placeholder="Code de sécurité..."
                        className="flex-1 bg-white/10 dark:bg-gray-900/50 border border-orange-500/20 rounded-[15px] px-4 py-2 text-xs outline-none focus:border-orange-500 text-orange-500 font-bold"
                        value={orderDeletionPassword}
                        onChange={(e) =>
                          setOrderDeletionPassword(e.target.value)
                        }
                      />
                      <button
                        onClick={() => {
                          saveAdvancedSettings({ orderDeletionPassword });
                          toast.success("Code Master Delete synchronisé.");
                        }}
                        className="bg-orange-600 text-white px-4 py-2 rounded-[15px] text-[10px] font-display font-black uppercase italic tracking-widest hover:bg-orange-700 transition-all active:scale-95"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* IA & Privacy */}
              <div className="pt-10 border-t border-white/10 space-y-8">
                <div className="flex items-center justify-between group">
                  <div className="max-w-md">
                    <p className="font-display font-bold text-lg text-gray-900 dark:text-white italic tracking-tight underline decoration-2 underline-offset-4 decoration-brand-500/20">
                      Analyse IA quantum
                    </p>
                    <p className="text-[10px] text-gray-500 font-bold tracking-widest mt-1">
                      Autorisez l'IA à analyser vos flux pour optimiser vos
                      revenus via Nexus Insights.
                    </p>
                  </div>
                  <div
                    className="relative inline-flex items-center cursor-pointer group"
                    onClick={() => {
                      toast.info(
                        "Protocole IA Quantum en cours d'optimisation.",
                      );
                    }}
                  >
                    <div className="w-16 h-8 bg-black/10 dark:bg-white/10 p-1 rounded-full transition-all duration-300 peer-checked:bg-brand-600">
                      <div className="w-6 h-6 bg-white rounded-full transition-all duration-300 translate-x-8 shadow-[0_0_15px_rgba(255,255,255,0.5)]"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Zone Critique */}
            <div className="p-10 bg-red-500/5 dark:bg-red-500/10 border-t border-red-500/20 flex items-center justify-between mt-auto group/zone">
              <div className="relative">
                <div className="absolute -inset-4 bg-red-500/5 blur-2xl group-hover/zone:bg-red-500/10 transition-all duration-700 rounded-full"></div>
                <div className="relative z-10">
                  <p className="font-bold text-2xl text-red-600 dark:text-red-500 tracking-tighter leading-none mb-1">
                    Zone de Non-Retour
                  </p>
                  <p className="text-[10px] text-red-500/70 font-bold uppercase tracking-[0.4em] italic">
                    Action Irréversible • Destruction de l'Écosystème
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  if (
                    confirm(
                      "ACTION CRITIQUE : Confirmez-vous la destruction totale de votre instance Nexus ? Cette action effacera toutes vos données de configuration et d'historique de manière permanente.",
                    )
                  ) {
                    toast.error("Séquence de destruction initiée...");
                    setTimeout(
                      () =>
                        toast.error("Protocole de sécurité : Liaison coupée."),
                      2000,
                    );
                  }
                }}
                className="px-10 py-5 bg-red-600/10 text-red-600 border border-red-600/30 rounded-[24px] font-display font-black uppercase italic tracking-widest text-[10px] hover:bg-red-600 hover:text-white transition-all shadow-[0_0_50px_-10px_rgba(220,38,38,0.3)] active:scale-95 group-hover/zone:shadow-[0_0_70px_-10px_rgba(220,38,38,0.5)]"
              >
                Destruct Nexus
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (settingsSubView === "delivery") {
      return (
        <div className="space-y-6 animate-in slide-in-from-right duration-300">
          <button
            onClick={() => setSettingsSubView("menu")}
            className="flex items-center text-brand-600 font-bold mb-4"
          >
            <Plus className="rotate-45 mr-1" size={20} /> Retour
          </button>
          <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 max-w-2xl">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center">
              <Truck className="mr-2 text-brand-600" /> Paramètres de Livraison
            </h3>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                  Rayon de livraison (km)
                </label>
                <input
                  type="number"
                  className="w-full p-4 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                  defaultValue={restaurant.deliveryRadius || 5}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                  Frais de livraison de base ({restaurant.currency})
                </label>
                <input
                  type="number"
                  className="w-full p-4 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                  defaultValue={restaurant.deliveryFee || 0}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                  Commande minimum pour livraison gratuite (
                  {restaurant.currency})
                </label>
                <input
                  type="number"
                  className="w-full p-4 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                  defaultValue={50}
                />
              </div>

              <div className="pt-4">
                <button
                  onClick={() =>
                    toast.success("Paramètres de livraison enregistrés !")
                  }
                  className="w-full py-4 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 transition-all"
                >
                  Enregistrer les modifications
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (settingsSubView === "hours") {
      const days = [
        "Lundi",
        "Mardi",
        "Mercredi",
        "Jeudi",
        "Vendredi",
        "Samedi",
        "Dimanche",
      ];
      return (
        <div className="space-y-6 animate-in slide-in-from-right duration-300">
          <button
            onClick={() => setSettingsSubView("menu")}
            className="flex items-center text-brand-600 font-bold mb-4"
          >
            <Plus className="rotate-45 mr-1" size={20} /> Retour
          </button>
          <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 max-w-2xl">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center">
              <Clock className="mr-2 text-brand-600" /> Horaires d'Ouverture
            </h3>

            <div className="space-y-4">
              {days.map((day) => (
                <div
                  key={day}
                  className="flex items-center justify-between p-3 border-b border-gray-50 dark:border-gray-700 last:border-0"
                >
                  <span className="font-bold text-gray-700 dark:text-gray-300 w-24">
                    {day}
                  </span>
                  <div className="flex items-center space-x-2">
                    <input
                      type="time"
                      className="p-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm"
                      value={businessHours[day]?.open || "09:00"}
                      onChange={(e) =>
                        setBusinessHours((prev: any) => ({
                          ...prev,
                          [day]: { ...(prev[day] || {}), open: e.target.value },
                        }))
                      }
                    />
                    <span className="text-gray-400">à</span>
                    <input
                      type="time"
                      className="p-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm"
                      value={businessHours[day]?.close || "22:00"}
                      onChange={(e) =>
                        setBusinessHours((prev: any) => ({
                          ...prev,
                          [day]: {
                            ...(prev[day] || {}),
                            close: e.target.value,
                          },
                        }))
                      }
                    />
                  </div>
                  <div className="flex items-center ml-4">
                    <input
                      type="checkbox"
                      className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500"
                      checked={businessHours[day]?.isOpen ?? true}
                      onChange={(e) =>
                        setBusinessHours((prev: any) => ({
                          ...prev,
                          [day]: {
                            ...(prev[day] || {}),
                            isOpen: e.target.checked,
                          },
                        }))
                      }
                    />
                    <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                      Ouvert
                    </span>
                  </div>
                </div>
              ))}

              <div className="pt-6">
                <button
                  onClick={async () => {
                    await saveAdvancedSettings({ hours: businessHours });
                    toast.success("Horaires synchronisés.");
                  }}
                  className="w-full py-4 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 transition-all active:scale-95 shadow-xl"
                >
                  Enregistrer les horaires
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (settingsSubView === "notifications") {
      return (
        <div className="space-y-6 animate-in slide-in-from-right duration-300">
          <button
            onClick={() => setSettingsSubView("menu")}
            className="flex items-center text-brand-600 font-bold mb-4"
          >
            <Plus className="rotate-45 mr-1" size={20} /> Retour
          </button>
          <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 max-w-2xl">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center">
              <Bell className="mr-2 text-brand-600" /> Préférences de
              Notifications
            </h3>

            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-gray-800 dark:text-white">
                    Nouvelles commandes
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Recevoir une alerte sonore et visuelle
                  </p>
                </div>
                <input
                  type="checkbox"
                  className="w-6 h-6 text-brand-600 rounded-lg focus:ring-brand-500"
                  defaultChecked
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-gray-800 dark:text-white">
                    Avis clients
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Être notifié quand un client laisse un avis
                  </p>
                </div>
                <input
                  type="checkbox"
                  className="w-6 h-6 text-brand-600 rounded-lg focus:ring-brand-500"
                  defaultChecked
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-gray-800 dark:text-white">
                    Rapports hebdomadaires
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Recevoir un résumé des ventes par email
                  </p>
                </div>
                <input
                  type="checkbox"
                  className="w-6 h-6 text-brand-600 rounded-lg focus:ring-brand-500"
                  defaultChecked
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-gray-800 dark:text-white">
                    Messages clients
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Notifications de chat en temps réel
                  </p>
                </div>
                <input
                  type="checkbox"
                  className="w-6 h-6 text-brand-600 rounded-lg focus:ring-brand-500"
                  defaultChecked
                />
              </div>

              <div className="pt-4">
                <button
                  onClick={() => toast.success("Préférences enregistrées !")}
                  className="w-full py-4 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 transition-all"
                >
                  Enregistrer les préférences
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (settingsSubView === "payments") {
      const config = restaurant.paymentConfig || {
        acceptCash: true,
        acceptMobileMoney: false,
      };

      return (
        <div className="space-y-6 animate-in slide-in-from-right duration-300">
          <button
            onClick={() => setSettingsSubView("menu")}
            className="flex items-center text-brand-600 font-bold mb-4"
          >
            <Plus className="rotate-45 mr-1" size={20} /> Retour
          </button>
          <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 max-w-2xl">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center">
              <CreditCard className="mr-2 text-brand-600" /> Configuration des
              Paiements
            </h3>

            <div className="space-y-8">
              {/* Cash */}
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-800">
                <div className="flex items-center">
                  <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-lg mr-4 text-green-600 dark:text-green-400">
                    <Banknote size={24} />
                  </div>
                  <div>
                    <p className="font-bold text-gray-800 dark:text-white">
                      Cash à la livraison
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Le client paie à la réception
                    </p>
                  </div>
                </div>
                <button
                  onClick={() =>
                    handleUpdatePaymentConfig({
                      ...config,
                      acceptCash: !config.acceptCash,
                    })
                  }
                  className={`w-12 h-6 rounded-full transition-colors relative ${config.acceptCash ? "bg-brand-600" : "bg-gray-300"}`}
                >
                  <div
                    className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${config.acceptCash ? "translate-x-7" : "translate-x-1"}`}
                  />
                </button>
              </div>

              {/* Mobile Money */}
              <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg mr-4 text-blue-600 dark:text-blue-400">
                      <Smartphone size={24} />
                    </div>
                    <div>
                      <p className="font-bold text-gray-800 dark:text-white">
                        Mobile Money
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Airtel, Orange, M-Pesa
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      handleUpdatePaymentConfig({
                        ...config,
                        acceptMobileMoney: !config.acceptMobileMoney,
                      })
                    }
                    className={`w-12 h-6 rounded-full transition-colors relative ${config.acceptMobileMoney ? "bg-brand-600" : "bg-gray-300"}`}
                  >
                    <div
                      className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${config.acceptMobileMoney ? "translate-x-7" : "translate-x-1"}`}
                    />
                  </button>
                </div>

                {config.acceptMobileMoney && (
                  <div className="grid grid-cols-1 gap-4 pt-4 animate-in fade-in duration-300">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                        Numéro M-Pesa
                      </label>
                      <input
                        type="text"
                        defaultValue={config.mpesaNumber}
                        onBlur={(e) =>
                          handleUpdatePaymentConfig({
                            ...config,
                            mpesaNumber: e.target.value,
                          })
                        }
                        placeholder="081XXXXXXX"
                        className="w-full p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">
                        Numéro airtel money
                      </label>
                      <input
                        type="text"
                        defaultValue={config.airtelNumber}
                        onBlur={(e) =>
                          handleUpdatePaymentConfig({
                            ...config,
                            airtelNumber: e.target.value,
                          })
                        }
                        placeholder="099XXXXXXX"
                        className="w-full p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">
                        Numéro orange money
                      </label>
                      <input
                        type="text"
                        defaultValue={config.orangeNumber}
                        onBlur={(e) =>
                          handleUpdatePaymentConfig({
                            ...config,
                            orangeNumber: e.target.value,
                          })
                        }
                        placeholder="089XXXXXXX"
                        className="w-full p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (settingsSubView === "sales_support") {
      return (
        <div className="space-y-6 animate-in slide-in-from-right duration-300">
          <button
            onClick={() => setSettingsSubView("subscription")}
            className="flex items-center text-brand-600 font-bold mb-4"
          >
            <Plus className="rotate-45 mr-1" size={20} /> Retour
          </button>

          <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 rounded-full flex items-center justify-center mx-auto mb-4">
                <Headphones size={40} />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                Support commercial
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                Parlez-nous de votre projet et obtenez une offre sur mesure.
              </p>
            </div>

            <form
              className="space-y-6"
              onSubmit={(e) => {
                e.preventDefault();
                toast.success(
                  "Votre demande a été envoyée ! Un conseiller vous contactera sous 24h.",
                );
                setSettingsSubView("subscription");
              }}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-2">
                    Nom complet
                  </label>
                  <input
                    type="text"
                    required
                    defaultValue={user.name}
                    className="w-full p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-brand-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-2">
                    Email professionnel
                  </label>
                  <input
                    type="email"
                    required
                    defaultValue={user.email}
                    className="w-full p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-brand-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-2">
                  Sujet de votre demande
                </label>
                <select className="w-full p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-brand-500 outline-none">
                  <option>Offre multi-établissements</option>
                  <option>Partenariat franchise</option>
                  <option>Besoins techniques spécifiques</option>
                  <option>Autre demande commerciale</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-2">
                  Message / détails du projet
                </label>
                <textarea
                  required
                  rows={4}
                  className="w-full p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-brand-500 outline-none resize-none"
                  placeholder="Décrivez vos besoins ici..."
                ></textarea>
              </div>

              <button
                type="submit"
                className="w-full py-4 bg-brand-600 text-white rounded-2xl font-bold shadow-lg shadow-brand-500/20 hover:bg-brand-700 transition-all active:scale-95 flex items-center justify-center"
              >
                <Send size={20} className="mr-2" />
                Envoyer ma demande
              </button>
            </form>

            <div className="mt-8 pt-8 border-t border-gray-100 dark:border-gray-700 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl">
                <Mail className="text-brand-600 mr-3" size={20} />
                <div>
                  <p className="text-[10px] font-bold text-gray-400">
                    Email direct
                  </p>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">
                    sales@dashmeals.com
                  </p>
                </div>
              </div>
              <div className="flex items-center p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl">
                <Phone className="text-brand-600 mr-3" size={20} />
                <div>
                  <p className="text-[10px] font-bold text-gray-400">
                    Téléphone
                  </p>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">
                    +243 812 345 678
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6 animate-in fade-in duration-500 pb-20">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
          Paramètres
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => setSettingsSubView("verification")}
            className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center hover:border-brand-500 transition-all group"
          >
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
              <CheckCircle size={24} />
            </div>
            <div className="text-left">
              <p className="font-bold text-gray-900 dark:text-white">
                Vérification du compte
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Gérez vos documents et votre statut.
              </p>
            </div>
          </button>

          <button
            onClick={() => setSettingsSubView("content")}
            className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center hover:border-brand-500 transition-all group"
          >
            <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-xl flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
              <UserIcon size={24} />
            </div>
            <div className="text-left">
              <p className="font-bold text-gray-900 dark:text-white">
                Mise à jour du contenu
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Photo, nom, mot de passe et infos resto.
              </p>
            </div>
          </button>

          <button
            onClick={() => setSettingsSubView("privacy")}
            className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center hover:border-brand-500 transition-all group"
          >
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-xl flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
              <Shield size={24} />
            </div>
            <div className="text-left">
              <p className="font-bold text-gray-900 dark:text-white">
                Paramètres et confidentialité
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Mode sombre, notifications, sécurité.
              </p>
            </div>
          </button>

          <button
            onClick={onLogout}
            className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-red-100 dark:border-red-900/30 flex items-center hover:bg-red-50 dark:hover:bg-red-900/10 transition-all group"
          >
            <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
              <LogOut size={24} />
            </div>
            <div className="text-left">
              <p className="font-bold text-red-600">Se déconnecter</p>
              <p className="text-xs text-red-400">
                Quitter votre session actuelle.
              </p>
            </div>
          </button>
        </div>
      </div>
    );
  };

  const renderOrders = () => (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
          Commandes ({filteredOrders.length})
        </h2>

        <div className="flex items-center space-x-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
          <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
            <button
              onClick={() => setOrderFilter("active")}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${orderFilter === "active" ? "bg-white dark:bg-gray-600 shadow-sm text-brand-600 dark:text-white" : "text-gray-500 dark:text-gray-400"}`}
            >
              En cours
            </button>
            <button
              onClick={() => setOrderFilter("completed")}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${orderFilter === "completed" ? "bg-white dark:bg-gray-600 shadow-sm text-brand-600 dark:text-white" : "text-gray-500 dark:text-gray-400"}`}
            >
              Terminées
            </button>
            <button
              onClick={() => setOrderFilter("all")}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${orderFilter === "all" ? "bg-white dark:bg-gray-600 shadow-sm text-brand-600 dark:text-white" : "text-gray-500 dark:text-gray-400"}`}
            >
              Toutes
            </button>
          </div>

          <button
            onClick={refreshOrders}
            disabled={isRefreshing}
            className="flex items-center space-x-2 text-sm font-bold text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 px-3 py-2 rounded-lg transition-colors flex-shrink-0"
          >
            <RefreshCw
              size={16}
              className={isRefreshing ? "animate-spin" : ""}
            />
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {filteredOrders.length === 0 ? (
          <div className="text-center py-10 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
            <ShoppingBag className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-gray-500 dark:text-gray-400 font-medium">
              Aucune commande{" "}
              {orderFilter === "active"
                ? "en cours"
                : orderFilter === "completed"
                  ? "terminée"
                  : ""}
              .
            </p>
          </div>
        ) : (
          filteredOrders.map((order) => (
            <div
              key={order.id}
              className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 animate-in slide-in-from-top-5 duration-300"
            >
              <div className="flex flex-col md:flex-row justify-between md:items-start mb-4">
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white">
                      Commande #{order.id.slice(0, 6)}
                    </h3>
                    {getStatusBadge(order.status)}
                    {order.isUrgent && (
                      <span className="bg-red-500 text-white px-2 py-1 rounded text-xs font-bold uppercase flex items-center shadow-sm animate-pulse-fast">
                        <Zap size={12} className="mr-1 fill-white" /> Urgent
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 flex items-center">
                    <span className="font-bold mr-1">
                      {order.customer?.full_name}
                    </span>
                    • {new Date(order.createdAt).toLocaleString()}
                  </p>
                  {order.customer?.phone_number && (
                    <div
                      className="flex items-center text-xs text-brand-600 dark:text-brand-400 font-bold mt-1 cursor-pointer"
                      onClick={() =>
                        window.open(`tel:${order.customer?.phone_number}`)
                      }
                    >
                      <Phone size={12} className="mr-1" />{" "}
                      {order.customer?.phone_number}
                    </div>
                  )}
                  {order.deliveryLocation && (
                    <div className="flex items-start text-xs text-gray-600 dark:text-gray-300 mt-2 bg-gray-100 dark:bg-gray-700 p-2 rounded-lg">
                      <MapPin
                        size={14}
                        className="mr-1.5 mt-0.5 text-brand-600 flex-shrink-0"
                      />
                      <div>
                        <span className="font-bold block">
                          Adresse de livraison:
                        </span>
                        {order.deliveryLocation.address}
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${order.deliveryLocation.lat},${order.deliveryLocation.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-brand-600 hover:underline block mt-1 font-medium"
                        >
                          Ouvrir dans Google Maps
                        </a>
                      </div>
                    </div>
                  )}
                </div>
                <div className="mt-4 md:mt-0 text-right">
                  <p className="text-lg font-bold text-brand-600">
                    {formatDualPrice(order.totalAmount || 0, restaurant.currency as 'USD' | 'CDF' || 'USD', order.exchangeRate || restaurant.exchangeRate, restaurant.displayCurrencyMode)}
                  </p>
                  <p className="text-xs text-gray-400 font-bold">
                    {order.items.length} articles
                  </p>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4 mb-4 space-y-2">
                {order.items.map((item, i) => (
                  <div
                    key={i}
                    className="flex justify-between items-center text-sm"
                  >
                    <div className="flex items-center">
                      {order.status === "pending" ? (
                        <div className="flex items-center bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 rounded-md mr-3">
                          <button
                            onClick={() =>
                              updateOrderItemQuantity(
                                order.id,
                                i,
                                item.quantity - 1,
                              )
                            }
                            className="px-2 py-0.5 text-gray-500 hover:text-brand-600 dark:text-gray-300 dark:hover:text-brand-400"
                          >
                            -
                          </button>
                          <span className="font-bold text-xs px-1 min-w-[1.5rem] text-center dark:text-white">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() =>
                              updateOrderItemQuantity(
                                order.id,
                                i,
                                item.quantity + 1,
                              )
                            }
                            className="px-2 py-0.5 text-gray-500 hover:text-brand-600 dark:text-gray-300 dark:hover:text-brand-400"
                          >
                            +
                          </button>
                        </div>
                      ) : (
                        <span className="font-bold bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 w-6 h-6 flex items-center justify-center rounded-md mr-3 text-xs dark:text-white">
                          {item.quantity}
                        </span>
                      )}
                      <span className="text-gray-700 dark:text-gray-200">
                        {item.name}
                      </span>
                    </div>
                    <span className="font-bold text-gray-900 dark:text-white">
                      ${((item.price || 0) * (item.quantity || 1)).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              {(order.paymentProof || order.proof_url) && (
                <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-900/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <p className="text-xs font-bold text-blue-800 dark:text-blue-300 mb-2">
                      Preuve de paiement jointe :
                    </p>
                    <a
                      href={order.proof_url || order.paymentProof}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-32 h-32 rounded-lg overflow-hidden border-2 border-blue-200 hover:opacity-80 transition-opacity"
                    >
                      <img
                        src={order.proof_url || order.paymentProof}
                        alt="Preuve de paiement"
                        className="w-full h-full object-cover"
                      />
                    </a>
                  </div>
                  {order.status === "pending" &&
                    order.paymentStatus !== "paid" && (
                      <div className="flex flex-col gap-2 w-full md:w-auto">
                        <button
                          onClick={() => updatePaymentStatus(order.id, "paid")}
                          className="px-4 py-2 bg-green-500 text-white rounded-lg text-xs font-bold hover:bg-green-600 shadow-sm"
                        >
                          Confirmer le paiement
                        </button>
                        <button
                          onClick={() =>
                            updatePaymentStatus(order.id, "failed")
                          }
                          className="px-4 py-2 bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 rounded-lg text-xs font-bold hover:bg-red-200 dark:hover:bg-red-900/50 shadow-sm"
                        >
                          Demander une nouvelle preuve
                        </button>
                      </div>
                    )}
                </div>
              )}

              <div className="flex flex-wrap gap-2 justify-end pt-2 border-t border-gray-100 dark:border-gray-700">
                {(user.role === "business" ||
                  (user.role === "staff" &&
                    (user.staffRole === "admin" ||
                      user.staffRole === "manager"))) && (
                  <button
                    onClick={() => {
                      if (user.role === "staff") {
                        handleDeleteOrder(order.id);
                      } else {
                        setConfirmingDeleteOrder(order.id);
                      }
                    }}
                    className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors mr-auto"
                    title="Supprimer la commande"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
                {order.customer?.phone_number && (
                  <button
                    onClick={() =>
                      window.open(`tel:${order.customer?.phone_number}`)
                    }
                    className="px-4 py-2 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-lg text-xs font-bold hover:bg-green-100 dark:hover:bg-green-900/40 flex items-center"
                  >
                    <Phone size={14} className="mr-2" /> Appeler
                  </button>
                )}
                <button
                  onClick={() => openChat(order)}
                  className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg text-xs font-bold hover:bg-blue-100 dark:hover:bg-blue-900/40 flex items-center"
                >
                  <MessageSquare size={14} className="mr-2" /> Message Client
                </button>

                {order.status === "pending" && (
                  <>
                    <button
                      onClick={() => {
                        const hasDeletionPassword =
                          !!restaurant.settings?.orderDeletionPassword;
                        if (user.role === "staff" || hasDeletionPassword) {
                          setPinVerification({
                            isOpen: true,
                            title: "Mot de passe requis",
                            onSuccess: () =>
                              updateOrderStatus(order.id, "cancelled"),
                            error: "",
                            value: "",
                            isLoading: false,
                          });
                        } else {
                          updateOrderStatus(order.id, "cancelled");
                        }
                      }}
                      className="px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-xs font-bold hover:bg-red-100 dark:hover:bg-red-900/40"
                    >
                      Refuser
                    </button>
                    <button
                      onClick={() => updateOrderStatus(order.id, "preparing")}
                      className="px-4 py-2 bg-brand-600 text-white rounded-lg text-xs font-bold hover:bg-brand-700 shadow-md"
                    >
                      Accepter & Cuisiner
                    </button>
                  </>
                )}
                {order.status === "preparing" && (
                  <button
                    onClick={() => updateOrderStatus(order.id, "ready")}
                    className="px-4 py-2 bg-orange-500 text-white rounded-lg text-xs font-bold hover:bg-orange-600 shadow-md"
                  >
                    Marquer Prêt
                  </button>
                )}
                {order.status === "ready" && (
                  <div className="flex flex-col gap-2">
                    {order.delivery_person_id ? (
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center space-x-2 text-xs text-green-600 font-bold bg-green-50 dark:bg-green-900/20 px-3 py-2 rounded-lg">
                          <Bike size={14} />
                          <span>
                            Assigné à:{" "}
                            {deliveryPersonnel.find(
                              (p) => p.id === order.delivery_person_id,
                            )?.name || "Livreur"}
                          </span>
                          <button
                            onClick={() =>
                              updateOrderStatus(order.id, "delivering")
                            }
                            className="px-4 py-2 bg-brand-600 text-white rounded-lg text-xs font-bold hover:bg-brand-700 shadow-md flex items-center justify-center"
                          >
                            <Navigation size={14} className="mr-2" /> Confirmer
                            l'expédition
                          </button>
                        </div>
                        <button
                          onClick={() => setIsAssigningDelivery(order.id)}
                          className="ml-4 text-brand-600 dark:text-brand-400 hover:underline text-xs"
                        >
                          Changer
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setIsAssigningDelivery(order.id)}
                        className="px-4 py-2 bg-brand-100 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 rounded-lg text-xs font-bold hover:bg-brand-200 dark:hover:bg-brand-900/40 flex items-center justify-center"
                      >
                        <UserPlus size={14} className="mr-2" /> Assigner un
                        livreur
                      </button>
                    )}
                    {isAssigningDelivery === order.id && (
                      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 shadow-lg animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-2">
                          <h4 className="text-xs font-black text-gray-900 dark:text-white uppercase">
                            Choisir un livreur
                          </h4>
                          <button
                            onClick={() => setIsAssigningDelivery(null)}
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                          >
                            <X size={14} />
                          </button>
                        </div>
                        <div className="max-h-40 overflow-y-auto space-y-1">
                          {deliveryPersonnel.length === 0 ? (
                            <p className="text-[10px] text-gray-500 py-2">
                              Aucun livreur disponible
                            </p>
                          ) : (
                            deliveryPersonnel.map((p) => (
                              <button
                                key={p.id}
                                onClick={() =>
                                  assignDeliveryPerson(order.id, p.id)
                                }
                                className={`w-full text-left p-2 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-lg text-xs font-medium flex items-center justify-between group ${
                                  p.deliveryInfo?.isAvailable
                                    ? "text-gray-700 dark:text-gray-200"
                                    : "opacity-50 grayscale cursor-not-allowed"
                                }`}
                                disabled={!p.deliveryInfo?.isAvailable}
                              >
                                <div className="flex flex-col">
                                  <span>{p.name}</span>
                                  <div className="flex items-center space-x-1.5 mt-0.5">
                                    <span
                                      className={`w-1.5 h-1.5 rounded-full ${p.deliveryInfo?.isAvailable ? "bg-green-500" : "bg-red-500"}`}
                                    />
                                    <span className="text-[9px] text-gray-400 uppercase font-bold">
                                      {p.deliveryInfo?.vehicleType || "Moto"}
                                    </span>
                                  </div>
                                </div>
                                <ChevronRight
                                  size={12}
                                  className="text-gray-300 group-hover:text-brand-600"
                                />
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )}

                    <button
                      onClick={() => updateOrderStatus(order.id, "delivering")}
                      className="px-4 py-2 bg-blue-500 text-white rounded-lg text-xs font-bold hover:bg-blue-600 shadow-md"
                    >
                      En Livraison
                    </button>
                  </div>
                )}
                {order.status === "delivering" && (
                  <button
                    onClick={() => updateOrderStatus(order.id, "completed")}
                    className="px-4 py-2 bg-green-500 text-white rounded-lg text-xs font-bold hover:bg-green-600 shadow-md"
                  >
                    Terminer (Livré)
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Voice Assistant for Orders */}
      <div className="fixed bottom-24 right-8 z-40">
        <button
          onClick={() => setIsVoiceActive(!isVoiceActive)}
          className={`w-16 h-16 rounded-full flex items-center justify-center shadow-2xl transition-all transform hover:scale-110 ${
            isVoiceActive ? "bg-red-500 animate-pulse" : "bg-brand-600"
          } text-white`}
        >
          {isVoiceActive ? <MicOff size={28} /> : <Mic size={28} />}
        </button>
        {isVoiceActive && (
          <div className="absolute bottom-20 right-0 w-64 bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-2xl border border-brand-100 dark:border-brand-900/30 animate-in slide-in-from-bottom-4">
            <div className="flex items-center space-x-2 mb-2">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-ping"></div>
              <span className="text-xs font-bold text-gray-900 dark:text-white tracking-widest">
                Assistant vocal actif
              </span>
            </div>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight">
              Dites "Accepter la commande #123" ou "Marquer prête" pour
              contrôler le dashboard à la voix.
            </p>
          </div>
        )}
      </div>
    </div>
  );

  const [adjustingStockItem, setAdjustingStockItem] = useState<MenuItem | null>(
    null,
  );
  const [newStockValue, setNewStockValue] = useState("");

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingStockItem) return;

    const newStock = parseInt(newStockValue);
    if (isNaN(newStock) || newStock < 0) {
      toast.error("Veuillez entrer une valeur de stock valide.");
      return;
    }

    try {
      const { error } = await supabase
        .from("menu_items")
        .update({ stock: newStock })
        .eq("id", adjustingStockItem.id);

      if (error) throw error;

      const updatedMenu = restaurant.menu.map((m) =>
        m.id === adjustingStockItem.id ? { ...m, stock: newStock } : m,
      );
      onUpdateRestaurant({ ...restaurant, menu: updatedMenu });
      toast.success("Stock mis à jour !");
      setAdjustingStockItem(null);
      setNewStockValue("");
    } catch (err) {
      console.error("Error updating stock:", err);
      toast.error("Erreur lors de la mise à jour du stock.");
    }
  };

  const renderSalesAndInventory = () => {
    let filteredOrders = completedOrders;
    if (salesStartDate) {
      filteredOrders = filteredOrders.filter(
        (o) => new Date(o.createdAt) >= new Date(salesStartDate),
      );
    }
    if (salesEndDate) {
      const end = new Date(salesEndDate);
      end.setHours(23, 59, 59, 999);
      filteredOrders = filteredOrders.filter(
        (o) => new Date(o.createdAt) <= end,
      );
    }

    const filteredRevenue = filteredOrders.reduce(
      (sum, o) => sum + o.totalAmount,
      0,
    );

    const filteredProductSales: Record<
      string,
      { name: string; quantity: number; revenue: number }
    > = {};
    filteredOrders.forEach((order) => {
      order.items.forEach((item) => {
        if (!filteredProductSales[item.id]) {
          filteredProductSales[item.id] = {
            name: item.name,
            quantity: 0,
            revenue: 0,
          };
        }
        filteredProductSales[item.id].quantity += item.quantity;
        filteredProductSales[item.id].revenue += item.price * item.quantity;
      });
    });
    const filteredTopSellingProducts = Object.values(filteredProductSales)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    const chartData = [];
    if (salesStartDate && salesEndDate) {
      const start = new Date(salesStartDate);
      const end = new Date(salesEndDate);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      const daysToShow = Math.min(diffDays + 1, 30);

      for (let i = 0; i < daysToShow; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        const dateStr = d.toISOString().split("T")[0];
        const dayRevenue = completedOrders
          .filter(
            (o) =>
              new Date(o.createdAt).toISOString().split("T")[0] === dateStr,
          )
          .reduce((sum, o) => sum + o.totalAmount, 0);
        chartData.push({
          name: d.toLocaleDateString("fr-FR", {
            day: "2-digit",
            month: "2-digit",
          }),
          ventes: dayRevenue,
        });
      }
    } else if (salesStartDate) {
      const d = new Date(salesStartDate);
      const dateStr = d.toISOString().split("T")[0];
      const dayRevenue = completedOrders
        .filter(
          (o) => new Date(o.createdAt).toISOString().split("T")[0] === dateStr,
        )
        .reduce((sum, o) => sum + o.totalAmount, 0);
      chartData.push({
        name: d.toLocaleDateString("fr-FR", {
          day: "2-digit",
          month: "2-digit",
        }),
        ventes: dayRevenue,
      });
    } else {
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split("T")[0];
        const dayRevenue = completedOrders
          .filter(
            (o) =>
              new Date(o.createdAt).toISOString().split("T")[0] === dateStr,
          )
          .reduce((sum, o) => sum + o.totalAmount, 0);
        chartData.push({
          name: d.toLocaleDateString("fr-FR", { weekday: "short" }),
          ventes: dayRevenue,
        });
      }
    }

    return (
      <FeatureGate feature="advancedStats">
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">
          <h2 className="text-3xl font-display font-bold text-gray-900 dark:text-white tracking-tighter italic mb-8">
            Ventes & inventaire
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="glass p-8 rounded-[32px] border border-white/20 dark:border-white/5 lg:col-span-2 shadow-2xl">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-6">
                <h3 className="font-display font-bold text-xl text-gray-900 dark:text-white flex items-center italic tracking-tight">
                  <TrendingUp
                    size={24}
                    className="mr-3 text-brand-600 drop-shadow-[0_0_8px_rgba(225,29,72,0.4)]"
                  />{" "}
                  Aperçu analytique
                </h3>
                <div className="flex items-center space-x-2 glass p-2 rounded-2xl border border-white/20 shadow-inner">
                  <input
                    type="date"
                    value={salesStartDate}
                    onChange={(e) => setSalesStartDate(e.target.value)}
                    className="bg-transparent text-xs font-bold text-gray-700 dark:text-gray-200 outline-none border-none px-2"
                  />
                  <span className="text-gray-400 font-bold">→</span>
                  <input
                    type="date"
                    value={salesEndDate}
                    onChange={(e) => setSalesEndDate(e.target.value)}
                    className="bg-transparent text-xs font-bold text-gray-700 dark:text-gray-200 outline-none border-none px-2"
                  />
                  {(salesStartDate || salesEndDate) && (
                    <button
                      onClick={() => {
                        setSalesStartDate("");
                        setSalesEndDate("");
                      }}
                      className="p-1.5 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-lg hover:bg-red-200 transition-all active:scale-90"
                      title="Réinitialiser"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-10">
                <div className="glass p-5 rounded-2xl border border-white/10 shadow-sm">
                  <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 tracking-[0.15em] mb-2 leading-none">
                    {salesStartDate || salesEndDate
                      ? "Période filtrée"
                      : "Total revenus"}
                  </p>
                  <p className="text-3xl font-display font-bold text-gray-900 dark:text-white tracking-tighter italic">
                    $
                    {(salesStartDate || salesEndDate
                      ? filteredRevenue
                      : revenue
                    ).toLocaleString("fr-FR", { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="glass p-5 rounded-2xl border border-white/10 shadow-sm relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-brand-500/10 rounded-full -mr-12 -mt-12 blur-2xl group-hover:bg-brand-500/20 transition-all"></div>
                  <p className="text-[10px] font-bold text-brand-600 dark:text-brand-400 tracking-[0.15em] mb-2 leading-none">
                    {salesStartDate || salesEndDate
                      ? "Total global"
                      : "Revenus mensuels"}
                  </p>
                  <p className="text-3xl font-display font-bold text-brand-600 dark:text-brand-400 tracking-tighter italic">
                    $
                    {(salesStartDate || salesEndDate
                      ? revenue
                      : monthlyRevenue
                    ).toLocaleString("fr-FR", { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="glass p-5 rounded-2xl border border-white/10 shadow-sm">
                  <p className="text-[10px] font-bold text-green-600 dark:text-green-400 tracking-[0.15em] mb-2 leading-none">
                    Journée actuelle
                  </p>
                  <p className="text-3xl font-display font-bold text-green-600 dark:text-green-500 tracking-tighter italic">
                    $
                    {dailyRevenue.toLocaleString("fr-FR", {
                      minimumFractionDigits: 2,
                    })}
                  </p>
                </div>
              </div>

              <div className="h-64 w-full mb-8">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#e5e7eb"
                      vertical={false}
                      opacity={0.3}
                    />
                    <XAxis
                      dataKey="name"
                      stroke="#9ca3af"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontWeight: 800, textTransform: "uppercase" }}
                    />
                    <YAxis
                      stroke="#9ca3af"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `$${value}`}
                      tick={{ fontWeight: 800 }}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: "24px",
                        border: "none",
                        boxShadow: "0 25px 50px -12px rgb(0 0 0 / 0.25)",
                        padding: "16px",
                        background: "rgba(255,255,255,0.9)",
                        backdropFilter: "blur(10px)",
                      }}
                      labelStyle={{
                        fontWeight: 900,
                        marginBottom: "8px",
                        textTransform: "uppercase",
                        color: "#111827",
                      }}
                      itemStyle={{ fontWeight: 800, color: "#e11d48" }}
                      formatter={(value: number) => [
                        `$${value.toFixed(2)}`,
                        "CHIFFRE D'AFFAIRES",
                      ]}
                    />
                    <Line
                      type="monotone"
                      dataKey="ventes"
                      stroke="#e11d48"
                      strokeWidth={4}
                      dot={{
                        r: 5,
                        fill: "#e11d48",
                        strokeWidth: 3,
                        stroke: "#fff",
                      }}
                      activeDot={{
                        r: 8,
                        stroke: "#fff",
                        strokeWidth: 4,
                        fill: "#e11d48",
                      }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <h4 className="text-[10px] font-bold text-gray-400 dark:text-gray-500 tracking-widest mb-4">
                Top 5 produits vendus
              </h4>
              <div className="space-y-4">
                {filteredTopSellingProducts.map((product, index) => (
                  <div
                    key={index}
                    className="flex justify-between items-center p-4 glass rounded-2xl border border-white/10 group hover:border-brand-500/30 transition-all"
                  >
                    <div className="flex items-center">
                      <span className="w-8 h-8 rounded-full bg-brand-600 text-white flex items-center justify-center text-xs font-black mr-4 shadow-lg shadow-brand-500/30 italic">
                        #{index + 1}
                      </span>
                      <span className="font-display font-black text-gray-900 dark:text-white uppercase italic tracking-tight">
                        {product.name}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-black text-gray-900 dark:text-white uppercase">
                        {product.quantity} UNITÉTÉS
                      </p>
                      <p className="text-[10px] font-black text-brand-600 uppercase tracking-wider">
                        ${product.revenue.toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
                {filteredTopSellingProducts.length === 0 && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4 italic">
                    Aucune donnée disponible.
                  </p>
                )}
              </div>
            </div>

            <div className="glass p-8 rounded-[32px] border border-white/20 dark:border-white/5 shadow-2xl">
              <h3 className="font-display font-black text-xl text-gray-900 dark:text-white mb-8 flex items-center uppercase italic tracking-tight">
                <Package
                  size={24}
                  className="mr-3 text-brand-600 drop-shadow-[0_0_8px_rgba(225,29,72,0.4)]"
                />{" "}
                Alertes stock
              </h3>
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                {restaurant.menu
                  .filter((item) => item.stock !== undefined)
                  .sort((a, b) => (a.stock || 0) - (b.stock || 0))
                  .map((item) => {
                    const threshold = item.lowStockThreshold || 5;
                    const isLowStock = item.stock! <= threshold;
                    return (
                      <div
                        key={item.id}
                        className={`flex flex-col p-5 rounded-2xl border transition-all ${isLowStock ? "bg-red-500/5 border-red-500/30" : "glass border-white/10 hover:border-white/20"}`}
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <span className="text-sm font-black text-gray-900 dark:text-white uppercase italic tracking-tight block">
                              {item.name}
                            </span>
                            {isLowStock && (
                              <span className="text-[9px] text-red-600 dark:text-red-400 font-black flex items-center mt-1 uppercase tracking-widest animate-pulse">
                                <AlertCircle size={10} className="mr-1" />{" "}
                                CRITIQUE (≤ {threshold})
                              </span>
                            )}
                          </div>
                          <div className="flex items-center space-x-3">
                            <span
                              className={`text-xs font-black px-3 py-1.5 rounded-xl shadow-sm border ${item.stock! > threshold * 2 ? "bg-green-500/10 text-green-600 border-green-500/20" : item.stock! > 0 ? "bg-amber-500/10 text-amber-600 border-amber-500/20" : "bg-red-500/10 text-red-600 border-red-500/20"}`}
                            >
                              {item.stock}{" "}
                              <span className="text-[8px] opacity-60">
                                UNIT.
                              </span>
                            </span>
                            <button
                              onClick={() => {
                                setAdjustingStockItem(item);
                                setNewStockValue(item.stock!.toString());
                              }}
                              className="p-2 text-gray-400 hover:text-brand-600 glass rounded-xl transition-all active:scale-90"
                            >
                              <Settings size={14} />
                            </button>
                          </div>
                        </div>
                        {adjustingStockItem?.id === item.id && (
                          <form
                            onSubmit={handleAdjustStock}
                            className="mt-4 flex items-center space-x-2 animate-in slide-in-from-top-2 duration-300"
                          >
                            <input
                              type="number"
                              className="flex-1 p-2 text-xs font-black bg-white dark:bg-black/20 border border-white/10 rounded-xl outline-none focus:border-brand-500"
                              value={newStockValue}
                              onChange={(e) => setNewStockValue(e.target.value)}
                              min="0"
                            />
                            <button
                              type="submit"
                              className="bg-brand-600 text-white p-2.5 rounded-xl hover:bg-brand-700 shadow-lg shadow-brand-500/20 active:scale-95 transition-all"
                            >
                              <CheckCircle size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setAdjustingStockItem(null)}
                              className="glass text-gray-500 p-2.5 rounded-xl hover:bg-white transition-all"
                            >
                              <X size={14} />
                            </button>
                          </form>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>

          <div className="glass p-8 rounded-[32px] border border-white/20 dark:border-white/5 shadow-2xl mt-12">
            <h3 className="font-display font-black text-xl text-gray-900 dark:text-white mb-8 flex items-center uppercase italic tracking-tight">
              <Receipt
                size={24}
                className="mr-3 text-brand-600 drop-shadow-[0_0_8px_rgba(225,29,72,0.4)]"
              />{" "}
              Historique Transactionnelle
            </h3>
            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">
                      Identifiant
                    </th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">
                      Horodatage
                    </th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">
                      Détenteur
                    </th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">
                      Canal
                    </th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">
                      Volume
                    </th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">
                      Règlement
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredOrders.length > 0 ? (
                    filteredOrders.map((order) => (
                      <tr
                        key={order.id}
                        className="group hover:bg-white/5 transition-colors"
                      >
                        <td className="px-6 py-5 font-mono text-xs font-bold text-gray-900 dark:text-white opacity-60 group-hover:opacity-100 italic">
                          #{order.id.slice(0, 8).toUpperCase()}
                        </td>
                        <td className="px-6 py-5 text-xs font-bold text-gray-500 tracking-tight">
                          {new Date(order.createdAt)
                            .toLocaleDateString("fr-FR", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                            .replace(":", "H")}
                        </td>
                        <td className="px-6 py-5">
                          <span className="text-sm font-bold text-gray-800 dark:text-gray-200 italic tracking-tighter">
                            {order.customerName || "Client anonyme"}
                          </span>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center">
                            {order.paymentMethod === "stripe" ? (
                              <span className="text-[9px] font-bold px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-500 border border-blue-500/20 tracking-widest">
                                Visa/MC
                              </span>
                            ) : order.paymentMethod === "mobile_money" ? (
                              <span className="text-[9px] font-bold px-2.5 py-1 rounded-lg bg-orange-500/10 text-orange-500 border border-orange-500/20 tracking-widest">
                                Mobile
                              </span>
                            ) : (
                              <span className="text-[9px] font-bold px-2.5 py-1 rounded-lg bg-green-500/10 text-green-500 border border-green-500/20 tracking-widest">
                                Liquide
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-5 font-display font-bold text-brand-600 italic">
                          $
                          {order.totalAmount.toLocaleString("fr-FR", {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                        <td className="px-6 py-5">
                          {order.status === "completed" ? (
                            <span className="text-[10px] font-bold px-3 py-1.5 rounded-full bg-green-500/20 text-green-600 border border-green-500/30 tracking-widest drop-shadow-[0_0_5px_rgba(34,197,94,0.3)]">
                              Validé
                            </span>
                          ) : order.status === "cancelled" ? (
                            <span className="text-[10px] font-bold px-3 py-1.5 rounded-full bg-red-500/20 text-red-600 border border-red-500/30 tracking-widest">
                              Annulé
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-3 py-1.5 rounded-full bg-amber-500/20 text-amber-600 border border-amber-500/30 tracking-widest animate-pulse">
                              En cours
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center opacity-30">
                          <Receipt size={48} className="mb-4" />
                          <p className="font-display font-bold tracking-widest text-sm">
                            Aucune transaction
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </FeatureGate>
    );
  };

  const renderAnalytics = () => (
    <FeatureGate feature="aiInsights">
      <div className="space-y-10 animate-in fade-in duration-700 pb-24">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h2 className="text-4xl font-display font-bold text-gray-900 dark:text-white tracking-tighter flex items-center italic">
              <Brain
                className="mr-4 text-brand-600 drop-shadow-[0_0_15px_rgba(225,29,72,0.5)]"
                size={40}
              />
              IA & insights business
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm font-medium tracking-widest mt-2">
              Stratégies prédictives haute précision • Gemini Ultra
            </p>
          </div>
          <button
            onClick={fetchInsights}
            disabled={loadingInsights}
            className="flex items-center space-x-3 bg-brand-600 text-white px-8 py-4 rounded-[20px] font-display font-bold italic tracking-wide hover:bg-brand-700 transition-all shadow-[0_20px_40px_-12px_rgba(225,29,72,0.4)] hover:shadow-[0_25px_50px_-12px_rgba(225,29,72,0.6)] active:scale-95 disabled:opacity-50"
          >
            <RefreshCw
              size={20}
              className={loadingInsights ? "animate-spin" : ""}
            />
            <span>{loadingInsights ? "Synchronisation..." : "Actualiser"}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2 space-y-8">
            {businessInsights.length > 0 ? (
              businessInsights.map((insight, idx) => (
                <div
                  key={idx}
                  className="glass p-8 rounded-[32px] border border-white/20 dark:border-white/5 shadow-2xl hover:border-brand-500/30 transition-all group overflow-hidden relative"
                >
                  <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/5 rounded-full -mr-32 -mt-32 blur-3xl group-hover:bg-brand-500/10 transition-all duration-700"></div>
                  <div className="flex items-start space-x-6 relative z-10">
                    <div
                      className={`p-5 rounded-2xl shadow-inner ${
                        insight.type === "demand"
                          ? "bg-blue-500/10 text-blue-500 border border-blue-500/20"
                          : insight.type === "menu"
                            ? "bg-orange-500/10 text-orange-500 border border-orange-500/20"
                            : "bg-green-500/10 text-green-500 border border-green-500/20"
                      }`}
                    >
                      {insight.type === "demand" ? (
                        <TrendingUp size={30} />
                      ) : insight.type === "menu" ? (
                        <Coffee size={30} />
                      ) : (
                        <Zap size={30} />
                      )}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-display font-bold text-xl text-gray-900 dark:text-white italic tracking-tight mb-3">
                        {insight.title}
                      </h4>
                      <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed mb-6 font-medium">
                        {insight.description}
                      </p>
                      <div className="bg-white/50 dark:bg-black/20 p-6 rounded-2xl border border-white/20 dark:border-white/5 backdrop-blur-sm">
                        <p className="text-[10px] font-bold text-brand-600 dark:text-brand-400 tracking-widest mb-3 flex items-center">
                          <Lightbulb size={14} className="mr-2" /> Directive
                          stratégique
                        </p>
                        <p className="text-sm text-gray-800 dark:text-gray-100 font-bold leading-snug">
                          {insight.action}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="glass p-16 rounded-[40px] border border-dashed border-white/20 dark:border-white/10 text-center flex flex-col items-center justify-center">
                <div className="relative mb-8">
                  <div className="absolute inset-0 bg-brand-500/20 blur-3xl rounded-full scale-150 animate-pulse"></div>
                  <Brain
                    size={80}
                    className="relative text-gray-300 dark:text-gray-600"
                  />
                </div>
                <h4 className="font-display font-bold text-2xl text-gray-900 dark:text-white italic tracking-tight mb-4">
                  Système en attente
                </h4>
                <p className="text-gray-500 dark:text-gray-400 text-sm max-w-sm mx-auto font-medium leading-relaxed">
                  L'intelligence artificielle est prête à analyser vos{" "}
                  {orders.length} dernières transactions pour générer des
                  recommandations personnalisées.
                </p>
              </div>
            )}
          </div>

          <div className="space-y-10">
            <div className="bg-gradient-to-br from-brand-600 to-brand-900 p-8 rounded-[32px] text-white shadow-[0_30px_60px_-15px_rgba(225,29,72,0.5)] relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl group-hover:scale-125 transition-all duration-1000"></div>
              <div className="relative z-10">
                <h4 className="font-display font-bold text-xl italic tracking-tight mb-6 flex items-center">
                  <Zap size={24} className="mr-3" /> Demande prédictive
                </h4>
                <p className="text-brand-100 text-xs font-bold tracking-widest mb-8 opacity-80">
                  Cycle de flux 24H • Temps réel
                </p>
                <div className="space-y-5">
                  {[
                    {
                      time: "12:00 - 14:00",
                      level: "CRITIQUE",
                      color: "bg-white text-brand-700 shadow-xl",
                    },
                    {
                      time: "18:00 - 20:00",
                      level: "ÉLEVÉ",
                      color:
                        "bg-brand-500/40 text-white border border-white/20",
                    },
                    {
                      time: "20:00 - 22:00",
                      level: "MODÉRÉ",
                      color:
                        "bg-brand-900/40 text-white border border-white/20",
                    },
                  ].map((p, i) => (
                    <div
                      key={i}
                      className={`flex items-center justify-between p-4 rounded-2xl backdrop-blur-md transition-all group/item hover:translate-x-1 ${p.color}`}
                    >
                      <span className="text-[10px] font-bold tracking-widest">
                        {p.time}
                      </span>
                      <span className="text-[10px] font-bold tracking-widest">
                        {p.level}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="glass p-8 rounded-[32px] border border-white/20 dark:border-white/5 shadow-2xl">
              <h4 className="font-display font-bold text-gray-900 dark:text-white mb-6 flex items-center italic tracking-tight">
                <AlertTriangle size={20} className="mr-3 text-orange-500" />{" "}
                Alertes stock IA
              </h4>
              <div className="space-y-4">
                {restaurant.menu
                  .filter(
                    (i) =>
                      i.stock !== undefined &&
                      i.stock! <= (i.lowStockThreshold || 5),
                  )
                  .map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-4 bg-red-500/10 rounded-2xl border border-red-500/20 group hover:border-red-500/40 transition-all"
                    >
                      <span className="text-xs font-bold text-red-600 dark:text-red-400 italic tracking-tight">
                        {item.name}
                      </span>
                      <span className="text-[10px] font-bold text-red-700 dark:text-red-300 tracking-widest">
                        {item.stock} réserves
                      </span>
                    </div>
                  ))}
                {restaurant.menu.filter(
                  (i) =>
                    i.stock !== undefined &&
                    i.stock! <= (i.lowStockThreshold || 5),
                ).length === 0 && (
                  <div className="flex flex-col items-center py-8 opacity-40">
                    <CheckCircle size={32} className="text-green-500 mb-3" />
                    <p className="text-[10px] font-bold text-gray-500 tracking-widest">
                      Stock sécurisé
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </FeatureGate>
  );

  const [supportMessages, setSupportMessages] = useState<
    { role: "user" | "ai"; text: string }[]
  >([]);
  const [supportInput, setSupportInput] = useState("");
  const [isSupportLoading, setIsSupportLoading] = useState(false);

  const handleSupportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supportInput.trim() || isSupportLoading) return;

    const userMsg = supportInput;
    setSupportMessages((prev) => [...prev, { role: "user", text: userMsg }]);
    setSupportInput("");
    setIsSupportLoading(true);

    try {
      const response = await getSmartSupportResponse(userMsg, {
        restaurantName: restaurant.name,
        menu: restaurant.menu.map((m) => `${m.name}: ${m.price}$`).join(", "),
        recentOrders: orders
          .slice(0, 5)
          .map((o) => `Order #${o.id.slice(0, 5)}: ${o.status}`)
          .join(", "),
      });
      setSupportMessages((prev) => [...prev, { role: "ai", text: response }]);
    } catch (err) {
      toast.error("Erreur support AI");
    } finally {
      setIsSupportLoading(false);
    }
  };

  const renderSupport = () => (
    <FeatureGate feature="aiInsights">
      <div className="h-[calc(100vh-140px)] flex flex-col glass rounded-[40px] border border-white/20 dark:border-white/5 shadow-2xl overflow-hidden animate-in fade-in duration-700">
        <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/30 dark:bg-black/20 backdrop-blur-xl">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 bg-brand-600 rounded-2xl flex items-center justify-center text-white shadow-[0_10px_20px_-5px_rgba(225,29,72,0.4)] relative group overflow-hidden">
              <div className="absolute inset-0 bg-white/20 -translate-x-full group-hover:translate-x-full transition-transform duration-700 skew-x-12"></div>
              <Bot size={32} className="relative z-10" />
            </div>
            <div>
              <h3 className="font-display font-bold text-xl text-gray-900 dark:text-white italic tracking-tight">
                Assistant stratégique
              </h3>
              <p className="text-[10px] text-brand-600 dark:text-brand-400 font-bold tracking-widest opacity-80">
                Réseau neuronal Gemini Ultra • LIVE
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3 glass px-4 py-2 rounded-2xl border border-white/20">
            <span className="flex h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>
            <span className="text-[10px] font-bold text-gray-400 tracking-widest">
              Opérationnel
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-transparent custom-scrollbar">
          {supportMessages.length === 0 && (
            <div className="text-center py-24 flex flex-col items-center">
              <div className="w-24 h-24 glass rounded-full flex items-center justify-center mb-8 shadow-inner border border-white/20 group relative">
                <div className="absolute inset-0 bg-brand-500/10 blur-2xl rounded-full scale-150 animate-pulse"></div>
                <MessageSquare
                  size={40}
                  className="text-brand-600 relative z-10"
                />
              </div>
              <h4 className="font-display font-bold text-2xl text-gray-900 dark:text-white mb-4 italic tracking-tight">
                Analyse en temps réel
              </h4>
              <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mx-auto font-medium leading-relaxed">
                Optimisez vos opérations avec des conseils basés sur vos flux
                réels. Posez votre première question.
              </p>
            </div>
          )}
          {supportMessages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-in slide-in-from-bottom-4 duration-500`}
            >
              <div
                className={`max-w-[75%] p-6 rounded-[28px] shadow-2xl transition-all hover:scale-[1.01] ${
                  msg.role === "user"
                    ? "bg-brand-600 text-white rounded-tr-none shadow-brand-500/20"
                    : "glass text-gray-800 dark:text-gray-100 rounded-tl-none border border-white/20"
                }`}
              >
                <p className="text-sm leading-relaxed font-medium">
                  {msg.text}
                </p>
              </div>
            </div>
          ))}
          {isSupportLoading && (
            <div className="flex justify-start">
              <div className="glass p-6 rounded-[28px] rounded-tl-none border border-white/20 shadow-xl">
                <div className="flex space-x-2">
                  <div className="w-2 h-2 bg-brand-600 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-brand-600 rounded-full animate-bounce delay-150"></div>
                  <div className="w-2 h-2 bg-brand-600 rounded-full animate-bounce delay-300"></div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 bg-white/30 dark:bg-black/20 border-t border-white/10 backdrop-blur-xl">
          <form
            onSubmit={handleSupportSubmit}
            className="relative flex items-center gap-4"
          >
            <input
              type="text"
              value={supportInput}
              onChange={(e) => setSupportInput(e.target.value)}
              placeholder="Posez une question stratégique..."
              className="flex-1 px-8 py-5 glass border border-white/20 rounded-[28px] focus:ring-4 focus:ring-brand-500/20 dark:text-white outline-none font-medium placeholder:text-gray-400 placeholder:uppercase placeholder:text-[10px] placeholder:tracking-widest"
            />
            <button
              type="submit"
              disabled={!supportInput.trim() || isSupportLoading}
              className="p-5 bg-brand-600 text-white rounded-[24px] hover:bg-brand-700 transition-all disabled:opacity-50 shadow-[0_15px_30px_-5px_rgba(225,29,72,0.4)] active:scale-90"
            >
              <Send size={24} />
            </button>
          </form>
        </div>
      </div>
    </FeatureGate>
  );

  const renderMarketing = () => {
    const completedOrders = orders.filter(
      (o) => o.status === "completed" || o.status === "delivered",
    );
    const totalPoints = completedOrders.reduce(
      (acc, o) => acc + Math.floor(o.totalAmount * 10),
      0,
    );
    const uniqueCustomers = new Set(completedOrders.map((o) => o.userId)).size;
    const rewardsClaimed = Math.floor(totalPoints / 500); // Simple logic: 1 reward per 500 points

    return (
      <FeatureGate feature="autoMarketing">
        <div className="space-y-12 animate-in fade-in duration-700 pb-24">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h2 className="text-4xl font-display font-bold text-gray-900 dark:text-white tracking-tighter flex items-center italic">
                <Megaphone
                  className="mr-4 text-brand-600 drop-shadow-[0_0_15px_rgba(225,29,72,0.5)]"
                  size={40}
                />
                Marketing & Audience
              </h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm font-medium tracking-wide mt-2">
                Expansion du réseau • Engagement communautaire
              </p>
            </div>
            <button
              onClick={() => setIsAddingPromo(!isAddingPromo)}
              className="flex items-center space-x-3 bg-brand-600 text-white px-8 py-4 rounded-[20px] font-display font-bold italic tracking-wide hover:bg-brand-700 transition-all shadow-[0_20px_40px_-12px_rgba(225,29,72,0.4)] hover:shadow-[0_25px_50px_-12px_rgba(225,29,72,0.6)] active:scale-95"
            >
              <Plus size={20} />
              <span>{t("new_story")}</span>
            </button>
          </div>

          {isAddingPromo && (
            <form
              onSubmit={addPromotion}
              className="glass p-10 rounded-[40px] border border-white/20 dark:border-white/5 shadow-2xl animate-in slide-in-from-top-4 duration-500 relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full -mr-48 -mt-48 blur-3xl group-hover:bg-purple-500/20 transition-all duration-1000"></div>
              <h4 className="font-display font-bold text-2xl text-purple-600 dark:text-purple-400 mb-8 flex items-center italic tracking-tight relative z-10">
                <Plus size={24} className="mr-3" /> Nouvelle campagne flash
              </h4>

              {promoError && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-600 dark:text-red-400 text-xs font-black uppercase tracking-widest flex items-center animate-in fade-in slide-in-from-top-2">
                  <AlertCircle size={16} className="mr-3 flex-shrink-0" />
                  <span>{promoError}</span>
                  <button
                    onClick={() => setPromoError(null)}
                    className="ml-auto opacity-50 hover:opacity-100"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 relative z-10">
                <div className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-3 tracking-wide">
                      Sélection du support
                    </label>
                    <div className="flex space-x-4">
                      <label
                        className={`flex-1 flex items-center justify-center space-x-3 cursor-pointer p-5 rounded-2xl border transition-all ${newPromoType === "image" ? "bg-purple-600 border-purple-600 text-white shadow-xl scale-[1.02]" : "glass border-white/20 text-gray-400 hover:border-purple-500/30"}`}
                      >
                        <input
                          type="radio"
                          name="type"
                          className="hidden"
                          checked={newPromoType === "image"}
                          onChange={() => {
                            setNewPromoType("image");
                            setPromoFile(null);
                            setNewPromoUrl("");
                          }}
                        />
                        <ImageIcon size={20} />
                        <span className="font-display font-bold text-sm italic">
                          Image
                        </span>
                      </label>
                      <label
                        className={`flex-1 flex items-center justify-center space-x-3 cursor-pointer p-5 rounded-2xl border transition-all ${newPromoType === "video" ? "bg-purple-600 border-purple-600 text-white shadow-xl scale-[1.02]" : "glass border-white/20 text-gray-400 hover:border-purple-500/30"}`}
                      >
                        <input
                          type="radio"
                          name="type"
                          className="hidden"
                          checked={newPromoType === "video"}
                          onChange={() => {
                            setNewPromoType("video");
                            setPromoFile(null);
                            setNewPromoUrl("");
                          }}
                        />
                        <Video size={20} />
                        <span className="font-display font-bold text-sm italic">
                          Vidéo
                        </span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-[0.2em]">
                      Fichier Média
                    </label>

                    <div className="mb-6">
                      <label
                        className={`cursor-pointer glass border-2 border-dashed transition-all p-10 rounded-[32px] flex flex-col items-center justify-center group/upload ${promoFile ? "border-purple-500 bg-purple-500/5" : "border-white/20 hover:border-purple-500/40"}`}
                      >
                        <div
                          className={`p-5 rounded-full mb-4 transition-all duration-500 ${promoFile ? "bg-purple-600 text-white animate-bounce" : "bg-white/10 text-gray-400 group-hover/upload:scale-110"}`}
                        >
                          <Upload size={32} />
                        </div>
                        <span className="text-xs font-black text-gray-600 dark:text-gray-300 uppercase tracking-widest">
                          {promoFile
                            ? promoFile.name
                            : newPromoType === "video"
                              ? "Charger MP4"
                              : "Charger Visuel"}
                        </span>
                        <input
                          type="file"
                          id="promo-upload"
                          accept={
                            newPromoType === "video" ? "video/*" : "image/*"
                          }
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setPromoFile(file);
                              setNewPromoUrl("");
                              setPromoError(null);
                            }
                          }}
                        />
                        <button
                          type="button"
                          className="absolute inset-0 w-full h-full opacity-0 z-10"
                          onClick={async (e) => {
                            e.preventDefault();
                            if (isCapacitor) {
                              const file = await (newPromoType === 'image'
                                ? pickImage({ asFile: true })
                                : pickFile({ types: ['video/mp4', 'video/quicktime'], asFile: true }));

                              if (file instanceof File) {
                                setPromoFile(file);
                                setNewPromoUrl("");
                                setPromoError(null);
                              }
                            } else {
                              document.getElementById('promo-upload')?.click();
                            }
                          }}
                        />
                      </label>
                    </div>

                    <div className="relative flex py-4 items-center">
                      <div className="flex-grow border-t border-white/10"></div>
                      <span className="flex-shrink-0 mx-6 text-gray-400 text-[10px] font-black uppercase tracking-[0.3em]">
                        OU VIA URL
                      </span>
                      <div className="flex-grow border-t border-white/10"></div>
                    </div>

                    <input
                      type="url"
                      className={`w-full px-6 py-4 glass border border-white/20 rounded-2xl focus:ring-4 focus:ring-purple-500/20 outline-none transition-all ${promoFile ? "opacity-30 cursor-not-allowed" : "dark:text-white focus:border-purple-500/50"}`}
                      placeholder={
                        newPromoType === "video"
                          ? "Format MP4: https://site.com/video.mp4"
                          : "Format Web: https://site.com/img.jpg"
                      }
                      value={newPromoUrl}
                      onChange={(e) => {
                        setNewPromoUrl(e.target.value);
                        if (e.target.value) {
                          setPromoFile(null);
                          setPromoError(null);
                        }
                      }}
                      disabled={!!promoFile}
                    />
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-black text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-[0.2em]">
                      Aperçu de la Campagne
                    </label>
                    <div className="relative aspect-[9/16] w-full max-w-[280px] mx-auto rounded-[32px] overflow-hidden bg-black shadow-2xl border-4 border-white/10 group/preview">
                      {promoFile || newPromoUrl ? (
                        <>
                          {newPromoType === "image" ? (
                            <img
                              src={
                                promoFile
                                  ? URL.createObjectURL(promoFile)
                                  : newPromoUrl
                              }
                              alt="Preview"
                              className="w-full h-full object-cover group-hover/preview:scale-110 transition-transform duration-1000"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <video
                              src={
                                promoFile
                                  ? URL.createObjectURL(promoFile)
                                  : newPromoUrl
                              }
                              autoPlay
                              muted
                              loop
                              className="w-full h-full object-cover"
                            />
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-6">
                            <p className="text-white font-display font-black text-lg uppercase italic tracking-tight line-clamp-3 leading-tight drop-shadow-lg">
                              {newPromoCaption ||
                                "Votre message stratégique..."}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setPromoFile(null);
                              setNewPromoUrl("");
                            }}
                            className="absolute top-4 right-4 bg-red-600/80 backdrop-blur-md text-white p-2 rounded-full shadow-xl hover:bg-red-600 hover:scale-110 transition-all"
                          >
                            <X size={18} />
                          </button>
                        </>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-gray-950/50">
                          <ImageIcon size={48} className="text-white/10 mb-4" />
                          <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">
                            En attente de média
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-[0.2em]">
                      Légende de Campagne
                    </label>
                    <textarea
                      rows={2}
                      className="w-full px-6 py-4 glass border border-white/20 rounded-2xl focus:ring-4 focus:ring-purple-500/20 outline-none dark:text-white transition-all focus:border-purple-500/50 resize-none font-bold placeholder:text-gray-500"
                      placeholder="Décrivez votre offre (ex: -20% sur tout le menu avec le code RÉSEAU)..."
                      value={newPromoCaption}
                      onChange={(e) => setNewPromoCaption(e.target.value)}
                    />
                  </div>

                  <div className="flex justify-end pt-4">
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-purple-600 text-white px-8 py-5 rounded-[24px] font-display font-black uppercase italic tracking-widest hover:bg-purple-700 transition-all shadow-[0_20px_40px_-10px_rgba(147,51,234,0.4)] active:scale-95 disabled:opacity-50 flex items-center justify-center space-x-3"
                    >
                      {loading ? (
                        <RefreshCw className="animate-spin mr-3" />
                      ) : (
                        <Megaphone className="mr-3" />
                      )}
                      <span>
                        {loading ? "DÉPLOIEMENT..." : "LANCER LA RÉGIE"}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </form>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {promotions.map((promo) => (
              <div
                key={promo.id}
                className="group relative aspect-[9/16] rounded-[32px] overflow-hidden shadow-2xl bg-black border border-white/10 group/item transition-all hover:translate-y-[-8px]"
              >
                {promo.mediaType === "video" ? (
                  <video
                    src={promo.mediaUrl}
                    className="w-full h-full object-cover opacity-70 group-hover/item:opacity-90 transition-opacity duration-700"
                    muted
                    autoPlay
                    loop
                  />
                ) : (
                  <img
                    src={promo.mediaUrl}
                    alt="Promo"
                    className="w-full h-full object-cover opacity-70 group-hover/item:opacity-90 transition-opacity duration-700"
                    referrerPolicy="no-referrer"
                  />
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent flex flex-col justify-end p-6 translate-y-4 group-hover/item:translate-y-0 transition-transform duration-500">
                  <p className="text-white font-display font-black text-xl uppercase italic tracking-tight mb-3 leading-none opacity-0 group-hover/item:opacity-100 transition-opacity duration-700 delay-100">
                    {promo.caption || "STORY LIVE"}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                      {new Date(promo.createdAt).toLocaleDateString()}
                    </span>
                    <div className="flex items-center text-brand-500 font-black text-[10px] uppercase tracking-widest">
                      <Zap size={12} className="mr-1" /> ACTIVE
                    </div>
                  </div>
                </div>

                {user.role === "business" && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deletePromotion(promo.id);
                    }}
                    className="absolute top-4 right-4 p-3 bg-red-600 text-white rounded-2xl opacity-0 group-hover/item:opacity-100 transition-all hover:scale-110 shadow-xl"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
            ))}
            {promotions.length === 0 && !isAddingPromo && (
              <div className="col-span-full py-24 glass border-dashed border-2 border-white/10 rounded-[40px] flex flex-col items-center justify-center text-center">
                <Megaphone
                  className="h-20 w-20 text-gray-200 dark:text-gray-700 mb-6 drop-shadow-glow"
                  strokeWidth={1}
                />
                <h4 className="font-display font-black text-2xl text-gray-900 dark:text-white uppercase italic tracking-tight mb-3">
                  Aucune Story Active
                </h4>
                <p className="text-gray-500 dark:text-gray-400 text-sm max-w-xs font-medium uppercase tracking-[0.1em]">
                  Engagez votre audience avec des visuels immersifs dès
                  maintenant.
                </p>
              </div>
            )}
          </div>

          <div className="mt-16 pt-16 border-t border-white/10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-12">
              <div>
                <h3 className="font-display font-black text-3xl text-gray-900 dark:text-white uppercase italic tracking-tighter">
                  Flux de Campagnes IA
                </h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm font-medium uppercase tracking-[0.2em] mt-2">
                  Automatisation des vecteurs d'engagement
                </p>
              </div>
              <button
                onClick={() => setIsAddingCampaign(true)}
                className="flex items-center space-x-3 bg-white dark:bg-black/50 text-brand-600 dark:text-brand-400 border border-brand-500/30 px-8 py-4 rounded-[20px] font-display font-black uppercase italic tracking-widest hover:bg-brand-600 hover:text-white transition-all shadow-xl active:scale-95"
              >
                <Plus size={20} />
                <span>Nouvelle campagne</span>
              </button>
            </div>

            {(isAddingCampaign || editingCampaign) && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                    {editingCampaign
                      ? "Modifier la campagne"
                      : "Créer une campagne"}
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Nom de la campagne
                      </label>
                      <input
                        type="text"
                        value={newCampaignName}
                        onChange={(e) => setNewCampaignName(e.target.value)}
                        className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                        placeholder="Ex: Relance panier"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Déclencheur
                      </label>
                      <select
                        value={newCampaignTrigger}
                        onChange={(e) =>
                          setNewCampaignTrigger(e.target.value as any)
                        }
                        className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                      >
                        <option value="abandoned_cart">
                          Panier abandonné (après 2h)
                        </option>
                        <option value="dormant_30_days">
                          Client inactif (30 jours)
                        </option>
                        <option value="birthday">Anniversaire du client</option>
                        <option value="new_customer">
                          Nouveau client (Bienvenue)
                        </option>
                        <option value="loyal_customer">
                          Client fidèle (5+ commandes)
                        </option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Message de la notification
                      </label>
                      <textarea
                        value={newCampaignMessage}
                        onChange={(e) => setNewCampaignMessage(e.target.value)}
                        className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none resize-none h-24"
                        placeholder="Ex: Vous avez oublié quelque chose ! Profitez de -10% pour finaliser votre commande."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Réduction (%)
                      </label>
                      <input
                        type="number"
                        value={newCampaignDiscount}
                        onChange={(e) =>
                          setNewCampaignDiscount(Number(e.target.value))
                        }
                        className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                        min="0"
                        max="100"
                      />
                    </div>
                  </div>
                  <div className="mt-6 flex justify-end space-x-3">
                    <button
                      onClick={() => {
                        setIsAddingCampaign(false);
                        setEditingCampaign(null);
                        setNewCampaignName("");
                        setNewCampaignMessage("");
                        setNewCampaignDiscount(10);
                      }}
                      className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl font-medium transition-colors"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={handleSaveCampaign}
                      disabled={isSavingCampaign}
                      className="px-4 py-2 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 transition-colors disabled:opacity-50"
                    >
                      {isSavingCampaign
                        ? "Enregistrement..."
                        : editingCampaign
                          ? "Modifier"
                          : "Créer"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {isAddingReward && (
              <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-gray-100 dark:border-gray-700 animate-in zoom-in-95 duration-200">
                  <div className="p-6">
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center">
                        <Gift size={24} className="mr-2 text-brand-600" />
                        Nouvelle récompense
                      </h3>
                      <button
                        onClick={() => setIsAddingReward(false)}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                      >
                        <X size={24} />
                      </button>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Nom de la récompense
                        </label>
                        <input
                          type="text"
                          value={newRewardName}
                          onChange={(e) => setNewRewardName(e.target.value)}
                          placeholder="Ex: Burger Offert"
                          className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Points requis
                        </label>
                        <input
                          type="number"
                          value={newRewardPoints}
                          onChange={(e) =>
                            setNewRewardPoints(Number(e.target.value))
                          }
                          className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                          min="1"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Description
                        </label>
                        <textarea
                          value={newRewardDesc}
                          onChange={(e) => setNewRewardDesc(e.target.value)}
                          placeholder="Décrivez la récompense..."
                          className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none h-24 resize-none"
                        />
                      </div>
                    </div>
                    <div className="mt-6 flex justify-end space-x-3">
                      <button
                        onClick={() => setIsAddingReward(false)}
                        className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl font-medium transition-colors"
                      >
                        Annuler
                      </button>
                      <button
                        onClick={handleSaveReward}
                        disabled={isSavingReward}
                        className="px-4 py-2 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 transition-colors disabled:opacity-50"
                      >
                        {isSavingReward ? "Enregistrement..." : "Enregistrer"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Campaign Management Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {automatedCampaigns.map((campaign) => (
                <div
                  key={campaign.id}
                  className="glass p-8 rounded-[32px] border border-white/20 dark:border-white/5 shadow-2xl relative group overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500/5 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-brand-500/10 transition-all duration-700"></div>
                  <div className="flex justify-between items-start mb-6">
                    <div
                      className={`p-4 rounded-2xl shadow-inner ${
                        campaign.trigger_type === "abandoned_cart"
                          ? "bg-orange-500/10 text-orange-500 border border-orange-500/20"
                          : campaign.trigger_type === "dormant_30_days"
                            ? "bg-blue-500/10 text-blue-500 border border-blue-500/20"
                            : campaign.trigger_type === "new_customer"
                              ? "bg-green-500/10 text-green-500 border border-green-500/20"
                              : campaign.trigger_type === "loyal_customer"
                                ? "bg-purple-500/10 text-purple-500 border border-purple-500/20"
                                : "bg-pink-500/10 text-pink-500 border border-pink-500/20"
                      }`}
                    >
                      {campaign.trigger_type === "abandoned_cart" ? (
                        <ShoppingCart size={24} />
                      ) : campaign.trigger_type === "dormant_30_days" ? (
                        <Clock size={24} />
                      ) : campaign.trigger_type === "new_customer" ? (
                        <UserPlus size={24} />
                      ) : campaign.trigger_type === "loyal_customer" ? (
                        <Award size={24} />
                      ) : (
                        <Gift size={24} />
                      )}
                    </div>
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() =>
                          handleToggleCampaign(campaign.id, campaign.is_active)
                        }
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-500 ${campaign.is_active ? "bg-green-500" : "bg-gray-300 dark:bg-white/10"}`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-transform duration-500 ${campaign.is_active ? "translate-x-6" : "translate-x-1"}`}
                        />
                      </button>
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        {campaign.is_active ? "Active" : "Hormis"}
                      </span>
                    </div>
                  </div>
                  <h4 className="font-display font-bold text-xl text-gray-900 dark:text-white italic tracking-tight mb-2">
                    {campaign.name}
                  </h4>
                  <p className="text-gray-500 dark:text-gray-400 text-[10px] font-bold tracking-widest leading-relaxed mb-6 line-clamp-2">
                    {campaign.message_body}
                  </p>

                  <div className="flex items-center justify-between pt-6 border-t border-white/10">
                    <div className="text-[10px] font-black uppercase tracking-widest">
                      <span className="text-brand-600 text-lg mr-2 italic">
                        -{campaign.discount_percentage}%
                      </span>{" "}
                      VECTEUR
                    </div>
                    <div className="flex items-center space-x-4">
                      <button
                        onClick={() => {
                          setEditingCampaign(campaign);
                          setNewCampaignName(campaign.name);
                          setNewCampaignTrigger(campaign.trigger_type);
                          setNewCampaignMessage(campaign.message_body);
                          setNewCampaignDiscount(campaign.discount_percentage);
                        }}
                        className="text-brand-600 dark:text-brand-400 text-[10px] font-black hover:scale-105 transition-transform uppercase tracking-widest border-b-2 border-brand-500/30"
                      >
                        Modifier
                      </button>
                      {user.role === "business" && (
                        <button
                          onClick={() => handleDeleteCampaign(campaign.id)}
                          className="p-2 text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {automatedCampaigns.length === 0 && (
                <div className="col-span-full py-16 glass border-dashed border-2 border-white/10 rounded-[32px] flex flex-col items-center justify-center text-center">
                  <Zap
                    className="mx-auto h-16 w-16 text-gray-200 dark:text-gray-700 mb-6 drop-shadow-glow"
                    strokeWidth={1}
                  />
                  <h4 className="font-display font-black text-xl text-gray-900 dark:text-white uppercase italic tracking-tight mb-2">
                    Cycle d'automatisation vide
                  </h4>
                  <p className="text-gray-500 dark:text-gray-400 text-[10px] font-black uppercase tracking-widest">
                    Lancez vos premières campagnes de rétention IA.
                  </p>
                </div>
              )}
            </div>

            {/* Loyalty Program Section */}
            <div className="mt-12 group">
              <div className="bg-gradient-to-br from-brand-600 to-brand-900 p-12 rounded-[48px] text-white shadow-[0_40px_80px_-20px_rgba(225,29,72,0.4)] relative overflow-hidden transition-all duration-700 hover:scale-[1.01]">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-white/10 rounded-full -mr-250 -mt-250 blur-[120px] group-hover:bg-white/20 transition-all duration-1000"></div>
                <div className="absolute bottom-0 left-0 w-96 h-96 bg-brand-400/20 rounded-full -ml-48 -mb-48 blur-[100px]"></div>

                <div className="relative z-10">
                  <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-10">
                    <div className="max-w-xl">
                      <h3 className="text-5xl font-display font-bold mb-6 flex items-center tracking-tighter italic">
                        <Star
                          size={44}
                          className="mr-6 text-yellow-500 fill-yellow-500 drop-shadow-[0_0_15px_rgba(234,179,8,0.6)]"
                        />
                        Fidélité maximale
                      </h3>
                      <p className="text-brand-100 text-lg font-medium leading-relaxed opacity-80 italic">
                        Levier stratégique pour transformer vos clients
                        occasionnels en ambassadeurs Premium via une économie de
                        jetons numériques.
                      </p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
                      <button
                        onClick={() => setIsAddingReward(true)}
                        className="bg-white text-brand-700 px-10 py-5 rounded-[24px] font-display font-black text-sm uppercase italic tracking-widest hover:bg-brand-50 transition-all shadow-2xl active:scale-95"
                      >
                        <Gift className="inline mr-2" size={18} /> Ajouter une
                        récompense
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mt-16">
                    <div className="bg-white/10 p-8 rounded-[32px] backdrop-blur-xl border border-white/20 shadow-inner group/stat hover:bg-white/20 transition-all">
                      <p className="text-[10px] font-bold tracking-[0.3em] text-brand-200 mb-2 transition-colors">
                        Vecteur audience
                      </p>
                      <p className="text-5xl font-display font-bold italic tracking-tighter">
                        {loyaltyPoints.length ||
                          uniqueCustomers.toLocaleString()}
                      </p>
                      <div className="mt-4 h-1 w-12 bg-yellow-500 rounded-full group-hover/stat:w-24 transition-all duration-500"></div>
                    </div>
                    <div className="bg-white/10 p-8 rounded-[32px] backdrop-blur-xl border border-white/20 shadow-inner group/stat hover:bg-white/20 transition-all">
                      <p className="text-[10px] font-bold tracking-[0.3em] text-brand-200 mb-2 transition-colors">
                        Capital point réseau
                      </p>
                      <p className="text-5xl font-display font-bold italic tracking-tighter">
                        {loyaltyPoints.reduce((acc, p) => acc + p.points, 0) ||
                          totalPoints.toLocaleString()}
                      </p>
                      <div className="mt-4 h-1 w-12 bg-brand-400 rounded-full group-hover/stat:w-24 transition-all duration-500"></div>
                    </div>
                    <div className="bg-white/10 p-8 rounded-[32px] backdrop-blur-xl border border-white/20 shadow-inner group/stat hover:bg-white/20 transition-all">
                      <p className="text-[10px] font-bold tracking-[0.3em] text-brand-200 mb-2 transition-colors">
                        Catalogue actif
                      </p>
                      <p className="text-5xl font-display font-bold italic tracking-tighter">
                        {loyaltyRewards.length || "00"}
                      </p>
                      <div className="mt-4 h-1 w-12 bg-white rounded-full group-hover/stat:w-24 transition-all duration-500"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Loyalty Rewards List */}
            <div className="mt-16">
              <div className="flex items-center space-x-4 mb-10">
                <div className="h-0.5 w-12 bg-brand-600"></div>
                <h4 className="font-display font-bold text-2xl text-gray-900 dark:text-white italic tracking-tight">
                  Récompenses du réseau
                </h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {loyaltyRewards.map((reward) => (
                  <div
                    key={reward.id}
                    className="glass p-8 rounded-[32px] border border-white/20 dark:border-white/5 shadow-2xl relative group hover:border-brand-500/30 transition-all"
                  >
                    <div className="flex justify-between items-start mb-6">
                      <h5 className="font-display font-bold text-xl text-gray-900 dark:text-white italic tracking-tight">
                        {reward.name}
                      </h5>
                      <span className="bg-yellow-500/10 text-yellow-600 dark:bg-yellow-500/20 dark:text-yellow-400 text-[10px] font-bold px-4 py-2 rounded-full border border-yellow-500/20 tracking-widest">
                        {reward.points_required} points
                      </span>
                    </div>
                    <p className="text-gray-500 dark:text-gray-400 text-[11px] font-bold tracking-widest leading-relaxed mb-8 line-clamp-3">
                      {reward.description}
                    </p>
                    <div className="flex items-center justify-between pt-6 border-t border-white/10">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                        {reward.id.slice(0, 8)} REGISTRY
                      </span>
                      {user.role === "business" && (
                        <button
                          onClick={() => handleDeleteReward(reward.id)}
                          className="p-3 bg-red-500/10 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-all shadow-xl group-hover:scale-110"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {loyaltyRewards.length === 0 && (
                  <div className="col-span-full py-16 glass border-dashed border-2 border-white/10 rounded-[40px] flex flex-col items-center justify-center text-center opacity-50">
                    <Gift
                      size={48}
                      className="text-gray-400 mb-4"
                      strokeWidth={1}
                    />
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                      Répertoire vide
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Top Customers Section */}
            <div className="mt-12">
              <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center">
                <Award size={20} className="mr-2 text-brand-600" />
                Top Clients Fidèles
              </h4>
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-900/50">
                    <tr>
                      <th className="px-6 py-3 font-bold text-gray-500 dark:text-gray-400">
                        Client
                      </th>
                      <th className="px-6 py-3 font-bold text-gray-500 dark:text-gray-400">
                        Points
                      </th>
                      <th className="px-6 py-3 font-bold text-gray-500 dark:text-gray-400 text-right">
                        Dernière commande
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {loyaltyPoints.map((p, idx) => (
                      <tr
                        key={p.id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 flex items-center justify-center font-bold mr-3">
                              {idx + 1}
                            </div>
                            <div>
                              <p className="font-bold text-gray-900 dark:text-white">
                                {(Array.isArray(p.profiles)
                                  ? p.profiles[0]?.full_name
                                  : p.profiles?.full_name) ||
                                  (Array.isArray(p.profiles)
                                    ? p.profiles[0]?.email
                                    : p.profiles?.email) ||
                                  profilesCache[p.user_id]?.full_name ||
                                  `Client #${p.user_id?.slice(0, 4)}`}
                              </p>
                              <p className="text-[10px] text-gray-500">
                                {(Array.isArray(p.profiles)
                                  ? p.profiles[0]?.email
                                  : p.profiles?.email) ||
                                  profilesCache[p.user_id]?.email ||
                                  "Email non renseigné"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-black text-brand-600 dark:text-brand-400">
                            {p.points}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right text-gray-500 text-xs">
                          {new Date(p.updated_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                    {loyaltyPoints.length === 0 && (
                      <tr>
                        <td
                          colSpan={3}
                          className="px-6 py-10 text-center text-gray-500 italic"
                        >
                          En attente des premières commandes pour calculer la
                          fidélité.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Add Reward Modal */}
            {isAddingReward && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                    Ajouter une récompense
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Nom de la récompense
                      </label>
                      <input
                        type="text"
                        value={newRewardName}
                        onChange={(e) => setNewRewardName(e.target.value)}
                        className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                        placeholder="Ex: Dessert gratuit"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Points requis
                      </label>
                      <input
                        type="number"
                        value={newRewardPoints}
                        onChange={(e) =>
                          setNewRewardPoints(Number(e.target.value))
                        }
                        className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                        min="1"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Description
                      </label>
                      <textarea
                        value={newRewardDesc}
                        onChange={(e) => setNewRewardDesc(e.target.value)}
                        className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none resize-none h-24"
                        placeholder="Ex: Valable sur tous les desserts de la carte."
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => setIsAddingReward(false)}
                      className="px-4 py-3 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-2xl font-black text-xs uppercase tracking-widest transition-colors"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={handleSaveReward}
                      disabled={isSavingReward || !newRewardName}
                      className="px-4 py-3 bg-brand-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-brand-700 transition-all shadow-lg shadow-brand-500/20 disabled:opacity-50"
                    >
                      {isSavingReward ? "CHARGEMENT..." : "ENREGISTRER"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </FeatureGate>
    );
  };

  const renderEmailModal = () => {
    if (!emailModal.isOpen) return null;

    return (
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-300 border border-gray-100 dark:border-gray-700">
          <div className="bg-brand-600 p-6 text-white flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                <Mail size={24} />
              </div>
              <div>
                <h3 className="text-xl font-black">Envoyer un Email</h3>
                <p className="text-xs text-white/80">
                  Communication directe avec {emailModal.recipientName}
                </p>
              </div>
            </div>
            <button
              onClick={() =>
                setEmailModal((prev) => ({ ...prev, isOpen: false }))
              }
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          <div className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                Destinataire
              </label>
              <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 text-gray-600 dark:text-gray-300 text-sm font-medium">
                {emailModal.recipientName} (
                {emailModal.recipientEmail || "Email non disponible"})
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                Sujet
              </label>
              <input
                type="text"
                value={emailModal.subject}
                onChange={(e) =>
                  setEmailModal((prev) => ({
                    ...prev,
                    subject: e.target.value,
                  }))
                }
                className="w-full px-4 py-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none transition-all text-sm dark:text-white"
                placeholder="Sujet de votre message..."
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                Message
              </label>
              <textarea
                value={emailModal.message}
                onChange={(e) =>
                  setEmailModal((prev) => ({
                    ...prev,
                    message: e.target.value,
                  }))
                }
                rows={6}
                className="w-full px-4 py-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none transition-all text-sm dark:text-white resize-none"
                placeholder="Écrivez votre message ici..."
              />
            </div>

            <div className="flex space-x-3 pt-2">
              <button
                onClick={() =>
                  setEmailModal((prev) => ({ ...prev, isOpen: false }))
                }
                className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleSendManualEmail}
                disabled={emailModal.isSending || !emailModal.recipientEmail}
                className="flex-1 py-3 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 transition-colors shadow-lg shadow-brand-600/20 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {emailModal.isSending ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <Send size={18} className="mr-2" />
                    Envoyer
                  </>
                )}
              </button>
            </div>
            {!emailModal.recipientEmail && (
              <p className="text-[10px] text-red-500 text-center font-medium">
                <AlertCircle size={10} className="inline mr-1" />
                Impossible d'envoyer : cet utilisateur n'a pas d'adresse email
                enregistrée.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <DashboardContext.Provider
      value={{ restaurant, setActiveView, setSettingsSubView }}
    >
      <div className="min-h-[100dvh] bg-gray-50 dark:bg-gray-900 flex transition-colors duration-300">
        {renderNotificationsModal()}
        {renderEmailModal()}

        {showNotification && (
          <div
            className="fixed top-4 right-4 z-[100] bg-white dark:bg-gray-800 border-l-4 border-brand-600 shadow-xl rounded-lg p-4 animate-in slide-in-from-right duration-300 flex items-center max-w-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
            onClick={() => {
              setShowNotification(false);
              navigateTo("orders");
            }}
          >
            <div className="bg-brand-100 dark:bg-brand-900/30 p-2 rounded-full mr-3 text-brand-600 dark:text-brand-400">
              <Bell size={20} />
            </div>
            <div>
              <h4 className="font-bold text-gray-900 dark:text-white text-sm">
                Nouvelle Commande !
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Un client vient de passer commande.
              </p>
            </div>
          </div>
        )}

        {activeChatOrder && (
          <ChatWindow
            orderId={activeChatOrder.id}
            currentUser={{
              id: user.role === "staff" ? restaurant.ownerId : user.id,
              role: "business",
              name: restaurant.name,
            }}
            otherUserId={activeChatOrder.userId}
            otherUserName={activeChatOrder.customer?.full_name || "Client"}
            otherUserPhone={activeChatOrder.customer?.phone_number || ""}
            restaurantId={restaurant.id}
            onClose={closeChat}
          />
        )}

        {activeChatSubscriber && (
          <ChatWindow
            orderId={`sub-${activeChatSubscriber.user_id}-${restaurant.id}`}
            currentUser={{
              id: user.role === "staff" ? restaurant.ownerId : user.id,
              role: "business",
              name: restaurant.name,
            }}
            otherUserId={activeChatSubscriber.user_id}
            otherUserName={
              (Array.isArray(activeChatSubscriber.profiles)
                ? activeChatSubscriber.profiles[0]?.full_name
                : activeChatSubscriber.profiles?.full_name) || "Abonné"
            }
            otherUserPhone={
              (Array.isArray(activeChatSubscriber.profiles)
                ? activeChatSubscriber.profiles[0]?.phone_number
                : activeChatSubscriber.profiles?.phone_number) || ""
            }
            restaurantId={restaurant.id}
            onClose={closeChat}
          />
        )}

        {/* DELETE CONFIRMATION MODAL */}
        {confirmingDeleteOrder && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setConfirmingDeleteOrder(null)}
            ></div>
            <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden relative z-10 animate-in fade-in zoom-in duration-200">
              <div className="p-6 text-center">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle
                    size={32}
                    className="text-red-600 dark:text-red-400"
                  />
                </div>
                <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2 uppercase tracking-tight">
                  Supprimer la commande ?
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 leading-relaxed">
                  Cette action est irréversible. Toutes les données liées
                  (messages, avis, notifications) seront également supprimées.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setConfirmingDeleteOrder(null)}
                    className="py-3 px-4 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={() => handleDeleteOrder(confirmingDeleteOrder)}
                    className="py-3 px-4 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 shadow-lg shadow-red-500/30 transition-transform active:scale-95"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <aside className="hidden md:flex w-72 flex-col glass border-r border-white/20 dark:border-white/5 h-screen sticky top-0 transition-all duration-500 z-50">
          <div className="p-8 border-b border-white/10">
            <div className="flex items-center space-x-3 mb-6">
              <div className="bg-white p-2 rounded-2xl shadow-xl ring-1 ring-black/5">
                <img
                  src={APP_LOGO_URL}
                  alt="DashMeals"
                  className="h-10 w-auto object-contain"
                />
              </div>
              <h1 className="text-2xl font-display font-black tracking-tighter text-gray-900 dark:text-white leading-none uppercase italic">
                DashMeals
              </h1>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <p className="text-[9px] text-brand-600 font-black uppercase tracking-[0.2em] mb-1">
                  PARTENAIRE RÉSEAU
                </p>
                <div className="flex items-center">
                  <span className="text-sm font-black text-gray-900 dark:text-white flex items-center">
                    {user.name}
                    {restaurant.isVerified && (
                      <CheckCircle2
                        size={14}
                        className="ml-1.5 text-blue-500 drop-shadow-sm"
                        title="Entreprise Vérifiée"
                      />
                    )}
                  </span>
                  <div className="ml-2 w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" title="En ligne"></div>
                </div>
              </div>
              <button
                onClick={() => setIsNotificationsOpen(true)}
                className="relative p-2.5 text-gray-500 hover:bg-white dark:hover:bg-white/5 hover:shadow-sm rounded-2xl transition-all active:scale-90"
              >
                <Bell size={20} />
                {unreadNotificationsCount > 0 && (
                  <span className="absolute top-2 right-2 w-4 h-4 bg-brand-600 text-white text-[9px] font-black flex items-center justify-center rounded-full border-2 border-white dark:border-gray-800 animate-bounce">
                    {unreadNotificationsCount}
                  </span>
                )}
              </button>
            </div>
          </div>
          <nav className="flex-1 p-4 space-y-2">
            {renderSidebarItem(
              "overview",
              <LayoutDashboard size={20} />,
              t("overview"),
            )}
            {renderSidebarItem(
              "orders",
              <ShoppingBag size={20} />,
              t("orders"),
              pendingOrdersCount,
            )}
            {renderSidebarItem("reviews", <Star size={20} />, "Avis Clients")}
            {renderSidebarItem(
              "support",
              <MessageSquare size={20} />,
              "Support Client IA",
            )}
            {renderSidebarItem("menu", <Coffee size={20} />, t("menu"))}
            {renderSidebarItem(
              "sales",
              <TrendingUp size={20} />,
              "Ventes & Inventaire",
            )}
            {renderSidebarItem(
              "analytics",
              <Brain size={20} />,
              "IA & Insights",
            )}
            {renderSidebarItem(
              "marketing",
              <Megaphone size={20} />,
              t("marketing"),
            )}
            {renderSidebarItem(
              "marketplace",
              <Package size={20} />,
              "Marketplace",
            )}
            {renderSidebarItem(
              "subscribers",
              <Users size={20} />,
              "Abonnés",
              followers.length,
            )}
            {renderSidebarItem("team", <UserIcon size={20} />, "Équipe")}
            {renderSidebarItem(
              "settings",
              <Settings size={20} />,
              t("settings"),
            )}

            <div className="pt-4 mt-4 border-t border-gray-100 dark:border-gray-800">
              <button
                onClick={openHelpCenter}
                className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
              >
                <HelpCircle size={20} />
                <span className="font-medium">Centre d'aide</span>
              </button>
            </div>
          </nav>
          <div className="p-4 border-t border-gray-100 dark:border-gray-700">
            <button
              onClick={onLogout}
              className="w-full flex items-center justify-center space-x-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-lg transition-colors font-medium text-sm"
            >
              <LogOut size={16} />
              <span>{t("logout")}</span>
            </button>
          </div>
        </aside>

        <div className="md:hidden fixed top-0 left-0 right-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 z-50 px-4 py-3 flex justify-between items-center transition-colors duration-300">
          <div className="flex items-center space-x-2">
            <div className="bg-white p-1 rounded-md shadow-sm border border-gray-100 dark:border-gray-700">
              <img
                src={APP_LOGO_URL}
                alt="DashMeals"
                className="h-6 w-auto object-contain"
              />
            </div>
            <h1 className="text-lg font-black tracking-tight text-gray-900 dark:text-white leading-none">
              DashMeals
            </h1>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsNotificationsOpen(true)}
              className="relative p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all"
            >
              <Bell size={20} />
              {unreadNotificationsCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white dark:border-gray-800">
                  {unreadNotificationsCount}
                </span>
              )}
            </button>
            <button
              onClick={toggleSidebar}
              className="p-2 text-gray-600 dark:text-gray-300"
            >
              {isSidebarOpen ? <X /> : <LayoutDashboard />}
            </button>
          </div>
        </div>

        {isSidebarOpen && (
          <div
            className="md:hidden fixed inset-0 z-40 bg-gray-800/50 backdrop-blur-sm"
            onClick={closeSidebar}
          >
            <div
              className="w-3/4 h-full bg-white dark:bg-gray-800 p-4 space-y-2 pt-20 transition-colors duration-300 overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-6 px-4">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Connecté en tant que
                </p>
                <div className="flex items-center space-x-2">
                  <p className="font-bold text-gray-800 dark:text-white">
                    {user.name}
                  </p>
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" title="En ligne"></div>
                </div>
              </div>
              {renderSidebarItem(
                "overview",
                <LayoutDashboard size={20} />,
                t("overview"),
              )}
              {renderSidebarItem(
                "orders",
                <ShoppingBag size={20} />,
                t("orders"),
                pendingOrdersCount,
              )}
              {renderSidebarItem("reviews", <Star size={20} />, "Avis Clients")}
              {renderSidebarItem(
                "support",
                <MessageSquare size={20} />,
                "Support Client IA",
              )}
              {renderSidebarItem("menu", <Coffee size={20} />, t("menu"))}
              {renderSidebarItem(
                "sales",
                <TrendingUp size={20} />,
                "Ventes & Inventaire",
              )}
              {renderSidebarItem(
                "analytics",
                <Brain size={20} />,
                "IA & Insights",
              )}
              {renderSidebarItem(
                "marketing",
                <Megaphone size={20} />,
                t("marketing"),
              )}
              {renderSidebarItem(
                "marketplace",
                <Package size={20} />,
                "Marketplace",
              )}
              {renderSidebarItem(
                "subscribers",
                <Users size={20} />,
                "Abonnés",
                followers.length,
              )}
              {renderSidebarItem("team", <UserIcon size={20} />, "Équipe")}
              {renderSidebarItem(
                "settings",
                <Settings size={20} />,
                t("settings"),
              )}

              <div className="pt-4 mt-4 border-t border-gray-100 dark:border-gray-800">
                <button
                  onClick={() => {
                    openHelpCenter();
                    closeSidebar();
                  }}
                  className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
                >
                  <HelpCircle size={20} />
                  <span className="font-medium">Centre d'aide</span>
                </button>
              </div>

              <button
                onClick={onLogout}
                className="w-full flex items-center space-x-3 px-4 py-3 text-red-500 mt-10"
              >
                <LogOut size={20} /> <span>{t("logout")}</span>
              </button>
            </div>
          </div>
        )}

        <main className="flex-1 p-6 md:p-10 pt-20 md:pt-10 overflow-y-auto h-screen">
          {activeView === "overview" && renderOverview()}
          {activeView === "orders" && renderOrders()}
          {activeView === "reviews" && renderReviews()}
          {activeView === "menu" && renderMenu()}
          {activeView === "sales" && renderSalesAndInventory()}
          {activeView === "analytics" && renderAnalytics()}
          {activeView === "support" && renderSupport()}
          {activeView === "marketing" && renderMarketing()}
          {activeView === "marketplace" && renderMarketplace()}
          {activeView === "subscribers" && renderSubscribers()}
          {activeView === "team" && renderTeam()}
          {activeView === "billing" && renderBillingView()}
          {activeView === "settings" && renderSettings()}
        </main>

        {/* HELP CENTER OVERLAY */}
        {isHelpCenterOpen && (
          <HelpCenter user={user} onClose={closeHelpCenter} />
        )}

        {/* PIN Setup Dialog */}
        <PinSetupDialog
          isOpen={isPinSetupOpen}
          onClose={() => setIsPinSetupOpen(false)}
          onConfirm={(pin) => {
            setAppLockEnabled(true);
            setAppLockPin(pin);
            saveAdvancedSettings({ appLockEnabled: true, appLockPin: pin });
            setIsPinSetupOpen(false);
            toast.success("Code PIN configuré avec succès !");
          }}
        />

        {renderPinVerificationModal()}

        {isPayingSubscription && selectedPlan && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-300 max-h-[95vh] flex flex-col">
              <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center flex-shrink-0">
                <div>
                  <h3 className="text-xl font-black text-gray-900 dark:text-white">
                    Finaliser l'abonnement
                  </h3>
                  <p className="text-sm text-gray-500">
                    {selectedPlan.name} •{" "}
                    <span className="text-brand-600 font-bold">
                      ${selectedPlan.price}/mois
                    </span>
                  </p>
                </div>
                <button
                  onClick={() => {
                    setIsPayingSubscription(false);
                    setIsPaymentFormExpanded(false);
                  }}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="p-6 overflow-y-auto custom-scrollbar">
                <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-4">
                  Mode de Paiement
                </label>
                <div className="grid grid-cols-2 gap-4 mb-8">
                  <button
                    onClick={() => setSelectedPaymentMethod("card")}
                    className={`p-4 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all ${selectedPaymentMethod === "card" ? "border-brand-600 bg-brand-50/50 dark:bg-brand-900/10" : "border-gray-100 dark:border-gray-700 hover:border-gray-200"}`}
                  >
                    <CreditCard
                      className={
                        selectedPaymentMethod === "card"
                          ? "text-brand-600"
                          : "text-gray-400"
                      }
                      size={24}
                    />
                    <span
                      className={`text-xs font-bold ${selectedPaymentMethod === "card" ? "text-brand-600" : "text-gray-500"}`}
                    >
                      Carte Bancaire
                    </span>
                  </button>
                  <button
                    disabled
                    className="p-4 rounded-2xl border-2 border-gray-50 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 flex flex-col items-center justify-center gap-2 opacity-60 cursor-not-allowed group relative"
                  >
                    <Smartphone className="text-gray-300" size={24} />
                    <span className="text-xs font-bold text-gray-400">
                      Mobile Money
                    </span>
                    <div className="absolute -top-2 -right-2 bg-gray-200 dark:bg-gray-700 text-[8px] font-black px-2 py-0.5 rounded-full uppercase text-gray-500">
                      Bientôt
                    </div>
                  </button>
                </div>

                {selectedPaymentMethod === "card" ? (
                  <div className="animate-in slide-in-from-bottom-2 duration-300 space-y-4">
                    <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800 rounded-xl flex items-start gap-3">
                      <Info className="text-blue-600 mt-0.5" size={16} />
                      <p className="text-[10px] text-blue-800 dark:text-blue-300 leading-relaxed font-medium">
                        L'abonnement sera activé immédiatement après la
                        validation de votre paiement par Stripe.
                      </p>
                    </div>

                    <button
                      onClick={() =>
                        setIsPaymentFormExpanded(!isPaymentFormExpanded)
                      }
                      className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-2xl border border-gray-100 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all group"
                    >
                      <div className="flex items-center">
                        <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/30 text-brand-600 flex items-center justify-center mr-3">
                          <CreditCard size={16} />
                        </div>
                        <span className="text-sm font-black text-gray-900 dark:text-white">
                          Informations de Paiement
                        </span>
                      </div>
                      <ChevronDown
                        size={20}
                        className={`text-gray-400 transition-transform duration-300 ${isPaymentFormExpanded ? "rotate-180" : ""}`}
                      />
                    </button>

                    {isPaymentFormExpanded && (
                      <div className="pt-2 animate-in slide-in-from-top-2 duration-300">
                        <StripePayment
                          planId={selectedPlan.id}
                          restaurantId={restaurant.id}
                          initialAmount={selectedPlan.price}
                          currency="USD"
                          onSuccess={handleSubscriptionSuccess}
                          onCancel={() => setIsPayingSubscription(false)}
                          language={language}
                        />
                      </div>
                    )}

                    {!isPaymentFormExpanded && (
                      <p className="text-[10px] text-center text-gray-400 italic">
                        Cliquez sur le bouton ci-dessus pour dérouler le
                        formulaire de carte
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="py-12 text-center space-y-4">
                    <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto text-gray-400">
                      <Smartphone size={32} />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 dark:text-white">
                        Mobile Money Indisponible
                      </h4>
                      <p className="text-xs text-gray-500 max-w-[200px] mx-auto">
                        Le paiement par Mobile Money est en cours d'intégration.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardContext.Provider>
  );
};
