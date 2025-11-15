
import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import type { LatLngExpression, LatLngTuple, Map } from 'leaflet';
import L from 'leaflet';

// Fix for default icon issue with webpack
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const customIcons = {
  start: new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
  }),
  end: new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
  }),
  driver: new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
  }),
};


interface MapUpdaterProps {
  center: LatLngExpression;
  zoom: number;
}

const MapUpdater: React.FC<MapUpdaterProps> = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
};

interface MarkerData {
    position: LatLngTuple;
    popupText: string;
    type: 'start' | 'end' | 'driver';
    isDraggable?: boolean;
    onDragEnd?: (latlng: { lat: number, lng: number }) => void;
}

interface MapComponentProps {
  center: LatLngTuple;
  zoom?: number;
  markers?: MarkerData[];
  route?: LatLngTuple[];
  routeType?: 'road' | 'straight';
}

const MapComponent: React.FC<MapComponentProps> = ({ center, zoom = 13, markers = [], route = [], routeType = 'road' }) => {
  const mapRef = useRef<Map>(null);

  useEffect(() => {
    // This effect addresses an issue where map tiles do not load correctly
    // if the map container's size is not immediately available on render.
    // By invalidating the map's size after a short delay, we force it
    // to re-calculate its dimensions and render the tiles correctly.
    const timer = setTimeout(() => {
      mapRef.current?.invalidateSize();
    }, 100);

    return () => {
      clearTimeout(timer);
    };
  }, []); // Empty dependency array ensures this runs once after the component mounts.

  const routePathOptions = routeType === 'straight'
    ? { color: '#f59e0b', weight: 5, opacity: 0.9, dashArray: '10, 10' } // Amber, dashed
    : { color: '#1e40af', weight: 5, opacity: 0.8 }; // Blue, solid


  return (
    <MapContainer center={center} zoom={zoom} scrollWheelZoom={true} ref={mapRef} style={{ height: '100%', width: '100%' }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapUpdater center={center} zoom={zoom} />
      
      {markers.map((marker, index) => (
        <Marker
            key={index}
            position={marker.position}
            icon={customIcons[marker.type]}
            draggable={marker.isDraggable}
            eventHandlers={{
                dragend: (e) => {
                    if (marker.onDragEnd) {
                        marker.onDragEnd(e.target.getLatLng());
                    }
                }
            }}
        >
          <Popup>{marker.popupText}</Popup>
        </Marker>
      ))}

      {route.length > 0 && <Polyline positions={route} pathOptions={routePathOptions} />}
    </MapContainer>
  );
};

export default MapComponent;
