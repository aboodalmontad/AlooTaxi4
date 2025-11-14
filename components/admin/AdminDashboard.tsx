import React, { useState, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { LogOut, Map, Users, Settings, LayoutDashboard } from 'lucide-react';

import DashboardHome from './DashboardHome';
import UserManagement from './UserManagement';
import AppSettings from './AppSettings';
import MapComponent from '../map/MapComponent';
import type { LatLngTuple } from 'leaflet';


const LiveMap: React.FC = () => {
    // Mock data for the master map
    const mockDrivers: {id: string, name: string, position: LatLngTuple}[] = [
        { id: 'd1', name: 'أحمد', position: [33.515, 36.278] },
        { id: 'd2', name: 'محمد', position: [33.505, 36.285] },
    ];
    const mockCustomers: {id: string, name: string, position: LatLngTuple}[] = [
        { id: 'c1', name: 'سارة', position: [33.512, 36.270] }
    ];

    const mapMarkers = useMemo(() => {
        const markers = [];
        markers.push(...mockDrivers.map(d => ({
            position: d.position,
            popupText: `السائق: ${d.name}`,
            type: 'driver' as const,
        })));
        markers.push(...mockCustomers.map(c => ({
            position: c.position,
            popupText: `طلب من: ${c.name}`,
            type: 'start' as const,
        })));
        return markers;
    }, []);

    return (
        <div className="h-full w-full flex flex-col">
            <h2 className="text-3xl font-bold text-white mb-4">الخريطة الحية</h2>
            <div className="flex-grow rounded-lg overflow-hidden border border-slate-700">
               <MapComponent center={[33.5138, 36.2765]} zoom={13} markers={mapMarkers} />
            </div>
        </div>
    );
}


const AdminDashboard: React.FC = () => {
    const { user, logout } = useAuth();
    const [activeView, setActiveView] = useState('dashboard');
    
    const renderContent = () => {
        switch (activeView) {
            case 'dashboard': return <DashboardHome />;
            case 'users': return <UserManagement />;
            case 'settings': return <AppSettings />;
            case 'map': return <LiveMap />;
            default: return <DashboardHome />;
        }
    }
    
    const NavItem: React.FC<{icon: React.ElementType, label: string, view: string}> = ({ icon: Icon, label, view}) => (
         <button onClick={() => setActiveView(view)} className={`flex items-center w-full px-4 py-3 text-right rounded-lg transition-colors ${activeView === view ? 'bg-sky-600 text-white' : 'text-slate-300 hover:bg-slate-700 hover:text-white'}`}>
            <Icon className="w-6 h-6 ml-4" />
            <span className="font-semibold">{label}</span>
        </button>
    );

    return (
        <div className="flex h-screen bg-slate-900">
            <aside className="w-64 bg-slate-800 p-4 flex flex-col justify-between shadow-lg border-l border-slate-700">
                <div>
                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-bold text-white">ألو تكسي</h1>
                        <p className="text-sky-400">لوحة التحكم</p>
                    </div>
                    <nav className="space-y-2">
                        <NavItem icon={LayoutDashboard} label="الملخص" view="dashboard" />
                        <NavItem icon={Users} label="إدارة المستخدمين" view="users" />
                        <NavItem icon={Map} label="الخريطة الحية" view="map" />
                        <NavItem icon={Settings} label="إعدادات التطبيق" view="settings" />
                    </nav>
                </div>
                <div>
                     <div className="text-center text-slate-400 mb-4 p-2 border-t border-slate-700">
                        <p className="font-bold">{user?.name}</p>
                        <p className="text-sm">{user?.role === 'super_admin' ? 'مدير عام' : 'مدير محافظة'}</p>
                    </div>
                    <button onClick={logout} className="flex items-center w-full px-4 py-3 text-right rounded-lg transition-colors text-red-400 hover:bg-red-500 hover:text-white">
                        <LogOut className="w-6 h-6 ml-4" />
                        <span className="font-semibold">تسجيل الخروج</span>
                    </button>
                </div>
            </aside>
            <main className="flex-1 p-6 overflow-y-auto">
                {renderContent()}
            </main>
        </div>
    );
};

export default AdminDashboard;