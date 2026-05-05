import React from 'react';
import { X, Shield, Info, HelpCircle, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface LegalModalProps {
  type: 'terms' | 'privacy' | 'contact' | null;
  onClose: () => void;
}

export const LegalModal: React.FC<LegalModalProps> = ({ type, onClose }) => {
  if (!type) return null;

  const content = {
    terms: {
      title: "Conditions Générales d'Utilisation",
      icon: <Shield className="text-brand-600" />,
      body: `
        1. Acceptation des conditions : En utilisant DashMeals, vous acceptez d'être lié par les présentes conditions.
        2. Service : DashMeals est une plateforme de mise en relation entre clients et restaurateurs en RDC.
        3. Paiements : Les paiements effectués via Money Fusion ou Mobile Money sont définitifs après confirmation de la livraison.
        4. Annulation : Toute annulation doit intervenir avant la mise en préparation par le restaurant.
        5. Livraison : Les temps de livraison sont des estimations basées sur le trafic et les conditions météorologiques à Kinshasa.
      `
    },
    privacy: {
      title: "Politique de Confidentialité",
      icon: <Info className="text-brand-600" />,
      body: `
        1. Données collectées : Nous collectons votre nom, email, téléphone et position géographique pour assurer la livraison.
        2. Utilisation : Vos données ne sont jamais vendues à des tiers. Elles servent exclusivement au fonctionnement de l'application.
        3. Sécurité : Vos données sont stockées sur des serveurs sécurisés (Supabase) avec chiffrement de bout en bout.
        4. Droits : Vous pouvez demander la suppression de votre compte et de vos données à tout moment via le centre d'aide.
      `
    },
    contact: {
      title: "Centre d'Aide & Contact",
      icon: <HelpCircle className="text-brand-600" />,
      body: `
        Besoin d'assistance ? Notre équipe est disponible 7j/7 de 8h à 22h.
        
        Email : support@dashmeals.cd
        Téléphone : +243 81 000 0000
        WhatsApp : +243 81 000 0001
        Adresse : Boulevard du 30 Juin, Gombe, Kinshasa, RDC.
        
        Pour toute plainte concernant une commande spécifique, merci de vous munir de votre numéro de commande (ID) affiché dans votre historique.
      `
    }
  };

  const active = content[type];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-md"
        />
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white dark:bg-gray-900 w-full max-w-2xl rounded-[32px] overflow-hidden shadow-2xl relative z-10 flex flex-col max-h-[80vh]"
        >
          <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
            <div className="flex items-center space-x-3">
               <div className="p-2 bg-brand-50 dark:bg-brand-900/20 rounded-xl">
                  {active.icon}
               </div>
               <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tighter italic">{active.title}</h2>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
              <X size={20} className="text-gray-500" />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-8 space-y-6">
            <div className="prose dark:prose-invert max-w-none">
              {active.body.split('\n').map((line, i) => (
                <p key={i} className="text-sm text-gray-600 dark:text-gray-400 font-medium leading-relaxed">
                  {line.trim()}
                </p>
              ))}
            </div>
            
            <div className="pt-8 border-t border-gray-100 dark:border-gray-800">
               <div className="bg-brand-50 dark:bg-brand-900/20 p-4 rounded-2xl flex items-center">
                  <Shield size={20} className="text-brand-600 mr-3" />
                  <p className="text-[10px] font-bold text-brand-900 dark:text-brand-400 uppercase tracking-widest leading-tight">
                    Document certifié DashMeals RDC • Dernière mise à jour: Avril 2024
                  </p>
               </div>
            </div>
          </div>
          
          <div className="p-6 bg-gray-50 dark:bg-gray-800/50">
            <button 
              onClick={onClose}
              className="w-full py-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-2xl font-black uppercase tracking-widest text-xs hover:opacity-90 transition-opacity"
            >
              J'ai compris
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
