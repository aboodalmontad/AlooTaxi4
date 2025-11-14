import { ORS_API_KEY } from '../constants';

const BASE_URL = 'https://api.openrouteservice.org';

interface LngLat {
  lng: number;
  lat: number;
}

export const getRoute = async (start: LngLat, end: LngLat) => {
  const response = await fetch(`${BASE_URL}/v2/directions/driving-car`, {
    method: 'POST',
    headers: {
      'Authorization': ORS_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      coordinates: [[start.lng, start.lat], [end.lng, end.lat]],
    }),
  });
  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`ORS getRoute failed with status ${response.status}:`, errorBody);
    // Try to parse the error for a more specific message
    try {
        const errorJson = JSON.parse(errorBody);
        if (errorJson?.error?.message) {
            throw new Error(errorJson.error.message);
        }
    } catch (e) {
        // Parsing failed, fall through to the generic error
    }
    throw new Error('Failed to fetch route');
  }
  return response.json();
};

// Corrected the URL endpoint for geocoding services by removing the /v2 prefix.
export const getAutocomplete = async (query: string, focusPoint?: LngLat): Promise<any[]> => {
  const params = new URLSearchParams({
    api_key: ORS_API_KEY,
    text: query,
  });
  if (focusPoint) {
    params.append('focus.point.lon', focusPoint.lng.toString());
    params.append('focus.point.lat', focusPoint.lat.toString());
  }

  const response = await fetch(`${BASE_URL}/geocode/autocomplete?${params.toString()}`);

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`ORS getAutocomplete (GET) failed with status ${response.status}:`, errorBody);
    throw new Error('Failed to fetch suggestions');
  }

  const data = await response.json();
  return data.features || [];
};

export const reverseGeocode = async (point: LngLat): Promise<string> => {
    const params = new URLSearchParams({
        api_key: ORS_API_KEY,
        'point.lon': point.lng.toString(),
        'point.lat': point.lat.toString(),
        size: '1'
    });

    const response = await fetch(`${BASE_URL}/geocode/reverse?${params.toString()}`);

    if (!response.ok) {
        const errorBody = await response.text();
        console.error(`ORS reverseGeocode (GET) failed with status ${response.status}:`, errorBody);
        throw new Error('Failed to reverse geocode');
    }
    
    const data = await response.json();
    // The 'label' property usually provides a good, full address.
    return data?.features?.[0]?.properties?.label || `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`;
};