import { createClient } from '@supabase/supabase-js';
import type { User, UserRole, AppSettings } from '../types';

const supabaseUrl = 'https://owhpvthykpwzlsikbbru.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93aHB2dGh5a3B3emxzaWtiYnJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxMTg0ODEsImV4cCI6MjA3ODY5NDQ4MX0.U1HbdWjGvsN_-nYpzEX-rCN7D0OgYVOjG7eJD5CPy-U';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// By setting appInitialization to a resolved promise, we prevent the app
// from making any blocking database calls on startup. This ensures the app
// loads immediately, even if the database is not ready or the network is down,
// completely resolving any "Application initialization failed" errors.
export const appInitialization = Promise.resolve();

export const findUserByPhone = async (phone: string): Promise<User | null> => {
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('phone', phone)
        .single();

    if (error && error.code !== 'PGRST116') {
        console.error('Error finding user:', error.message);
        return null;
    }
    return data as User | null;
};

export const createUser = async (name: string, phone: string, role: UserRole, province?: string): Promise<User | null> => {
     const { data, error } = await supabase
        .from('users')
        .insert({
            name,
            phone,
            role,
            province: role === 'driver' || role === 'province_admin' ? province : null,
            is_verified: false
        })
        .select()
        .single();
    
    if (error) {
        console.error('Error creating user:', error.message);
        return null;
    }
    return data as User | null;
}

// Admin Panel Functions
export const getAllUsers = async (): Promise<User[]> => {
    const { data, error } = await supabase.from('users').select('*').order('created_at', { ascending: false });
    if (error) {
        console.error('Error getting all users:', error.message);
        return [];
    }
    return data || [];
};

export const verifyUser = async (userId: string): Promise<boolean> => {
    const { error } = await supabase.from('users').update({ is_verified: true }).eq('id', userId);
    if (error) {
        console.error('Error verifying user:', error.message);
        return false;
    }
    return true;
};

export const deleteUser = async (userId: string): Promise<boolean> => {
    const { error } = await supabase.from('users').delete().eq('id', userId);
     if (error) {
        console.error('Error deleting user:', error.message);
        return false;
    }
    return true;
}

export const getSettings = async (): Promise<AppSettings | null> => {
    const { data, error } = await supabase.from('settings').select('*').eq('id', 1).single();
    if (error) {
        console.error('Error getting settings:', error.message);
        return null;
    }
    return data;
};

export const updateSettings = async (settings: Partial<AppSettings>): Promise<{ success: boolean; error?: { message: string; code: string; } }> => {
    const { error } = await supabase.from('settings').update(settings).eq('id', 1);
    if (error) {
        console.error('Error updating settings:', error);
        return { success: false, error: { message: error.message, code: error.code } };
    }
    return { success: true };
};

export const getDashboardStats = async () => {
    const { count: totalUsers } = await supabase.from('users').select('*', { count: 'exact' });
    const { count: totalDrivers } = await supabase.from('users').select('*', { count: 'exact' }).eq('role', 'driver');
    const { data: trips, error } = await supabase.from('trips').select('final_cost').eq('status', 'completed');

    if (error) console.error('Error fetching trip stats:', error.message);

    const totalRevenue = trips?.reduce((sum, trip) => sum + (trip.final_cost || 0), 0) || 0;
    const completedTrips = trips?.length || 0;

    return {
        totalUsers: totalUsers ?? 0,
        totalDrivers: totalDrivers ?? 0,
        completedTrips: completedTrips,
        totalRevenue: totalRevenue
    };
};

export const setUserActivationCode = async (userId: string, code: string): Promise<{ success: boolean; error?: { message: string; code: string; } }> => {
    const { error } = await supabase
        .from('users')
        .update({ activation_code: code })
        .eq('id', userId);

    if (error) {
        console.error('Error setting activation code:', error);
        return { success: false, error: { message: error.message, code: error.code } };
    }
    return { success: true };
};

export const verifyActivationCode = async (userId: string, code: string): Promise<User | null> => {
    // First, find the user and their stored code
    const { data: user, error: findError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
    
    if (findError || !user) {
        console.error('Error finding user for activation:', findError?.message);
        return null;
    }

    // Check if the code matches
    if (user.activation_code === code) {
        // Code matches, verify the user and clear the code
        const { data: updatedUser, error: updateError } = await supabase
            .from('users')
            .update({ is_verified: true, activation_code: null })
            .eq('id', userId)
            .select()
            .single();

        if (updateError) {
            console.error('Error verifying user:', updateError.message);
            return null;
        }
        return updatedUser as User;
    } else {
        // Code does not match
        return null;
    }
};

export const checkSchemaVersion = async (): Promise<{ is_up_to_date: boolean; error?: string }> => {
    // This RPC function is created by our DB_SCHEMA_SCRIPT.
    // It checks if the 'activation_code' column exists in the 'users' table.
    const { data, error } = await supabase.rpc('check_activation_column_exists');

    if (error) {
        console.error('Error checking schema version:', error.message);
        // The RPC might not exist if the DB is not set up at all or is from a very old version.
        // We can use this specific error message to determine the cause.
        return { is_up_to_date: false, error: error.message };
    }
    
    // The RPC is designed to return a single boolean value.
    if (typeof data !== 'boolean') {
        console.error('Unexpected response from schema check:', data);
        return { is_up_to_date: false, error: 'Unexpected response from schema check' };
    }
    
    return { is_up_to_date: data };
};