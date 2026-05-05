import React, { useState, useEffect } from 'react';
import { Clock, Bike, Star, Footprints, Flame, Phone, MapPin, Bell, UserPlus, Heart, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Restaurant } from '../types';
import { formatDistance, formatTime } from '../utils/geo';
import { formatDualPrice } from '../utils/format';
import { toast } from 'sonner';

interface Props {
  restaurant: Restaurant;
  onClick: () => void;
  promotionsCount?: number;
  isSubscribed?: boolean;
  onSubscribe?: (e: React.MouseEvent) => void;
  isSubscribing?: boolean;
  isGuest?: boolean;
}

export const RestaurantCard: React.FC<Props> = ({
  restaurant,
  onClick,
  promotionsCount = 0,
  isSubscribed = false,
  onSubscribe,
  isSubscribing = false,
  isGuest = false,
}) => {
  // Récupération des plats populaires (les 3 premiers du menu)
  const popularItems = restaurant.menu?.slice(0, 3) || [];

  return (
    <div
      onClick={onClick}
      className={`group relative glass rounded-[40px] shadow-sm hover:shadow-2xl overflow-hidden transition-all duration-700 cursor-pointer mb-8 transform hover:-translate-y-2 border border-white/40 dark:border-white/5 active:scale-[0.98] ${
        restaurant.isVerified
          ? 'ring-2 ring-amber-400/30'
          : ''
      }`}
    >
      {/* Image Header */}
      <div className="relative h-60 w-full overflow-hidden">
        <img
          src={restaurant.coverImage}
          alt={restaurant.name}
          className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
          referrerPolicy="no-referrer"
          onError={(e) => {
            (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${restaurant.id}/800/600`;
          }}
        />

        {/* Dynamic Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-80 group-hover:opacity-60 transition-opacity duration-700" />

        {/* Top Badges */}
        <div className="absolute top-3 left-3 flex flex-wrap gap-2">
          {restaurant.isVerified && (
            <span className="bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg shadow-lg flex items-center border border-white/20">
              <Star size={10} className="mr-1 fill-white" /> Premium
            </span>
          )}
          {isSubscribed && (
            <span className="bg-brand-500/90 backdrop-blur-md text-white text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg shadow-lg flex items-center border border-white/20">
              <Bell size={10} className="mr-1 fill-white" /> Abonné
            </span>
          )}
          {promotionsCount > 0 && (
            <span className="bg-rose-500/90 backdrop-blur-md text-white text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg shadow-lg flex items-center border border-white/20 animate-pulse">
              <Flame size={10} className="mr-1 fill-white" /> {promotionsCount} Promo
              {promotionsCount > 1 ? 's' : ''}
            </span>
          )}
          <div className="flex items-center">
            {restaurant.isOpen ? (
              <div className="bg-emerald-500/90 backdrop-blur-md p-1.5 rounded-full shadow-lg border border-white/20" title="Ouvert">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse shadow-[0_0_8px_rgba(255,255,255,0.8)]"></div>
              </div>
            ) : (
              <div className="bg-gray-500/90 backdrop-blur-md p-1.5 rounded-full shadow-lg border border-white/20" title="Fermé">
                <div className="w-2 h-2 bg-white/60 rounded-full"></div>
              </div>
            )}
          </div>
          <span className="bg-black/60 backdrop-blur-md text-white text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg shadow-lg">
            {restaurant.type === 'restaurant' ? 'Restaurant' : 'Snack'}
          </span>
        </div>

        {/* Étoiles */}
        <div className="absolute top-4 right-4">
          <div className="flex items-center space-x-1.5 bg-black/40 backdrop-blur-xl px-3 py-1.5 rounded-2xl shadow-2xl border border-white/20 transition-transform group-hover:scale-110">
            <Star size={12} className="fill-amber-400 text-amber-400" />
            <span className="text-[11px] font-black text-white">
              {restaurant.rating || 4.5}
            </span>
            <span className="text-[9px] text-gray-300 font-bold opacity-80">({restaurant.reviewCount || 0})</span>
          </div>
        </div>

        {/* Infos en bas de l'image */}
        <div className="absolute bottom-6 left-6 right-6 flex justify-between items-end">
          <div className="flex-1 min-w-0 mr-4">
            <div className="flex items-center space-x-2 mb-1.5">
              <h3 className="text-2xl font-display font-black text-white leading-none tracking-tight uppercase italic drop-shadow-2xl truncate">
                {restaurant.name}
              </h3>
              {restaurant.isVerified && (
                <CheckCircle2 size={18} className="text-blue-400 drop-shadow-lg flex-shrink-0" />
              )}
            </div>
            <div className="flex items-center text-white/80 text-[10px] font-black uppercase tracking-widest bg-black/20 backdrop-blur-sm self-start px-2 py-1 rounded-lg inline-flex">
              <MapPin size={10} className="mr-1.5 text-brand-400" />
              {restaurant.city || 'Kinshasa'} • {formatDistance(restaurant.distance)}
            </div>
          </div>

          <div className="bg-brand-500 text-white rounded-[20px] p-3 text-center min-w-[70px] shadow-2xl border border-white/20 transform group-hover:scale-110 transition-transform duration-500">
            <p className="text-[8px] text-white/80 uppercase font-black tracking-widest mb-0.5">LIVRAISON</p>
            <p className="text-white font-black text-xs">~{restaurant.estimatedDeliveryTime || 30} MIN</p>
          </div>
        </div>
      </div>

      {/* Corps de la carte */}
      <div className="p-5">
        {/* Grille des temps de livraison */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="flex items-center p-2.5 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-700">
            <div className="bg-orange-100 dark:bg-orange-900/30 p-1.5 rounded-lg mr-3 text-orange-600 dark:text-orange-400">
              <Bike size={16} />
            </div>
            <div>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">Moto</p>
              <p className="text-sm font-bold text-gray-800 dark:text-white">
                {restaurant.timeMoto ? formatTime(restaurant.timeMoto) : '--'}
              </p>
            </div>
          </div>

          <div className="flex items-center p-2.5 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-700">
            <div className="bg-blue-100 dark:bg-blue-900/30 p-1.5 rounded-lg mr-3 text-blue-600 dark:text-blue-400">
              <Footprints size={16} />
            </div>
            <div>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">Marche</p>
              <p className="text-sm font-bold text-gray-800 dark:text-white">
                {restaurant.timeWalking ? formatTime(restaurant.timeWalking) : '--'}
              </p>
            </div>
          </div>
        </div>

        {/* Plats populaires */}
        {popularItems.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center">
                <div className="bg-rose-100 dark:bg-rose-900/30 p-1 rounded-md mr-2">
                  <Flame size={12} className="text-rose-500 fill-rose-500" />
                </div>
                <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                  Populaires
                </span>
              </div>
            </div>

            <div className="space-y-2">
              {popularItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between group/item hover:bg-gray-50 dark:hover:bg-gray-700/50 p-1.5 rounded-lg transition-colors -mx-1.5"
                >
                  <div className="flex items-center overflow-hidden">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-8 h-8 rounded-md object-cover mr-3 bg-gray-200 dark:bg-gray-700"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/food/200/200';
                      }}
                    />
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-300 truncate max-w-[140px]">
                      {item.name}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-md whitespace-nowrap">
                    {formatDualPrice(item.price || 0, restaurant.currency as 'USD' | 'CDF', restaurant.exchangeRate, restaurant.displayCurrencyMode)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pied de carte */}
        <div className="pt-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center text-gray-400 text-xs font-medium">
            <Clock size={14} className="mr-1.5" />
            <span>Préparation ~{restaurant.preparationTime || 25} min</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onSubscribe}
              disabled={isSubscribing}
              className={`flex items-center px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                isSubscribing
                  ? 'opacity-50 cursor-wait'
                  : isSubscribed
                  ? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  : 'bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 hover:bg-brand-100 dark:hover:bg-brand-900/50'
              }`}
            >
              {isSubscribing ? (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-1.5" />
              ) : isSubscribed ? (
                <Heart size={14} className="mr-1.5 fill-red-500 text-red-500" />
              ) : (
                <UserPlus size={14} className="mr-1.5" />
              )}
              {isSubscribing
                ? 'Chargement...'
                : isSubscribed
                ? 'Abonné'
                : "S'abonner"}
            </button>

            {restaurant.phoneNumber && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  window.location.href = `tel:${restaurant.phoneNumber}`;
                }}
                className="p-1.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-green-100 hover:text-green-600 dark:hover:bg-green-900/30 dark:hover:text-green-400 transition-colors"
              >
                <Phone size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};