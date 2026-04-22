import { loadStripe } from '@stripe/stripe-js';

const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

export const stripePromise = stripePublishableKey 
  ? loadStripe(stripePublishableKey) 
  : null;

export const createPaymentIntent = async (planId: string, restaurantId: string, currency: string = 'usd', type: 'subscription' | 'order' = 'subscription') => {
  const response = await fetch('/api/stripe/create-payment-intent', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ planId, restaurantId, currency, type }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create payment intent');
  }

  return response.json();
};
