
import React, { useState } from 'react';
import type { UserRole } from '../../types';
import { SYRIAN_PROVINCES } from '../../constants';
import { signIn, signUp } from '../../services/supabase';
import { Database, Copy, Check, ShieldAlert, X, LogIn, UserPlus, RefreshCw, Info } from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';


const DB_SCHEMA_SCRIPT = `
-- ألو تكسي - سكربت إعادة تعيين وإنشاء قاعدة البيانات (متوافق مع نظام المصادقة)
-- Allo Taxi - Database Reset and Creation Script (Auth Compatible)
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


-- 2. إنشاء جدول المستخدمين (users) - مرتبط بـ auth.users
-- This table stores public profile data for each user and is linked to the main auth.users table.
CREATE TABLE public.users (
    id uuid NOT NULL,
    name text NOT NULL,
    phone text NOT NULL,
    role public.user_role NOT NULL,
    province text NULL,
    is_verified boolean NOT NULL DEFAULT false,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    activation_code text NULL,
    CONSTRAINT users_pkey PRIMARY KEY (id),
    CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
);
COMMENT ON TABLE public.users IS 'يحتوي على معلومات جميع مستخدمي التطبيق ويرتبط بجدول المصادقة.';


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
    ors_api_key text NULL,
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


-- 8. إنشاء سياسات RLS (Policies) الآمنة
-- Users can only see and manage their own data. Admins have broader access.
CREATE POLICY "Users can view their own profile." ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can create their own profile." ON public.users FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Public read access for settings" ON public.settings FOR SELECT USING (true);
-- A more complex policy is needed for admins in a real scenario. For this app, we'll allow full access.
CREATE POLICY "Admins can manage all data." ON public.users FOR ALL USING ( (SELECT role FROM public.users WHERE id = auth.uid()) = 'super_admin' );
CREATE POLICY "Admins can manage all settings." ON public.settings FOR ALL USING ( (SELECT role FROM public.users WHERE id = auth.uid()) = 'super_admin' );

-- 9. إنشاء حساب المدير العام الافتراضي
-- Note: This only creates the profile. The actual user must be created in Supabase Auth
-- (e.g., via the Supabase Studio) with the phone number '0999999999' and password.
-- Then, get the user's ID from the 'auth.users' table and replace the placeholder below.
INSERT INTO public.users (id, name, phone, role, is_verified)
VALUES ('00000000-0000-0000-0000-000000000000', 'المدير العام', '0999999999', 'super_admin', true)
ON CONFLICT (id) DO NOTHING;


-- 10. إنشاء دالة للتحقق من إصدار المخطط
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

                    <div className="bg-indigo-900/50 p-4 rounded-lg border border-indigo-700 flex gap-4">
                        <Info className="h-6 w-6 text-indigo-300 flex-shrink-0 mt-1" />
                        <div>
                            <h4 className="font-bold text-indigo-200 mb-2">لماذا نحتاج إلى تفعيل "Email provider"؟</h4>
                            <p className="text-sm text-indigo-300">
                                تطبيقنا يستخدم رقم الهاتف لتسجيل الدخول. ولكن لضمان أقصى درجات الأمان، نستخدم نظام المصادقة القوي والمجاني من Supabase خلف الكواليس. يقوم التطبيق تلقائياً بتحويل رقم الهاتف إلى معرّف فريد وآمن (مثال: <code dir="ltr" className="font-mono text-xs">+963...@allo.taxi</code>). هذا يسمح لنا بتوفير نظام تسجيل دخول آمن ومجاني دون الحاجة لإرسال رسائل SMS مكلفة. تفعيل "Email provider" هو مجرد خطوة تقنية للسماح لهذا النظام بالعمل. <b className="font-bold text-white">التطبيق لن يستخدم أو يطلب أي بريد إلكتروني حقيقي من المستخدمين.</b>
                            </p>
                        </div>
                    </div>

                    <p>1. اذهب إلى <a href="https://supabase.com/" target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline">لوحة تحكم مشروعك في Supabase</a>.</p>
                    <p>2. في القائمة الجانبية، اذهب إلى <b className="text-white">Authentication</b> ثم <b className="text-white">Providers</b>.</p>
                    <p><b className="text-sky-300">3. (خطوة تقنية ضرورية)</b> تأكد من أن مقدم الخدمة <b className="text-white">Email</b> مُفعّل (Enabled). (انظر الشرح أعلاه).</p>
                    <p><b className="text-amber-300">4. (مهم جداً)</b> تحت قسم <b className="text-white">Email</b>، قم <b className="text-amber-300">بتعطيل</b> خيار <b className="text-white">"Confirm email"</b>. هذا ضروري ليعمل نظام التفعيل اليدوي عبر واتساب.</p>
                    <p>5. في القائمة الجانبية، اذهب إلى قسم <b className="text-white">SQL Editor</b> (محرر SQL).</p>
                    <p>6. اضغط على <b className="text-white">+ New query</b> (استعلام جديد).</p>
                    <p>7. انسخ السكربت أدناه بالضغط على زر "نسخ السكربت".</p>
                    <p>8. الصق السكربت في المحرر واضغط على <b className="text-white">RUN</b> (تشغيل).</p>
                    <p><b className="text-amber-300">9. (مهم جداً)</b> بعد نجاح التنفيذ، اذهب إلى قسم <b className="text-white">API Docs</b>، ثم في صفحة الجداول (Tables and Views)، اضغط على زر <b className="text-white">"Reload schema"</b> في الأعلى ليتعرف التطبيق على أي تغييرات جديدة.</p>
                    <p>10. بعد إتمام الخطوات، عد إلى هنا واضغط على زر "التحقق والمتابعة".</p>
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
  const [isLoginView, setIsLoginView] = useState(true);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<UserRole>('customer');
  const [province, setProvince] = useState(SYRIAN_PROVINCES[0]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { error: settingsError, loading: settingsLoading, refetchSettings } = useSettings();
  const [isRetrying, setIsRetrying] = useState(false);
  const [showSetupGuide, setShowSetupGuide] = useState(false);

  const validatePhone = () => {
    if (!/^(09)\d{8}$/.test(phone)) {
        setError('الرجاء إدخال رقم هاتف سوري صالح (e.g., 09xxxxxxxx)');
        return false;
    }
    return true;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validatePhone() || !password) {
        setError('الرجاء إدخال رقم الهاتف وكلمة المرور.');
        return;
    }
    setError('');
    setLoading(true);

    const { error: signInError } = await signIn(phone, password);
    if (signInError) {
        setError(signInError.message === 'Invalid login credentials' ? 'رقم الهاتف أو كلمة المرور غير صحيحة.' : 'فشل تسجيل الدخول. يرجى المحاولة مرة أخرى.');
    }
    // On success, the onAuthStateChange listener in App.tsx will handle the rest.
    setLoading(false);
  };
  
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validatePhone() || !name.trim()) {
        setError('الرجاء إدخال الاسم ورقم هاتف صالح.');
        return;
    }
    if (password.length < 6) {
        setError('يجب أن تتكون كلمة المرور من 6 أحرف على الأقل.');
        return;
    }
    if (password !== confirmPassword) {
        setError('كلمتا المرور غير متطابقتين.');
        return;
    }
    setError('');
    setLoading(true);
    
    const { user, session, error: signUpError } = await signUp(name, phone, password, role, province);
    if (signUpError) {
        if (signUpError.message.includes('User already registered')) {
            setError('هذا الرقم مسجل بالفعل. يرجى تسجيل الدخول بدلاً من ذلك.');
        } else if (signUpError.message.includes('Email signups are disabled')) {
            setError('فشل إنشاء الحساب. يرجى الطلب من مسؤول النظام مراجعة دليل الإعداد وتفعيل "Email provider".');
        } else {
            setError('حدث خطأ أثناء إنشاء الحساب. ' + signUpError.message);
        }
    } else if (user && !session) {
        // This handles the case where sign-up is successful but requires email confirmation,
        // which is not possible with our dummy email system.
        setError('فشل إنشاء الحساب. يرجى الطلب من مسؤول النظام تعطيل خيار "Confirm email" في إعدادات المصادقة.');
    }
    // On success with a session, the onAuthStateChange listener in App.tsx will handle the rest.
    setLoading(false);
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

  const AuthForm = isLoginView ? (
    <form onSubmit={handleLogin} className="space-y-4">
        <div>
            <label htmlFor="phone" className="block text-sm font-medium text-slate-300 mb-2">رقم الهاتف</label>
            <input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09..." required className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 transition"/>
        </div>
        <div>
            <label htmlFor="password"className="block text-sm font-medium text-slate-300 mb-2">كلمة المرور</label>
            <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 transition"/>
        </div>
        <button type="submit" disabled={loading} className="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold py-3 px-4 rounded-lg transition-transform transform hover:scale-105 disabled:bg-slate-500 disabled:cursor-not-allowed flex justify-center items-center gap-2">
            {loading ? <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div> : <><LogIn size={18}/> تسجيل الدخول</>}
        </button>
    </form>
  ) : (
    <form onSubmit={handleRegister} className="space-y-4 animate-fade-in">
        <div>
            <label htmlFor="name-reg" className="block text-sm font-medium text-slate-300 mb-2">الاسم الكامل</label>
            <input id="name-reg" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="اسمك الكامل" required className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 transition"/>
        </div>
         <div>
            <label htmlFor="phone-reg" className="block text-sm font-medium text-slate-300 mb-2">رقم الهاتف</label>
            <input id="phone-reg" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09..." required className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 transition"/>
        </div>
        <div>
            <label htmlFor="password-reg"className="block text-sm font-medium text-slate-300 mb-2">كلمة المرور</label>
            <input id="password-reg" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 transition"/>
        </div>
        <div>
            <label htmlFor="confirm-password-reg"className="block text-sm font-medium text-slate-300 mb-2">تأكيد كلمة المرور</label>
            <input id="confirm-password-reg" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 transition"/>
        </div>
        <div>
            <label htmlFor="role" className="block text-sm font-medium text-slate-300 mb-2">تسجيل كـ</label>
            <select id="role" value={role} onChange={(e) => setRole(e.target.value as UserRole)} className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-sky-500 transition">
                <option value="customer">زبون</option>
                <option value="driver">سائق</option>
            </select>
        </div>
        {role === 'driver' && (
            <div>
                <label htmlFor="province" className="block text-sm font-medium text-slate-300 mb-2">المحافظة</label>
                <select id="province" value={province} onChange={(e) => setProvince(e.target.value)} className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-sky-500 transition">
                    {SYRIAN_PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
            </div>
        )}
        <button type="submit" disabled={loading} className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-4 rounded-lg transition-transform transform hover:scale-105 disabled:bg-slate-500 disabled:cursor-not-allowed flex justify-center items-center gap-2">
            {loading ? <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div> : <><UserPlus size={18}/> إنشاء حساب</>}
        </button>
    </form>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 text-white">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold tracking-wider">ألو تكسي</h1>
          <p className="text-sky-300 mt-2">{isLoginView ? 'أهلاً بعودتك!' : 'انضم إلينا الآن'}</p>
        </div>

        {error && <p className="bg-red-500/50 text-white p-3 rounded-lg mb-4 text-center">{error}</p>}

        {AuthForm}
        
        <div className="text-center mt-6">
            <button onClick={() => { setIsLoginView(!isLoginView); setError(''); }} className="text-sm text-slate-400 hover:text-sky-300 transition">
                {isLoginView ? 'ليس لديك حساب؟ إنشاء حساب جديد' : 'لديك حساب بالفعل؟ تسجيل الدخول'}
            </button>
        </div>

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
