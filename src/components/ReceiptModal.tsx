import React from 'react';
import { X, Download, Printer, CheckCircle, Package, MapPin, Truck, ShieldCheck, CreditCard } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { DeliveryRequest } from '../types';
import { cn } from '../lib/utils';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  delivery: DeliveryRequest | null;
}

export default function ReceiptModal({ isOpen, onClose, delivery }: ReceiptModalProps) {
  if (!delivery) return null;

  const handlePrint = React.useCallback(() => {
    // Small delay helps browser handle the print dialog reliably
    setTimeout(() => {
      try {
        window.print();
      } catch (error) {
        console.error("Print error:", error);
      }
    }, 100);
  }, []);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="receipt-modal-overlay fixed inset-0 z-[200] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-md no-print"
            onClick={onClose}
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="bg-white rounded-[40px] shadow-2xl relative w-full max-w-lg overflow-hidden flex flex-col h-auto max-h-[90vh] z-10 print-receipt"
          >
            {/* Header / Actions - Top Close Button */}
            <div className="absolute top-6 right-6 flex items-center gap-3 z-[100] no-print">
              <button 
                type="button"
                onClick={handlePrint}
                className="w-12 h-12 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center hover:bg-orange-50 hover:text-orange-600 active:scale-95 transition-all border border-white shadow-sm"
                title="Imprimer le reçu"
              >
                <Printer className="w-5 h-5" />
              </button>
              <button 
                onClick={onClose}
                className="w-12 h-12 bg-slate-900 text-white rounded-full flex items-center justify-center hover:bg-orange-500 active:scale-95 transition-all shadow-lg"
                title="Fermer"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div id="receipt-content" className="p-10 md:p-12 overflow-y-auto custom-scrollbar flex-1 print:p-0">
              {/* Receipt Content */}
              <div className="flex flex-col items-center text-center mb-10">
                <div className="w-20 h-20 bg-slate-900 text-white rounded-[32px] flex items-center justify-center mb-6 shadow-2xl shadow-slate-950/20">
                  <Package className="w-10 h-10" />
                </div>
                <h2 className="text-3xl font-black text-slate-950 tracking-tighter uppercase italic leading-none">REÇU DE <span className="text-orange-500">COURSE.</span></h2>
                <div className="mt-4 flex items-center justify-center">
                  <div className="px-5 py-2 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-2 italic">
                    <CheckCircle className="w-3 h-3" />
                    PAIEMENT VALIDÉ
                  </div>
                </div>
              </div>

              {/* Amount Display (Simplified/Matching Payment Style) */}
              <div className="bg-slate-50 border border-slate-100 rounded-[32px] p-8 text-center mb-8 relative overflow-hidden">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 leading-none italic">TOTAL PAYÉ</p>
                <p className="text-4xl font-black text-slate-950 tracking-tighter italic">
                  {delivery.cost?.toLocaleString('fr-FR')} <span className="text-xs font-bold text-slate-400 not-italic uppercase tracking-normal">FCFA</span>
                </p>
                <div className="mt-4 pt-4 border-t border-slate-200 border-dashed flex items-center justify-center gap-2">
                  <CreditCard className="w-3 h-3 text-slate-400" />
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">{delivery.paymentMethod === 'cash' ? 'Payé en espèces' : 'Mobile Money Transaction'}</span>
                </div>
              </div>

              <div className="space-y-8 border-y-2 border-slate-50 py-10 border-dashed mb-6">
                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-none italic">RÉFÉRENCE</p>
                    <p className="text-lg font-black text-slate-950 tracking-tight">#{delivery.id.slice(-8).toUpperCase()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-none italic">DATE</p>
                    <p className="text-lg font-black text-slate-950 italic">
                      {(() => {
                        if (!delivery.createdAt) return '-';
                        let d;
                        if (typeof (delivery.createdAt as any).toDate === 'function') {
                          d = (delivery.createdAt as any).toDate();
                        } else {
                          d = new Date(delivery.createdAt);
                        }
                        return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
                      })()}
                    </p>
                  </div>
                </div>

                <div className="space-y-6 pt-2">
                  <div className="flex gap-4">
                    <div className="w-10 h-10 bg-white border border-slate-100 rounded-2xl flex items-center justify-center shrink-0 shadow-sm">
                      <MapPin className="w-5 h-5 text-orange-500" />
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1 italic">DÉPART</p>
                      <p className="text-sm font-bold text-slate-900 leading-tight">{delivery.from.address}</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="w-10 h-10 bg-white border border-slate-100 rounded-2xl flex items-center justify-center shrink-0 shadow-sm">
                      <MapPin className="w-5 h-5 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest leading-none mb-1 italic">DESTINATION</p>
                      <p className="text-sm font-bold text-slate-900 leading-tight">{delivery.to.address}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-10 shrink-0 no-print border-t border-slate-50 bg-slate-50/50">
               <button 
                onClick={onClose}
                className="w-full py-6 bg-slate-950 text-white rounded-[24px] font-black text-[11px] uppercase tracking-[0.3em] hover:bg-orange-500 active:scale-95 transition-all shadow-2xl shadow-slate-950/20 italic"
               >
                 TERMINER LA CONSULTATION
               </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
