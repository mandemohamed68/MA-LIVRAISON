import React, { useState } from 'react';
import { Smartphone, ShieldCheck, Loader2, X, CreditCard, Coins } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (method: 'cash' | 'mobile_money' | 'card') => void;
  amount: number;
}

export default function PaymentModal({ isOpen, onClose, onConfirm, amount }: PaymentModalProps) {
  const [step, setStep] = useState(1);
  const [selectedMethod, setSelectedMethod] = useState<'orange' | 'moov' | 'coris' | 'sank' | 'card' | 'cash' | null>(null);
  const [pin, setPin] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedMethod === 'cash') {
      onConfirm('cash');
      onClose();
      return;
    }
    
    setIsProcessing(true);
    // Simulate real delay
    await new Promise(r => setTimeout(r, 2000));
    setIsProcessing(false);
    
    let dbMethod: 'mobile_money' | 'card' | 'cash' = 'mobile_money';
    if (selectedMethod === 'card') dbMethod = 'card';
    if (selectedMethod === 'cash') dbMethod = 'cash';
    
    onConfirm(dbMethod);
    onClose();
  };

  const getHeaderColor = () => {
    if (selectedMethod === 'orange') return 'bg-[#FF7900]';
    if (selectedMethod === 'moov') return 'bg-[#005CB9]';
    if (selectedMethod === 'coris') return 'bg-[#CC0000]';
    if (selectedMethod === 'sank') return 'bg-[#2E7A3C]';
    if (selectedMethod === 'card') return 'bg-slate-800';
    if (selectedMethod === 'cash') return 'bg-emerald-600';
    return 'bg-slate-900';
  };
  
  const getHeaderName = () => {
    if (selectedMethod === 'orange') return 'Orange Money';
    if (selectedMethod === 'moov') return 'Moov Money';
    if (selectedMethod === 'coris') return 'Coris Money';
    if (selectedMethod === 'sank') return 'Sank Money';
    if (selectedMethod === 'card') return 'Carte Bancaire';
    if (selectedMethod === 'cash') return 'Espèces à la livraison';
    return 'Paiement (Burkina Faso)';
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-sm"
          />
          <motion.div 
            initial={window.innerWidth < 1024 ? { y: '100%' } : { scale: 0.9, opacity: 0 }}
            animate={window.innerWidth < 1024 ? { y: 0 } : { scale: 1, opacity: 1 }}
            exit={window.innerWidth < 1024 ? { y: '100%' } : { scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={cn(
              "fixed z-[120] bg-white overflow-hidden shadow-2xl",
              "bottom-0 left-0 right-0 rounded-t-[40px] max-h-[90vh]", // Mobile: Bottom Sheet
              "lg:inset-auto lg:top-1/2 lg:left-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2 lg:w-full lg:max-w-md lg:rounded-[40px]" // Desktop: Centered Modal
            )}
          >
            {/* Minimal Drag Indicator for Mobile */}
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto my-4 lg:hidden" />

            <div className={cn("px-8 py-6 text-white relative transition-colors duration-300", getHeaderColor())}>
              <button 
                onClick={onClose}
                className="absolute top-6 right-6 p-2 bg-white/20 hover:bg-white/30 rounded-xl transition-all"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-3 mb-1">
                <ShieldCheck className="w-4 h-4 opacity-70" />
                <p className="text-[10px] font-black uppercase tracking-widest opacity-70">{getHeaderName()}</p>
              </div>
              <h2 className="text-2xl font-black tracking-tighter">Paiement Sécurisé</h2>
            </div>

            <div className="p-8 overflow-y-auto max-h-[calc(90vh-120px)]">
              {step === 1 ? (
                <div className="space-y-6">
                  <div className="text-center p-6 bg-slate-50 rounded-[32px] border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Montant à régler</p>
                    <div className="flex items-baseline justify-center gap-2">
                       <span className="text-5xl font-black text-slate-900 tracking-tighter">{amount}</span>
                       <span className="text-lg font-black text-slate-400">FCFA</span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-3">
                    <button 
                      onClick={() => { setSelectedMethod('orange'); setStep(2); }}
                      className="group w-full flex items-center justify-between p-4 bg-white border-2 border-slate-50 rounded-3xl hover:border-orange-500 transition-all text-left shadow-sm hover:shadow-orange-500/10"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-[#FF7900] rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20 group-hover:scale-110 transition-transform">
                          <Smartphone className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <span className="block font-black text-slate-900 uppercase text-[10px] tracking-widest mb-0.5">Orange Money</span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Paiement Mobile Rapide</span>
                        </div>
                      </div>
                    </button>

                    <button 
                      onClick={() => { setSelectedMethod('moov'); setStep(2); }}
                      className="group w-full flex items-center justify-between p-4 bg-white border-2 border-slate-50 rounded-3xl hover:border-blue-500 transition-all text-left shadow-sm hover:shadow-blue-500/10"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-[#005CB9] rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-110 transition-transform">
                          <Smartphone className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <span className="block font-black text-slate-900 uppercase text-[10px] tracking-widest mb-0.5">Moov Money</span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Paiement Mobile Sécurisé</span>
                        </div>
                      </div>
                    </button>

                    <button 
                      onClick={() => { setSelectedMethod('coris'); setStep(2); }}
                      className="group w-full flex items-center justify-between p-4 bg-white border-2 border-slate-50 rounded-3xl hover:border-red-500 transition-all text-left shadow-sm hover:shadow-red-500/10"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-[#CC0000] rounded-2xl flex items-center justify-center shadow-lg shadow-red-500/20 group-hover:scale-110 transition-transform">
                          <Smartphone className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <span className="block font-black text-slate-900 uppercase text-[10px] tracking-widest mb-0.5">Coris Money</span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Paiement Local</span>
                        </div>
                      </div>
                    </button>

                    <button 
                      onClick={() => { setSelectedMethod('sank'); setStep(2); }}
                      className="group w-full flex items-center justify-between p-4 bg-white border-2 border-slate-50 rounded-3xl hover:border-green-600 transition-all text-left shadow-sm hover:shadow-green-600/10"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-[#2E7A3C] rounded-2xl flex items-center justify-center shadow-lg shadow-green-600/20 group-hover:scale-110 transition-transform">
                          <Smartphone className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <span className="block font-black text-slate-900 uppercase text-[10px] tracking-widest mb-0.5">Sank Money</span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Réseau Burkinabè</span>
                        </div>
                      </div>
                    </button>

                    <button 
                      onClick={() => { setSelectedMethod('card'); setStep(2); }}
                      className="group w-full flex items-center justify-between p-4 bg-white border-2 border-slate-50 rounded-3xl hover:border-slate-800 transition-all text-left shadow-sm hover:shadow-slate-800/10"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-slate-800 rounded-2xl flex items-center justify-center shadow-lg shadow-slate-800/20 group-hover:scale-110 transition-transform">
                          <CreditCard className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <span className="block font-black text-slate-900 uppercase text-[10px] tracking-widest mb-0.5">Carte Bancaire</span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Visa, MasterCard, CB</span>
                        </div>
                      </div>
                    </button>

                    <button 
                      onClick={() => { setSelectedMethod('cash'); setStep(2); }}
                      className="group w-full flex items-center justify-between p-4 bg-white border-2 border-slate-50 rounded-3xl hover:border-emerald-600 transition-all text-left shadow-sm hover:shadow-emerald-600/10"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-600/20 group-hover:scale-110 transition-transform">
                          <Coins className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <span className="block font-black text-slate-900 uppercase text-[10px] tracking-widest mb-0.5">Espèces</span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Règlement à la livraison</span>
                        </div>
                      </div>
                    </button>
                  </div>

                  <p className="text-[8px] text-center text-slate-400 font-bold uppercase tracking-[0.2em] px-4">
                    Le montant est bloqué par notre plateforme et ne sera versé au livreur qu'une fois la confirmation de livraison effectuée par vos soins.
                  </p>
                </div>
              ) : selectedMethod === 'cash' ? (
                <div className="text-center py-4">
                  <div className="w-20 h-20 bg-emerald-50 rounded-[28px] flex items-center justify-center mx-auto mb-6 border-2 border-emerald-100 rotate-3">
                    <Coins className="w-10 h-10 text-emerald-600 -rotate-3" />
                  </div>
                  <h3 className="text-xl font-black text-slate-900 mb-2">Paiement en espèces</h3>
                  <p className="font-bold text-slate-500 text-xs uppercase tracking-widest max-w-[200px] mx-auto leading-relaxed mb-8">
                    Le montant de <span className="text-slate-900">{amount} FCFA</span> sera collecté directement par le livreur.
                  </p>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => setStep(1)}
                      className="flex-1 py-5 rounded-[24px] font-black text-[10px] uppercase tracking-widest transition-all text-slate-400 bg-slate-50 hover:bg-slate-100"
                    >
                      Retour
                    </button>
                    <button 
                      onClick={handleSubmit}
                      className="flex-[2] py-5 rounded-[24px] font-black text-[10px] uppercase tracking-widest transition-all text-white bg-emerald-600 hover:bg-emerald-700 shadow-xl shadow-emerald-500/20 active:scale-95"
                    >
                      Confirmer la commande
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-8">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-slate-100 rounded-[20px] flex items-center justify-center mx-auto mb-4">
                      <ShieldCheck className="w-8 h-8 text-slate-800" />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 mb-1">Authentification</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Code PIN {getHeaderName()}
                    </p>
                  </div>
                  
                  <div className="flex justify-center gap-4">
                    {[0, 1, 2, 3].map((index) => (
                      <input 
                        key={index}
                        id={`pin-${index}`}
                        type="password"
                        maxLength={1}
                        value={pin[index] || ''}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '');
                          const newPin = pin.split('');
                          newPin[index] = val;
                          setPin(newPin.join('').slice(0, 4));
                          if (val && index < 3) {
                            const nextInput = document.getElementById(`pin-${index + 1}`);
                            nextInput?.focus();
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Backspace' && !pin[index] && index > 0) {
                            const prevInput = document.getElementById(`pin-${index - 1}`);
                            prevInput?.focus();
                          }
                        }}
                        onFocus={(e) => e.target.select()}
                        className="w-14 h-16 bg-white border-2 border-slate-200 rounded-2xl text-center text-3xl font-black text-slate-900 focus:border-slate-900 focus:ring-4 focus:ring-slate-900/10 transition-all outline-none"
                        autoFocus={index === 0}
                      />
                    ))}
                  </div>

                  <div className="pt-4 space-y-4">
                    <button 
                      disabled={pin.length < 4 || isProcessing}
                      className={cn(
                        "w-full py-5 rounded-2xl font-black text-xs uppercase tracking-[0.15em] transition-all flex items-center justify-center gap-3 relative overflow-hidden group",
                        getHeaderColor(),
                        "text-white shadow-xl shadow-slate-900/10 disabled:opacity-50 disabled:active:scale-100 active:scale-95"
                      )}
                    >
                      {/* Button highlight effect */}
                      <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
                      
                      {isProcessing ? <Loader2 className="w-5 h-5 animate-spin relative z-10" /> : (
                        <span className="relative z-10">Valider le paiement</span>
                      )}
                    </button>
                    <button 
                      type="button"
                      onClick={() => { setStep(1); setPin(''); }}
                      className="w-full py-4 rounded-2xl font-bold text-[11px] uppercase tracking-widest text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-all"
                    >
                      ← Changer de méthode
                    </button>
                  </div>
                </form>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
