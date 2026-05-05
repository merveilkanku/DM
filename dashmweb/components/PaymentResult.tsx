import React from 'react';
import { CheckCircle2, XCircle, AlertCircle, ArrowLeft, Landmark } from 'lucide-react';
import { motion } from 'motion/react';

interface Props {
  status: 'success' | 'cancel' | 'failed';
  onReturn: () => void;
}

export const PaymentResult: React.FC<Props> = ({ status, onReturn }) => {
  const config = {
    success: {
      icon: <CheckCircle2 size={64} className="text-green-500" />,
      title: "Paiement Réussi !",
      message: "Merci pour votre confiance. Votre abonnement est en cours d'activation. Vous allez être redirigé vers votre tableau de bord dans quelques instants.",
      color: "bg-green-50 border-green-100 text-green-800",
      btnColor: "bg-green-600 hover:bg-green-700"
    },
    cancel: {
      icon: <AlertCircle size={64} className="text-amber-500" />,
      title: "Paiement Annulé",
      message: "L'opération a été annulée. Aucun montant n'a été débité de votre compte.",
      color: "bg-amber-50 border-amber-100 text-amber-800",
      btnColor: "bg-amber-600 hover:bg-amber-700"
    },
    failed: {
      icon: <XCircle size={64} className="text-red-500" />,
      title: "Échec du Paiement",
      message: "Désolé, une erreur est survenue lors de la transaction. Veuillez vérifier vos fonds ou contacter votre banque.",
      color: "bg-red-50 border-red-100 text-red-800",
      btnColor: "bg-red-600 hover:bg-red-700"
    }
  };

  const { icon, title, message, color, btnColor } = config[status];

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 font-sans">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100"
      >
        <div className="p-8 text-center">
          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", damping: 12 }}
            className="flex justify-center mb-6"
          >
            {icon}
          </motion.div>
          
          <h1 className="text-2xl font-black text-gray-900 mb-4">{title}</h1>
          
          <div className={`p-4 rounded-2xl border ${color} text-sm font-medium leading-relaxed mb-8`}>
            {message}
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={onReturn}
              className={`w-full py-4 rounded-xl text-white font-bold shadow-lg transition-all transform active:scale-95 ${btnColor}`}
            >
              Retour au Tableau de Bord
            </button>
            <div className="flex items-center justify-center gap-2 text-gray-400">
                <Landmark size={14} />
                <span className="text-[10px] font-bold uppercase tracking-widest">Sécurisé par Money Fusion RDC</span>
            </div>
          </div>
        </div>
        
        <div className="bg-gray-50 px-8 py-4 border-t border-gray-100 flex justify-center">
          <button 
            onClick={onReturn}
            className="text-xs font-bold text-gray-500 hover:text-gray-700 flex items-center gap-1 transition-colors"
          >
            <ArrowLeft size={14} />
            Tableau de bord
          </button>
        </div>
      </motion.div>
    </div>
  );
};
