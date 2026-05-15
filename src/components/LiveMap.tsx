import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { UserProfile, DeliveryRequest } from '../types';

// Fix for default marker icons in Leaflet
import 'leaflet/dist/leaflet.css';

const getTruckSvg = () => `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 17h4V5H2v12h3"/><path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5"/><path d="M14 17h1"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>`;

const getPackageSvg = () => `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>`;

const createCustomIcon = (color: string, svgString: string) => {
  return L.divIcon({
    html: `<div style="background-color: ${color}; padding: 8px; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); color: white; display: flex; align-items: center; justify-content: center;">
            ${svgString}
          </div>`,
    className: 'custom-div-icon',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
};

const driverIcon = createCustomIcon('#f97316', getTruckSvg()); // Orange for drivers
const deliveryIcon = createCustomIcon('#2563eb', getPackageSvg()); // Blue for deliveries


interface LiveMapProps {
  drivers: UserProfile[];
  deliveries: DeliveryRequest[];
}

// Sub-component to handle map centering/bounds
const MapBoundsHandler = ({ drivers, deliveries }: LiveMapProps) => {
  const map = useMap();

  useEffect(() => {
    const points: [number, number][] = [];
    
    drivers.forEach(d => {
      if (d.currentLocation?.lat && d.currentLocation?.lng) {
        points.push([d.currentLocation.lat, d.currentLocation.lng]);
      }
    });

    deliveries.forEach(d => {
      if (d.from?.lat && d.from?.lng) {
        points.push([d.from.lat, d.from.lng]);
      }
      if (d.to?.lat && d.to?.lng) {
        points.push([d.to.lat, d.to.lng]);
      }
    });

    if (points.length > 0) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [drivers, deliveries, map]);

  return null;
};

const LiveMap: React.FC<LiveMapProps> = ({ drivers, deliveries }) => {
  // Default center (e.g., Abidjan) if no points
  const defaultCenter: [number, number] = [5.36, -3.99];

  return (
    <div className="w-full h-full min-h-[400px] relative rounded-[32px] overflow-hidden border-4 border-white shadow-inner bg-slate-100">
      <MapContainer 
        center={defaultCenter} 
        zoom={12} 
        scrollWheelZoom={true}
        className="w-full h-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <MapBoundsHandler drivers={drivers} deliveries={deliveries} />

        {/* Render Drivers */}
        {drivers.map(driver => (
          driver.currentLocation?.lat && driver.currentLocation?.lng && (
            <Marker 
              key={driver.userId} 
              position={[driver.currentLocation.lat, driver.currentLocation.lng]}
              icon={driverIcon}
            >
              <Popup>
                <div className="p-1">
                  <p className="font-black text-slate-900 uppercase text-[10px] mb-1">{driver.name}</p>
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                    {driver.vehicleType || 'Livreur'} • {driver.status === 'online' ? 'Disponible' : 'Occupé'}
                  </p>
                </div>
              </Popup>
            </Marker>
          )
        ))}

        {/* Render Active Deliveries (To points) */}
        {deliveries.filter(d => d.status !== 'delivered' && d.status !== 'cancelled').map(delivery => (
          delivery.to?.lat && delivery.to?.lng && (
            <Marker 
              key={delivery.id} 
              position={[delivery.to.lat, delivery.to.lng]}
              icon={deliveryIcon}
            >
              <Popup>
                <div className="p-1">
                  <p className="font-black text-blue-600 uppercase text-[10px] mb-1">Dest: {delivery.recipientPhone || 'Client'}</p>
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                    Status: {delivery.status}
                  </p>
                </div>
              </Popup>
            </Marker>
          )
        ))}
      </MapContainer>

      {/* Stats Overlay */}
      <div className="absolute bottom-6 right-6 z-[1000] bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-2xl border border-white/50 flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-900">{drivers.length} Livreurs Actifs</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-blue-600" />
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-900">{deliveries.filter(d => d.status !== 'delivered').length} Points de destination</span>
        </div>
      </div>
    </div>
  );
};

export default LiveMap;
