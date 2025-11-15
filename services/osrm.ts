interface LngLat {
  lng: number;
  lat: number;
}

/**
 * Snaps a coordinate to the nearest point on the road network using OSRM's nearest service.
 * This is a private helper function.
 * @param point - The coordinates to snap.
 * @returns The snapped coordinates, or the original coordinates if snapping fails.
 */
const snapToRoad = async (point: LngLat): Promise<LngLat> => {
    const url = `https://router.project-osrm.org/nearest/v1/driving/${point.lng},${point.lat}`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`OSRM snapToRoad failed with status ${response.status} for point ${point.lng},${point.lat}`);
            return point; // Return original point if snapping fails
        }
        const data = await response.json();
        if (data.code === 'Ok' && data.waypoints && data.waypoints.length > 0) {
            const [lng, lat] = data.waypoints[0].location;
            return { lng, lat };
        }
        return point; // Return original if no snapped point found
    } catch (error) {
        console.error("Error during snapToRoad fetch:", error);
        return point;
    }
};


/**
 * Fetches a driving route from the public OSRM API.
 * If a route is not found, it attempts to snap the start/end points to the nearest road and retries.
 * @param start - The starting coordinates.
 * @param end - The ending coordinates.
 * @returns An object containing the route geometry, distance in meters, and duration in seconds.
 */
export const getRouteOSRM = async (start: LngLat, end: LngLat) => {
    const fetchRouteData = async (startPoint: LngLat, endPoint: LngLat) => {
        const url = `https://router.project-osrm.org/route/v1/driving/${startPoint.lng},${startPoint.lat};${endPoint.lng},${endPoint.lat}?overview=full&geometries=geojson`;
        return fetch(url);
    };

    let response = await fetchRouteData(start, end);

    // If the initial request fails with a "NoRoute" error (HTTP 400), try snapping points to the road.
    if (!response.ok && response.status === 400) {
        try {
            const errorData = await response.json();
            if (errorData.code === 'NoRoute') {
                console.warn("OSRM couldn't find a route. Snapping points to nearest road and retrying.");
                
                // Snap both start and end points concurrently for better performance.
                const [snappedStart, snappedEnd] = await Promise.all([
                    snapToRoad(start),
                    snapToRoad(end)
                ]);
                
                // Retry only if coordinates actually changed to avoid an identical failing request.
                if (snappedStart.lat !== start.lat || snappedStart.lng !== start.lng ||
                    snappedEnd.lat !== end.lat || snappedEnd.lng !== end.lng) {
                    
                    response = await fetchRouteData(snappedStart, snappedEnd);
                }
            }
        } catch (e) {
            // This catches JSON parsing errors or other issues during the retry logic.
            // We'll let it fall through to the generic error handling below.
             console.error("Error while handling OSRM NoRoute fallback:", e);
        }
    }

    // Final check on the response after any potential retries.
    if (!response.ok) {
        const errorBody = await response.text();
        console.error(`OSRM getRoute failed with status ${response.status}:`, errorBody);
        
        // Provide a more specific error message to the frontend if possible.
        try {
            const errorJson = JSON.parse(errorBody);
            if (errorJson.code === 'NoRoute') {
                 throw new Error('No route found even after snapping to nearest roads.');
            }
        } catch(e) { /* ignore parse error if body is not JSON */ }
        
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
