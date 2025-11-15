import React, { useState, useEffect, useMemo } from 'react';
import type { LatLngTuple } from 'leaflet';
import MapComponent from '../map/MapComponent';
import { useGeolocation } from '../../hooks/useGeolocation';
import type { Trip } from '../../types';
import { supabase } from '../../services/supabase';
import { Navigation, Check, X, Phone, LogOut, LocateFixed } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import NotificationPopup from '../ui/NotificationPopup';

const formatSYP = (amount: number) => {
  return new Intl.NumberFormat('ar-SY', { style: 'currency', currency: 'SYP', minimumFractionDigits: 0 }).format(amount);
};


const DriverView: React.FC = () => {
    const { user, logout } = useAuth();
    const { lat, lng, error: geoError } = useGeolocation(true); // Watch for position changes
    const [currentTrip, setCurrentTrip] = useState<Trip | null>(null);
    const [incomingRequest, setIncomingRequest] = useState<Trip | null>(null);
    const [status, setStatus] = useState<'offline' | 'online' | 'in_trip'>('offline');
    const [notification, setNotification] = useState<{ message: string, type: 'info' | 'success' | 'warning' | 'error' } | null>(null);
    
    // Damascus as default, will be updated by geolocation
    const driverPosition = useMemo((): LatLngTuple => (lat && lng ? [lat, lng] : [33.5138, 36.2765]), [lat, lng]);
    const [mapCenter, setMapCenter] = useState<LatLngTuple>(driverPosition);
    const [initialLocationSet, setInitialLocationSet] = useState(false);

    // This effect centers the map on the driver's location once when it first becomes available.
    // After that, the driver is free to pan the map. The "Locate Me" button can be used to re-center.
    useEffect(() => {
        if (lat && lng && !initialLocationSet) {
            setMapCenter([lat, lng]);
            setInitialLocationSet(true);
        }
    }, [lat, lng, initialLocationSet]);

    // Show a notification if there's a geolocation error.
    useEffect(() => {
        if (geoError) {
            setNotification({ message: `خطأ في تحديد الموقع: ${geoError}`, type: 'error' });
        }
    }, [geoError]);


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
            {notification && <NotificationPopup message={notification.message} type={notification.type} onClose={() => setNotification(null)} />}
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
                     <button 
                        onClick={() => setStatus(s => s === 'online' ? 'offline' : 'online')} 
                        disabled={status === 'in_trip'}
                        className={`px-4 py-2 rounded-md font-bold transition ${
                            status !== 'offline' ? 'bg-green-600' : 'bg-red-600'
                        } ${status === 'in_trip' ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90'}`}
                    >
                        {status === 'in_trip' ? 'في رحلة' : status === 'online' ? 'متصل' : 'غير متصل'}
                    </button>
                </div>
            </div>
            
            <div className="absolute top-20 right-4 z-[1000]">
                 <button 
                    onClick={() => setMapCenter(driverPosition)} 
                    className="bg-sky-600 text-white p-3 rounded-full shadow-lg hover:bg-sky-500 transition-transform transform hover:scale-110"
                    aria-label="تحديد موقعي"
                    title="تحديد موقعي"
                 >
                    <LocateFixed className="h-6 w-6" />
                </button>
            </div>

            <div className="flex-grow">
                <MapComponent center={mapCenter} markers={mapMarkers} />
            </div>

            {/* Panels for trip status */}
            <div className="absolute bottom-0 left-0 right-0 z-[1000]">
                {incomingRequest && status === 'online' && (
                    <div className="bg-slate-800/90 backdrop-blur-md p-4 rounded-t-2xl shadow-2xl animate-fade-in-up">
                        <h3 className="text-xl font-bold text-sky-300 text-center mb-2">طلب رحلة جديد!</h3>
                        <div className="bg-slate-700 p-3 rounded-lg mb-4">
                            <p><span className="font-semibold text-slate-400">من:</span> {incomingRequest.pickup_address}</p>
                            <p><span className="font-semibold text-slate-400">إلى:</span> {incomingRequest.dropoff_address}</p>
                            <p><span className="font-semibold text-slate-400">الأجرة المقدرة:</span> <span className="font-bold text-amber-300">{formatSYP(incomingRequest.estimated_cost)}</span></p>
                        </div>
                        <div className="flex gap-4">
                            <button onClick={handleAcceptRequest} className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-lg transition flex items-center justify-center gap-2"><Check /> قبول</button>
                            <button onClick={handleDeclineRequest} className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-lg transition flex items-center justify-center gap-2"><X /> رفض</button>
                        </div>
                    </div>
                )}
                {currentTrip && status === 'in_trip' && (
                    <div className="bg-slate-800/90 backdrop-blur-md p-4 rounded-t-2xl shadow-2xl animate-fade-in-up">
                         {currentTrip.status === 'accepted' && (
                             <div>
                                 <h3 className="text-xl font-bold text-sky-300 text-center mb-2">في الطريق إلى الزبون</h3>
                                 <p className="text-center text-slate-300 mb-4">{currentTrip.pickup_address}</p>
                                 <div className="flex gap-4">
                                     <a href={`https://www.google.com/maps/dir/?api=1&destination=${currentTrip.pickup_location.lat},${currentTrip.pickup_location.lng}`} target="_blank" rel="noopener noreferrer" className="flex-1 bg-sky-600 hover:bg-sky-500 text-white font-bold py-3 rounded-lg transition flex items-center justify-center gap-2"><Navigation /> بدء الملاحة</a>
                                     <button onClick={() => updateTripStatus('driver_arrived')} className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold py-3 rounded-lg transition flex items-center justify-center gap-2"><Check /> وصلت</button>
                                 </div>
                             </div>
                         )}
                         {currentTrip.status === 'driver_arrived' && (
                              <div>
                                 <h3 className="text-xl font-bold text-green-400 text-center mb-4">لقد وصلت! بانتظار الزبون...</h3>
                                 <button onClick={() => updateTripStatus('in_progress')} className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-lg transition">بدء الرحلة</button>
                             </div>
                         )}
                          {currentTrip.status === 'in_progress' && (
                             <div>
                                 <h3 className="text-xl font-bold text-sky-300 text-center mb-2">الرحلة جارية إلى الوجهة</h3>
                                 <p className="text-center text-slate-300 mb-4">{currentTrip.dropoff_address}</p>
                                  <div className="flex gap-4">
                                      <a href={`https://www.google.com/maps/dir/?api=1&destination=${currentTrip.dropoff_location.lat},${currentTrip.dropoff_location.lng}`} target="_blank" rel="noopener noreferrer" className="flex-1 bg-sky-600 hover:bg-sky-500 text-white font-bold py-3 rounded-lg transition flex items-center justify-center gap-2"><Navigation /> الملاحة</a>
                                     <button onClick={() => updateTripStatus('completed')} className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-lg transition">إنهاء الرحلة</button>
                                  </div>
                             </div>
                         )}
                         {currentTrip.status === 'completed' && (
                              <div className="text-center">
                                 <h3 className="text-2xl font-bold text-green-400">الرحلة اكتملت!</h3>
                                 <p className="text-lg">الأجرة النهائية: {formatSYP(currentTrip.estimated_cost)}</p>
                             </div>
                         )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default DriverView;