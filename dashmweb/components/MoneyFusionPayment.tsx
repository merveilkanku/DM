import React, { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, ShieldCheck, AlertCircle, ExternalLink, CreditCard, Landmark } from 'lucide-react';
import { fetchWithRetry } from '../utils/fetch';

interface MoneyFusionPaymentProps {
  planId: string;
  restaurantId: string;
  initialAmount: number;
  currency?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
  language?: string;
  type?: 'subscription' | 'order';
}

export const MoneyFusionPayment: React.FC<MoneyFusionPaymentProps> = ({ 
  planId, 
  restaurantId, 
  initialAmount, 
  currency = 'USD', 
  onSuccess,
  onCancel,
  language = 'fr',
  type = 'subscription' 
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatPrice = (amt: number, curr: string) => {
    if (curr.toUpperCase() === 'CDF') return `${amt.toLocaleString()} FC`;
    return `${amt.toFixed(2)} $`;
  };

  const handlePayment = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetchWithRetry('/api/moneyfusion/create-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          planId, 
          restaurantId, 
          amount: initialAmount,
          currency: currency.toUpperCase(),
          type 
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erreur lors de la création du paiement');
      }

      const { url } = await response.json();
      
      if (!url) {
        throw new Error('URL de paiement non reçue');
      }

      toast.info('Redirection vers Money Fusion RDC...');
      
      // We use window.location.href to leave the app and go to the payment portal
      // After payment, Money Fusion will redirect back to the success_url provided in the backend
      window.location.href = url;

    } catch (err: any) {
      console.error('Money Fusion Init Error:', err);
      setError(err.message || 'Impossible d\'initialiser le paiement Money Fusion');
      toast.error(err.message || 'Impossible d\'initialiser le paiement');
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-800 p-4 rounded-xl flex items-start gap-3">
        <Landmark className="text-orange-600 mt-0.5 shrink-0" size={18} />
        <div>
          <p className="text-xs font-bold text-orange-900 dark:text-orange-200">Mode Money Fusion RDC</p>
          <p className="text-[10px] text-orange-800 dark:text-orange-300 leading-relaxed mt-1">
            Payez en toute sécurité via M-Pesa, Airtel Money, Orange Money ou Visa/Mastercard. 
            Vous serez redirigé vers le portail de paiement sécurisé.
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-800 p-4 rounded-xl flex items-start gap-3">
          <AlertCircle className="text-red-600 mt-0.5 shrink-0" size={18} />
          <p className="text-xs text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      <button
        onClick={handlePayment}
        disabled={isLoading}
        className="w-full bg-brand-600 text-white py-4 px-6 rounded-2xl font-black shadow-lg shadow-brand-200 dark:shadow-none hover:bg-brand-700 transition-all disabled:opacity-50 flex items-center justify-center text-lg gap-2 group"
      >
        {isLoading ? (
          <>
            <Loader2 className="animate-spin" size={24} />
            Traitement...
          </>
        ) : (
          <>
            <CreditCard size={24} className="group-hover:scale-110 transition-transform" />
            <span>Payer {formatPrice(initialAmount, currency)}</span>
            <ExternalLink size={16} className="ml-1 opacity-50" />
          </>
        )}
      </button>

      <div className="flex flex-col items-center justify-center space-y-2 py-2">
        <div className="flex items-center space-x-3 opacity-60 grayscale hover:grayscale-0 transition-all">
          <img src="https://upload.wikimedia.org/wikipedia/commons/b/b8/M-Pesa_logo.png" alt="M-Pesa" className="h-4 object-contain" />
          <img src="https://upload.wikimedia.org/wikipedia/commons/e/e1/Airtel_logo.png" alt="Airtel" className="h-4 object-contain" />
          <img src="https://upload.wikimedia.org/wikipedia/commons/c/c9/Orange_logo.svg" alt="Orange" className="h-4 object-contain" />
        </div>
        <div className="flex items-center justify-center text-[10px] text-gray-400 space-x-1">
          <ShieldCheck size={12} />
          <span>Paiement sécurisé et vérifié par Money Fusion RDC</span>
        </div>
      </div>
    </div>
  );
};
