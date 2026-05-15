import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, X } from 'lucide-react';

export function QuotaWarning() {
  const [show, setShow] = useState(false);
  const [lastError, setLastError] = useState<any>(null);

  useEffect(() => {
    const handleQuotaError = (e: any) => {
      setLastError(e.detail);
      setShow(true);
    };

    window.addEventListener('firestore-quota-exceeded', handleQuotaError);
    return () => window.removeEventListener('firestore-quota-exceeded', handleQuotaError);
  }, []);

  if (!show) return null;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -100, opacity: 0 }}
        className="fixed top-0 left-0 right-0 z-[9999] p-4 pointer-events-none"
      >
        <div className="max-w-md mx-auto bg-rose-600 text-white p-4 rounded-2xl shadow-2xl flex items-center gap-4 pointer-events-auto border border-rose-500/50">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-black uppercase tracking-widest">Quota Firestore Épuisé</h3>
            <p className="text-[11px] font-medium opacity-90 leading-tight mt-1">
              Les limites gratuites de Firebase sont atteintes. Certaines données peuvent être manquantes ou obsolètes jusqu'au prochain reset (minuit).
            </p>
          </div>
          <button 
            onClick={() => setShow(false)}
            className="w-8 h-8 hover:bg-white/10 rounded-full flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
