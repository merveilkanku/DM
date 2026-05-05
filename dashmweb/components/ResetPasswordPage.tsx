import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { KeyRound, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';

export const ResetPasswordPage: React.FC = () => {
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Check if we have a recovery session
    const checkSession = async () => {
      // Small delay to allow Supabase to parse the URL hash
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const { data: { session } } = await supabase.auth.getSession();
      console.log("Session check on mount:", !!session);
      
      if (!session) {
        setError("Session de récupération expirée ou introuvable. Veuillez cliquer à nouveau sur le lien dans votre email.");
      }
    };
    checkSession();
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }

    setLoading(true);
    setError(null);
    
    // Timeout de sécurité pour éviter le chargement infini
    const timeoutId = setTimeout(() => {
      if (loading) {
        setLoading(false);
        setError("La requête a mis trop de temps à répondre. Veuillez réessayer.");
      }
    }, 15000);

    try {
      console.log("Step 1: Checking session...");
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) throw sessionError;
      
      if (!sessionData.session) {
        throw new Error("Session introuvable. Le lien a peut-être expiré ou a déjà été utilisé.");
      }

      console.log("Step 2: Updating password for user:", sessionData.session.user.id);
      
      // On utilise une promesse avec timeout pour la mise à jour
      const updatePromise = supabase.auth.updateUser({ password: newPassword });
      const { data, error: updateError } = await updatePromise;
      
      if (updateError) throw updateError;
      
      console.log("Step 3: Password updated successfully!");
      clearTimeout(timeoutId);
      setSuccess(true);
      setLoading(false);

      // On ne fait pas de signOut immédiat ici pour éviter de casser le rendu actuel
      // La déconnexion se fera au clic sur le bouton de retour ou via le rechargement

    } catch (err: any) {
      clearTimeout(timeoutId);
      console.error("Reset Error Details:", err);
      setError(err.message || "Une erreur est survenue lors de la mise à jour.");
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-brand-50 flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-md rounded-2xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={32} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Succès !</h2>
          <p className="text-gray-600 mb-8">Votre mot de passe a été mis à jour avec succès.</p>
          <button 
            onClick={() => window.location.href = '/'}
            className="w-full bg-brand-600 text-white py-3 rounded-xl font-bold hover:bg-brand-700 transition-all"
          >
            Retour à la connexion
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-brand-600 p-6 text-center">
          <h1 className="text-2xl font-bold text-white">Réinitialisation</h1>
          <p className="text-brand-100 text-sm">Sécurisez votre compte DashMeals</p>
        </div>

        <div className="p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm flex items-start">
              <AlertCircle className="mr-2 flex-shrink-0" size={18} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleReset} className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Nouveau mot de passe</label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="password"
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !!error}
              className="w-full bg-brand-600 text-white py-4 rounded-xl font-bold shadow-lg hover:bg-brand-700 active:scale-[0.98] transition-all flex items-center justify-center disabled:opacity-50"
            >
              {loading ? (
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                "Mettre à jour le mot de passe"
              )}
            </button>
          </form>

          <button 
            onClick={() => window.location.href = '/'}
            className="w-full mt-6 text-gray-500 text-sm font-medium flex items-center justify-center hover:text-brand-600"
          >
            <ArrowLeft size={16} className="mr-2" />
            Annuler et retourner
          </button>
        </div>
      </div>
    </div>
  );
};
