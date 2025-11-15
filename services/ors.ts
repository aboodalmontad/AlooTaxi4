
const BASE_URL = 'https://api.openrouteservice.org';

interface LngLat {
  lng: number;
  lat: number;
}

export const getRoute = async (start: LngLat, end: LngLat, apiKey: string) => {
  const response = await fetch(`${BASE_URL}/v2/directions/driving-car`, {
    method: 'POST',
    headers: {
      'Authorization': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      coordinates: [[start.lng, start.lat], [end.lng, end.lat]],
    }),
  });
  if (!response.ok) {
    if (response.status === 403) {
      throw new Error('API_KEY_INVALID');
    }
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

// Corrected to use GET and the v1 geocode endpoint as per ORS documentation.
export const getAutocomplete = async (query: string, apiKey: string, focusPoint?: LngLat): Promise<any[]> => {
  const params = new URLSearchParams({
    api_key: apiKey,
    text: query,
  });
  if (focusPoint) {
    params.append('focus.point.lat', focusPoint.lat.toString());
    params.append('focus.point.lon', focusPoint.lng.toString());
  }

  const response = await fetch(`${BASE_URL}/geocode/autocomplete?${params.toString()}`);

  if (!response.ok) {
    if (response.status === 403) {
      throw new Error('API_KEY_INVALID');
    }
    const errorBody = await response.text();
    console.error(`ORS getAutocomplete (GET) failed with status ${response.status}:`, errorBody);
    throw new Error('Failed to fetch suggestions');
  }

  const data = await response.json();
  return data.features || [];
};

// Corrected to use GET and the v1 geocode endpoint as per ORS documentation.
export const reverseGeocode = async (point: LngLat, apiKey: string): Promise<string> => {
    const params = new URLSearchParams({
      api_key: apiKey,
      'point.lat': point.lat.toString(),
      'point.lon': point.lng.toString(),
    });

    const response = await fetch(`${BASE_URL}/geocode/reverse?${params.toString()}`);

    if (!response.ok) {
        if (response.status === 403) {
          throw new Error('API_KEY_INVALID');
        }
        const errorBody = await response.text();
        console.error(`ORS reverseGeocode (GET) failed with status ${response.status}:`, errorBody);
        throw new Error('Failed to reverse geocode');
    }
    
    const data = await response.json();
    return data?.features?.[0]?.properties?.label || `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`;
};