import React, { useState, useEffect } from 'react';
import { getDashboardStats } from '../../services/supabase';
import { Users, Car, CheckCircle, BarChart } from 'lucide-react';

const formatSYP = (amount: number) => {
  return new Intl.NumberFormat('ar-SY', { style: 'currency', currency: 'SYP', minimumFractionDigits: 0 }).format(amount);
};

const StatCard: React.FC<{ icon: React.ElementType, title: string, value: string | number, color: string }> = ({ icon: Icon, title, value, color }) => {
    return (
        <div className="bg-slate-800 p-6 rounded-xl flex items-center gap-6 border border-slate-700">
            <div className={`p-4 rounded-lg ${color}`}>
                <Icon className="h-8 w-8 text-white" />
            </div>
            <div>
                <p className="text-slate-400 text-sm font-medium">{title}</p>
                <p className="text-white text-3xl font-bold">{value}</p>
            </div>
        </div>
    );
};

const DashboardHome: React.FC = () => {
    const [stats, setStats] = useState({
        totalUsers: 0,
        totalDrivers: 0,
        completedTrips: 0,
        totalRevenue: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            setLoading(true);
            try {
                const data = await getDashboardStats();
                setStats(data);
            } catch (error) {
                console.error("Failed to fetch dashboard stats:", error);
                // In a real app, you might want to set an error state here
                // to inform the user that stats could not be loaded.
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-400"></div>
            </div>
        );
    }
    
    return (
        <div className="animate-fade-in">
            <h1 className="text-3xl font-bold text-white mb-6">ملخص الأداء</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard icon={Users} title="إجمالي المستخدمين" value={stats.totalUsers} color="bg-sky-500" />
                <StatCard icon={Car} title="إجمالي السائقين" value={stats.totalDrivers} color="bg-amber-500" />
                <StatCard icon={CheckCircle} title="الرحلات المكتملة" value={stats.completedTrips} color="bg-green-500" />
                <StatCard icon={BarChart} title="إجمالي الإيرادات" value={formatSYP(stats.totalRevenue)} color="bg-indigo-500" />
            </div>

            {/* Placeholder for future charts */}
            <div className="mt-8 bg-slate-800 p-6 rounded-xl border border-slate-700">
                <h2 className="text-xl font-bold text-white mb-4">نشاط الرحلات (آخر 7 أيام)</h2>
                 <div className="flex items-center justify-center h-48 text-slate-500">
                    <p>سيتم عرض المخطط البياني هنا قريباً.</p>
                </div>
            </div>
        </div>
    );
};

export default DashboardHome;