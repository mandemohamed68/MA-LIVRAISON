import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { DeliveryRequest } from '../types';
import { Package, Calendar, MapPin, CheckCircle, ChevronRight, Search, X, FileText, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';

import ReceiptModal from '../components/ReceiptModal';

export default function DeliveryHistory() {
  const { profile } = useAuth();
  const [deliveries, setDeliveries] = useState<DeliveryRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReceipt, setSelectedReceipt] = useState<DeliveryRequest | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;

    const fetchHistory = async () => {
      try {
        const filters: any = {};
        if (profile.role === 'client') filters.clientId = profile.userId;
        else filters.driverId = profile.userId;
        filters.status = 'delivered'; // ou cancelled

        const data = await api.getDeliveries(filters);
        // Adaptation simple si les structures diffèrent légèrement
        const mapped = data.map((d: any) => ({
          ...d,
          from: d.fromAddress ? { address: d.fromAddress } : d.from,
          to: d.toAddress ? { address: d.toAddress } : d.to,
        }));
        setDeliveries(mapped);
      } catch (error) {
        console.error("Error fetching history:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
    // En local, on peut rafraîchir toutes les 30s ou utiliser un bouton
    const interval = setInterval(fetchHistory, 30000);
    return () => clearInterval(interval);
  }, [profile]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4" />
      <p className="text-slate-400 font-black uppercase tracking-widest text-xs">Chargement de l'historique...</p>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto py-10 px-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 sm:mb-12 gap-4">
        <div>
          <h1 className="text-3xl sm:text-5xl font-black text-slate-950 tracking-tighter uppercase leading-none">Historique</h1>
          <p className="text-slate-400 font-bold text-[10px] sm:text-xs uppercase tracking-widest mt-2">Toutes vos courses terminées</p>
        </div>
        <div className="bg-emerald-500/10 text-emerald-600 px-4 sm:px-6 py-2 rounded-full inline-flex items-center gap-2 border border-emerald-500/20 w-fit">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span className="text-[10px] font-black uppercase tracking-widest">{deliveries.length} Livraisons</span>
        </div>
      </div>

      {deliveries.length === 0 ? (
        <div className="bg-white rounded-[40px] p-20 text-center shadow-xl border-4 border-white">
          <div className="w-20 h-20 bg-slate-50 rounded-[30px] flex items-center justify-center mx-auto mb-6">
            <Package className="w-10 h-10 text-slate-200" />
          </div>
          <h3 className="text-2xl font-black text-slate-900 mb-2">Aucun historique</h3>
          <p className="text-slate-400 font-medium max-w-xs mx-auto">Vous n'avez pas encore de livraisons terminées dans votre compte.</p>
        </div>
      ) : (
        <div className="grid gap-6">
          {deliveries.map((delivery, idx) => (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              key={delivery.id}
              className="bg-white rounded-[32px] p-5 sm:p-8 shadow-sm border border-slate-100 group hover:shadow-xl hover:scale-[1.01] transition-all min-w-0"
            >
              <div className="flex flex-col gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 bg-slate-50 rounded-2xl flex items-center justify-center shrink-0 border border-slate-100 group-hover:bg-orange-50 group-hover:border-orange-100 transition-all">
                    <Package className="w-6 h-6 sm:w-7 sm:h-7 text-slate-300 group-hover:text-orange-500 transition-all" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                       <span className={cn(
                        "text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full inline-flex items-center gap-1",
                        delivery.status === 'delivered' ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-red-50 text-red-600 border border-red-100"
                       )}>
                         {delivery.status === 'delivered' ? <CheckCircle className="w-2 h-2" /> : <X className="w-2 h-2" />}
                         {delivery.status === 'delivered' ? 'Livré' : 'Annulé'}
                       </span>
                       <div className="flex items-center gap-1 shrink-0 min-w-0">
                         <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                         <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">
                           {(() => {
                             if (!delivery.createdAt) return 'Date inconnue';
                             let d;
                             if (typeof (delivery.createdAt as any).toDate === 'function') {
                               d = (delivery.createdAt as any).toDate();
                             } else {
                               d = new Date(delivery.createdAt);
                             }
                             return isNaN(d.getTime()) ? 'Date inconnue' : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
                           })()}
                         </span>
                       </div>
                    </div>
                    <h3 className="font-black text-lg text-slate-900 tracking-tight leading-none truncate mb-1">
                      Course #{delivery.id.slice(-6).toUpperCase()}
                    </h3>
                  </div>
                </div>

                {/* Addresses */}
                <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl">
                  <div className="flex items-center gap-1 flex-1 min-w-0">
                    <MapPin className="w-3 h-3 shrink-0 text-orange-500" />
                    <span className="text-[10px] sm:text-xs font-bold text-slate-500 truncate flex-1 min-w-0">{delivery.from?.address || 'Non spécifiée'}</span>
                  </div>
                  <ChevronRight className="w-3 h-3 shrink-0 text-slate-300" />
                  <div className="flex items-center gap-1 flex-1 min-w-0">
                    <MapPin className="w-3 h-3 shrink-0 text-blue-600" />
                    <span className="text-[10px] sm:text-xs font-bold text-slate-500 truncate flex-1 min-w-0">{delivery.to?.address || 'Non spécifiée'}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 mt-1 border-t border-slate-100 gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-0.5">RÉGLÉ</p>
                    <p className="text-xl sm:text-2xl font-black text-slate-900 tracking-tighter leading-none truncate">{delivery.cost} FCFA</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {delivery.status === 'delivered' && (
                      <button 
                        onClick={() => setSelectedReceipt(delivery)}
                        className="w-10 h-10 bg-slate-100 text-slate-600 rounded-xl flex items-center justify-center hover:bg-orange-50 hover:text-orange-600 transition-all font-black shrink-0"
                        title="Voir le reçu"
                      >
                        <FileText className="w-4 h-4" />
                      </button>
                    )}
                    {((!delivery.isPaid && profile?.role === 'client') || profile?.role === 'admin' || profile?.role === 'superadmin') && (
                      <div className="flex gap-2">
                        {deletingId !== delivery.id ? (
                          <button 
                            onClick={(e) => {
                              e.preventDefault();
                              setDeletingId(delivery.id);
                            }}
                            className="w-10 h-10 bg-rose-50 text-rose-500 rounded-xl flex items-center justify-center hover:bg-rose-100 transition-all font-black shrink-0"
                            title="Supprimer la course"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        ) : (
                          <>
                            <button 
                              onClick={async (e) => {
                                e.preventDefault();
                                try {
                                  await deleteDoc(doc(db, 'deliveries', delivery.id));
                                  setDeletingId(null);
                                } catch (error: any) {
                                  console.error("Delete Error", error);
                                  alert("Erreur: " + error.message);
                                  setDeletingId(null);
                                }
                              }}
                              className="px-3 bg-rose-500 text-white rounded-xl flex items-center justify-center hover:bg-rose-600 transition-all font-black text-[10px] uppercase h-10"
                            >
                              Supprimer
                            </button>
                            <button 
                              onClick={(e) => {
                                e.preventDefault();
                                setDeletingId(null);
                              }}
                              className="w-10 h-10 bg-slate-100 text-slate-500 rounded-xl flex items-center justify-center font-black shrink-0"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    )}
                    <Link 
                      to={`/delivery/${delivery.id}`}
                      className="w-10 h-10 bg-slate-950 text-white rounded-xl flex items-center justify-center hover:scale-110 transition-all shadow-lg shrink-0"
                    >
                      <Search className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <ReceiptModal 
        isOpen={!!selectedReceipt} 
        onClose={() => setSelectedReceipt(null)} 
        delivery={selectedReceipt} 
      />
    </div>
  );
}
