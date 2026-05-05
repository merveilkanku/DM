import React, { useState } from 'react';
import { Lock, X, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (pin: string) => void;
}

export const PinSetupDialog: React.FC<Props> = ({ isOpen, onClose, onConfirm }) => {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [step, setStep] = useState(1); // 1: Enter PIN, 2: Confirm PIN
  const [error, setError] = useState(false);

  const handlePinSubmit = (digit: string) => {
    if (step === 1) {
      if (pin.length >= 4) return;
      const newPin = pin + digit;
      setPin(newPin);
      if (newPin.length === 4) {
        setTimeout(() => setStep(2), 300);
      }
    } else {
      if (confirmPin.length >= 4) return;
      const newPin = confirmPin + digit;
      setConfirmPin(newPin);
      if (newPin.length === 4) {
        if (newPin === pin) {
          onConfirm(newPin);
          reset();
        } else {
          setError(true);
          setTimeout(() => {
            setConfirmPin('');
            setError(false);
          }, 500);
        }
      }
    }
  };

  const handleBackspace = () => {
    if (step === 1) {
      setPin(pin.slice(0, -1));
    } else {
      setConfirmPin(confirmPin.slice(0, -1));
    }
  };

  const reset = () => {
    setPin('');
    setConfirmPin('');
    setStep(1);
    setError(false);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl"
        >
          <div className="p-6 flex flex-col items-center">
            <div className="w-full flex justify-between items-center mb-6">
              <button onClick={() => { reset(); onClose(); }} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                <X size={20} className="text-gray-500" />
              </button>
              <h3 className="font-black text-gray-900 dark:text-white">Configuration du PIN</h3>
              <div className="w-10" />
            </div>

            <div className="mb-6 p-4 bg-brand-50 dark:bg-brand-900/30 rounded-full">
              <Lock size={32} className="text-brand-600 dark:text-brand-400" />
            </div>

            <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-2 text-center">
              {step === 1 ? "Choisissez votre code PIN" : "Confirmez votre code PIN"}
            </h4>
            <p className="text-gray-500 dark:text-gray-400 text-center mb-8 text-sm">
              {step === 1 
                ? "Ce code vous sera demandé à chaque ouverture de l'application." 
                : "Veuillez saisir à nouveau votre code pour confirmer."}
            </p>

            {/* PIN Display */}
            <div className={`flex space-x-4 mb-10 ${error ? 'animate-shake' : ''}`}>
              {[0, 1, 2, 3].map((i) => {
                const currentVal = step === 1 ? pin : confirmPin;
                return (
                  <div 
                    key={i}
                    className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
                      currentVal.length > i 
                      ? 'bg-brand-600 border-brand-600 scale-110' 
                      : 'border-gray-300 dark:border-gray-600'
                    }`}
                  />
                );
              })}
            </div>

            {/* Keypad */}
            <div className="grid grid-cols-3 gap-4 w-full max-w-[240px]">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button
                  key={num}
                  onClick={() => handlePinSubmit(num.toString())}
                  className="w-16 h-16 rounded-full bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-xl font-bold text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 active:scale-95 transition-all"
                >
                  {num}
                </button>
              ))}
              <div />
              <button
                onClick={() => handlePinSubmit('0')}
                className="w-16 h-16 rounded-full bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-xl font-bold text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 active:scale-95 transition-all"
              >
                0
              </button>
              <button
                onClick={handleBackspace}
                className="w-16 h-16 rounded-full flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X size={24} />
              </button>
            </div>

            {error && (
              <p className="mt-4 text-red-500 text-xs font-bold">Les codes PIN ne correspondent pas.</p>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
