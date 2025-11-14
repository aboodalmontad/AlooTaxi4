
import React, { useState, useEffect, useMemo } from 'react';
import { AuthContext } from './contexts/AuthContext';
import { SettingsProvider, useSettings } from './contexts/SettingsContext';
import type { User, UserRole } from './types';
import Login from './components/auth/Login';
import CustomerView from './components/customer/CustomerView';
import DriverView from './components/driver/DriverView';
import AdminDashboard from './components/admin/AdminDashboard';
import { appInitialization } from './services/supabase';
import NotificationPopup from './components/ui/NotificationPopup';
import ActivationScreen from './components/auth/ActivationScreen';

const SettingsErrorNotification: React.FC = () => {
  const { error } = useSettings();
  const [showError, setShowError] = useState(false);

  useEffect(() => {
    if (error) {
      setShowError(true);
    }
  }, [error]);

  if (!showError || !error) return null;

  return <NotificationPopup message={error} type="warning" onClose={() => setShowError(false)} />;
};


const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [initError, setInitError] = useState<Error | null>(null);

  // Wait for app initialization (like creating the admin user) to complete
  useEffect(() => {
    appInitialization
      .then(() => {
        // In a real app, you would also check for a valid session token here
        setLoading(false);
      })
      .catch((err) => {
        console.error("Application initialization failed:", err);
        setInitError(err as Error);
        setLoading(false);
      });
  }, []);

  const login = (userData: User) => {
    setUser(userData);
    // In a real app, save session to localStorage
  };

  const logout = () => {
    setUser(null);
    // In a real app, clear session from localStorage
  };
  
  const authContextValue = useMemo(() => ({ user, login, logout }), [user]);

  const renderView = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-screen bg-slate-900 text-white">
          <svg className="animate-spin h-8 w-8 text-sky-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="ms-3 text-lg">جاري تهيئة التطبيق...</span>
        </div>
      );
    }
    
    if (initError) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-slate-900 text-white p-4 text-center">
                <h1 className="text-3xl font-bold text-red-500 mb-4">خطأ في تهيئة التطبيق</h1>
                <p className="text-lg mb-2">تعذر الاتصال بقاعدة البيانات أو إعدادها بشكل صحيح.</p>
                <p className="text-slate-400 mb-6">
                    يرجى التأكد من تشغيل سكربت إعداد قاعدة البيانات في لوحة تحكم Supabase. إذا قمت بتشغيله للتو، فقد تحتاج إلى تحديث الصفحة.
                </p>
                <pre className="bg-slate-800 text-red-300 p-4 rounded-lg mb-6 w-full max-w-2xl overflow-auto text-left dir-ltr">
                    <code>{initError.message}</code>
                </pre>
                <button
                    onClick={() => window.location.reload()}
                    className="bg-sky-600 hover:bg-sky-500 text-white font-bold py-3 px-6 rounded-lg transition-transform transform hover:scale-105"
                >
                    تحديث الصفحة
                </button>
            </div>
        );
    }

    if (!user) {
      return <Login />;
    }
    
    // Manual verification check
    if (!user.is_verified) {
        return <ActivationScreen user={user} onActivationSuccess={login} />;
    }

    switch (user.role) {
      case 'customer':
        return <CustomerView />;
      case 'driver':
        return <DriverView />;
      case 'super_admin':
      case 'province_admin':
        return <AdminDashboard />;
      default:
        return <Login />;
    }
  };

  return (
    <AuthContext.Provider value={authContextValue}>
      <SettingsProvider>
        <div className="bg-slate-100 dark:bg-slate-900 min-h-screen text-slate-800 dark:text-slate-200">
          <SettingsErrorNotification />
          {renderView()}
        </div>
      </SettingsProvider>
    </AuthContext.Provider>
  );
};

export default App;