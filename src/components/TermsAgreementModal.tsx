
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, FileText, ChevronRight, Check } from 'lucide-react';
import { CLIENT_TERMS, DRIVER_TERMS, PRIVACY_POLICY } from '../data/terms';
import Markdown from 'react-markdown';

interface TermsAgreementModalProps {
  role: 'client' | 'driver';
  onAccept: () => void;
}

export default function TermsAgreementModal({ role, onAccept }: TermsAgreementModalProps) {
  const [step, setStep] = useState<'intro' | 'terms' | 'privacy'>('intro');
  const [hasScrolledTerms, setHasScrolledTerms] = useState(false);
  const [hasScrolledPrivacy, setHasScrolledPrivacy] = useState(false);

  // Automatically mark as scrolled if content is short or after 2 seconds
  React.useEffect(() => {
    if (step === 'terms') {
      const timer = setTimeout(() => setHasScrolledTerms(true), 2000);
      return () => clearTimeout(timer);
    }
    if (step === 'privacy') {
      const timer = setTimeout(() => setHasScrolledPrivacy(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [step]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>, setter: (val: boolean) => void) => {
    const element = e.currentTarget;
    if (element.scrollHeight - element.scrollTop <= element.clientHeight + 100) {
      setter(true);
    }
  };

  const termsText = role === 'client' ? CLIENT_TERMS : DRIVER_TERMS;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Acceptation requise</h2>
            <p className="text-sm text-slate-500 font-medium italic">Pancho Livraison - Plateforme Professionnelle</p>
          </div>
          <div className="flex gap-1.5">
            {[1, 2, 3].map((i) => (
              <div 
                key={i} 
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  (i === 1 && step === 'intro') || (i === 2 && step === 'terms') || (i === 3 && step === 'privacy')
                    ? 'w-6 bg-orange-500'
                    : 'w-1.5 bg-slate-200'
                }`} 
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
          <AnimatePresence mode="wait">
            {step === 'intro' && (
              <motion.div
                key="intro"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="text-center py-6"
              >
                <div className="w-20 h-20 bg-orange-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
                  <ShieldCheck className="w-10 h-10 text-orange-600" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-4">Bienvenue sur PANCHO EXECUTIVE</h3>
                <p className="text-slate-600 leading-relaxed max-w-sm mx-auto mb-8">
                  Pour garantir une expérience sécurisée et professionnelle à tous nos utilisateurs, veuillez consulter et accepter nos conditions d'utilisation.
                </p>
                <div className="space-y-4 max-w-xs mx-auto text-left">
                  <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <FileText className="w-5 h-5 text-indigo-500" />
                    <span className="text-sm font-semibold text-slate-700">Conditions de Service</span>
                  </div>
                  <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <ShieldCheck className="w-5 h-5 text-emerald-500" />
                    <span className="text-sm font-semibold text-slate-700">Politique de Confidentialité</span>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 'terms' && (
              <motion.div
                key="terms"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col h-full"
              >
                <div 
                  className="bg-slate-50 rounded-2xl p-6 border border-slate-100 prose prose-slate prose-sm max-w-none max-h-[400px] overflow-y-auto mb-4 text-slate-700"
                  onScroll={(e) => handleScroll(e, setHasScrolledTerms)}
                >
                  <Markdown>{termsText}</Markdown>
                </div>
                {!hasScrolledTerms && (
                  <p className="text-[10px] text-center text-slate-400 font-bold uppercase tracking-widest animate-pulse">
                    Veuillez lire jusqu'en bas pour continuer ↓
                  </p>
                )}
              </motion.div>
            )}

            {step === 'privacy' && (
              <motion.div
                key="privacy"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col h-full"
              >
                <div 
                  className="bg-slate-50 rounded-2xl p-6 border border-slate-100 prose prose-slate prose-sm max-w-none max-h-[400px] overflow-y-auto mb-4 text-slate-700"
                  onScroll={(e) => handleScroll(e, setHasScrolledPrivacy)}
                >
                  <Markdown>{PRIVACY_POLICY}</Markdown>
                </div>
                {!hasScrolledPrivacy && (
                  <p className="text-[10px] text-center text-slate-400 font-bold uppercase tracking-widest animate-pulse">
                    Veuillez lire jusqu'en bas pour continuer ↓
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-8 py-6 border-t border-slate-100 bg-slate-50 flex flex-col gap-3">
          {step === 'intro' ? (
            <button
              onClick={() => setStep('terms')}
              className="w-full bg-slate-900 text-white h-14 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-black transition-all active:scale-95"
            >
              Comprendre et Continuer
              <ChevronRight className="w-5 h-5" />
            </button>
          ) : step === 'terms' ? (
            <button
              disabled={!hasScrolledTerms}
              onClick={() => setStep('privacy')}
              className={`w-full h-14 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 ${
                hasScrolledTerms 
                  ? 'bg-slate-900 text-white hover:bg-black' 
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              Accepter les Conditions
              <Check className="w-5 h-5" />
            </button>
          ) : (
            <button
              disabled={!hasScrolledPrivacy}
              onClick={onAccept}
              className={`w-full h-14 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 ${
                hasScrolledPrivacy 
                  ? 'bg-orange-600 text-white hover:bg-orange-700 shadow-lg shadow-orange-200' 
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              Tout accepter et Commencer
              <Check className="w-5 h-5" />
            </button>
          )}
          <p className="text-[10px] text-center text-slate-400 font-medium">
             En cliquant, vous certifiez être majeur et avoir lu nos engagements.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
