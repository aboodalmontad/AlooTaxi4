
import { createClient, AuthError, User as AuthUser, Session } from '@supabase/supabase-js';
import type { User, UserRole, AppSettings } from '../types';

const supabaseUrl = 'https://owhpvthykpwzlsikbbru.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93aHB2dGh5a3B3emxzaWtiYnJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxMTg0ODEsImV4cCI6MjA3ODY5NDQ4MX0.U1HbdWjGvsN_-nYpzEX-rCN7D0OgYVOjG7eJD5CPy-U';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// This is no longer needed as App.tsx handles session initialization.
export const appInitialization = Promise.resolve();

// Helper function to create a consistent dummy email from a phone number.
const phoneToDummyEmail = (phone: string): string => {
    // Converts a Syrian phone number like '0912345678' to '+963912345678@allo.taxi'
    // This allows using Supabase's email/password auth while the user only deals with their phone number.
    const internationalFormat = `+963${phone.substring(1)}`;
    return `${internationalFormat}@allo.taxi`;
};

// New Authentication Functions
export const signUp = async (name: string, phone: string, password: string, role: UserRole, province?: string): Promise<{ user: User | null; error: AuthError | Error | null; session: Session | null }> => {
    const email = phoneToDummyEmail(phone);

    // Step 1: Sign up the user in Supabase Auth using the dummy email
    const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
    });

    if (authError) {
        return { user: null, error: authError, session: null };
    }
    if (!authData.user) {
        return { user: null, error: new Error('Signup successful but no user object was returned.'), session: null };
    }

    // Step 2: Create or update a corresponding profile in the public.users table
    const { data: profileData, error: profileError } = await supabase
        .from('users')
        .upsert({
            id: authData.user.id,
            name,
            phone,
            role,
            province: role === 'driver' || role === 'province_admin' ? province : null,
            is_verified: false, // Default verification status
        })
        .select()
        .single();
    
    if (profileError) {
        // This is a tricky state. The user is created in auth, but the profile creation failed.
        // A robust solution might involve a database trigger or deleting the auth user.
        // For now, we return the error to the user.
        console.error('Error creating user profile:', profileError.message);
        return { user: null, error: profileError, session: null };
    }

    return { user: profileData as User, error: null, session: authData.session };
};

export const signIn = async (phone: string, password: string): Promise<{ user: AuthUser | null; error: AuthError | null }> => {
    const email = phoneToDummyEmail(phone);
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });
    return { user: data.user, error };
};

export const signOut = async () => {
    await supabase.auth.signOut();
};

export const getUserProfile = async (userId: string): Promise<User | null> => {
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
    
    if (error) {
        console.error('Error fetching user profile:', error.message);
        return null;
    }
    return data as User;
}


// Admin Panel Functions (mostly unchanged, but rely on RLS policies now)
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
    // Note: Deleting from the public.users table will cascade and delete the auth.users entry
    // due to the foreign key constraint defined in the setup script.
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
    const { data: user, error: findError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
    
    if (findError || !user) {
        console.error('Error finding user for activation:', findError?.message);
        return null;
    }

    if (user.activation_code === code) {
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
        return null;
    }
};

export const checkSchemaVersion = async (): Promise<{ is_up_to_date: boolean; error?: string }> => {
    const { data, error } = await supabase.rpc('check_activation_column_exists');

    if (error) {
        console.error('Error checking schema version:', error.message);
        return { is_up_to_date: false, error: error.message };
    }
    
    if (typeof data !== 'boolean') {
        console.error('Unexpected response from schema check:', data);
        return { is_up_to_date: false, error: 'Unexpected response from schema check' };
    }
    
    return { is_up_to_date: data };
};
