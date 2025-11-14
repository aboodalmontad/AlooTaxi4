
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { LatLngTuple } from 'leaflet';
import MapComponent from '../map/MapComponent';
import { useGeolocation } from '../../hooks/useGeolocation';
import { getRoute, getAutocomplete, reverseGeocode } from '../../services/ors';
import { MapPin, LocateFixed, Search, X, Phone, AlertTriangle } from 'lucide-react';
import { VEHICLE_ICONS } from '../../constants';
import { VehicleType } from '../../types';
import NotificationPopup from '../ui/NotificationPopup';
import { useSettings } from '../../contexts/SettingsContext';
import Modal from '../ui/Modal';


// Helper to format currency in Syrian Pounds
const formatSYP = (amount: number) => {
  return new Intl.NumberFormat('ar-SY', {
    style: 'currency',
    currency: 'SYP',
    minimumFractionDigits: 0,
  }).format(amount);
};


const AddressInput: React.FC<{
    value: string;
    onValueChange: (value: string) => void;
    placeholder: string;
    suggestions: any[];
    onSuggestionClick: (feature: any) => void;
    onClear: () => void;
}> = ({ value, onValueChange, placeholder, suggestions, onSuggestionClick, onClear }) => {
    return (
        <div className="relative w-full">
            <Search className="absolute top-1/2 -translate-y-1/2 right-3 text-slate-400 h-5 w-5" />
            {value && <X onClick={onClear} className="absolute top-1/2 -translate-y-1/2 left-3 text-slate-400 h-5 w-5 cursor-pointer hover:text-white" />}
            <input
                type="text"
                value={value}
                onChange={e => onValueChange(e.target.value)}
                placeholder={placeholder}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg pr-10 pl-10 py-3 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 transition"
            />
            {suggestions.length > 0 && (
                <ul className="absolute bottom-full mb-2 w-full bg-slate-800 border border-slate-600 rounded-lg shadow-lg max-h-48 overflow-y-auto z-10">
                    {suggestions.map((feature, i) => (
                        <li key={i} onClick={() => onSuggestionClick(feature)} className="px-4 py-2 text-white hover:bg-sky-700 cursor-pointer">
                            {feature.properties.label}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};


const CustomerView: React.FC = () => {
    const [mapCenter, setMapCenter] = useState<LatLngTuple>([33.5138, 36.2765]); // Damascus
    const { lat, lng, error: geoError } = useGeolocation();
    const { settings, loading: settingsLoading } = useSettings();

    const [pickup, setPickup] = useState<{coords: LatLngTuple, address: string} | null>(null);
    const [dropoff, setDropoff] = useState<{coords: LatLngTuple, address: string} | null>(null);

    const [pickupQuery, setPickupQuery] = useState('');
    const [dropoffQuery, setDropoffQuery] = useState('');
    
    const [pickupSuggestions, setPickupSuggestions] = useState<any[]>([]);
    const [dropoffSuggestions, setDropoffSuggestions] = useState<any[]>([]);

    const [route, setRoute] = useState<LatLngTuple[]>([]);
    const [distance, setDistance] = useState<number>(0);
    const [selectedVehicle, setSelectedVehicle] = useState<VehicleType>(VehicleType.Regular);
    const [tripStatus, setTripStatus] = useState<'idle' | 'pricing' | 'requested' | 'confirmed' | 'ongoing'>('idle');
    const [notification, setNotification] = useState<{ message: string, type: 'info' | 'success' | 'warning' | 'error' } | null>(null);
    const [isContactModalOpen, setIsContactModalOpen] = useState(false);
    const [routeError, setRouteError] = useState<string | null>(null);
    
    useEffect(() => {
        if (lat && lng) {
            const userLocation: LatLngTuple = [lat, lng];
            setMapCenter(userLocation);
            if (!pickup) {
                handleSetPickup(userLocation, 'موقعي الحالي');
            }
        }
    }, [lat, lng]);
    
    const handleSetPickup = useCallback(async (coords: LatLngTuple, address?: string) => {
        try {
            const addr = address || await reverseGeocode({lat: coords[0], lng: coords[1]});
            setPickup({ coords, address: addr });
            setPickupQuery(addr);
            setPickupSuggestions([]);
        } catch (error) {
            console.error("Error reverse geocoding for pickup:", error);
            setNotification({ message: 'تعذر تحديد اسم الموقع. يرجى التحقق من اتصالك بالإنترنت.', type: 'error' });
            setPickup({ coords, address: 'موقع محدد على الخريطة' });
            setPickupQuery('موقع محدد على الخريطة');
        }
    }, []);

    const handleSetDropoff = useCallback(async (coords: LatLngTuple, address?: string) => {
        try {
            const addr = address || await reverseGeocode({lat: coords[0], lng: coords[1]});
            setDropoff({ coords, address: addr });
            setDropoffQuery(addr);
            setDropoffSuggestions([]);
        } catch (error) {
            console.error("Error reverse geocoding for dropoff:", error);
            setNotification({ message: 'تعذر تحديد اسم الموقع. يرجى التحقق من اتصالك بالإنترنت.', type: 'error' });
            setDropoff({ coords, address: 'موقع محدد على الخريطة' });
            setDropoffQuery('موقع محدد على الخريطة');
        }
    }, []);

    const fetchSuggestions = useCallback(async (query: string, setter: React.Dispatch<any[]>) => {
        try {
            const focusPoint = lat && lng ? { lat, lng } : undefined;
            const features = await getAutocomplete(query, focusPoint);
            setter(features);
        } catch (error) {
            console.error("Error fetching suggestions:", error);
            setNotification({ message: 'تعذر جلب اقتراحات العناوين. يرجى التحقق من اتصالك بالإنترنت.', type: 'error' });
        }
    }, [lat, lng]);

    useEffect(() => {
        const handler = setTimeout(() => {
            if (pickupQuery && pickupQuery !== pickup?.address) fetchSuggestions(pickupQuery, setPickupSuggestions);
        }, 500);
        return () => clearTimeout(handler);
    }, [pickupQuery, fetchSuggestions, pickup?.address]);

    useEffect(() => {
        const handler = setTimeout(() => {
            if (dropoffQuery && dropoffQuery !== dropoff?.address) fetchSuggestions(dropoffQuery, setDropoffSuggestions);
        }, 500);
        return () => clearTimeout(handler);
    }, [dropoffQuery, fetchSuggestions, dropoff?.address]);
    
    useEffect(() => {
        const calculateRoute = async () => {
            if (pickup && dropoff) {
                setRouteError(null); // Clear previous errors when recalculating
                try {
                    const routeData = await getRoute(
                        { lat: pickup.coords[0], lng: pickup.coords[1] },
                        { lat: dropoff.coords[0], lng: dropoff.coords[1] }
                    );

                    if (routeData && routeData.features && routeData.features.length > 0 && routeData.features[0].geometry) {
                        const routeCoords = routeData.features[0].geometry.coordinates.map((c: number[]) => [c[1], c[0]] as LatLngTuple);
                        setRoute(routeCoords);
                        setDistance(routeData.features[0].properties.summary.distance); // in meters
                        setTripStatus('pricing');
                    } else {
                        console.warn("No route returned from ORS API for the selected points.");
                        setRouteError('تعذر إيجاد مسار بين النقطتين المحددتين. الرجاء تجربة مواقع مختلفة.');
                        setRoute([]);
                        setDistance(0);
                        setTripStatus('pricing'); // Keep panel open to show error
                    }
                } catch (error) {
                    console.error("Error fetching route from ORS:", error);
                    setRouteError('تعذر حساب المسار. يرجى التحقق من اتصالك بالإنترنت.');
                    setRoute([]);
                    setDistance(0);
                    setTripStatus('pricing'); // Keep panel open to show error
                }
            }
        };
        calculateRoute();
    }, [pickup, dropoff]);

    const markers = useMemo(() => {
        const m = [];
        if (pickup) m.push({
            position: pickup.coords, popupText: `نقطة الانطلاق: ${pickup.address}`, type: 'start' as const, isDraggable: true,
            onDragEnd: (latlng: {lat: number, lng: number}) => handleSetPickup([latlng.lat, latlng.lng])
        });
        if (dropoff) m.push({
            position: dropoff.coords, popupText: `الوجهة: ${dropoff.address}`, type: 'end' as const, isDraggable: true,
            onDragEnd: (latlng: {lat: number, lng: number}) => handleSetDropoff([latlng.lat, latlng.lng])
        });
        return m;
    }, [pickup, dropoff, handleSetPickup, handleSetDropoff]);

    const calculatePrice = (vehicle: VehicleType) => {
        if (!settings || distance === 0) return 0;
        const distanceInKm = distance / 1000;
        const multiplier = settings.vehicle_multipliers[vehicle] || 1;
        return Math.round((settings.base_fare_syp + (distanceInKm * settings.per_km_fare_syp)) * multiplier);
    };

    const handleRequestTrip = () => {
        setTripStatus('requested');
        setNotification({ message: 'تم إرسال طلبك! جاري البحث عن أقرب سائق...', type: 'info' });
        // Mock driver acceptance
        setTimeout(() => {
            setTripStatus('confirmed');
            setNotification({ message: 'تم قبول رحلتك! السائق في طريقه إليك.', type: 'success' });
        }, 5000);
    }
    
    return (
        <div className="h-screen w-screen flex flex-col relative">
            {notification && <NotificationPopup message={notification.message} type={notification.type} onClose={() => setNotification(null)} />}
            
            <button
                onClick={() => setIsContactModalOpen(true)}
                className="absolute top-4 right-4 z-[401] bg-sky-600 text-white p-3 rounded-full shadow-lg hover:bg-sky-500 transition-transform transform hover:scale-110"
                aria-label="تواصل مع الإدارة"
            >
                <Phone className="h-6 w-6" />
            </button>
            
            <div className="flex-grow">
                 <MapComponent center={mapCenter} markers={markers} route={route} />
            </div>

            <div className="absolute bottom-0 left-0 right-0 bg-slate-800/80 backdrop-blur-md p-4 rounded-t-2xl shadow-2xl z-[400]">
                {tripStatus === 'idle' || tripStatus === 'pricing' ? (
                <>
                <div className="flex flex-col md:flex-row gap-4 mb-4">
                    <div className="flex-1 flex items-center gap-2">
                         <MapPin className="text-green-400 h-6 w-6 flex-shrink-0" />
                         <AddressInput
                            value={pickupQuery}
                            onValueChange={setPickupQuery}
                            placeholder="نقطة الانطلاق"
                            suggestions={pickupSuggestions}
                            onSuggestionClick={(f) => handleSetPickup([f.geometry.coordinates[1], f.geometry.coordinates[0]], f.properties.label)}
                            onClear={() => { setPickup(null); setPickupQuery(''); setRoute([]); setTripStatus('idle'); setRouteError(null); }}
                         />
                    </div>
                     <div className="flex-1 flex items-center gap-2">
                        <MapPin className="text-red-400 h-6 w-6 flex-shrink-0" />
                        <AddressInput
                            value={dropoffQuery}
                            onValueChange={setDropoffQuery}
                            placeholder="إلى أين تريد الذهاب؟"
                            suggestions={dropoffSuggestions}
                            onSuggestionClick={(f) => handleSetDropoff([f.geometry.coordinates[1], f.geometry.coordinates[0]], f.properties.label)}
                            onClear={() => { setDropoff(null); setDropoffQuery(''); setRoute([]); setTripStatus('idle'); setRouteError(null); }}
                         />
                    </div>
                    <button onClick={() => lat && lng && handleSetPickup([lat,lng])} className="p-3 bg-sky-600 hover:bg-sky-500 rounded-lg text-white transition">
                        <LocateFixed />
                    </button>
                </div>
                
                {tripStatus === 'pricing' && (
                <div className="animate-fade-in">
                    {routeError ? (
                        <div className="flex items-center justify-center gap-3 bg-amber-900/50 border border-amber-700 text-amber-300 p-4 rounded-lg my-2">
                            <AlertTriangle className="h-6 w-6 flex-shrink-0" />
                            <p className="font-semibold text-center">{routeError}</p>
                        </div>
                    ) : settingsLoading ? (
                        <div className="flex items-center justify-center h-48 text-slate-400">
                           <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-400"></div>
                           <span className="ms-3">جاري تحميل التسعيرة...</span>
                       </div>
                    ) : (
                    <>
                        <h3 className="text-white text-lg font-semibold mb-3">اختر نوع المركبة:</h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
                            {Object.values(VehicleType).map((vehicleKey) => {
                                const Icon = VEHICLE_ICONS[vehicleKey];
                                if (!Icon || !settings || settings.vehicle_multipliers[vehicleKey] === undefined) return null;

                                const isActive = selectedVehicle === vehicleKey;
                                return (
                                    <button key={vehicleKey} onClick={() => setSelectedVehicle(vehicleKey)} className={`p-3 rounded-lg text-center transition ${isActive ? 'bg-sky-600 text-white ring-2 ring-sky-300' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>
                                        <Icon className="mx-auto h-8 w-8 mb-2" />
                                        <span className="block text-sm font-medium">{vehicleKey}</span>
                                        <span className="block text-xs font-bold text-sky-300 mt-1">{formatSYP(calculatePrice(vehicleKey))}</span>
                                    </button>
                                );
                            })}
                        </div>
                        <div className="flex gap-4">
                            <button onClick={handleRequestTrip} className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-4 rounded-lg transition-transform transform hover:scale-105">
                                تأكيد الطلب الآن
                            </button>
                             <button className="bg-slate-600 hover:bg-slate-500 text-white font-bold py-3 px-4 rounded-lg transition">
                                جدولة الرحلة
                            </button>
                        </div>
                    </>
                    )}
                </div>
                )}
                </>
                ) : (
                    <div className="text-center py-4 text-white animate-fade-in">
                        <h2 className="text-2xl font-bold mb-2">{notification?.message}</h2>
                        {tripStatus === 'requested' && <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-300 mx-auto mt-4"></div>}
                        {tripStatus === 'confirmed' && <p>يمكنك تتبع السائق على الخريطة.</p>}
                    </div>
                )}
            </div>

            <Modal
                isOpen={isContactModalOpen}
                onClose={() => setIsContactModalOpen(false)}
                title="تواصل مع الإدارة"
            >
                <div className="text-center">
                    <p className="text-slate-300 mb-4">
                        في حال واجهتك أي مشكلة، يمكنك التواصل مباشرة مع المدير على الرقم التالي:
                    </p>
                    <p dir="ltr" className="text-2xl font-bold text-sky-300 tracking-wider mb-6">
                        {settings?.manager_phone || 'غير متوفر'}
                    </p>
                    <a
                        href={`tel:${settings?.manager_phone}`}
                        className="w-full inline-flex justify-center items-center gap-2 bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-4 rounded-lg transition-transform transform hover:scale-105"
                    >
                        <Phone />
                        اتصل الآن
                    </a>
                </div>
            </Modal>
        </div>
    );
};

export default CustomerView;
