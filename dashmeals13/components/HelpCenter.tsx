import React, { useState } from 'react';
import { 
  Search, ChevronRight, ChevronDown, Mail, Phone, MessageSquare, 
  HelpCircle, Book, Shield, Zap, ShoppingBag, Truck, CreditCard, User, Store, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

interface HelpSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  articles: {
    id: string;
    title: string;
    content: string;
  }[];
}

const HELP_CONTENT: HelpSection[] = [
  {
    id: 'getting-started',
    title: 'Premiers Pas',
    icon: <Zap className="w-5 h-5 text-yellow-500" />,
    articles: [
      {
        id: 'create-account',
        title: 'Comment créer un compte ?',
        content: "Pour créer un compte, cliquez sur le bouton 'S'inscrire' sur la page d'accueil. Vous pouvez vous inscrire en tant que Client, Partenaire (Restaurant) ou Livreur. Remplissez les informations requises et validez votre inscription."
      },
      {
        id: 'login-issues',
        title: 'Problèmes de connexion',
        content: "Si vous avez oublié votre mot de passe, utilisez le lien 'Mot de passe oublié' sur la page de connexion. Un email de réinitialisation vous sera envoyé avec un lien sécurisé vers une page dédiée pour définir votre nouveau mot de passe."
      }
    ]
  },
  {
    id: 'security-privacy',
    title: 'Sécurité & Confidentialité',
    icon: <Shield className="w-5 h-5 text-red-500" />,
    articles: [
      {
        id: 'app-lock',
        title: 'Verrouillage de l\'application',
        content: "Pour plus de sécurité, vous pouvez activer le verrouillage de l'application dans vos paramètres. Une fois activé, un code PIN ou un schéma de sécurité sera requis à chaque ouverture de l'application."
      },
      {
        id: 'password-reset-security',
        title: 'Réinitialisation sécurisée',
        content: "Notre processus de réinitialisation de mot de passe utilise des liens à usage unique et une page dédiée sécurisée. Chaque tentative est enregistrée dans nos journaux de sécurité pour prévenir toute activité suspecte."
      }
    ]
  },
  {
    id: 'personalization',
    title: 'Personnalisation',
    icon: <User className="w-5 h-5 text-pink-500" />,
    articles: [
      {
        id: 'themes-fonts',
        title: 'Thèmes et Polices',
        content: "Basculez entre le mode clair et sombre, et choisissez parmi plusieurs polices d'écriture (Facebook, Instagram, Modern, etc.) pour adapter l'interface à vos préférences dans les paramètres."
      },
      {
        id: 'languages',
        title: 'Changer la langue',
        content: "DashMeals est disponible en plusieurs langues, dont le Français et l'Anglais. Vous pouvez changer la langue de l'interface à tout moment dans votre profil."
      }
    ]
  },
  {
    id: 'orders',
    title: 'Commandes & Livraison',
    icon: <ShoppingBag className="w-5 h-5 text-blue-500" />,
    articles: [
      {
        id: 'place-order',
        title: 'Comment passer une commande ?',
        content: "Parcourez les restaurants, sélectionnez vos plats, ajoutez-les au panier et payez. Vous pouvez choisir entre le paiement à la livraison ou par Mobile Money."
      },
      {
        id: 'track-order',
        title: 'Suivre ma commande',
        content: "Suivez le statut de votre commande en temps réel dans 'Mes Commandes'. Vous recevrez des notifications à chaque étape."
      }
    ]
  },
  {
    id: 'payments',
    title: 'Paiements & Tarifs',
    icon: <CreditCard className="w-5 h-5 text-green-500" />,
    articles: [
      {
        id: 'payment-methods',
        title: 'Moyens de paiement',
        content: "Nous acceptons le paiement en espèces à la livraison et les paiements par Mobile Money (M-Pesa, Airtel Money, Orange Money)."
      },
      {
        id: 'delivery-fees',
        title: 'Frais de livraison',
        content: "Les frais sont calculés selon la distance entre le restaurant et votre adresse."
      }
    ]
  },
  {
    id: 'partners',
    title: 'Espace Partenaires',
    icon: <Store className="w-5 h-5 text-purple-500" />,
    articles: [
      {
        id: 'manage-menu',
        title: 'Gérer mon menu',
        content: "Ajoutez, modifiez ou supprimez des plats dans la section 'Menu' de votre tableau de bord. Gérez aussi les stocks et les catégories."
      },
      {
        id: 'marketing-campaigns',
        title: 'Campagnes Marketing',
        content: "Boostez votre visibilité avec des campagnes. Vos promotions s'afficheront en haut de l'application client."
      }
    ]
  },
  {
    id: 'delivery',
    title: 'Espace Livreurs',
    icon: <Truck className="w-5 h-5 text-orange-500" />,
    articles: [
      {
        id: 'delivery-missions',
        title: 'Missions de livraison',
        content: "Activez votre disponibilité. Lorsqu'une commande est prête, acceptez la mission pour voir les détails de livraison et l'itinéraire."
      },
      {
        id: 'earnings',
        title: 'Suivre mes gains',
        content: "Consultez l'historique de vos livraisons et vos gains cumulés dans votre espace personnel."
      }
    ]
  },
  {
    id: 'technical',
    title: 'Support Technique',
    icon: <HelpCircle className="w-5 h-5 text-gray-500" />,
    articles: [
      {
        id: 'offline-mode',
        title: 'Mode Hors-ligne',
        content: "Si la connexion est perdue, l'application passe en mode restreint. Les actions en temps réel reprendront dès le rétablissement de la connexion."
      }
    ]
  }
];

interface Props {
  user: any;
  onClose: () => void;
}

export const HelpCenter: React.FC<Props> = ({ user, onClose }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedArticle, setExpandedArticle] = useState<string | null>(null);
  const [showContactForm, setShowContactForm] = useState(false);
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketMessage, setTicketMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredContent = HELP_CONTENT.map(section => ({
    ...section,
    articles: section.articles.filter(article => 
      article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.content.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(section => section.articles.length > 0);

  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketSubject.trim() || !ticketMessage.trim()) {
      toast.error("Veuillez remplir tous les champs");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('support_tickets').insert({
        user_id: user.id,
        subject: ticketSubject,
        message: ticketMessage,
        status: 'open'
      });

      if (error) throw error;

      toast.success("Votre message a été envoyé au support !");
      setShowContactForm(false);
      setTicketSubject('');
      setTicketMessage('');
    } catch (err) {
      console.error("Error sending ticket:", err);
      toast.error("Erreur lors de l'envoi du message");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-white dark:bg-gray-900 overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b dark:border-gray-800 px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
            >
              <ChevronRight className="w-6 h-6 rotate-180" />
            </button>
            <h1 className="text-xl font-bold">Centre d'aide</h1>
          </div>
          <button 
            onClick={() => setShowContactForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-full text-sm font-medium hover:bg-orange-600 transition-colors"
          >
            <Mail className="w-4 h-4" />
            Support
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Search */}
        <div className="relative mb-8">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input 
            type="text"
            placeholder="Comment pouvons-nous vous aider ?"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-gray-100 dark:bg-gray-800 border-none rounded-2xl focus:ring-2 focus:ring-orange-500 transition-all"
          />
        </div>

        {/* Support Info */}
        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-900/30 rounded-2xl p-6 mb-8">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-orange-500 rounded-xl text-white">
              <HelpCircle className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-orange-900 dark:text-orange-100 mb-1">Besoin d'une assistance directe ?</h2>
              <p className="text-orange-700 dark:text-orange-300 text-sm mb-4">
                Notre équipe est disponible pour vous aider. Contactez-nous par email à :
              </p>
              <a 
                href="mailto:irmerveilkanku@gmail.com"
                className="inline-flex items-center gap-2 text-orange-600 dark:text-orange-400 font-bold hover:underline"
              >
                <Mail className="w-4 h-4" />
                irmerveilkanku@gmail.com
              </a>
            </div>
          </div>
        </div>

        {/* Help Sections */}
        <div className="space-y-6">
          {filteredContent.map((section) => (
            <div key={section.id} className="space-y-3">
              <div className="flex items-center gap-2 px-2">
                {section.icon}
                <h3 className="font-bold text-gray-900 dark:text-white uppercase tracking-wider text-xs">
                  {section.title}
                </h3>
              </div>
              <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-2xl overflow-hidden divide-y dark:divide-gray-700">
                {section.articles.map((article) => (
                  <div key={article.id} className="group">
                    <button 
                      onClick={() => setExpandedArticle(expandedArticle === article.id ? null : article.id)}
                      className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left"
                    >
                      <span className="font-medium text-gray-700 dark:text-gray-200">{article.title}</span>
                      {expandedArticle === article.id ? (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      )}
                    </button>
                    <AnimatePresence>
                      {expandedArticle === article.id && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="p-4 pt-0 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                            {article.content}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-12 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Vous ne trouvez pas ce que vous cherchez ?
          </p>
          <button 
            onClick={() => setShowContactForm(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-full font-bold hover:opacity-90 transition-opacity"
          >
            <MessageSquare className="w-5 h-5" />
            Contacter le support
          </button>
        </div>
      </div>

      {/* Contact Support Modal */}
      <AnimatePresence>
        {showContactForm && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-900 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b dark:border-gray-800 flex items-center justify-between">
                <h3 className="text-xl font-bold">Contacter le support</h3>
                <button 
                  onClick={() => setShowContactForm(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <form onSubmit={handleSubmitTicket} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sujet</label>
                  <input 
                    type="text"
                    value={ticketSubject}
                    onChange={(e) => setTicketSubject(e.target.value)}
                    placeholder="Ex: Problème de paiement"
                    className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-800 border-none rounded-xl focus:ring-2 focus:ring-orange-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Message</label>
                  <textarea 
                    value={ticketMessage}
                    onChange={(e) => setTicketMessage(e.target.value)}
                    placeholder="Décrivez votre problème en détail..."
                    rows={5}
                    className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-800 border-none rounded-xl focus:ring-2 focus:ring-orange-500 resize-none"
                    required
                  />
                </div>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-4 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-600 transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? "Envoi en cours..." : "Envoyer le message"}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
