import React from 'react';
import { Shield, Info, Phone, Mail, HelpCircle, MapPin, Globe } from 'lucide-react';
import { APP_LOGO_URL } from '../constants';
import { AppSettings } from '../types';

interface FooterProps {
  onLegalClick: (type: 'terms' | 'privacy' | 'contact') => void;
  className?: string;
  appSettings?: AppSettings | null;
}

export const Footer: React.FC<FooterProps> = ({ onLegalClick, className = "", appSettings }) => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className={`bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 py-12 px-6 pb-24 md:pb-12 ${className}`}>
      <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-12">
        {/* Brand & Mission */}
        <div className="space-y-6">
          <div className="flex items-center space-x-2">
            <img src={APP_LOGO_URL} alt="DashMeals Logo" className="w-10 h-10 rounded-xl shadow-lg border-2 border-white dark:border-gray-800" />
            <h2 className="text-2xl font-black text-gray-900 dark:text-white italic tracking-tighter uppercase">DashMeals</h2>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed font-medium">
            Propulser la gastronomie congolaise vers le futur. 
            Livraison ultra-rapide, paiement sécurisé et traçabilité totale en République Démocratique du Congo.
          </p>
          <div className="flex items-center space-x-4">
             <div className="w-8 h-8 rounded-full bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center text-brand-600 dark:text-brand-400">
                <Globe size={16} />
             </div>
             <p className="text-[10px] font-black uppercase tracking-widest text-brand-600 dark:text-brand-400">Kinshasa • Lubumbashi • Goma</p>
          </div>
        </div>

        {/* Quick Links */}
        <div>
          <h3 className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] mb-6">Légal & Confiance</h3>
          <ul className="space-y-4">
            <li>
              <button 
                onClick={() => onLegalClick('terms')}
                className="flex items-center text-sm font-bold text-gray-600 dark:text-gray-300 hover:text-brand-600 dark:hover:text-brand-400 transition-colors group"
                id="footer_terms_link"
              >
                <Shield size={16} className="mr-3 opacity-50 group-hover:opacity-100 transition-opacity" />
                Conditions Générales
              </button>
            </li>
            <li>
              <button 
                onClick={() => onLegalClick('privacy')}
                className="flex items-center text-sm font-bold text-gray-600 dark:text-gray-300 hover:text-brand-600 dark:hover:text-brand-400 transition-colors group"
                id="footer_privacy_link"
              >
                <Info size={16} className="mr-3 opacity-50 group-hover:opacity-100 transition-opacity" />
                Confidentialité
              </button>
            </li>
            <li>
              <button 
                onClick={() => onLegalClick('contact')}
                className="flex items-center text-sm font-bold text-gray-600 dark:text-gray-300 hover:text-brand-600 dark:hover:text-brand-400 transition-colors group"
                id="footer_contact_link"
              >
                <HelpCircle size={16} className="mr-3 opacity-50 group-hover:opacity-100 transition-opacity" />
                Centre d'Aide
              </button>
            </li>
          </ul>
        </div>

        {/* Support */}
        <div>
          <h3 className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] mb-6">Contact Support</h3>
          <ul className="space-y-4">
            <li className="flex items-start">
              <Mail size={16} className="mr-3 text-brand-600 mt-1" />
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase">Support Email</p>
                <a href={`mailto:${appSettings?.support_email || 'support@dashmeals.cd'}`} className="text-sm font-bold text-gray-900 dark:text-white hover:text-brand-600 transition-colors">
                  {appSettings?.support_email || 'support@dashmeals.cd'}
                </a>
              </div>
            </li>
            <li className="flex items-start">
              <Phone size={16} className="mr-3 text-brand-600 mt-1" />
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase">Téléphone (Urgent)</p>
                <p className="text-sm font-bold text-gray-900 dark:text-white">{appSettings?.support_phone || '+243 81 000 0000'}</p>
              </div>
            </li>
          </ul>
        </div>

        {/* Payment Methods Info */}
        <div>
          <h3 className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] mb-6">Paiements Sécurisés</h3>
          <div className="flex flex-wrap gap-3">
             <div className="bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-lg text-[10px] font-black text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700">MONEY FUSION</div>
             <div className="bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-lg text-[10px] font-black text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700">M-PESA</div>
             <div className="bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-lg text-[10px] font-black text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700">AIRTEL MONEY</div>
             <div className="bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-lg text-[10px] font-black text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700">ORANGE MONEY</div>
          </div>
          <p className="text-[9px] text-gray-500 mt-4 leading-tight italic">
            Vos transactions sont chiffrées par cryptage AES-256. 
            DashMeals ne stocke jamais vos coordonnées bancaires directes.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto mt-12 pt-8 border-t border-gray-100 dark:border-gray-800 flex flex-col md:flex-row justify-between items-center text-[10px] font-bold text-gray-400 uppercase tracking-widest">
         <p>© {currentYear} DashMeals RDC. Tous droits réservés.</p>
         <div className="flex items-center space-x-6 mt-4 md:mt-0">
            <span className="flex items-center"><MapPin size={10} className="mr-1" /> HQ: Kinshasa, Gombe</span>
            <span className="flex items-center"><Shield size={10} className="mr-1" /> Sécurité Vérifiée</span>
         </div>
      </div>
    </footer>
  );
};
