import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { supabase } from './lib/supabase';

import { Toaster } from 'sonner';

// Check if we are in a popup callback (OAuth redirect)
const isPopupCallback = window.opener && (window.location.hash.includes('access_token') || window.location.search.includes('code='));

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

if (isPopupCallback) {
  // We are the popup! Handle the callback.
  
  const handleAuth = async () => {
    try {
        // Wait a bit for Supabase to process the URL fragments
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Get the session that should have been set by the client initialization
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (session) {
            // Notify opener with session data
            window.opener.postMessage({ type: 'OAUTH_SUCCESS', session }, window.location.origin);
            // Give time for message to be received before closing
            setTimeout(() => window.close(), 1000);
        } else {
            // If no session yet, listen for it
            const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
                if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) {
                    window.opener.postMessage({ type: 'OAUTH_SUCCESS', session }, window.location.origin);
                    subscription.unsubscribe();
                    setTimeout(() => window.close(), 1000);
                }
            });
            
            // Timeout after 10 seconds if no session
            setTimeout(() => {
                subscription.unsubscribe();
                if (!window.closed) {
                    window.opener.postMessage({ type: 'OAUTH_ERROR', error: "Délai d'attente dépassé" }, window.location.origin);
                    window.close();
                }
            }, 10000);
        }
    } catch (err: any) {
        console.error("Popup Auth Exception:", err);
        window.opener.postMessage({ type: 'OAUTH_ERROR', error: err.message }, window.location.origin);
        setTimeout(() => window.close(), 2000);
    }
  };

  handleAuth();

  root.render(
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4 text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600 mb-4"></div>
      <h2 className="text-xl font-bold text-gray-800">Authentification...</h2>
      <p className="text-gray-500">Veuillez patienter pendant que nous finalisons votre connexion.</p>
    </div>
  );
} else {
// Normal app render
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').then(registration => {
        console.log('SW registered: ', registration);
      }).catch(registrationError => {
        console.log('SW registration failed: ', registrationError);
      });
    });
  }

  root.render(
    <React.StrictMode>
      <Toaster position="top-center" richColors />
      <App />
    </React.StrictMode>
  );
}