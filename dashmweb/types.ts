
export interface Location {
  latitude: number;
  longitude: number;
}

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  category: 'entrée' | 'plat' | 'boisson' | 'dessert';
  isAvailable: boolean;
  stock?: number;
  lowStockThreshold?: number;
}

export type BusinessType = 'restaurant' | 'bar' | 'terrasse' | 'snack';

export interface Promotion {
  id: string;
  restaurantId: string;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  caption?: string;
  createdAt: string;
}

export type Currency = 'USD' | 'CDF';

export type MobileMoneyNetwork = 'mpesa' | 'airtel' | 'orange';

export interface RestaurantPaymentConfig {
  acceptCash: boolean;
  acceptMobileMoney: boolean;
  acceptMoneyFusion?: boolean;
  mpesaNumber?: string;
  airtelNumber?: string;
  orangeNumber?: string;
}

export interface Restaurant {
  id: string;
  ownerId: string; // Lien avec le compte entreprise
  type: BusinessType;
  name: string;
  description: string;
  latitude: number;
  longitude: number;
  city: string; // Ville de l'établissement
  currency: Currency; // Devise par défaut
  exchangeRate?: number; // Taux de change (USD -> CDF) spécifique à l'établissement
  displayCurrencyMode?: 'dual' | 'usd' | 'cdf'; // Comment afficher le prix (Duo, Uniquement USD, Uniquement CDF)
  isOpen: boolean;
  rating: number; // 1-5
  reviewCount: number;
  preparationTime: number; // in minutes
  estimatedDeliveryTime: number; // in minutes (Temps moyen de livraison)
  deliveryAvailable: boolean;
  coverImage: string;
  phoneNumber?: string; // Ajout pour l'appel
  menu: MenuItem[];
  promotions?: Promotion[]; // Stories actives
  paymentConfig?: RestaurantPaymentConfig;
  isVerified?: boolean; // Badge de vérification
  verificationRequested?: boolean; // Demande de vérification envoyée par l'admin
  subscriptionTier?: 'free' | 'basic' | 'premium' | 'enterprise'; // Niveau d'abonnement
  subscriptionStatus?: 'active' | 'past_due' | 'canceled' | 'incomplete';
  subscriptionEndDate?: string;
  createdAt?: string; // Date de création du compte
  settings?: SecuritySettings;
  // Verification fields
  verificationStatus?: 'unverified' | 'pending' | 'verified' | 'rejected';
  verificationDocs?: {
    idCardUrl?: string;
    registryNumber?: string;
  };
  verificationPaymentStatus?: 'unpaid' | 'paid';
  // Calculated fields
  distance?: number; // km
  timeWalking?: number; // minutes
  timeMoto?: number; // minutes
}

export interface CartItem extends MenuItem {
  quantity: number;
  restaurantId: string;
  restaurantName: string;
  isUrgent?: boolean;
  paymentMethod?: PaymentMethod;
  paymentNetwork?: MobileMoneyNetwork;
  paymentStatus?: 'pending' | 'paid' | 'failed';
  paymentProof?: string;
  customerName?: string;
  customerPhone?: string;
  deliveryLocation?: {
    lat: number;
    lng: number;
    address: string;
  };
}

export type ViewMode = 'list' | 'map' | 'restaurant_detail' | 'checkout' | 'success' | 'orders' | 'settings' | 'delivery_onboarding';

export interface UserState {
  location: Location | null;
  locationError: string | null;
  loadingLocation: boolean;
}

// Auth Types
export type UserRole = 'client' | 'business' | 'superadmin' | 'guest' | 'staff' | 'delivery';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  city: string; // Ville de résidence
  phoneNumber?: string; // Ajout pour l'appel
  businessId?: string; // Si c'est un compte business ou staff
  deliveryApplicationStatus?: 'none' | 'pending' | 'approved' | 'rejected'; // Statut de la demande pour devenir livreur
  staffRole?: 'admin' | 'manager' | 'cook' | 'delivery';
  settings?: SecuritySettings;
  deliveryInfo?: {
    vehicleType: 'moto' | 'velo' | 'voiture' | 'pieton';
    isAvailable: boolean;
    bio?: string;
    rating?: number;
    completedOrders?: number;
  };
}

// Order Types
export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'delivering' | 'delivered' | 'completed' | 'cancelled';
export type PaymentMethod = 'cash' | 'mobile_money' | 'money_fusion';

export interface Order {
  id: string;
  userId: string;
  restaurantId: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentNetwork?: MobileMoneyNetwork;
  paymentStatus: 'pending' | 'paid' | 'failed';
  paymentProof?: string;
  totalAmount: number;
  exchangeRate?: number; // Taux de change appliqué à la commande
  isUrgent?: boolean;
  items: CartItem[];
  createdAt: string;
  deliveryLocation?: {
    lat: number;
    lng: number;
    address: string;
  };
  proof_url?: string;
  delivery_person_id?: string;
  delivery_lat?: number;
  delivery_lng?: number;
  // Optional joined fields for display
  restaurant?: {
    name: string;
    phone_number?: string;
    latitude?: number;
    longitude?: number;
  };
  customer?: {
    full_name: string;
    phone_number?: string;
  };
}

// Chat Types
export interface Message {
  id: string;
  orderId: string;
  senderId: string;
  content: string;
  createdAt: string;
  isRead: boolean;
  isLocal?: boolean;
}

// App Settings Types
export type Theme = 'light' | 'dark';
export type Language = 'fr' | 'en' | 'ln'; // Français, Anglais, Lingala
export type AppFont = 'inter' | 'roboto' | 'opensans' | 'lato' | 'montserrat' | 'poppins' | 'quicksand' | 'playfair' | 'facebook';

export interface SecuritySettings {
  notifPush: boolean;
  notifEmail: boolean;
  notifSms: boolean;
  twoFactorEnabled: boolean;
  appLockEnabled: boolean;
  appLockPin?: string;
  biometricsEnabled: boolean;
  privacyProfile?: 'public' | 'private';
  privacyStories?: 'everyone' | 'followers';
}

export interface StaffMember {
  id: string;
  restaurant_id: string;
  user_id?: string;
  name: string;
  role: 'admin' | 'manager' | 'cook' | 'delivery';
  pin_code?: string;
  created_at: string;
}

export interface AutomatedCampaign {
  id: string;
  restaurant_id: string;
  trigger_type: 'abandoned_cart' | 'dormant_30_days' | 'birthday';
  discount_percentage: number;
  is_active: boolean;
  created_at: string;
}

export interface AppSettings {
  support_email: string;
  support_phone: string;
  support_whatsapp: string;
  office_address: string;
}
