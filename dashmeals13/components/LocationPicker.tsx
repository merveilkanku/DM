import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Crosshair, Loader, AlertCircle, Navigation } from 'lucide-react';
import { toast } from 'sonner';

// Fix for default marker icon in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface Location {
  lat: number;
  lng: number;
  address?: string;
  city?: string;
  country?: string;
}

interface Props {
  onLocationSelect: (location: Location) => void;
  initialLocation?: Location;
  defaultCenter?: [number, number];
  defaultZoom?: number;
}

// Coordonnées exactes de Lubumbashi
const LUBUMBASHI_COORDS: [number, number] = [-11.6644, 27.4795];

// Coordonnées des grandes villes de RDC
const CITY_COORDINATES: Record<string, [number, number]> = {
  'Kinshasa': [-4.4419, 15.2663],
  'Lubumbashi': LUBUMBASHI_COORDS,
  'Goma': [-1.6741, 29.2342],
  'Bukavu': [-2.4978, 28.8529],
  'Kisangani': [0.5153, 25.1875],
  'Matadi': [-5.8167, 13.45],
  'Kananga': [-5.895, 22.4175],
  'Mbuji-Mayi': [-6.121, 23.603],
  'Kolwezi': [-10.7167, 25.4667],
  'Likasi': [-10.9833, 26.7333],
  'Boma': [-5.85, 13.05],
  'Kikwit': [-5.0333, 18.8167],
  'Mbandaka': [0.05, 18.2667],
  'Butembo': [0.1333, 29.2833],
  'Beni': [0.5, 29.4667]
};

const fetchAddress = async (lat: number, lng: number): Promise<{ address: string; city: string; country: string }> => {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'DashMeals-App/1.0'
        }
      }
    );
    const data = await res.json();
    
    const city = data.address?.city || 
                 data.address?.town || 
                 data.address?.village || 
                 data.address?.state ||
                 (lat > -12 && lat < -11 && lng > 27 && lng < 28 ? 'Lubumbashi' : 'Position inconnue');
    
    const country = data.address?.country || 'République Démocratique du Congo';
    const displayName = data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    
    return {
      address: displayName,
      city: city,
      country: country
    };
  } catch (error) {
    console.error("Reverse geocoding failed", error);
    return {
      address: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
      city: lat > -12 && lat < -11 && lng > 27 && lng < 28 ? 'Lubumbashi' : 'Position inconnue',
      country: 'RDC'
    };
  }
};

const LocationMarker = ({ 
  position, 
  setPosition, 
  onLocationSelect 
}: { 
  position: Location | null; 
  setPosition: (pos: Location) => void; 
  onLocationSelect: (pos: Location) => void;
}) => {
  const map = useMapEvents({
    async click(e) {
      const newPos = { lat: e.latlng.lat, lng: e.latlng.lng };
      const { address, city, country } = await fetchAddress(newPos.lat, newPos.lng);
      const locationData = { ...newPos, address, city, country };
      setPosition(locationData);
      onLocationSelect(locationData);
      toast.success(`📍 ${city} sélectionné`);
    },
  });

  useEffect(() => {
    if (position) {
      map.flyTo([position.lat, position.lng], map.getZoom());
    }
  }, [position, map]);

  return position === null ? null : (
    <Marker position={[position.lat, position.lng]} />
  );
};

export const LocationPicker: React.FC<Props> = ({ 
  onLocationSelect, 
  initialLocation,
  defaultCenter = LUBUMBASHI_COORDS,
  defaultZoom = 12
}) => {
  const [position, setPosition] = useState<Location | null>(initialLocation || null);
  const [isLocating, setIsLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>(defaultCenter);
  const [locationStatus, setLocationStatus] = useState<string>('');

  // Sélectionner Lubumbashi par défaut
  const selectLubumbashi = () => {
    const lubumbashiLocation = {
      lat: LUBUMBASHI_COORDS[0],
      lng: LUBUMBASHI_COORDS[1],
      address: "Lubumbashi, Haut-Katanga, République Démocratique du Congo",
      city: "Lubumbashi",
      country: "RDC"
    };
    
    setPosition(lubumbashiLocation);
    setMapCenter(LUBUMBASHI_COORDS);
    setLocationStatus("📍 Lubumbashi sélectionné");
    onLocationSelect(lubumbashiLocation);
    toast.success("📍 Lubumbashi sélectionné comme position");
    setError(null);
  };

  // Fonction pour détecter la position GPS avec gestion d'erreur améliorée
  const locateUser = () => {
    setIsLocating(true);
    setError(null);
    setLocationStatus('🔍 Activation du GPS...');
    
    if (!('geolocation' in navigator)) {
      const errorMsg = "❌ GPS non supporté. Veuillez sélectionner manuellement sur la carte.";
      setError(errorMsg);
      setLocationStatus(errorMsg);
      toast.error(errorMsg);
      setIsLocating(false);
      return;
    }
    
    // Vérifier si c'est un mobile (avec GPS réel)
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (!isMobile) {
      toast.info("💡 Sur ordinateur, la position par IP peut être imprécise. Cliquez directement sur la carte pour sélectionner Lubumbashi.");
      setLocationStatus("💡 Sur ordinateur, utilisez la carte pour sélectionner Lubumbashi");
      setIsLocating(false);
      return;
    }
    
    // Options pour mobile
    const options = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0
    };
    
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        
        console.log("📍 Position GPS mobile:", latitude, longitude);
        
        const { address, city, country } = await fetchAddress(latitude, longitude);
        const newPos = { lat: latitude, lng: longitude, address, city, country };
        
        setPosition(newPos);
        setMapCenter([latitude, longitude]);
        setLocationStatus(`✅ Position GPS: ${city} (précision: ${Math.round(accuracy)}m)`);
        
        onLocationSelect(newPos);
        toast.success(`📍 ${city} - Votre position GPS`);
        setIsLocating(false);
      },
      (err) => {
        // Formatage correct de l'erreur pour éviter le warning vide
        let errorMessage = "";
        switch (err.code) {
          case err.PERMISSION_DENIED:
            errorMessage = "❌ Permission GPS refusée. Activez la localisation dans les paramètres de votre appareil.";
            break;
          case err.POSITION_UNAVAILABLE:
            errorMessage = "❌ Signal GPS indisponible. Assurez-vous d'être à l'extérieur ou près d'une fenêtre.";
            break;
          case err.TIMEOUT:
            errorMessage = "⏱️ Délai GPS dépassé. Vérifiez votre connexion ou réessayez.";
            break;
          default:
            errorMessage = `❌ Erreur GPS: ${err.message || "cause inconnue"}`;
        }
        console.error("Geo error:", errorMessage);  // Maintenant un message lisible
        setError(errorMessage);
        setLocationStatus(errorMessage);
        toast.error(errorMessage);
        setIsLocating(false);
        
        // Proposer Lubumbashi
        setTimeout(() => {
          toast.info("💡 Utilisez le bouton 'Lubumbashi' ou cliquez sur la carte");
        }, 2000);
      },
      options
    );
  };

  // Fonction pour aller à une ville spécifique
  const goToCity = (cityName: string) => {
    const coords = CITY_COORDINATES[cityName];
    if (coords) {
      setMapCenter(coords);
      if (cityName === 'Lubumbashi') {
        selectLubumbashi();
      } else {
        setPosition(null);
        setLocationStatus(`📍 Carte centrée sur ${cityName}`);
        toast.info(`Affichage de ${cityName} - Cliquez sur la carte pour sélectionner`);
      }
    }
  };

  // Initialiser avec Lubumbashi (pas de détection automatique)
  useEffect(() => {
    if (!initialLocation) {
      selectLubumbashi();
    } else {
      setPosition(initialLocation);
      setMapCenter([initialLocation.lat, initialLocation.lng]);
    }
  }, []);

  return (
    <div className="space-y-4">
      {/* Barre de contrôle */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* BOUTON LUBUMBASHI - PRINCIPAL */}
        <button
          type="button"
          onClick={selectLubumbashi}
          className="flex items-center gap-2 bg-orange-500 text-white px-4 py-2 rounded-lg font-bold hover:bg-orange-600 transition-colors shadow-md"
        >
          <MapPin size={18} />
          📍 Lubumbashi
        </button>
        
        {/* Bouton GPS - visible uniquement sur mobile */}
        <button
          type="button"
          onClick={locateUser}
          disabled={isLocating}
          className="flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-brand-700 transition-colors disabled:opacity-50 md:opacity-70"
          title="Utiliser le GPS (recommandé sur mobile)"
        >
          {isLocating ? (
            <Loader size={18} className="animate-spin" />
          ) : (
            <Navigation size={18} />
          )}
          {isLocating ? 'Recherche...' : '📍 GPS'}
        </button>

        {/* Sélecteur rapide de villes */}
        <select
          onChange={(e) => goToCity(e.target.value)}
          value=""
          className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-white"
        >
          <option value="">🏙️ Autres villes...</option>
          {Object.keys(CITY_COORDINATES).map(city => (
            <option key={city} value={city}>{city}</option>
          ))}
        </select>
      </div>

      {/* Statut de localisation */}
      {locationStatus && (
        <div className={`text-xs p-2 rounded-lg flex items-center gap-2 ${
          locationStatus.includes('Lubumbashi') || locationStatus.includes('✅')
            ? 'bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/20 dark:text-green-400' 
            : locationStatus.includes('❌') || error
            ? 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-400'
            : 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/20 dark:text-blue-400'
        }`}>
          {locationStatus.includes('Lubumbashi') ? <MapPin size={14} /> : 
           locationStatus.includes('✅') ? <MapPin size={14} /> :
           locationStatus.includes('❌') ? <AlertCircle size={14} /> :
           <Loader size={14} className="animate-spin" />}
          {locationStatus}
        </div>
      )}

      {/* Carte */}
      <div className="relative w-full h-80 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-lg">
        <MapContainer 
          key={`${mapCenter[0]}-${mapCenter[1]}`}
          center={mapCenter} 
          zoom={defaultZoom} 
          style={{ height: '100%', width: '100%' }}
          zoomControl={true}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <LocationMarker 
            position={position} 
            setPosition={setPosition} 
            onLocationSelect={onLocationSelect} 
          />
        </MapContainer>

        {/* Message d'info */}
        {!position && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center bg-black/5">
            <div className="bg-white dark:bg-gray-800 px-4 py-2 rounded-lg shadow-sm font-medium text-sm text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <MapPin size={16} className="text-brand-600" />
              Cliquez sur la carte pour définir votre position
            </div>
          </div>
        )}
        
        {/* Indicateur Lubumbashi */}
        {position?.city === 'Lubumbashi' && (
          <div className="absolute top-2 left-2 z-[400] bg-orange-500 text-white text-xs px-2 py-1 rounded-full shadow-md flex items-center gap-1">
            <MapPin size={12} />
            🇨🇩 Lubumbashi
          </div>
        )}
      </div>

      {/* Affichage de la position sélectionnée */}
      {position && (
        <div className={`p-4 rounded-xl border ${
          position.city === 'Lubumbashi' 
            ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
            : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
        }`}>
          <div className="flex items-start gap-3">
            <MapPin size={20} className={`${
              position.city === 'Lubumbashi' 
                ? 'text-orange-600 dark:text-orange-400'
                : 'text-green-600 dark:text-green-400'
            } mt-0.5`} />
            <div className="flex-1">
              <p className={`font-bold ${
                position.city === 'Lubumbashi' 
                  ? 'text-orange-800 dark:text-orange-300'
                  : 'text-green-800 dark:text-green-300'
              }`}>
                {position.city || 'Position sélectionnée'}
                {position.city === 'Lubumbashi' && ' 🇨🇩'}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                {position.address || `${position.lat.toFixed(6)}, ${position.lng.toFixed(6)}`}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-2 font-mono">
                📍 {position.lat.toFixed(6)}, {position.lng.toFixed(6)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Message d'erreur */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-xl border border-red-200 dark:border-red-800">
          <div className="flex items-start gap-2">
            <AlertCircle size={18} className="text-red-600 dark:text-red-400 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
              <button
                onClick={selectLubumbashi}
                className="mt-2 text-xs text-red-600 dark:text-red-400 underline hover:no-underline"
              >
                📍 Sélectionner Lubumbashi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg text-xs text-gray-500 dark:text-gray-400 text-center">
        💡 <strong>Lubumbashi</strong> est sélectionné par défaut.<br />
        📱 Sur mobile, utilisez le bouton <strong>GPS</strong> pour votre position réelle.<br />
        🖱️ Sur ordinateur, cliquez directement sur la carte pour sélectionner un point.
      </div>
    </div>
  );
};