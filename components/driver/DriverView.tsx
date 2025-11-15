import React, { useState, useEffect, useMemo } from 'react';
import type { LatLngTuple } from 'leaflet';
import MapComponent from '../map/MapComponent';
import { useGeolocation } from '../../hooks/useGeolocation';
import type { Trip } from '../../types';
import { supabase } from '../../services/supabase';
import { Navigation, Check, X, Phone, LogOut } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

const formatSYP = (amount: number) => {
  return new Intl.NumberFormat('ar-SY', { style: 'currency', currency: 'SYP', minimumFractionDigits: 0 }).format(amount);
};


const DriverView: React.FC = () => {
    const { user, logout } = useAuth();
    const { lat, lng } = useGeolocation(true); // Watch for position changes
    const [currentTrip, setCurrentTrip] = useState<Trip | null>(null);
    const [incomingRequest, setIncomingRequest] = useState<Trip | null>(null);
    const [status, setStatus] = useState<'offline' | 'online' | 'in_trip'>('offline');
    
    // Damascus as default, will be updated by geolocation
    const driverPosition = useMemo((): LatLngTuple => (lat && lng ? [lat, lng] : [33.5138, 36.2765]), [lat, lng]);

    // The mock for creating a fake trip request has been removed.
    // In a real app, this would be replaced by a Supabase real-time subscription
    // to listen for new trips assigned to this driver.
    
    const handleAcceptRequest = () => {
        if (incomingRequest) {
            setCurrentTrip({ ...incomingRequest, status: 'accepted' });
            setIncomingRequest(null);
            setStatus('in_trip');
        }
    };
    
    const handleDeclineRequest = () => {
        setIncomingRequest(null);
    };
    
    const updateTripStatus = (newStatus: 'driver_arrived' | 'in_progress' | 'completed') => {
        if (currentTrip) {
            setCurrentTrip({ ...currentTrip, status: newStatus });
            if (newStatus === 'completed') {
                setTimeout(() => {
                    setCurrentTrip(null);
                    setStatus('online');
                }, 3000);
            }
        }
    };
    
    const mapMarkers = useMemo(() => {
        // Fix: Explicitly type the `markers` array to allow for different marker types ('start', 'end', 'driver').
        const markers: { position: LatLngTuple; popupText: string; type: 'driver' | 'start' | 'end' }[] = [{
            position: driverPosition,
            popupText: 'موقعي الحالي',
            type: 'driver'
        }];
        if (currentTrip && currentTrip.status === 'accepted') {
            markers.push({
                position: [currentTrip.pickup_location.lat, currentTrip.pickup_location.lng],
                popupText: `التقاط الزبون: ${currentTrip.pickup_address}`,
                type: 'start'
            });
        }
        if (currentTrip && currentTrip.status === 'in_progress') {
             markers.push({
                position: [currentTrip.dropoff_location.lat, currentTrip.dropoff_location.lng],
                popupText: `وجهة الزبون: ${currentTrip.dropoff_address}`,
                type: 'end'
            });
        }
        return markers;
    }, [driverPosition, currentTrip]);

    return (
        <div className="h-screen w-screen flex flex-col relative text-white">
            <div className="absolute top-4 right-4 left-4 z-[1000] flex justify-between items-center">
                 <div className="flex items-center gap-3 bg-slate-800/80 backdrop-blur-md p-2 pl-3 rounded-lg shadow-lg">
                    <div>
                        <p className="text-sm text-slate-300">أهلاً بك،</p>
                        <p className="font-bold text-white -mt-1">{user?.name}</p>
                    </div>
                    <button 
                        onClick={logout} 
                        className="p-2 text-red-400 hover:bg-red-500/20 rounded-full transition" 
                        title="تسجيل الخروج"
                    >
                        <LogOut size={20} />
                    </button>
                </div>

                <div className="flex items-center gap-4 bg-slate-800/80 backdrop-blur-md p-3 rounded-lg shadow-lg">
                    <span className="font-semibold">الحالة:</span>
                    <button onClick={() => setStatus(s => s === 'online' ? 'offline' : 'online')} className={`px-4 py-2 rounded-md font-bold transition ${status !== 'offline' ? 'bg-green-600' : 'bg-red-600'}`}>
                        {status !== 'offline' ? 'متصل' : 'غير متصل'}
                    </button>
                </div>
            </div>

            <div className="flex-grow">
                <MapComponent center={driverPosition} zoom={15} markers={mapMarkers} />
            </div>
            
            {incomingRequest && status === 'online' && (
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-indigo-900 to-transparent z-[1000] animate-fade-in-up">
                    <div className="bg-slate-800/90 backdrop-blur-md p-6 rounded-2xl shadow-2xl border border-sky-500">
                        <h2 className="text-2xl font-bold text-sky-300 mb-4">لديك طلب توصيل جديد!</h2>
                        <div className="space-y-3 text-lg">
                            <p><span className="font-semibold text-slate-400">من:</span> {incomingRequest.pickup_address}</p>
                            <p><span className="font-semibold text-slate-400">إلى:</span> {incomingRequest.dropoff_address}</p>
                            <p><span className="font-semibold text-slate-400">الأجرة المقدرة:</span> <span className="font-bold text-green-400">{formatSYP(incomingRequest.estimated_cost)}</span></p>
                        </div>
                        <div className="flex gap-4 mt-6">
                            <button onClick={handleAcceptRequest} className="flex-1 bg-green-600 hover:bg-green-500 font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-transform transform hover:scale-105">
                                <Check /> قبول
                            </button>
                            <button onClick={handleDeclineRequest} className="flex-1 bg-red-600 hover:bg-red-500 font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-transform transform hover:scale-105">
                                <X /> رفض
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {currentTrip && status === 'in_trip' && (
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-slate-800/90 backdrop-blur-md rounded-t-2xl shadow-2xl z-[1000] animate-fade-in-up">
                    <h2 className="text-xl font-bold mb-3">
                       {currentTrip.status === 'accepted' && 'في الطريق إلى الزبون'}
                       {currentTrip.status === 'driver_arrived' && 'بانتظار الزبون'}
                       {currentTrip.status === 'in_progress' && 'الرحلة جارية'}
                       {currentTrip.status === 'completed' && 'اكتملت الرحلة بنجاح!'}
                    </h2>
                     <div className="text-slate-300 mb-4">
                        <p>{currentTrip.status !== 'in_progress' ? `من: ${currentTrip.pickup_address}` : `إلى: ${currentTrip.dropoff_address}`}</p>
                     </div>

                    {currentTrip.status === 'accepted' && (
                         <button onClick={() => updateTripStatus('driver_arrived')} className="w-full bg-sky-600 hover:bg-sky-500 font-bold py-3 px-4 rounded-lg transition">لقد وصلت</button>
                    )}
                    {currentTrip.status === 'driver_arrived' && (
                         <button onClick={() => updateTripStatus('in_progress')} className="w-full bg-green-600 hover:bg-green-500 font-bold py-3 px-4 rounded-lg transition">ابدأ الرحلة</button>
                    )}
                    {currentTrip.status === 'in_progress' && (
                         <button onClick={() => updateTripStatus('completed')} className="w-full bg-indigo-600 hover:bg-indigo-500 font-bold py-3 px-4 rounded-lg transition">إنهاء الرحلة</button>
                    )}
                </div>
            )}
        </div>
    );
};

export default DriverView;