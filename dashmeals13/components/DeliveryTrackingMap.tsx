import React, { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Location, Order, Restaurant } from '../types';
import { Bike, MapPin, Home, Navigation, Clock, ShieldCheck } from 'lucide-react';

interface Props {
  order: Order;
  restaurant: Restaurant | null;
}

// Helper to recenter map to show both points
const FitBounds = ({ points }: { points: [number, number][] }) => {
  const map = useMap();
  useEffect(() => {
    if (points.length > 0) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [50, 50], animate: true });
    }
  }, [points, map]);
  return null;
};

export const DeliveryTrackingMap: React.FC<Props> = ({ order, restaurant }) => {
  const [deliveryPos, setDeliveryPos] = useState<Location | null>(null);
  const [progress, setProgress] = useState(0);

  const destination = useMemo(() => order.deliveryLocation || { lat: -4.325, lng: 15.322 }, [order.deliveryLocation?.lat, order.deliveryLocation?.lng]);
  const start = useMemo(() => restaurant ? { latitude: restaurant.latitude, longitude: restaurant.longitude } : { latitude: -4.312, longitude: 15.310 }, [restaurant?.latitude, restaurant?.longitude]);

  // Simulate delivery movement
  useEffect(() => {
    if (order.status !== 'delivering') return;
    
    // If we have real-time coordinates, use them instead of simulation
    if (order.delivery_lat && order.delivery_lng) {
      setDeliveryPos({ latitude: order.delivery_lat, longitude: order.delivery_lng });
      
      // Calculate progress based on distance if possible, or just keep it at a reasonable value
      // For now, let's just use the real position
      return;
    }

    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 1) return 1;
        return prev + 0.01; // 1% every 2 seconds
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [order.status]);

  useEffect(() => {
    // Interpolate position
    const lat = start.latitude + (destination.lat - start.latitude) * progress;
    const lng = start.longitude + (destination.lng - start.longitude) * progress;
    setDeliveryPos({ latitude: lat, longitude: lng });
  }, [progress, start.latitude, start.longitude, destination.lat, destination.lng]);

  // Icons
  const restaurantIcon = L.divIcon({
    className: 'custom-resto-icon',
    html: `<div class="bg-orange-600 p-2 rounded-full border-2 border-white shadow-lg text-white"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });

  const customerIcon = L.divIcon({
    className: 'custom-customer-icon',
    html: `<div class="bg-blue-600 p-2 rounded-full border-2 border-white shadow-lg text-white"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });

  const deliveryIcon = L.divIcon({
    className: 'custom-delivery-icon',
    html: `<div class="bg-brand-600 p-2 rounded-full border-2 border-white shadow-xl text-white animate-bounce"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg></div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20]
  });

  const boundsPoints: [number, number][] = useMemo(() => [
    [start.latitude, start.longitude],
    [destination.lat, destination.lng]
  ], [start, destination]);

  return (
    <div className="relative w-full h-64 rounded-2xl overflow-hidden border border-gray-200 shadow-inner bg-gray-100 mb-4 z-0">
      <MapContainer 
        center={[start.latitude, start.longitude]} 
        zoom={14} 
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <FitBounds points={boundsPoints} />

        {/* Restaurant */}
        <Marker position={[start.latitude, start.longitude]} icon={restaurantIcon}>
          <Popup>Restaurant: {restaurant?.name || 'Départ'}</Popup>
        </Marker>

        {/* Customer */}
        <Marker position={[destination.lat, destination.lng]} icon={customerIcon}>
          <Popup>Votre destination</Popup>
        </Marker>

        {/* Delivery Person */}
        {deliveryPos && (
          <Marker position={[deliveryPos.latitude, deliveryPos.longitude]} icon={deliveryIcon}>
            <Popup>Livreur en mouvement</Popup>
          </Marker>
        )}
      </MapContainer>

      {/* Overlay Info */}
      <div className="absolute bottom-3 left-3 right-3 bg-white/90 backdrop-blur-md p-3 rounded-xl shadow-lg z-[400] flex items-center justify-between">
          <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-brand-100 rounded-full flex items-center justify-center text-brand-600">
                  <Bike size={20} />
              </div>
              <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Livreur en route</p>
                  <p className="text-sm font-black text-gray-800">Arrivée dans ~{Math.max(1, Math.round(15 * (1 - progress)))} min</p>
              </div>
          </div>
          <div className="flex flex-col items-end">
              <div className="flex items-center text-green-600 text-[10px] font-bold bg-green-50 px-2 py-0.5 rounded-full">
                  <ShieldCheck size={10} className="mr-1" /> Sécurisé
              </div>
              <p className="text-[10px] text-gray-400 mt-1">{Math.round(progress * 100)}% du trajet</p>
          </div>
      </div>

      {/* Progress Bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gray-200 z-[400]">
          <div 
            className="h-full bg-brand-500 transition-all duration-1000 ease-linear"
            style={{ width: `${progress * 100}%` }}
          ></div>
      </div>
    </div>
  );
};
