
export type UserRole = 'customer' | 'driver' | 'province_admin' | 'super_admin';

export interface User {
  id: string;
  name: string;
  phone: string;
  role: UserRole;
  province?: string;
  is_verified: boolean;
  created_at: string;
  activation_code?: string | null;
}

export enum VehicleType {
  Regular = 'سيارة خاصة عادية',
  AC = 'سيارة خاصة مكيفة',
  Public = 'سيارة عامة',
  VIP = 'سيارة VIP',
  Microbus = 'ميكرو باص',
  Motorcycle = 'دراجة',
}

export type TripStatus = 'requested' | 'accepted' | 'driver_arrived' | 'in_progress' | 'completed' | 'cancelled' | 'scheduled';

export interface Trip {
  id: string;
  customer_id: string;
  driver_id?: string;
  status: TripStatus;
  pickup_location: { lat: number; lng: number };
  dropoff_location: { lat: number; lng: number };
  pickup_address: string;
  dropoff_address: string;
  distance_meters: number;
  estimated_cost: number;
  final_cost?: number;
  vehicle_type: VehicleType;
  created_at: string;
  scheduled_at?: string;
  completed_at?: string;
}

export interface Notification {
  id: string;
  user_id: string;
  message: string;
  created_at: string;
  is_read: boolean;
}

export interface AppSettings {
    id: number;
    base_fare_syp: number;
    per_km_fare_syp: number;
    app_commission_percentage: number;
    vehicle_multipliers: { [key in VehicleType]: number };
    manager_phone: string;
}