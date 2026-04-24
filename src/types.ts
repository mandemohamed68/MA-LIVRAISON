export interface AppConfig {
  mode: 'test' | 'prod';
  updatedAt: string;
}

export type UserRole = 'client' | 'driver' | 'admin' | 'superadmin';

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
  accountStatus?: 'active' | 'suspended';
  currentLocation?: {
    lat: number;
    lng: number;
  };
  // Driver specific
  licensePlate?: string;
  vehicleType?: 'moto' | 'tricycle' | 'camionnette';
  isVerified?: boolean;
  walletBalance?: number; // Virtual wallet for commission/cash
  driverType?: 'freelance' | 'company';
  parentCompanyId?: string; // If driver belongs to a company
  withdrawalRequested?: boolean;
  withdrawalAmount?: number;
  withdrawalMethod?: 'mobile_money' | 'cash';
  withdrawalPhone?: string;
  createdAt: string;
}

export type DeliveryStatus = 'pending' | 'accepted' | 'picked_up' | 'delivered' | 'cancelled';

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
  from: {
    lat: number;
    lng: number;
    address: string;
    indications?: string;
  };
  to: {
    lat: number;
    lng: number;
    address: string;
    indications?: string;
  };
  senderPhone?: string;
  recipientPhone?: string;
  packageDetails?: PackageDetails;
  baseCost?: number; // New: system generated cost
  clientProposedPrice?: number; // New: manual price set by client
  cost?: number; // Accepted final cost
  status: DeliveryStatus;
  paymentMethod: 'cash' | 'mobile_money' | 'card';
  isPaid?: boolean;
  paidToDriver?: boolean;
  paidToDriverAt?: string;
  pickupCode?: string;
  deliveryCode?: string;
  hasInsurance?: boolean;
  insuranceCost?: number;
  rating?: number;
  feedback?: string;
  
  // Imprévus et Exceptions
  isWeatherPaused?: boolean;
  sosAlert?: boolean;
  sosReason?: string;

  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  deliveryId: string;
  senderId: string;
  text: string;
  timestamp: string;
}

export interface TrackingPoint {
  lat: number;
  lng: number;
  timestamp: string;
}
