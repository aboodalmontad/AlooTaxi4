import React, { useState, useEffect } from 'react';
import { updateSettings } from '../../services/supabase';
import type { AppSettings } from '../../types';
import NotificationPopup from '../ui/NotificationPopup';
import { useSettings } from '../../contexts/SettingsContext';

const AppSettings: React.FC = () => {
    const { settings: contextSettings, loading: contextLoading, refetchSettings } = useSettings();
    const [settings, setSettings] = useState<Partial<AppSettings>>({});
    const [saving, setSaving] = useState(false);
    const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

    useEffect(() => {
        if (contextSettings) {
            setSettings(contextSettings);
        }
    }, [contextSettings]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type } = e.target;
        setSettings(prev => ({ ...prev, [name]: type === 'number' ? Number(value) : value }));
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const result = await updateSettings(settings);
            if (result.success) {
                setNotification({ message: 'تم حفظ الإعدادات بنجاح!', type: 'success' });
                await refetchSettings();
            } else {
                let errorMessage = 'فشل في حفظ الإعدادات.';
                // PostgREST error code '42703' is 'undefined_column'
                if (result.error && (result.error.code === '42703' || result.error.message.includes("schema cache"))) {
                    errorMessage = 'فشل الحفظ: لم يتم تحديث مخطط قاعدة البيانات. بعد تشغيل سكربت الإعداد، يرجى الذهاب إلى قسم "API Docs" في Supabase والضغط على "Reload schema".';
                } else if (result.error) {
                    errorMessage += ` السبب: ${result.error.message}`;
                }
                setNotification({ message: errorMessage, type: 'error' });
            }
        } catch (error) {
            console.error("Failed to save settings:", error);
            setNotification({ message: 'فشل الاتصال بالخادم. لم يتم حفظ الإعدادات.', type: 'error' });
        } finally {
            setSaving(false);
        }
    };

    if (contextLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-400"></div>
            </div>
        );
    }
    
    return (
        <div className="animate-fade-in text-white max-w-2xl mx-auto">
            {notification && <NotificationPopup message={notification.message} type={notification.type} onClose={() => setNotification(null)} />}
            <h1 className="text-3xl font-bold mb-6">إعدادات التطبيق العامة</h1>
            <form onSubmit={handleSave} className="bg-slate-800 p-8 rounded-xl border border-slate-700 space-y-6">
                <div>
                    <label htmlFor="base_fare_syp" className="block text-sm font-medium text-slate-300 mb-2">الأجرة الأساسية (ل.س)</label>
                    <input
                        type="number"
                        id="base_fare_syp"
                        name="base_fare_syp"
                        value={settings.base_fare_syp || ''}
                        onChange={handleInputChange}
                        className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                    <p className="text-xs text-slate-500 mt-1">المبلغ المبدئي الذي تبدأ به كل رحلة.</p>
                </div>
                <div>
                    <label htmlFor="per_km_fare_syp" className="block text-sm font-medium text-slate-300 mb-2">تسعيرة الكيلومتر (ل.س)</label>
                    <input
                        type="number"
                        id="per_km_fare_syp"
                        name="per_km_fare_syp"
                        value={settings.per_km_fare_syp || ''}
                        onChange={handleInputChange}
                        className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                    <p className="text-xs text-slate-500 mt-1">المبلغ الذي يضاف لكل كيلومتر تقطعه المركبة.</p>
                </div>
                 <div>
                    <label htmlFor="app_commission_percentage" className="block text-sm font-medium text-slate-300 mb-2">نسبة أرباح التطبيق (%)</label>
                    <input
                        type="number"
                        id="app_commission_percentage"
                        name="app_commission_percentage"
                        value={settings.app_commission_percentage || ''}
                        onChange={handleInputChange}
                        min="0"
                        max="100"
                        className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                    <p className="text-xs text-slate-500 mt-1">النسبة المئوية التي يحصل عليها التطبيق من كل رحلة.</p>
                </div>
                <div className="pt-4 border-t border-slate-700">
                     <label htmlFor="manager_phone" className="block text-sm font-medium text-slate-300 mb-2">رقم هاتف المدير (للتواصل)</label>
                    <input
                        type="tel"
                        id="manager_phone"
                        name="manager_phone"
                        value={settings.manager_phone || ''}
                        onChange={handleInputChange}
                        className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                    <p className="text-xs text-slate-500 mt-1">سيظهر هذا الرقم للزبائن للتواصل في حال وجود مشكلة.</p>
                </div>

                <div className="pt-4 border-t border-slate-700">
                    <h2 className="text-xl font-bold text-sky-400 mb-4">إعدادات خدمات الخرائط</h2>
                    <label htmlFor="ors_api_key" className="block text-sm font-medium text-slate-300 mb-2">مفتاح API لخدمة OpenRouteService</label>
                    <input
                        type="text"
                        id="ors_api_key"
                        name="ors_api_key"
                        value={settings.ors_api_key || ''}
                        onChange={handleInputChange}
                        className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                        placeholder="أدخل مفتاح API هنا"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                        هذا المفتاح ضروري لعمل الخرائط وحساب المسافات. يمكنك الحصول عليه من
                        <a href="https://openrouteservice.org/" target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline mx-1">
                            موقع OpenRouteService
                        </a>.
                    </p>
                </div>

                <div className="pt-4">
                    <button type="submit" disabled={saving} className="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold py-3 px-4 rounded-lg transition-transform transform hover:scale-105 disabled:bg-slate-500 disabled:cursor-not-allowed flex justify-center items-center">
                        {saving ? <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div> : 'حفظ التغييرات'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default AppSettings;