import React, { useState } from 'react';
import type { UserRole } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { SYRIAN_PROVINCES } from '../../constants';
import { findUserByPhone, createUser } from '../../services/supabase';
import { Database, Copy, Check, ArrowRight, RefreshCw, ShieldAlert, X } from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';


const DB_SCHEMA_SCRIPT = `
-- ألو تكسي - سكربت إعادة تعيين وإنشاء قاعدة البيانات
-- Allo Taxi - Database Reset and Creation Script
-- تحذير: هذا السكربت سيقوم بحذف الجداول والأنواع الحالية قبل إعادة إنشائها.
-- WARNING: This script will delete existing tables and types before recreating them.

-- 0. حذف الجداول والأنواع الحالية لتجنب الأخطاء
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.trips CASCADE;
DROP TABLE IF EXISTS public.settings CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
DROP TYPE IF EXISTS public.trip_status CASCADE;
DROP TYPE IF EXISTS public.vehicle_type CASCADE;
DROP TYPE IF EXISTS public.user_role CASCADE;
DROP FUNCTION IF EXISTS public.check_activation_column_exists() CASCADE;


-- 1. إنشاء الأنواع المخصصة (ENUMs)
CREATE TYPE public.user_role AS ENUM ('customer', 'driver', 'province_admin', 'super_admin');
CREATE TYPE public.vehicle_type AS ENUM ('سيارة خاصة عادية', 'سيارة خاصة مكيفة', 'سيارة عامة', 'سيارة VIP', 'ميكرو باص', 'دراجة');
CREATE TYPE public.trip_status AS ENUM ('requested', 'accepted', 'driver_arrived', 'in_progress', 'completed', 'cancelled', 'scheduled');


-- 2. إنشاء جدول المستخدمين (users)
CREATE TABLE public.users (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    name text NOT NULL,
    phone text NOT NULL,
    role public.user_role NOT NULL,
    province text NULL,
    is_verified boolean NOT NULL DEFAULT false,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    activation_code text NULL,
    CONSTRAINT users_pkey PRIMARY KEY (id),
    CONSTRAINT users_phone_key UNIQUE (phone)
);
COMMENT ON TABLE public.users IS 'يحتوي على معلومات جميع مستخدمي التطبيق.';


-- 3. إنشاء جدول الرحلات (trips)
CREATE TABLE public.trips (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    customer_id uuid NOT NULL,
    driver_id uuid NULL,
    status public.trip_status NOT NULL,
    pickup_location jsonb NOT NULL,
    dropoff_location jsonb NOT NULL,
    pickup_address text NOT NULL,
    dropoff_address text NOT NULL,
    distance_meters numeric NOT NULL,
    estimated_cost numeric NOT NULL,
    final_cost numeric NULL,
    vehicle_type public.vehicle_type NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    scheduled_at timestamp with time zone NULL,
    completed_at timestamp with time zone NULL,
    CONSTRAINT trips_pkey PRIMARY KEY (id),
    CONSTRAINT trips_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.users(id) ON DELETE CASCADE,
    CONSTRAINT trips_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.users(id) ON DELETE SET NULL
);
COMMENT ON TABLE public.trips IS 'يخزن تفاصيل كل رحلة مطلوبة في التطبيق.';


-- 4. إنشاء جدول الإشعارات (notifications)
CREATE TABLE public.notifications (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    message text NOT NULL,
    is_read boolean NOT NULL DEFAULT false,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT notifications_pkey PRIMARY KEY (id),
    CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);
COMMENT ON TABLE public.notifications IS 'يخزن الإشعارات المرسلة للمستخدمين.';


-- 5. إنشاء جدول الإعدادات (settings)
CREATE TABLE public.settings (
    id int8 NOT NULL DEFAULT 1,
    base_fare_syp numeric NOT NULL DEFAULT 2000,
    per_km_fare_syp numeric NOT NULL DEFAULT 500,
    app_commission_percentage numeric NOT NULL DEFAULT 15,
    vehicle_multipliers jsonb NOT NULL DEFAULT '{
        "سيارة خاصة عادية": 1, "سيارة خاصة مكيفة": 1.2, "سيارة عامة": 0.8,
        "سيارة VIP": 2.0, "ميكرو باص": 1.5, "دراجة": 0.6
    }',
    manager_phone text NULL DEFAULT '0912345678',
    CONSTRAINT settings_pkey PRIMARY KEY (id),
    CONSTRAINT settings_id_check CHECK ((id = 1))
);
COMMENT ON TABLE public.settings IS 'يخزن إعدادات التطبيق العامة التي يمكن للمدير تعديلها.';

-- 6. إدخال صف الإعدادات الافتراضي
INSERT INTO public.settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;


-- 7. تمكين RLS (Row Level Security) على الجداول
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;


-- 8. إنشاء سياسات RLS (Policies) للسماح بالوصول العام
-- ملاحظة: هذه السياسات متساهلة ومعدة لبيئة تطوير بدون مصادقة Supabase مدمجة.
CREATE POLICY "Public users access" ON public.users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public trips access" ON public.trips FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public notifications access" ON public.notifications FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public settings access" ON public.settings FOR ALL USING (true) WITH CHECK (true);

-- 9. إنشاء حساب المدير العام الافتراضي
-- Create a default super admin account
INSERT INTO public.users (name, phone, role, is_verified)
VALUES ('المدير العام', '0999999999', 'super_admin', true)
ON CONFLICT (phone) DO NOTHING;

-- 10. إنشاء دالة للتحقق من إصدار المخطط
-- This function allows the app to check if the DB schema is up-to-date.
-- It specifically checks for the existence of the 'activation_code' column.
CREATE OR REPLACE FUNCTION public.check_activation_column_exists()
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'users'
        AND column_name = 'activation_code'
    );
END;
$$;
`;

const DatabaseSetupGuide: React.FC<{
    onRetry: () => void;
    isRetrying: boolean;
    onClose: () => void;
    showCloseButton: boolean;
    errorMessage?: string | null;
}> = ({ onRetry, isRetrying, onClose, showCloseButton, errorMessage }) => {
    const [copied, setCopied] = useState(false);

    const handleCopyScript = () => {
        navigator.clipboard.writeText(DB_SCHEMA_SCRIPT.trim());
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    
    const isSchemaOutdated = errorMessage?.startsWith('SCHEMA_OUTDATED');
    const title = isSchemaOutdated ? "مطلوب تحديث قاعدة البيانات" : "مطلوب إعداد قاعدة البيانات";
    const description = isSchemaOutdated
        ? "يبدو أن مخطط قاعدة البيانات لديك قديم. لتفعيل آخر الميزات، يرجى تشغيل سكربت الإعداد المحدث أدناه."
        : "لتشغيل التطبيق لأول مرة، يرجى اتباع دليل الإعداد البسيط هذا لتهيئة قاعدة البيانات الخاصة بك على Supabase.";


    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 flex items-center justify-center p-4">
            <div className="relative w-full max-w-4xl bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 text-white animate-fade-in">
                {showCloseButton && (
                    <button onClick={onClose} className="absolute top-4 left-4 text-slate-400 hover:text-white p-2 rounded-full hover:bg-slate-700 transition-colors z-10" aria-label="إغلاق">
                        <X size={24} />
                    </button>
                )}
                <div className="text-center mb-6">
                    <ShieldAlert className="h-16 w-16 mx-auto text-amber-400 mb-4" />
                    <h2 className="text-3xl font-bold text-amber-300 mb-2">{title}</h2>
                    <p className="text-slate-300 max-w-2xl mx-auto">
                        {description}
                    </p>
                </div>

                <div className="space-y-4 text-slate-200 mb-6 bg-slate-900/50 p-6 rounded-lg border border-slate-700">
                    <h3 className="text-xl font-semibold text-sky-300 border-b border-slate-700 pb-2 mb-4">دليل الإعداد خطوة بخطوة</h3>
                    <p>1. اذهب إلى <a href="https://supabase.com/" target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline">لوحة تحكم مشروعك في Supabase</a>.</p>
                    <p>2. في القائمة الجانبية، اذهب إلى قسم <b className="text-white">SQL Editor</b> (محرر SQL).</p>
                    <p>3. اضغط على <b className="text-white">+ New query</b> (استعلام جديد).</p>
                    <p>4. انسخ السكربت أدناه بالضغط على زر "نسخ السكربت".</p>
                    <p>5. الصق السكربت في المحرر واضغط على <b className="text-white">RUN</b> (تشغيل).</p>
                    <p className="bg-sky-900/50 p-3 rounded-lg border border-sky-700"><b className="text-amber-300">6. (مهم جداً)</b> بعد نجاح التنفيذ، اذهب إلى قسم <b className="text-white">API Docs</b>، ثم في صفحة الجداول (Tables and Views)، اضغط على زر <b className="text-white">"Reload schema"</b> في الأعلى ليتعرف التطبيق على أي تغييرات جديدة.</p>
                    <p>7. بعد إتمام الخطوات، عد إلى هنا واضغط على زر "التحقق والمتابعة".</p>
                </div>

                <div className="relative mb-6">
                    <pre className="bg-slate-900/70 rounded-lg p-4 max-h-[30vh] overflow-auto text-left dir-ltr text-sm font-mono border border-slate-700">
                        <code>{DB_SCHEMA_SCRIPT.trim()}</code>
                    </pre>
                    <button
                        onClick={handleCopyScript}
                        className="absolute top-3 right-3 bg-slate-700 hover:bg-sky-600 text-white font-bold p-2 rounded-lg transition-colors flex items-center gap-2"
                    >
                        {copied ? <Check className="h-5 w-5 text-green-400" /> : <Copy className="h-5 w-5" />}
                        {copied ? 'تم النسخ!' : 'نسخ السكربت'}
                    </button>
                </div>

                <button
                    onClick={onRetry}
                    disabled={isRetrying}
                    className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-6 rounded-lg transition-transform transform hover:scale-105 flex justify-center items-center gap-2 disabled:opacity-50"
                >
                    {isRetrying ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : <RefreshCw className="h-5 w-5" />}
                    {isRetrying ? 'جارٍ التحقق...' : 'التحقق والمتابعة'}
                </button>
            </div>
        </div>
    );
};

const Login: React.FC = () => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole>('customer');
  const [province, setProvince] = useState(SYRIAN_PROVINCES[0]);
  const [isNewUser, setIsNewUser] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { error: settingsError, loading: settingsLoading, refetchSettings } = useSettings();

  const [isRetrying, setIsRetrying] = useState(false);
  const [showSetupGuide, setShowSetupGuide] = useState(false);
  
  const handlePhoneSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!/^(09)\d{8}$/.test(phone)) {
          setError('الرجاء إدخال رقم هاتف سوري صالح (e.g., 09xxxxxxxx)');
          return;
      }
      setError('');
      setLoading(true);

      try {
        const existingUser = await findUserByPhone(phone);
        if (existingUser) {
            login(existingUser);
        } else {
            setIsNewUser(true);
        }
      } catch (err) {
        setError('فشل الاتصال بالخادم. يرجى التحقق من اتصالك بالإنترنت.');
      } finally {
        setLoading(false);
      }
  };
  
  const handleRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
        setError('الرجاء إدخال الاسم.');
        return;
    }
    setError('');
    setLoading(true);
    
    try {
        const newUser = await createUser(name, phone, role, province);
        if(newUser) {
            login(newUser);
        } else {
            setError('حدث خطأ أثناء إنشاء الحساب. قد يكون رقم الهاتف مستخدماً أو أن قاعدة البيانات غير مهيأة.');
        }
    } catch (err) {
        setError('فشل الاتصال بالخادم. يرجى التحقق من اتصالك بالإنترنت.');
    } finally {
        setLoading(false);
    }
  };

  const handleRetry = async () => {
    setIsRetrying(true);
    await refetchSettings();
    setShowSetupGuide(false);
    setIsRetrying(false);
  };
  
  if (settingsLoading) {
    return (
         <div className="flex items-center justify-center h-screen bg-slate-900 text-white">
            <svg className="animate-spin h-8 w-8 text-sky-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="ms-3 text-lg">جاري التحقق من إعدادات التطبيق...</span>
          </div>
    );
  }
  
  // More robust error checking. Show the setup guide if the DB is not initialized,
  // the schema is outdated, or the user manually requested it.
  const isDbSetupError = settingsError && (settingsError.startsWith('SETUP_REQUIRED') || settingsError.startsWith('SCHEMA_OUTDATED'));
  if (isDbSetupError || showSetupGuide) {
      return <DatabaseSetupGuide
          onRetry={handleRetry}
          isRetrying={isRetrying}
          onClose={() => setShowSetupGuide(false)}
          showCloseButton={showSetupGuide && !isDbSetupError}
          errorMessage={settingsError}
      />;
  }
  
  if (settingsError) {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 flex items-center justify-center p-4">
            <div className="w-full max-w-2xl bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 text-white text-center animate-fade-in">
                <ShieldAlert className="h-16 w-16 mx-auto text-amber-400 mb-4" />
                <h2 className="text-3xl font-bold text-amber-300 mb-3">خطأ في الاتصال</h2>
                <p className="text-slate-300 mb-6 max-w-lg mx-auto">
                    تعذر الاتصال بالخادم لجلب إعدادات التطبيق. يرجى التحقق من اتصالك بالإنترنت.
                </p>
                 <button
                    onClick={handleRetry}
                    disabled={isRetrying}
                    className="bg-slate-600 hover:bg-slate-500 text-white font-bold py-3 px-6 rounded-lg transition-transform transform hover:scale-105 flex justify-center items-center gap-2 disabled:opacity-50"
                 >
                     {isRetrying ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : <RefreshCw className="h-5 w-5" />}
                     {isRetrying ? 'جارٍ التحقق...' : 'المحاولة مرة أخرى'}
                 </button>
            </div>
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 text-white">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold tracking-wider">ألو تكسي</h1>
          <p className="text-sky-300 mt-2">خدمتك الأسرع للتنقل</p>
        </div>

        {error && <p className="bg-red-500/50 text-white p-3 rounded-lg mb-4 text-center">{error}</p>}

        {!isNewUser ? (
            <form onSubmit={handlePhoneSubmit}>
              <div className="mb-4">
                <label htmlFor="phone" className="block text-sm font-medium text-slate-300 mb-2">رقم الهاتف</label>
                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="09..."
                  required
                  className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 transition"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold py-3 px-4 rounded-lg transition-transform transform hover:scale-105 disabled:bg-slate-500 disabled:cursor-not-allowed flex justify-center items-center"
              >
                {loading ? <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div> : 'متابعة'}
              </button>
            </form>
        ) : (
            <form onSubmit={handleRegistration} className="animate-fade-in">
                <p className="text-center mb-4 text-slate-300">أهلاً بك! يرجى إكمال التسجيل.</p>
                <div className="mb-4">
                    <label htmlFor="name" className="block text-sm font-medium text-slate-300 mb-2">الاسم الكامل</label>
                    <input
                      id="name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="اسمك الكامل"
                      required
                      className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 transition"
                    />
                </div>
                <div className="mb-6">
                    <label htmlFor="role" className="block text-sm font-medium text-slate-300 mb-2">تسجيل كـ</label>
                    <select
                        id="role"
                        value={role}
                        onChange={(e) => setRole(e.target.value as UserRole)}
                        className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-sky-500 transition"
                    >
                        <option value="customer">زبون</option>
                        <option value="driver">سائق</option>
                    </select>
                </div>
                 {(role === 'driver' || role === 'province_admin') && (
                     <div className="mb-6">
                        <label htmlFor="province" className="block text-sm font-medium text-slate-300 mb-2">المحافظة</label>
                        <select
                            id="province"
                            value={province}
                            onChange={(e) => setProvince(e.target.value)}
                            className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-sky-500 transition"
                        >
                           {SYRIAN_PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </div>
                 )}
                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-4 rounded-lg transition-transform transform hover:scale-105 disabled:bg-slate-500 disabled:cursor-not-allowed flex justify-center items-center"
                >
                     {loading ? <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div> : 'إنشاء حساب'}
                </button>
            </form>
        )}
        <div className="text-center mt-6 pt-4 border-t border-slate-700/50">
          <button
              onClick={() => setShowSetupGuide(true)}
              className="text-sm text-slate-400 hover:text-sky-300 transition flex items-center justify-center gap-2 w-full"
          >
              <Database size={16} />
              <span>المساعدة في إعداد قاعدة البيانات</span>
          </button>
      </div>
      </div>
    </div>
  );
};

export default Login;