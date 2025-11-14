import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { getSettings, checkSchemaVersion } from '../services/supabase';
import type { AppSettings } from '../types';
import { VehicleType } from '../types';

// These are the default values from the DB schema script
export const defaultSettings: AppSettings = {
    id: 1,
    base_fare_syp: 2000,
    per_km_fare_syp: 500,
    app_commission_percentage: 15,
    vehicle_multipliers: {
        [VehicleType.Regular]: 1,
        [VehicleType.AC]: 1.2,
        [VehicleType.Public]: 0.8,
        [VehicleType.VIP]: 2.0,
        [VehicleType.Microbus]: 1.5,
        [VehicleType.Motorcycle]: 0.6,
    },
    manager_phone: '0912345678',
};

interface SettingsContextType {
  settings: AppSettings;
  loading: boolean;
  error: string | null;
  refetchSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType>({
  settings: defaultSettings,
  loading: true,
  error: null,
  refetchSettings: async () => {},
});

export const useSettings = () => useContext(SettingsContext);

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = async () => {
    setLoading(true);
    setError(null);
    try {
        // Step 1: Proactively check if the database schema is up-to-date.
        // This is more robust than just trying to fetch settings.
        const schemaCheck = await checkSchemaVersion();

        if (!schemaCheck.is_up_to_date) {
            // The RPC function not existing is a clear sign the DB isn't set up at all or is very old.
             if (schemaCheck.error && schemaCheck.error.includes('does not exist')) {
                setError("SETUP_REQUIRED: Database not initialized.");
             } else {
                // The function exists but returns false, meaning the schema is old (e.g., missing activation_code).
                setError("SCHEMA_OUTDATED: Your database schema is out of date. Please run the setup script.");
             }
             setSettings(defaultSettings);
             setLoading(false);
             return;
        }

        // Step 2: If schema is OK, get the actual settings.
        const data = await getSettings();
        if (data) {
          setSettings(data);
        } else {
          // This can happen if the settings table is empty, which is also a setup issue.
          setError("SETUP_REQUIRED: Settings table is empty.");
          setSettings(defaultSettings);
        }
    } catch (e) {
        const err = e as Error;
        console.error("Network error fetching settings:", err);
        setError(`NETWORK_ERROR: ${err.message}`);
        setSettings(defaultSettings);
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, loading, error, refetchSettings: fetchSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};
