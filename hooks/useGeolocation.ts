
import { useState, useEffect } from 'react';

interface GeolocationState {
  lat: number | null;
  lng: number | null;
  error: string | null;
}

export const useGeolocation = (watch: boolean = false) => {
  const [location, setLocation] = useState<GeolocationState>({ lat: null, lng: null, error: null });

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocation(loc => ({ ...loc, error: 'Geolocation is not supported by your browser' }));
      return;
    }

    let watcherId: number | undefined;

    const onSuccess = (position: GeolocationPosition) => {
      setLocation({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        error: null,
      });
    };

    const onError = (error: GeolocationPositionError) => {
      setLocation(loc => ({ ...loc, error: error.message }));
    };

    if (watch) {
      watcherId = navigator.geolocation.watchPosition(onSuccess, onError, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      });
    } else {
      navigator.geolocation.getCurrentPosition(onSuccess, onError);
    }

    return () => {
      if (watcherId) {
        navigator.geolocation.clearWatch(watcherId);
      }
    };
  }, [watch]);

  return location;
};
