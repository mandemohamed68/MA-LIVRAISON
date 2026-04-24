import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { DeliveryRequest } from '../types';
import { Package, Calendar, MapPin, CheckCircle, ChevronRight, Search, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';

export default function DeliveryHistory() {
  const { profile } = useAuth();
  const [deliveries, setDeliveries] = useState<DeliveryRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;

    const q = query(
      collection(db, 'deliveries'),
      where(profile.role === 'client' ? 'clientId' : 'driverId', '==', profile.userId),
      where('status', 'in', ['delivered', 'cancelled']),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setDeliveries(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DeliveryRequest)));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4" />
      <p className="text-slate-400 font-black uppercase tracking-widest text-xs">Chargement de l'historique...</p>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto py-10 px-4">
      <div className="flex items-center justify-between mb-12">
        <div>
          <h1 className="text-5xl font-black text-slate-950 tracking-tighter uppercase leading-none">Historique</h1>
          <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-2">Toutes vos courses terminées</p>
        </div>
        <div className="bg-emerald-500/10 text-emerald-600 px-6 py-2 rounded-full flex items-center gap-2 border border-emerald-500/20">
          <CheckCircle className="w-4 h-4" />
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
              className="bg-white rounded-[32px] p-8 shadow-sm border border-slate-100 group hover:shadow-xl hover:scale-[1.01] transition-all"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center shrink-0 border border-slate-100 group-hover:bg-orange-50 group-hover:border-orange-100 transition-all">
                    <Package className="w-8 h-8 text-slate-300 group-hover:text-orange-500 transition-all" />
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                       <span className={cn(
                        "text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full inline-flex items-center gap-1",
                        delivery.status === 'delivered' ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-red-50 text-red-600 border border-red-100"
                       )}>
                         {delivery.status === 'delivered' ? <CheckCircle className="w-2 h-2" /> : <X className="w-2 h-2" />}
                         {delivery.status === 'delivered' ? 'Livré' : 'Annulé'}
                       </span>
                       <div className="flex items-center gap-2">
                         <Calendar className="w-3 h-3 text-slate-400" />
                         <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                           {delivery.createdAt ? new Date(delivery.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Date inconnue'}
                         </span>
                       </div>
                    </div>
                    <h3 className="font-black text-xl text-slate-900 tracking-tight leading-none mb-2">
                      Course #{delivery.id.slice(-6).toUpperCase()}
                    </h3>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-orange-500" />
                        <span className="text-[10px] font-bold text-slate-500 truncate max-w-[150px]">{delivery.from?.address || 'Non spécifiée'}</span>
                      </div>
                      <ChevronRight className="w-3 h-3 text-slate-300" />
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-blue-600" />
                        <span className="text-[10px] font-bold text-slate-500 truncate max-w-[150px]">{delivery.to?.address || 'Non spécifiée'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between md:justify-end gap-10 pt-6 md:pt-0 border-t md:border-t-0 border-slate-50">
                  <div className="text-right">
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">RÉGLÉ</p>
                    <p className="text-2xl font-black text-slate-900 tracking-tighter">{delivery.cost} FCFA</p>
                  </div>
                  <Link 
                    to={`/delivery/${delivery.id}`}
                    className="w-14 h-14 bg-slate-950 text-white rounded-2xl flex items-center justify-center hover:scale-110 transition-all shadow-lg"
                  >
                    <Search className="w-6 h-6" />
                  </Link>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
