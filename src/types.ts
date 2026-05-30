export interface AppConfig {
  mode: 'test' | 'prod';
  updatedAt: string;
  maintenanceMessage?: string;
  isMaintenanceMode?: boolean;
  ussdSyntaxOrange?: string;
  ussdSyntaxMoov?: string;
  ussdSyntaxTelecel?: string;
  ussdSyntaxCoris?: string;
  ussdSyntaxGeneric?: string;
  isOtpActive?: boolean;
  isUssdActive?: boolean;
  isCashActive?: boolean;
  isCardActive?: boolean;
  isOrangeActive?: boolean;
  isMoovActive?: boolean;
  isTelecelActive?: boolean;
  isCorisActive?: boolean;
  sappayClientId?: string;
  sappayClientSecret?: string;
  sappayUsername?: string;
  sappayPassword?: string;
}

export interface Sector {
  id: string;
  name: string;
  city: string;
  isActive: boolean;
}

export interface AppAnnouncement {
  id: string;
  title: string;
  message: string;
  targetRole: 'all' | 'client' | 'driver';
  type: 'info' | 'warning' | 'success';
  activeUntil: string;
  createdAt: string;
}

export type UserRole = 'client' | 'driver' | 'admin' | 'superadmin';

export interface DistancePricingRule {
  id: string;
  minKm: number;
  maxKm: number;
  price: number;
}

export interface CommissionSettings {
  id: 'global_config';
  platformFeePercent: number;
  driverSharePercent: number;
  minDeliveryCost: number;
  insuranceFeePercent: number;
  tarifKm: number;
  tarifPoids: number;
  fraisFixes: number;
  minRatioClient: number; // e.g. 0.7 for 70%
  maxRatioLivreur: number; // e.g. 2.0 for 200%
  maxSimultaneousDeliveries?: number; // admin defined limit
  distancePricingRules?: DistancePricingRule[];
  driverMinBalance?: number;
  withdrawalMinAmount?: number;
  promoEnabled?: boolean;
  promoRules?: { maxKm: number; price: number }[];
  updatedAt: string;
  updatedBy: string;
}

export interface UserProfile {
  userId: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  status?: 'online' | 'offline' | 'busy';
  accountStatus?: 'active' | 'suspended' | 'pending_approval';
  city?: string;
  neighborhood?: string;
  performanceScore?: number; // 0-100 score based on reliability
  cancellationRate?: number; // percentage
  totalEarnings?: number;
  dailyGoal?: number;
  idCardFront?: string;
  idCardBack?: string;
  address?: string;
  termsAcceptedAt?: string;
  sectors?: string[];
  favoriteAddresses?: {
    id: string;
    label: string;
    address: string;
    lat: number;
    lng: number;
    precision?: string;
  }[];
  currentLocation?: {
    lat: number;
    lng: number;
  };
  // Driver specific
  licensePlate?: string;
  vehicleType?: 'moto' | 'tricycle' | 'camionnette';
  isVerified?: boolean;
  verificationStatus?: 'pending' | 'verified' | 'rejected';
  identityCardUrl?: string; // Existing: idCardFront/Back
  identityCardBackUrl?: string;
  criminalRecordUrl?: string;
  guarantorName?: string;
  guarantorPhone?: string;
  guarantorCniUrl?: string;
  walletBalance?: number; 
  driverType?: 'freelance' | 'company';
  parentCompanyId?: string; // If driver belongs to a company
  withdrawalRequested?: boolean;
  withdrawalAmount?: number;
  withdrawalMethod?: 'mobile_money' | 'cash';
  withdrawalPhone?: string;
  totalWithdrawn?: number;
  updatedAt?: string;
  avatar?: string;
  photoURL?: string;
  displayName?: string;
  rib?: string;
  createdAt: string;
}

export type DeliveryStatus = 'pending' | 'accepted' | 'ready_for_pickup' | 'picked_up' | 'delivered' | 'cancelled';

export interface PackageDetails {
  size: 'small' | 'medium' | 'large';
  weightStr: string;
  contentCategory?: string;
  isFragile: boolean;
  valueDeclared?: number;
}

export interface DeliveryBid {
  id: string;
  deliveryId: string;
  driverId: string;
  driverName: string;
  vehicleType: string;
  price: number;
  timeEstimateMins: number;
  reason?: string;
  createdAt: string;
  status?: 'pending' | 'rejected' | 'accepted';
}

export interface DeliveryRequest {
  id: string;
  clientId: string;
  clientName: string;
  driverId?: string;
  driverName?: string;
  vehicleType?: 'moto' | 'tricycle' | 'camionnette';
  from: {
    lat: number;
    lng: number;
    address: string;
    precision?: string;
  };
  to: {
    lat: number;
    lng: number;
    address: string;
    precision?: string;
  };
  senderPhone?: string;
  recipientPhone?: string;
  packageDetails?: PackageDetails;
  baseCost?: number; // New: system generated cost
  clientProposedPrice?: number; // New: manual price set by client
  cost?: number; // Accepted final cost
  status: DeliveryStatus;
  paymentMethod: 'cash' | 'mobile_money' | 'card' | 'aggregator' | 'ussd' | 'orange' | 'moov' | 'telecel' | 'coris' | 'orange_ussd' | 'moov_ussd' | 'telecel_ussd';
  paymentStatus?: 'pending' | 'confirmed' | 'rejected' | 'pending_approval' | 'paid';
  paymentReference?: string;
  isPaid?: boolean;
  paidToDriver?: boolean;
  paidToDriverAt?: string;
  pickupCode?: string;
  deliveryCode?: string;
  hasInsurance?: boolean;
  insuranceCost?: number;
  rating?: number;
  feedback?: string;
  proofImage?: string;
  
  // Urgent & Priority
  isUrgent?: boolean;
  urgentFee?: number;
  boostAmount?: number; // Extra money added by client to speed up pickup
  
  // Imprévus et Exceptions
  isWeatherPaused?: boolean;
  sosAlert?: boolean;
  sosReason?: string;
  rejectedBy?: string[]; // IDs of drivers who declined this mission
  bids?: DeliveryBid[];
  lastMessageAt?: string;
  clientPhone?: string;
  notes?: string;
  cancelReason?: string;

  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  senderRole: 'client' | 'driver' | 'admin';
  createdAt: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  link?: string;
  isRead: boolean;
  createdAt: string;
}

export interface TrackingPoint {
  lat: number;
  lng: number;
  timestamp: string;
}
