
import React from 'react';
// Fix: Change type-only import to a regular import to use VehicleType as a value.
import { VehicleType } from './types';
import { Car, Snowflake, Bus, Award, Bike, User } from 'lucide-react';

export const ORS_API_KEY = '5b3ce3597851110001cf6248e12d4b05e23f4f36be3b1b7f7c69a82a';

export const VEHICLE_ICONS: { [key in VehicleType]: React.FC<any> } = {
  [VehicleType.Regular]: Car,
  [VehicleType.AC]: Snowflake,
  [VehicleType.Public]: User,
  [VehicleType.VIP]: Award,
  [VehicleType.Microbus]: Bus,
  [VehicleType.Motorcycle]: Bike,
};

export const SYRIAN_PROVINCES = [
  "دمشق", "ريف دمشق", "حلب", "حمص", "حماة", "اللاذقية", "طرطوس", "دير الزور", "الحسكة", "الرقة", "إدلب", "درعا", "السويداء", "القنيطرة"
];
