
interface LngLat {
  lng: number;
  lat: number;
}

/**
 * Fetches a driving route from the public OSRM API.
 * OSRM (Open Source Routing Machine) is a high-performance routing engine for OpenStreetMap data.
 * @param start - The starting coordinates.
 * @param end - The ending coordinates.
 * @returns An object containing the route geometry, distance in meters, and duration in seconds.
 */
export const getRouteOSRM = async (start: LngLat, end: LngLat) => {
    const url = `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`;

    const response = await fetch(url);
    if (!response.ok) {
        const errorBody = await response.text();
        console.error(`OSRM getRoute failed with status ${response.status}:`, errorBody);
        throw new Error('Failed to fetch route from OSRM');
    }

    const data = await response.json();

    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
        throw new Error('No route found by OSRM');
    }

    const route = data.routes[0];
    // OSRM returns coordinates as [lng, lat], so we swap them for Leaflet which expects [lat, lng].
    const geometry = route.geometry.coordinates.map((coord: number[]) => [coord[1], coord[0]]);
    const distance = route.distance; // in meters
    const duration = route.duration; // in seconds

    return { geometry, distance, duration };
};

/**
 * Performs reverse geocoding using the public Nominatim API.
 * Nominatim is a search engine for OpenStreetMap data.
 * @param point - The coordinates to geocode.
 * @returns A formatted address string.
 */
export const reverseGeocodeNominatim = async (point: LngLat): Promise<string> => {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${point.lat}&lon=${point.lng}`;

    const response = await fetch(url, {
        headers: {
            'Accept-Language': 'ar,en' // Prioritize Arabic names in the response
        }
    });

    if (!response.ok) {
        const errorBody = await response.text();
        console.error(`Nominatim reverseGeocode failed with status ${response.status}:`, errorBody);
        throw new Error('Failed to reverse geocode with Nominatim');
    }

    const data = await response.json();
    return data.display_name || `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`;
};
