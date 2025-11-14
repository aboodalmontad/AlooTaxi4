
import React from 'react';
// Fix: Change type-only import to a regular import to use VehicleType as a value.
import { VehicleType } from './types';
import { Car, Snowflake, Bus, Award, Bike, User } from 'lucide-react';

export const ORS_API_KEY = '5b3ce3597851110001cf6248a3c573524b074a38920b41992520f272';

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
