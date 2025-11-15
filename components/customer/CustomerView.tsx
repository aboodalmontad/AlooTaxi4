
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { LatLngTuple } from 'leaflet';
import MapComponent from '../map/MapComponent';
import { useGeolocation } from '../../hooks/useGeolocation';
import { getAutocomplete } from '../../services/ors';
import { getRouteOSRM, reverseGeocodeNominatim } from '../../services/osrm';
import { MapPin, LocateFixed, Search, X, Phone, AlertTriangle, Route, Clock, ChevronUp, AlertCircle } from 'lucide-react';
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

// Calculates the great-circle distance between two points on Earth
const getStraightLineDistance = (p1: LatLngTuple, p2: LatLngTuple): number => {
    const R = 6371e3; // metres
    const φ1 = p1[0] * Math.PI/180; // φ, λ in radians
    const φ2 = p2[0] * Math.PI/180;
    const Δφ = (p2[0]-p1[0]) * Math.PI/180;
    const Δλ = (p2[1]-p1[1]) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // in metres
}


const AddressInput: React.FC<{
    value: string;
    onValueChange: (value: string) => void;
    placeholder: string;
    suggestions: any[];
    onSuggestionClick: (feature: any) => void;
    onClear: () => void;
    disabled?: boolean;
}> = ({ value, onValueChange, placeholder, suggestions, onSuggestionClick, onClear, disabled }) => {
    return (
        <div className="relative w-full">
            <Search className="absolute top-1/2 -translate-y-1/2 right-3 text-slate-400 h-5 w-5" />
            {value && <X onClick={onClear} className="absolute top-1/2 -translate-y-1/2 left-3 text-slate-400 h-5 w-5 cursor-pointer hover:text-white" />}
            <input
                type="text"
                value={value}
                onChange={e => onValueChange(e.target.value)}
                placeholder={placeholder}
                disabled={disabled}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg pr-10 pl-10 py-3 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 transition disabled:bg-slate-800 disabled:cursor-not-allowed"
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
    const [routeType, setRouteType] = useState<'road' | 'straight'>('road');
    const [distance, setDistance] = useState<number>(0);
    const [duration, setDuration] = useState<number>(0);
    const [selectedVehicle, setSelectedVehicle] = useState<VehicleType>(VehicleType.Regular);
    const [tripStatus, setTripStatus] = useState<'idle' | 'pricing' | 'requested' | 'confirmed' | 'ongoing'>('idle');
    const [notification, setNotification] = useState<{ message: string, type: 'info' | 'success' | 'warning' | 'error' } | null>(null);
    const [isContactModalOpen, setIsContactModalOpen] = useState(false);
    const [routeError, setRouteError] = useState<string | null>(null);
    const [isPanelOpen, setIsPanelOpen] = useState(true);
    const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);

    // Address search is an optional feature that requires an ORS API key.
    // Other map services (routing, reverse geocoding) work without it.
    const isAddressSearchAvailable = useMemo(() => !!settings.ors_api_key, [settings.ors_api_key]);
    
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
        setIsPanelOpen(true);
        try {
            const addr = address || await reverseGeocodeNominatim({lat: coords[0], lng: coords[1]});
            setPickup({ coords, address: addr });
            setPickupQuery(addr);
            setPickupSuggestions([]);
        } catch (error) {
            console.error("Error reverse geocoding for pickup:", error);
            setNotification({ message: 'تعذر تحديد اسم الموقع. يرجى التحقق من اتصالك بالإنترنت.', type: 'error' });
            // Set a fallback address
            setPickup({ coords, address: 'موقع محدد على الخريطة' });
            setPickupQuery('موقع محدد على الخريطة');
        }
    }, []);

    const handleSetDropoff = useCallback(async (coords: LatLngTuple, address?: string) => {
        setIsPanelOpen(true);
        try {
            const addr = address || await reverseGeocodeNominatim({lat: coords[0], lng: coords[1]});
            setDropoff({ coords, address: addr });
            setDropoffQuery(addr);
            setDropoffSuggestions([]);
        } catch (error) {
            console.error("Error reverse geocoding for dropoff:", error);
            setNotification({ message: 'تعذر تحديد اسم الموقع. يرجى التحقق من اتصالك بالإنترنت.', type: 'error' });
            // Set a fallback address
            setDropoff({ coords, address: 'موقع محدد على الخريطة' });
            setDropoffQuery('موقع محدد على الخريطة');
        }
    }, []);

    const fetchSuggestions = useCallback(async (query: string, setter: React.Dispatch<any[]>) => {
        if (!settings.ors_api_key) {
            return;
        }
        try {
            const focusPoint = lat && lng ? { lat, lng } : undefined;
            const features = await getAutocomplete(query, settings.ors_api_key, focusPoint);
            setter(features);
        } catch (error) {
            console.error("Error fetching suggestions:", error);
            let message = 'تعذر جلب اقتراحات العناوين. يرجى التحقق من اتصالك بالإنترنت.';
            if (error instanceof Error && error.message === 'API_KEY_INVALID') {
                message = 'خدمة البحث عن العناوين غير متاحة حالياً بسبب مشكلة في الإعدادات.';
            }
            setNotification({ message, type: 'error' });
        }
    }, [lat, lng, settings.ors_api_key]);

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
    
    const calculateRoute = useCallback(async () => {
        if (pickup && dropoff) {
            setIsCalculatingRoute(true);
            setRouteError(null);
            setRoute([]); // Clear previous route
            setDistance(0);
            setDuration(0);

            try {
                const routeData = await getRouteOSRM(
                    { lat: pickup.coords[0], lng: pickup.coords[1] },
                    { lat: dropoff.coords[0], lng: dropoff.coords[1] }
                );

                setRoute(routeData.geometry);
                setRouteType('road'); // Always a road route now
                setDistance(routeData.distance);
                setDuration(routeData.duration);
                setTripStatus('pricing');

            } catch (error) {
                console.error("Error fetching route from OSRM:", error);
                let userMessage = 'تعذر حساب المسار. يرجى التحقق من اتصالك بالإنترنت.';
                if (error instanceof Error && (error.message.includes('No route found') || error.message.includes('Failed to fetch'))) {
                    userMessage = 'تعذر إيجاد مسار بين النقطتين المحددتين. يرجى التأكد من أن المواقع على طرق يمكن الوصول إليها.';
                }
                setRouteError(userMessage);
                // We keep the trip status as pricing to show the error in the panel.
                setTripStatus('pricing');
            } finally {
                setIsCalculatingRoute(false);
            }
        }
    }, [pickup, dropoff]);

    useEffect(() => {
        // Debounce route calculation to avoid excessive API calls while dragging markers
        const handler = setTimeout(() => {
             calculateRoute();
        }, 300);
       
        return () => clearTimeout(handler);
    }, [pickup, dropoff, calculateRoute]);

    // Automatically open the panel when pricing information is ready or an error occurs
    useEffect(() => {
        if (tripStatus === 'pricing') {
            setIsPanelOpen(true);
        }
    }, [tripStatus]);

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
                 <MapComponent center={mapCenter} markers={markers} route={route} routeType={routeType} />
            </div>

            <div className={`absolute bottom-0 left-0 right-0 bg-slate-800/80 backdrop-blur-md rounded-t-2xl shadow-2xl z-[400] transition-transform duration-300 ease-in-out ${isPanelOpen ? 'translate-y-0' : 'translate-y-[calc(100%-56px)]'}`}>
                <button
                    onClick={() => setIsPanelOpen(!isPanelOpen)}
                    className="w-full h-14 flex justify-center items-center cursor-pointer"
                    aria-label={isPanelOpen ? "إخفاء اللوحة" : "إظهار اللوحة"}
                >
                    <ChevronUp className={`h-8 w-8 text-slate-400 transition-transform duration-300 ${!isPanelOpen ? 'rotate-180' : ''}`} />
                </button>
                <div className="p-4 pt-0">
                    {!isAddressSearchAvailable && (
                        <div className="bg-amber-900/50 border border-amber-700 text-amber-300 p-3 rounded-lg mb-4 text-center flex items-center justify-center gap-3">
                            <AlertTriangle className="h-6 w-6 flex-shrink-0" />
                            <p>ميزة البحث عن العناوين غير مفعّلة. باقي خدمات الخرائط تعمل بشكل طبيعي.</p>
                        </div>
                    )}
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
                                onClear={() => { setPickup(null); setPickupQuery(''); setRoute([]); setDistance(0); setDuration(0); setTripStatus('idle'); setRouteError(null); }}
                                disabled={!isAddressSearchAvailable}
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
                                onClear={() => { setDropoff(null); setDropoffQuery(''); setRoute([]); setDistance(0); setDuration(0); setTripStatus('idle'); setRouteError(null); }}
                                disabled={!isAddressSearchAvailable}
                             />
                        </div>
                        <button onClick={() => lat && lng && handleSetPickup([lat,lng])} className="p-3 bg-sky-600 hover:bg-sky-500 rounded-lg text-white transition">
                            <LocateFixed />
                        </button>
                    </div>
                    
                    {tripStatus === 'pricing' && (
                    <div className="animate-fade-in">
                        {routeError ? (
                            <div className="flex items-center justify-center gap-3 bg-red-900/50 border border-red-700 text-red-300 p-4 rounded-lg my-2">
                                <AlertTriangle className="h-6 w-6 flex-shrink-0" />
                                <p className="font-semibold text-center">{routeError}</p>
                            </div>
                        ) : (settingsLoading || isCalculatingRoute) ? (
                            <div className="flex items-center justify-center h-48 text-slate-400">
                               <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-400"></div>
                               <span className="ms-3">{settingsLoading ? 'جاري تحميل التسعيرة...' : 'جاري حساب المسار...'}</span>
                           </div>
                        ) : (
                        <>
                            {distance > 0 ? (
                                <>
                                <div className="bg-slate-900/50 p-3 rounded-lg mb-4 flex items-center justify-around text-center border border-slate-600">
                                    <div className="flex items-center gap-3">
                                        <Route className="h-6 w-6 text-sky-400" />
                                        <div>
                                            <p className="text-slate-400 text-xs">المسافة</p>
                                            <p className="text-white text-lg font-bold">{(distance / 1000).toFixed(1)} كم</p>
                                        </div>
                                    </div>
                                    {duration > 0 && (
                                        <>
                                        <div className="w-px h-10 bg-slate-600"></div> {/* Divider */}
                                        <div className="flex items-center gap-3">
                                            <Clock className="h-6 w-6 text-sky-400" />
                                            <div>
                                                <p className="text-slate-400 text-xs">الوقت المقدر</p>
                                                <p className="text-white text-lg font-bold">{Math.round(duration / 60)} دقيقة</p>
                                            </div>
                                        </div>
                                        </>
                                    )}
                                </div>
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
                                    <button onClick={handleRequestTrip} className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-4 rounded-lg transition-transform transform hover:scale-105" disabled={distance === 0}>
                                        تأكيد الطلب الآن
                                    </button>
                                     <button className="bg-slate-600 hover:bg-slate-500 text-white font-bold py-3 px-4 rounded-lg transition" disabled={distance === 0}>
                                        جدولة الرحلة
                                    </button>
                                </div>
                                </>
                            ) : null}
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
