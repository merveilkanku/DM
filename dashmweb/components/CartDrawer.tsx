import React, { useState } from 'react';
import { X, Trash2, ShoppingBag, CreditCard, Banknote, ArrowLeft, Phone, CheckCircle2, Smartphone, MapPin, Map, Camera } from 'lucide-react';
import { CartItem, RestaurantPaymentConfig, PaymentMethod, MobileMoneyNetwork, Language } from '../types';
import { formatDualPrice } from '../utils/format';
import { LocationPicker } from './LocationPicker';
import { useTranslation } from '../lib/i18n';
import { toast } from 'sonner';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onRemove: (id: string) => void;
  onUpdateQuantity?: (id: string, newQuantity: number) => void;
  onCheckout: (paymentMethod: PaymentMethod, network?: MobileMoneyNetwork, isUrgent?: boolean, paymentProof?: string, deliveryLocation?: { lat: number; lng: number; address: string }) => void;
  total: number;
  currency?: 'USD' | 'CDF';
  exchangeRate?: number;
  displayCurrencyMode?: 'dual' | 'usd' | 'cdf';
  isLoading?: boolean;
  paymentConfig?: RestaurantPaymentConfig;
  language?: Language;
  userRole?: string;
}

export const CartDrawer: React.FC<Props> = ({ 
  isOpen, 
  onClose, 
  items, 
  onRemove, 
  onUpdateQuantity,
  onCheckout, 
  total, 
  currency = 'USD', 
  exchangeRate,
  displayCurrencyMode = 'dual',
  isLoading = false,
  paymentConfig = { acceptCash: true, acceptMobileMoney: false, airtelNumber: '', orangeNumber: '', mpesaNumber: '' },
  language = 'fr' as Language,
  userRole = 'guest'
}) => {
  const t = useTranslation(language as Language);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [selectedNetwork, setSelectedNetwork] = useState<MobileMoneyNetwork | null>(null);
  const [isUrgent, setIsUrgent] = useState(false);
  const [paymentProof, setPaymentProof] = useState<string | null>(null);
  const [deliveryLocation, setDeliveryLocation] = useState<{ lat: number; lng: number; address: string } | null>(null);
  const [addressDetails, setAddressDetails] = useState('');

  const formatPrice = (amount: number) => {
      return formatDualPrice(amount, currency as 'USD' | 'CDF', exchangeRate, displayCurrencyMode as 'dual' | 'usd' | 'cdf');
  };

  const handleNextStep = () => {
    if (step === 1) {
      setStep(2);
    } else if (step === 2) {
      if (!deliveryLocation) {
        toast.error(t('select_location_error'));
        return;
      }
      setStep(3);
    } else {
      if (!selectedMethod) return;
      if (selectedMethod === 'mobile_money' && !selectedNetwork) return;
      if (selectedMethod === 'mobile_money' && !paymentProof) {
        toast.error(t('payment_proof_error'));
        return;
      }

      const fullLocation = deliveryLocation ? {
        ...deliveryLocation,
        address: addressDetails ? `${addressDetails}` : deliveryLocation.address
      } : undefined;

      onCheckout(selectedMethod, selectedNetwork || undefined, isUrgent, paymentProof || undefined, fullLocation);
    }
  };

  const resetAndClose = () => {
    setStep(1);
    setSelectedMethod(null);
    setSelectedNetwork(null);
    setIsUrgent(false);
    setPaymentProof(null);
    setDeliveryLocation(null);
    setAddressDetails('');
    onClose();
  };

  if (!isOpen) return null;

  const canProceed = () => {
    if (step === 1) return items.length > 0;
    if (step === 2) return deliveryLocation !== null;
    if (step === 3) return (selectedMethod === 'cash' || (selectedMethod === 'mobile_money' && selectedNetwork));
    return false;
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={resetAndClose}></div>
      
      {/* Drawer */}
      <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-slide-in-right">
        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
          <div className="flex items-center">
            {step > 1 && (
              <button onClick={() => setStep(step - 1 as 1 | 2 | 3)} className="mr-3 p-2 hover:bg-gray-200 rounded-full transition-colors">
                <ArrowLeft size={20} className="text-gray-700" />
              </button>
            )}
            <h2 className="text-xl font-bold flex items-center text-gray-900">
              {step === 1 && <><ShoppingBag className="mr-2 text-brand-600" /> Votre Panier</>}
              {step === 2 && <><MapPin className="mr-2 text-brand-600" /> Livraison</>}
              {step === 3 && <><CreditCard className="mr-2 text-brand-600" /> Paiement</>}
            </h2>
          </div>
          <button onClick={resetAndClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500">
            <X size={24} />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-100 h-1.5">
          <div 
            className="bg-brand-600 h-1.5 transition-all duration-300 ease-out" 
            style={{ width: `${(step / 3) * 100}%` }}
          ></div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {step === 1 && (
            items.length === 0 ? (
              <div className="text-center text-gray-500 mt-20 flex flex-col items-center">
                <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <ShoppingBag size={40} className="text-gray-400" />
                </div>
                <p className="text-lg font-medium text-gray-900">Votre panier est vide</p>
                <p className="text-sm mt-2">Découvrez nos restaurants et ajoutez de délicieux plats.</p>
                <button onClick={resetAndClose} className="mt-6 px-6 py-2 bg-brand-50 text-brand-700 rounded-full font-bold hover:bg-brand-100 transition-colors">Explorer</button>
              </div>
            ) : (
              <div className="space-y-4">
                {items.map((item, idx) => (
                  <div key={`${item.id}-${idx}`} className="flex gap-4 bg-white border border-gray-100 rounded-2xl p-3 shadow-sm hover:shadow-md transition-shadow">
                    {item.image && (
                      <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100">
                        <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="flex-1 flex flex-col justify-between">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-bold text-gray-900 leading-tight">{item.name}</h4>
                          <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mt-1">{item.restaurantName}</p>
                        </div>
                        <button onClick={() => onRemove(item.id)} className="text-gray-400 hover:text-red-500 p-1 transition-colors">
                            <Trash2 size={16} />
                        </button>
                      </div>
                      <div className="flex justify-between items-center mt-2">
                        <p className="font-black text-brand-600">{formatPrice(item.price)}</p>
                        <div className="flex items-center bg-gray-100 rounded-full p-1">
                          <button 
                            onClick={() => onUpdateQuantity && onUpdateQuantity(item.id, Math.max(1, item.quantity - 1))}
                            className="w-6 h-6 flex items-center justify-center text-gray-600 hover:bg-white hover:shadow-sm rounded-full transition-all"
                          >-</button>
                          <span className="text-xs font-bold w-6 text-center">{item.quantity}</span>
                          <button 
                            onClick={() => onUpdateQuantity && onUpdateQuantity(item.id, item.quantity + 1)}
                            className="w-6 h-6 flex items-center justify-center text-gray-600 hover:bg-white hover:shadow-sm rounded-full transition-all"
                          >+</button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {step === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-1">Où devons-nous livrer ?</h3>
                <p className="text-sm text-gray-500 mb-4">Placez le repère sur votre position exacte.</p>
                
                <LocationPicker 
                  initialLocation={deliveryLocation ? { lat: deliveryLocation.lat, lng: deliveryLocation.lng } : undefined}
                  onLocationSelect={(loc) => setDeliveryLocation({ ...loc, address: loc.address || 'Position sélectionnée sur la carte' })} 
                />
              </div>

              {deliveryLocation && (
                <div className="bg-brand-50 border border-brand-100 rounded-xl p-4 flex items-start">
                  <MapPin className="text-brand-600 mt-0.5 mr-3 flex-shrink-0" size={20} />
                  <div>
                    <p className="font-bold text-brand-900 text-sm">Position enregistrée</p>
                    <p className="text-xs text-brand-700 mt-1">{deliveryLocation.address}</p>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Précisions sur l'adresse (Optionnel)</label>
                <textarea 
                  value={addressDetails}
                  onChange={(e) => setAddressDetails(e.target.value)}
                  placeholder="Ex: Appartement 4B, Bâtiment bleu, à côté de la pharmacie..."
                  className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none resize-none h-24 text-sm"
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              
              {/* Urgent Mode Toggle */}
              <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-center justify-between shadow-sm">
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mr-3">
                    <span className="text-xl">🚀</span>
                  </div>
                  <div>
                    <p className="font-bold text-red-800">Mode Urgent</p>
                    <p className="text-[10px] text-red-600 mt-0.5 font-medium uppercase tracking-wide">Priorité maximale</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsUrgent(!isUrgent)}
                  className={`w-14 h-8 rounded-full transition-colors relative shadow-inner ${isUrgent ? 'bg-red-500' : 'bg-gray-300'}`}
                >
                  <div className={`w-6 h-6 rounded-full bg-white absolute top-1 shadow-md transition-transform ${isUrgent ? 'translate-x-7' : 'translate-x-1'}`} />
                </button>
              </div>

              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-4">Mode de paiement</h3>
                <div className="grid grid-cols-1 gap-3">
                  {paymentConfig.acceptCash && (
                    <button 
                      onClick={() => setSelectedMethod('cash')}
                      className={`flex items-center p-4 border-2 rounded-2xl transition-all ${selectedMethod === 'cash' ? 'border-brand-500 bg-brand-50 shadow-md' : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'}`}
                    >
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center mr-4 transition-colors ${selectedMethod === 'cash' ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                        <Banknote size={24} />
                      </div>
                      <div className="text-left flex-1">
                        <p className="font-bold text-gray-900">Cash à la livraison</p>
                        <p className="text-xs text-gray-500 mt-0.5">Payez en espèces à la réception</p>
                      </div>
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${selectedMethod === 'cash' ? 'border-brand-500 bg-brand-500' : 'border-gray-300'}`}>
                        {selectedMethod === 'cash' && <CheckCircle2 className="text-white" size={16} />}
                      </div>
                    </button>
                  )}

                  {paymentConfig.acceptMobileMoney && (
                    <button 
                      onClick={() => setSelectedMethod('mobile_money')}
                      className={`flex items-center p-4 border-2 rounded-2xl transition-all ${selectedMethod === 'mobile_money' ? 'border-brand-500 bg-brand-50 shadow-md' : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'}`}
                    >
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center mr-4 transition-colors ${selectedMethod === 'mobile_money' ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                        <Smartphone size={24} />
                      </div>
                      <div className="text-left flex-1">
                        <p className="font-bold text-gray-900">Mobile Money</p>
                        <p className="text-xs text-gray-500 mt-0.5">Airtel, Orange ou M-Pesa</p>
                      </div>
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${selectedMethod === 'mobile_money' ? 'border-brand-500 bg-brand-500' : 'border-gray-300'}`}>
                        {selectedMethod === 'mobile_money' && <CheckCircle2 className="text-white" size={16} />}
                      </div>
                    </button>
                  )}
                </div>
              </div>

              {selectedMethod === 'mobile_money' && (
                <div className="animate-in fade-in slide-in-from-top-4 duration-300 bg-gray-50 p-4 rounded-2xl border border-gray-200">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Sélectionnez votre réseau</p>
                  <div className="grid grid-cols-3 gap-3">
                    {paymentConfig.mpesaNumber && (
                      <button 
                        onClick={() => setSelectedNetwork('mpesa')}
                        className={`flex flex-col items-center p-3 border-2 rounded-xl transition-all ${selectedNetwork === 'mpesa' ? 'border-brand-500 bg-white shadow-sm' : 'border-transparent bg-gray-100 hover:bg-gray-200'}`}
                      >
                        <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center text-white font-black text-[10px] mb-2 shadow-sm">M-PESA</div>
                        <span className="text-xs font-bold text-gray-700">M-Pesa</span>
                      </button>
                    )}
                    {paymentConfig.airtelNumber && (
                      <button 
                        onClick={() => setSelectedNetwork('airtel')}
                        className={`flex flex-col items-center p-3 border-2 rounded-xl transition-all ${selectedNetwork === 'airtel' ? 'border-brand-500 bg-white shadow-sm' : 'border-transparent bg-gray-100 hover:bg-gray-200'}`}
                      >
                        <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center text-white font-black text-[10px] mb-2 shadow-sm">AIRTEL</div>
                        <span className="text-xs font-bold text-gray-700">Airtel</span>
                      </button>
                    )}
                    {paymentConfig.orangeNumber && (
                      <button 
                        onClick={() => setSelectedNetwork('orange')}
                        className={`flex flex-col items-center p-3 border-2 rounded-xl transition-all ${selectedNetwork === 'orange' ? 'border-brand-500 bg-white shadow-sm' : 'border-transparent bg-gray-100 hover:bg-gray-200'}`}
                      >
                        <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center text-white font-black text-[10px] mb-2 shadow-sm">ORANGE</div>
                        <span className="text-xs font-bold text-gray-700">Orange</span>
                      </button>
                    )}
                  </div>

                  {selectedNetwork && (
                    <div className="mt-6 animate-in fade-in duration-300">
                      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-4">
                        <p className="text-xs text-gray-500 mb-1">Montant à envoyer :</p>
                        <p className="text-2xl font-black text-brand-600 mb-4">{formatPrice(total)}</p>
                        
                        <p className="text-xs text-gray-500 mb-1">Numéro {selectedNetwork.toUpperCase()} :</p>
                        <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border border-gray-200">
                          <div className="flex items-center">
                            <Phone size={16} className="text-gray-400 mr-2" />
                            <span className="font-mono font-bold text-lg text-gray-800">
                              {selectedNetwork === 'mpesa' ? paymentConfig.mpesaNumber : 
                               selectedNetwork === 'airtel' ? paymentConfig.airtelNumber : 
                               paymentConfig.orangeNumber}
                            </span>
                          </div>
                          <button 
                            onClick={() => {
                              const num = selectedNetwork === 'mpesa' ? paymentConfig.mpesaNumber : 
                                         selectedNetwork === 'airtel' ? paymentConfig.airtelNumber : 
                                         paymentConfig.orangeNumber;
                              if (num) navigator.clipboard.writeText(num);
                            }}
                            className="px-3 py-1.5 bg-white border border-gray-200 rounded-md text-xs font-bold text-gray-700 hover:bg-gray-50 shadow-sm"
                          >
                            Copier
                          </button>
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-bold text-gray-900 mb-1">Preuve de paiement</label>
                        <p className="text-xs text-gray-500 mb-3">Joignez une capture d'écran du message de confirmation.</p>
                        
                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors bg-white">
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
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="border-t p-4 bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
            <div className="flex justify-between items-center mb-4">
              <span className="text-gray-500 font-medium">Total à payer</span>
              <span className="text-2xl font-black text-gray-900">{formatPrice(total)}</span>
            </div>
            
            {userRole === 'guest' && step === 3 && (
                <div className="mb-4 p-3 bg-brand-50 border border-brand-100 rounded-xl text-center">
                    <p className="text-xs font-bold text-brand-700">Connectez-vous pour finaliser votre commande</p>
                </div>
            )}

            <button 
              onClick={handleNextStep}
              disabled={isLoading || !canProceed() || (userRole === 'guest' && step === 3)}
              className={`w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-4 rounded-xl shadow-lg transform active:scale-[0.98] transition-all flex justify-center items-center text-lg ${isLoading || !canProceed() || (userRole === 'guest' && step === 3) ? 'opacity-50 cursor-not-allowed saturate-50' : ''}`}
            >
              {isLoading ? (
                <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                step === 1 ? 'Valider le panier' : 
                step === 2 ? 'Continuer vers le paiement' : 
                (userRole === 'guest' ? 'Connexion requise' : 'Confirmer la commande')
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
