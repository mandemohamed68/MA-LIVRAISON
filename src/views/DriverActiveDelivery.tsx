import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { DeliveryRequest } from '../types';
import { Package, Navigation, Loader2, AlertCircle, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';

export default function DriverActiveDelivery() {
  const { profile } = useAuth();
  const [activeDelivery, setActiveDelivery] = useState<DeliveryRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!profile) return;

    // A driver can have only one active delivery at a time in this logic
    const q = query(
      collection(db, 'deliveries'),
      where('driverId', '==', profile.userId),
      where('status', 'in', ['accepted', 'picked_up']),
      limit(1)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        setActiveDelivery({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as DeliveryRequest);
      } else {
        setActiveDelivery(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile]);

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
    </div>
  );

  if (!activeDelivery) return (
    <div className="max-w-xl mx-auto py-20 px-4 text-center">
      <div className="bg-white rounded-[40px] p-12 shadow-xl border-4 border-white">
        <div className="w-20 h-20 bg-blue-50 rounded-[30px] flex items-center justify-center mx-auto mb-8">
          <Navigation className="w-10 h-10 text-blue-200" />
        </div>
        <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase mb-2">Aucune course active</h2>
        <p className="text-slate-400 font-medium mb-10">Vous n'avez pas de livraison en cours de traitement pour le moment.</p>
        <button 
          onClick={() => navigate('/driver')}
          className="w-full py-5 bg-blue-600 text-white rounded-3xl font-black text-sm uppercase tracking-widest hover:scale-105 transition-all shadow-xl shadow-blue-100"
        >
          Chercher une mission
        </button>
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto py-10 px-4">
      <h1 className="text-5xl font-black text-slate-950 tracking-tighter uppercase mb-12">Course en cours</h1>
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-[48px] p-10 shadow-2xl border-4 border-white overflow-hidden relative"
      >
        <div className="relative z-10">
          <div className="flex items-center gap-6 mb-10 pb-10 border-b border-slate-50">
            <div className="w-20 h-20 bg-blue-600 rounded-[30px] flex items-center justify-center shadow-xl shadow-blue-100">
              <Package className="w-10 h-10 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 bg-blue-600 rounded-full animate-ping" />
                <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">En cours de traitement</p>
              </div>
              <h2 className="text-3xl font-black text-slate-900 tracking-tighter">Client: {activeDelivery.clientName}</h2>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-10">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Point de départ</p>
              <p className="font-bold text-slate-800 text-lg leading-snug">{activeDelivery.from.address}</p>
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Destination</p>
              <p className="font-bold text-slate-800 text-lg leading-snug">{activeDelivery.to.address}</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="flex-1 w-full p-6 bg-slate-50 rounded-3xl border border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total à encaisser</p>
              <p className="text-4xl font-black text-slate-950 tracking-tighter">{activeDelivery.cost} FCFA</p>
            </div>
            <button 
              onClick={() => navigate(`/delivery/${activeDelivery.id}`)}
              className="w-full sm:w-auto px-10 py-6 bg-orange-500 text-white rounded-3xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-orange-600 transition-all shadow-2xl shadow-orange-100"
            >
              <span>Accéder au Suivi</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="absolute -top-20 -right-20 w-80 h-80 bg-blue-50 rounded-full -z-0 opacity-50" />
      </motion.div>
    </div>
  );
}
