import React, { useState } from 'react';
import { X, Trash2, ShoppingBag, CreditCard, Banknote, ArrowLeft, Phone, CheckCircle2, Smartphone, MapPin, Map, Camera } from 'lucide-react';
import { CartItem, RestaurantPaymentConfig, PaymentMethod, MobileMoneyNetwork, Language } from '../types';
import { formatDualPrice } from '../utils/format';
import { LocationPicker } from './LocationPicker';
import { useTranslation } from '../lib/i18n';
import { toast } from 'sonner';
import { useNativePicker } from '../utils/useNativePicker';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onUpdateQuantity: (id: string, delta: number) => void;
  onRemoveItem: (id: string) => void;
  onClearCart: () => void;
  onPlaceOrder: (details: any) => Promise<void>;
  restaurantPaymentConfig?: RestaurantPaymentConfig;
  restaurantId: string;
  theme?: 'light' | 'dark';
  language?: Language;
}

export const CartDrawer: React.FC<Props> = ({ 
  isOpen, 
  onClose, 
  items, 
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onPlaceOrder,
  restaurantPaymentConfig,
  restaurantId,
  theme = 'light',
  language = 'fr'
}) => {
  const t = useTranslation(language as Language);
  const [step, setStep] = useState<'cart' | 'checkout' | 'payment'>('cart');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [mobileNetwork, setMobileNetwork] = useState<MobileMoneyNetwork>('m-pesa');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [deliveryNote, setDeliveryNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [location, setLocation] = useState<{lat: number, lng: number, address: string} | null>(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [paymentProof, setPaymentProof] = useState<string | null>(null);

  const { isCapacitor, pickImage } = useNativePicker();

  const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const handleNext = () => {
    if (step === 'cart') setStep('checkout');
    else if (step === 'checkout') {
      if (!location) {
        toast.error("Veuillez sélectionner un lieu de livraison");
        return;
      }
      setStep('payment');
    }
  };

  const handleSubmitOrder = async () => {
    if (paymentMethod === 'mobile_money' && !phoneNumber) {
      toast.error("Veuillez entrer votre numéro de téléphone");
      return;
    }

    if (paymentMethod === 'mobile_money' && !paymentProof) {
        toast.error("Veuillez charger une capture d'écran de votre paiement");
        return;
    }

    setIsSubmitting(true);
    try {
      await onPlaceOrder({
        items,
        total,
        paymentMethod,
        mobileNetwork,
        phoneNumber,
        deliveryNote,
        location,
        paymentProof
      });
      onClearCart();
      onClose();
      setStep('cart');
    } catch (err) {
      toast.error("Erreur lors de la commande");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div className="relative w-full max-w-md bg-white dark:bg-gray-900 h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-500 transition-colors">
        {/* Header */}
        <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-white dark:bg-gray-900 sticky top-0 z-10">
          <div className="flex items-center">
            {step !== 'cart' && (
              <button
                onClick={() => setStep(step === 'payment' ? 'checkout' : 'cart')}
                className="mr-4 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
              >
                <ArrowLeft size={20} className="text-gray-600 dark:text-gray-400" />
              </button>
            )}
            <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight italic">
              {step === 'cart' ? "Votre Panier" : step === 'checkout' ? "Livraison" : "Paiement"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
          >
            <X size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 'cart' ? (
            items.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <div className="w-20 h-20 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                  <ShoppingBag size={40} className="text-gray-300" />
                </div>
                <p className="text-gray-500 dark:text-gray-400 font-medium">Votre panier est vide</p>
                <button
                  onClick={onClose}
                  className="mt-4 text-brand-600 font-bold hover:underline"
                >
                  Continuer mes achats
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {items.map((item) => (
                  <div key={item.id} className="flex items-center space-x-4 bg-gray-50 dark:bg-gray-800 p-3 rounded-2xl border border-gray-100 dark:border-gray-700">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-16 h-16 rounded-xl object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-gray-900 dark:text-white truncate">{item.name}</h4>
                      <p className="text-brand-600 font-bold text-sm">
                        {formatDualPrice(item.price)}
                      </p>
                    </div>
                    <div className="flex items-center bg-white dark:bg-gray-900 rounded-xl p-1 shadow-sm border border-gray-100 dark:border-gray-700">
                      <button
                        onClick={() => onUpdateQuantity(item.id, -1)}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-gray-600 dark:text-gray-400"
                      >
                        <Trash2 size={16} />
                      </button>
                      <span className="w-8 text-center font-bold text-gray-900 dark:text-white">{item.quantity}</span>
                      <button
                        onClick={() => onUpdateQuantity(item.id, 1)}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-brand-600"
                      >
                        <ShoppingBag size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : step === 'checkout' ? (
            <div className="space-y-6">
              <div
                onClick={() => setShowLocationPicker(true)}
                className={`p-4 border-2 border-dashed rounded-2xl cursor-pointer transition-all ${location ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/10' : 'border-gray-200 dark:border-gray-700 hover:border-brand-300'}`}
              >
                {location ? (
                  <div className="flex items-start">
                    <div className="bg-brand-100 dark:bg-brand-900 p-2 rounded-xl mr-3 text-brand-600">
                      <MapPin size={20} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-brand-600 uppercase tracking-wider mb-1">Lieu de livraison</p>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 leading-tight">{location.address}</p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center">
                    <Map className="mx-auto text-gray-400 mb-2" size={32} />
                    <p className="text-sm font-bold text-gray-700 dark:text-gray-300">Sélectionner sur la carte</p>
                    <p className="text-xs text-gray-500 mt-1">Où devons-nous livrer ?</p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-widest">Note pour le livreur (Optionnel)</label>
                <textarea 
                  className="w-full p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-brand-500 outline-none text-gray-900 dark:text-white transition-all"
                  rows={3}
                  placeholder="Ex: Porte bleue, 2ème étage..."
                  value={deliveryNote}
                  onChange={(e) => setDeliveryNote(e.target.value)}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setPaymentMethod('cash')}
                  className={`p-4 rounded-2xl border-2 flex flex-col items-center justify-center transition-all ${paymentMethod === 'cash' ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/10 text-brand-600' : 'border-gray-100 dark:border-gray-800 text-gray-400'}`}
                >
                  <Banknote size={24} className="mb-2" />
                  <span className="text-xs font-bold">Espèces</span>
                </button>
                <button
                  onClick={() => setPaymentMethod('mobile_money')}
                  className={`p-4 rounded-2xl border-2 flex flex-col items-center justify-center transition-all ${paymentMethod === 'mobile_money' ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/10 text-brand-600' : 'border-gray-100 dark:border-gray-800 text-gray-400'}`}
                >
                  <Smartphone size={24} className="mb-2" />
                  <span className="text-xs font-bold">Mobile Money</span>
                </button>
              </div>

              {paymentMethod === 'mobile_money' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-2xl">
                    <h4 className="text-xs font-black text-blue-700 dark:text-blue-400 uppercase mb-2">Instructions</h4>
                    <p className="text-[11px] text-blue-600 dark:text-blue-300 font-medium">
                      Payez sur le numéro suivant et uploadez la capture d'écran du message de confirmation :
                    </p>
                    <p className="text-lg font-black text-blue-800 dark:text-blue-200 mt-2">081 234 56 78</p>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {['m-pesa', 'orange', 'airtel'].map((net) => (
                      <button
                        key={net}
                        onClick={() => setMobileNetwork(net as MobileMoneyNetwork)}
                        className={`py-2 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all ${mobileNetwork === net ? 'bg-brand-600 text-white shadow-lg' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'}`}
                      >
                        {net}
                      </button>
                    ))}
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Votre numéro de téléphone</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                      <input
                        type="tel"
                        className="w-full p-3 pl-10 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-gray-900 dark:text-white font-bold"
                        placeholder="08..."
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Preuve de paiement</label>
                    <div className="relative group">
                      <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all overflow-hidden relative">
                        {paymentProof ? (
                          <div className="relative w-full h-full p-2">
                            <img src={paymentProof} alt="Preuve" className="w-full h-full object-contain rounded-lg" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
                              <span className="text-white font-bold text-sm">Changer l'image</span>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            <Camera className="w-8 h-8 text-gray-400 mb-2" />
                            <p className="text-sm text-gray-500 font-medium">Cliquez pour uploader</p>
                          </div>
                        )}
                        <input
                          type="file"
                          id="payment-proof-input"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                setPaymentProof(reader.result as string);
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                        <button
                          type="button"
                          className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer"
                          onClick={async (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (isCapacitor) {
                              const dataUrl = await pickImage();
                              if (dataUrl) setPaymentProof(dataUrl);
                            } else {
                              document.getElementById('payment-proof-input')?.click();
                            }
                          }}
                        />
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="flex justify-between items-center mb-4">
            <span className="text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest text-sm">Total</span>
            <span className="text-2xl font-black text-brand-600 italic">
              {formatDualPrice(total)}
            </span>
          </div>

          {items.length > 0 && (
            <button 
              onClick={step === 'payment' ? handleSubmitOrder : handleNext}
              disabled={isSubmitting}
              className="w-full py-4 bg-brand-600 hover:bg-brand-700 text-white rounded-[24px] font-black shadow-xl shadow-brand-500/20 transition-all active:scale-95 flex items-center justify-center disabled:opacity-50 uppercase italic tracking-tighter"
            >
              {isSubmitting ? (
                <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  {step === 'cart' ? "Passer la commande" : step === 'checkout' ? "Suivant" : "Confirmer la commande"}
                  <CheckCircle2 size={20} className="ml-2" />
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {showLocationPicker && (
        <LocationPicker
          onSelect={(loc) => {
            setLocation(loc);
            setShowLocationPicker(false);
          }}
          onClose={() => setShowLocationPicker(false)}
        />
      )}
    </div>
  );
};
