import React, { useState, useEffect } from 'react';
import {
  PaymentElement,
  Elements,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { stripePromise, createPaymentIntent } from '../lib/stripe';
import { toast } from 'sonner';
import { Loader2, ShieldCheck, AlertCircle } from 'lucide-react';

const CheckoutForm: React.FC<{ amount: number; currency: string; onSuccess: () => void }> = ({ amount, currency, onSuccess }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const formatPrice = (amt: number, curr: string) => {
    if (curr.toUpperCase() === 'CDF') return `${amt.toFixed(0)} FC`;
    return `$${amt.toFixed(2)}`;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      console.error('Stripe or Elements not loaded');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      console.log('Confirming payment with Stripe...');
      const result = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: window.location.href, // Use current URL as return_url
        },
        redirect: 'if_required',
      });

      console.log('Stripe confirmPayment result:', result);

      if (result.error) {
        const error = result.error;
        console.error('Stripe Confirm Error:', error);
        setErrorMessage(error.message || 'Une erreur est survenue');
        toast.error(error.message || 'Erreur de paiement');
        setIsProcessing(false);
      } else {
        const paymentIntent = result.paymentIntent;
        const status = paymentIntent?.status;
        console.log('Payment status received:', status);
        
        if (status === 'succeeded' || status === 'requires_capture') {
          console.log('Payment successful, calling onSuccess');
          toast.success('Paiement réussi !');
          try {
            await onSuccess();
            console.log('onSuccess completed');
          } catch (onSuccessError) {
            console.error('Error in onSuccess callback:', onSuccessError);
            setIsProcessing(false);
          }
        } else if (status === 'processing') {
          console.log('Payment is processing...');
          toast.info('Paiement en cours de traitement...');
          try {
            await onSuccess();
          } catch (onSuccessError) {
            console.error('Error in onSuccess callback (processing):', onSuccessError);
            setIsProcessing(false);
          }
        } else {
          console.warn('Unexpected payment status:', status);
          setErrorMessage(`Statut de paiement inattendu : ${status}`);
          setIsProcessing(false);
        }
      }
    } catch (err: any) {
      console.error('Unexpected Error during payment:', err);
      setErrorMessage('Une erreur inattendue est survenue.');
      toast.error('Erreur de paiement inattendue');
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement options={{ layout: 'tabs' }} />
      {errorMessage && (
        <div className="bg-red-50 border border-red-100 text-red-600 p-3 rounded-lg text-xs font-medium">
          {errorMessage}
        </div>
      )}
      <button
        disabled={!stripe || isProcessing}
        className="w-full bg-brand-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-brand-200 hover:bg-brand-700 transition-all disabled:opacity-50 flex items-center justify-center text-lg"
      >
        {isProcessing ? (
          <>
            <Loader2 className="animate-spin mr-2" size={20} />
            Traitement...
          </>
        ) : (
          `Payer ${formatPrice(amount / 100, currency)}`
        )}
      </button>
      <div className="flex items-center justify-center text-[10px] text-gray-400 space-x-1">
        <ShieldCheck size={12} />
        <span>Paiement 100% sécurisé par Stripe</span>
      </div>
    </form>
  );
};

interface StripePaymentProps {
  planId: string;
  restaurantId: string;
  initialAmount: number; // Used for UI display only now
  currency?: string;
  onSuccess: () => void;
  onCancel?: () => void;
  language?: string;
  type?: 'subscription' | 'order';
}

export const StripePayment: React.FC<StripePaymentProps> = ({ planId, restaurantId, initialAmount, currency = 'USD', onSuccess, type = 'subscription' }) => {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [chargedAmount, setChargedAmount] = useState<number>(initialAmount * 100); // Stripe expects cents

  useEffect(() => {
    const initPayment = async () => {
      try {
        const data = await createPaymentIntent(planId, restaurantId, currency.toLowerCase(), type as 'subscription' | 'order');
        setClientSecret(data.clientSecret);
        if (data.amount) {
          setChargedAmount(data.amount);
        }
      } catch (err) {
        console.error('Stripe Init Error:', err);
        toast.error('Impossible d\'initialiser le paiement Stripe');
      }
    };

    initPayment();
  }, [initialAmount, currency]);

  if (!stripePromise) {
    return (
      <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100 flex items-start">
        <AlertCircle className="mr-2 flex-shrink-0" size={18} />
        <p>Stripe n'est pas configuré. Veuillez ajouter la clé publique dans les variables d'environnement.</p>
      </div>
    );
  }

  if (!clientSecret) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <div className="relative">
          <Loader2 className="animate-spin text-brand-600" size={40} />
          <div className="absolute inset-0 flex items-center justify-center">
            <ShieldCheck className="text-brand-200" size={16} />
          </div>
        </div>
        <div className="text-center">
          <p className="text-gray-900 font-bold">Sécurisation de la connexion...</p>
          <p className="text-gray-500 text-xs">Préparation de votre paiement Stripe</p>
        </div>
      </div>
    );
  }

  return (
    <Elements stripe={stripePromise} options={{ 
      clientSecret,
      appearance: {
        theme: 'stripe',
        variables: {
          colorPrimary: '#ea580c', // brand-600
          colorBackground: '#ffffff',
          colorText: '#111827',
          borderRadius: '12px',
        }
      }
    }}>
      <CheckoutForm amount={chargedAmount} currency={currency} onSuccess={onSuccess} />
      {chargedAmount > initialAmount && (
        <p className="text-[10px] text-orange-600 mt-2 text-center font-medium">
          Note : Le montant a été ajusté au minimum autorisé par Stripe ({chargedAmount / 100} {currency}).
        </p>
      )}
    </Elements>
  );
};
