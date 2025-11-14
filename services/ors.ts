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
    throw new Error('Failed to fetch route');
  }
  return response.json();
};

export const getAutocomplete = async (query: string, focusPoint?: LngLat) => {
    if (query.length < 3) return [];
    let url = `${BASE_URL}/geocode/autocomplete?api_key=${ORS_API_KEY}&text=${query}&lang=ar`;
    if (focusPoint) {
        url += `&focus.point.lon=${focusPoint.lng}&focus.point.lat=${focusPoint.lat}`;
    }
    const response = await fetch(url);
    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`ORS getAutocomplete failed with status ${response.status}:`, errorBody);
      throw new Error('Failed to fetch autocomplete suggestions');
    }
    const data = await response.json();
    return data.features;
};

export const reverseGeocode = async (point: LngLat) => {
    const url = `${BASE_URL}/geocode/reverse?api_key=${ORS_API_KEY}&point.lon=${point.lng}&point.lat=${point.lat}&lang=ar`;
    const response = await fetch(url);
    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`ORS reverseGeocode failed with status ${response.status}:`, errorBody);
      throw new Error('Failed to reverse geocode');
    }
    const data = await response.json();
    return data.features[0]?.properties?.label || 'موقع غير معروف';
}