import { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, orderBy, updateDoc, doc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { DeliveryRequest, DeliveryBid } from '../types';
import { Link } from 'react-router-dom';
import { Package, Clock, CheckCircle, ChevronRight, MapPin, Truck, AlertCircle, Navigation, Search, DollarSign } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import PaymentModal from '../components/PaymentModal';

const getStatusConfig = (status: string) => {
  switch (status) {
    case 'pending': return { label: 'En attente', color: 'bg-amber-100 text-amber-700', icon: Clock };
    case 'accepted': return { label: 'Acceptée', color: 'bg-indigo-100 text-indigo-700', icon: Truck };
    case 'picked_up': return { label: 'En cours', color: 'bg-emerald-100 text-emerald-700', icon: Truck };
    case 'delivered': return { label: 'Livrée', color: 'bg-slate-100 text-slate-500', icon: CheckCircle };
    case 'cancelled': return { label: 'Annulée', color: 'bg-red-100 text-red-700', icon: AlertCircle };
    default: return { label: status, color: 'bg-slate-100 text-slate-700', icon: Package };
  }
};

interface DeliveryItemProps {
  delivery: DeliveryRequest;
  key?: string;
}

function DeliveryItem({ delivery }: DeliveryItemProps) {
  const [bids, setBids] = useState<DeliveryBid[]>([]);
  const [showBids, setShowBids] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedBid, setSelectedBid] = useState<DeliveryBid | null>(null);
  
  const [refuseBidData, setRefuseBidData] = useState<DeliveryBid | null>(null);
  const [counterPrice, setCounterPrice] = useState<number | ''>('');

  useEffect(() => {
    if (delivery.status !== 'pending') return;
    const unsub = onSnapshot(collection(db, `deliveries/${delivery.id}/bids`), (snap) => {
      setBids(snap.docs.map(d => ({ ...d.data(), id: d.id } as DeliveryBid)));
    });
    return () => unsub();
  }, [delivery.id, delivery.status]);

  const activeBids = bids.filter(b => b.status !== 'rejected');

  const handleRefuseBid = async (withoutCounterOffer: boolean) => {
    if (!refuseBidData) return;
    try {
      if (!withoutCounterOffer && counterPrice) {
        // Update delivery with new client counter-offer
        await updateDoc(doc(db, 'deliveries', delivery.id), {
          clientProposedPrice: Number(counterPrice),
          updatedAt: new Date().toISOString()
        });
      }
      
      // Mark bid as rejected
      await updateDoc(doc(db, 'deliveries', delivery.id, 'bids', refuseBidData.id), {
        status: 'rejected',
        updatedAt: new Date().toISOString()
      });
      
      setRefuseBidData(null);
      setCounterPrice('');
    } catch (e) {
      console.error(e);
      alert("Erreur lors du refus de l'offre");
    }
  };

  const acceptBid = async (paymentMethod: 'cash' | 'mobile_money' | 'card') => {
    if (!selectedBid) return;
    try {
      await updateDoc(doc(db, 'deliveries', delivery.id), {
        status: 'accepted',
        driverId: selectedBid.driverId,
        driverName: selectedBid.driverName,
        vehicleType: selectedBid.vehicleType,
        cost: selectedBid.price,
        paymentMethod,
        isPaid: paymentMethod !== 'cash', // If not cash, we mark it paid (blocked)
        updatedAt: new Date().toISOString()
      });
      setIsPaymentModalOpen(false);
    } catch (e) {
      console.error(e);
      console.log("Erreur lors de la validation");
    }
  };

  const submitRating = async (ratingValue: number) => {
    try {
      await updateDoc(doc(db, 'deliveries', delivery.id), {
        rating: ratingValue,
        updatedAt: new Date().toISOString()
      });
    } catch (e) {
      console.error(e);
      console.log("Erreur lors de l'évaluation");
    }
  };

  const status = getStatusConfig(delivery.status);
  const isLive = ['accepted', 'picked_up'].includes(delivery.status);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-white/70 backdrop-blur-xl rounded-[32px] p-6 sm:p-8 shadow-sm hover:shadow-xl shadow-slate-200/40 border border-white transition-all duration-300 relative overflow-hidden group ${isLive ? 'ring-2 ring-orange-500/20' : ''}`}
    >
      {isLive && <div className="absolute top-0 right-0 w-64 h-full bg-gradient-to-l from-orange-500/5 to-transparent pointer-events-none" />}
      
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 relative z-10">
        <div className="flex-1 space-y-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className={cn("px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-sm border border-black/5 bg-white", status.color)}>
              <status.icon className="w-4 h-4" />
              <span>{status.label}</span>
            </div>
            <span className="text-[10px] text-slate-400 font-bold tracking-[0.2em] uppercase">
              • {delivery.createdAt ? new Date(delivery.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Date inconnue'}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-12">
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Départ</p>
              <p className="text-base text-slate-900 font-bold leading-tight">{delivery.from?.address || 'Adresse non spécifiée'}</p>
            </div>
            <div className="hidden sm:block w-8 h-px bg-slate-300" />
            <div>
              <p className="text-[9px] font-black text-orange-500 uppercase tracking-widest mb-1">Arrivée</p>
              <p className="text-base text-slate-900 font-bold leading-tight">{delivery.to?.address || 'Adresse non spécifiée'}</p>
            </div>
          </div>
        </div>

        <div className="flex sm:items-center justify-between lg:flex-col lg:items-end gap-6 shrink-0 pt-6 lg:pt-0 border-t lg:border-t-0 border-slate-100/50">
          {delivery.status === 'pending' ? (
               <div className="flex flex-col items-end">
                 <button 
                 onClick={() => setShowBids(!showBids)}
                 className="px-6 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-orange-500 transition-all flex items-center gap-2 shadow-xl shadow-slate-900/20"
               >
                 {activeBids.length > 0 ? (
                   <>
                     <span className="relative flex h-2 w-2 mr-1">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                     </span>
                     Revoir {activeBids.length} Offre{activeBids.length > 1 ? 's' : ''}
                   </>
                 ) : (
                   <>
                     <Search className="w-4 h-4" /> En attente de devis
                   </>
                 )}
               </button>
               <button 
                 onClick={async (e) => {
                   const btn = e.currentTarget;
                   if (btn.innerText === 'CONFIRMER ANNULATION ?') {
                     await updateDoc(doc(db, 'deliveries', delivery.id), { status: 'cancelled', updatedAt: new Date().toISOString() });
                   } else {
                     btn.innerText = 'CONFIRMER ANNULATION ?';
                     setTimeout(() => { if(btn) btn.innerText = 'Annuler demande'; }, 3000);
                   }
                 }} 
                 className="text-slate-400 text-[10px] font-bold mt-2 hover:text-red-500 transition-colors uppercase"
               >
                 Annuler demande
               </button>
             </div>
          ) : (
            <div className="flex flex-col items-end">
              <div className="text-4xl font-black text-slate-900 tracking-tighter leading-none mb-4">{delivery.cost?.toLocaleString('fr-FR')} <span className="text-sm font-bold text-slate-400">FCFA</span></div>
              {isLive ? (
                <div className="flex items-center gap-4">
                    {delivery.status === 'accepted' ? (
                      <div className="hidden sm:flex flex-col items-end px-5 py-3 bg-slate-900 text-white rounded-2xl shadow-lg relative overflow-hidden">
                        <div className="absolute -right-4 -bottom-4 w-12 h-12 bg-white/10 rounded-full blur-md" />
                        <span className="text-[8px] font-black uppercase text-slate-400 tracking-[0.2em]">PIN Enlèvement</span>
                        <span className="text-2xl font-black tracking-[0.3em] text-orange-500 leading-none mt-1">{delivery.pickupCode}</span>
                      </div>
                    ) : (
                        <div className="flex flex-col items-end px-5 py-3 bg-emerald-950 text-white rounded-2xl shadow-lg relative overflow-hidden">
                        <div className="absolute -right-4 -bottom-4 w-12 h-12 bg-white/10 rounded-full blur-md" />
                        <span className="text-[8px] font-black uppercase text-emerald-400/70 tracking-[0.2em]">PIN Validation</span>
                        <span className="text-2xl font-black tracking-[0.3em] text-emerald-400 leading-none mt-1">{delivery.deliveryCode}</span>
                      </div>
                    )}
                    <Link
                      to={`/delivery/${delivery.id}`}
                      className="bg-orange-500 text-white w-14 h-14 rounded-full flex items-center justify-center hover:bg-slate-900 transition-all shadow-xl shadow-orange-500/30 group/btn hover:scale-105"
                    >
                      <Navigation className="w-5 h-5 group-hover/btn:scale-110 transition-transform" />
                    </Link>
                </div>
              ) : delivery.status === 'delivered' ? (
                <div className="flex flex-col items-end gap-2">
                  <div className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-100">
                    Livraison Réussie
                  </div>
                  {!delivery.rating && (
                    <div className="flex items-center gap-1 mt-2">
                      {[1,2,3,4,5].map(star => (
                        <button key={star} onClick={() => submitRating(star)} className="text-xl text-slate-300 hover:text-amber-400 transition-colors">
                          ★
                        </button>
                      ))}
                    </div>
                  )}
                  {delivery.rating && (
                    <div className="flex items-center gap-1 mt-2 text-amber-500 text-sm">
                      Note : {"★".repeat(delivery.rating)}{"☆".repeat(5 - delivery.rating)}
                    </div>
                  )}
                </div>
              ) : (
                <div className="px-4 py-2 bg-slate-100 text-slate-500 rounded-full text-[10px] font-black uppercase tracking-widest">
                  {status.label}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Bids Dropdown */}
      <AnimatePresence>
        {delivery.status === 'pending' && showBids && activeBids.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-6 pt-6 border-t border-slate-100 space-y-4"
          >
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Propositions des livreurs :</p>
            {activeBids.map(bid => (
              <div key={bid.id} className="bg-slate-50 p-4 rounded-3xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:bg-white hover:border-orange-200 hover:shadow-xl hover:shadow-orange-500/10 transition-all">
                 <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                   <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center shrink-0 relative">
                     <Truck className="w-6 h-6" />
                     {bid.price > (delivery.clientProposedPrice || delivery.baseCost || 0) && (
                       <span className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 text-white rounded-full flex items-center justify-center text-[7px] font-black border-2 border-white">
                         !
                       </span>
                     )}
                   </div>
                   <div>
                     <p className="text-sm font-bold text-slate-900 group-hover:text-orange-500 transition-colors uppercase tracking-widest">{bid.driverName}</p>
                     <p className="text-[10px] font-bold text-slate-500 mt-1 uppercase tracking-wider flex items-center gap-2">
                       <span>{bid.vehicleType}</span>
                       <span className="w-1 h-1 bg-slate-300 rounded-full" />
                       <span>{bid.timeEstimateMins} mins</span>
                     </p>
                     {bid.reason && (
                       <p className="text-[9px] text-slate-400 font-medium italic mt-1 bg-slate-200/50 px-2 py-0.5 rounded-lg max-w-[200px] truncate group-hover:max-w-none group-hover:whitespace-normal transition-all">
                         "{bid.reason}"
                       </p>
                     )}
                   </div>
                 </div>
                 
                 <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-4 sm:pt-0 border-slate-200">
                    <div className="text-right flex-1 sm:flex-none">
                      <div className="text-2xl font-black text-slate-900 italic tracking-tighter">
                        {bid.price} <span className="text-[10px] text-slate-400 not-italic uppercase">FCFA</span>
                      </div>
                      {bid.price > (delivery.clientProposedPrice || 0) && (
                        <p className="text-[7px] font-black text-orange-500 uppercase tracking-widest mt-0.5">Contre-proposition</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setRefuseBidData(bid)}
                        className="flex-1 sm:flex-none px-4 py-3 bg-red-50 text-red-600 hover:bg-red-500 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                      >
                        Refuser
                      </button>
                      <button 
                        onClick={() => {
                          setSelectedBid(bid);
                          setIsPaymentModalOpen(true);
                        }}
                        className="flex-1 sm:flex-none px-6 py-3 bg-slate-200 text-slate-800 hover:bg-orange-500 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-slate-200/50 hover:shadow-orange-500/20"
                      >
                        Accepter
                      </button>
                    </div>
                 </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {refuseBidData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setRefuseBidData(null)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[32px] p-6 lg:p-8 shadow-2xl relative w-full max-w-md z-10"
            >
              <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter mb-2">Refuser l'offre</h3>
              <p className="text-sm font-medium text-slate-500 mb-6">Vous pouvez simplement refuser l'offre, ou faire une contre-proposition qui mettra à jour votre tarif souhaité pour tous les livreurs.</p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-2">Nouvelle proposition (FCFA) - Optionnel</label>
                  <input 
                    type="number"
                    value={counterPrice}
                    onChange={(e) => setCounterPrice(e.target.value ? Number(e.target.value) : '')}
                    placeholder="Ex: 1500"
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold focus:border-orange-500 focus:bg-white transition-all outline-none"
                  />
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4">
                  <button onClick={() => handleRefuseBid(true)} className="px-4 py-3 bg-red-100 text-red-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-200 transition-all">
                    Juste refuser
                  </button>
                  <button onClick={() => handleRefuseBid(false)} disabled={!counterPrice} className="px-4 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-orange-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                    Refuser & Proposer
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <PaymentModal 
        isOpen={isPaymentModalOpen} 
        onClose={() => setIsPaymentModalOpen(false)} 
        amount={selectedBid?.price || 0}
        onConfirm={acceptBid}
      />
    </motion.div>
  );
}

export default function ClientDashboard() {
  const { profile, t } = useAuth();
  const [deliveries, setDeliveries] = useState<DeliveryRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [localTime, setLocalTime] = useState(new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));

  useEffect(() => {
    const timer = setInterval(() => {
      setLocalTime(new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!profile) {
      setLoading(false);
      return;
    }
    const q = query(collection(db, 'deliveries'), where('clientId', '==', profile.userId), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        setDeliveries(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DeliveryRequest)));
        setLoading(false);
      },
      (error) => {
        console.warn("Client deliveries listener error:", error.message);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [profile]);

  if (loading) return (
    <div className="max-w-4xl mx-auto space-y-6 pt-12">
       <div className="h-40 bg-slate-200 rounded-[40px] animate-pulse flex items-center justify-center">
         <p className="text-slate-400 font-bold uppercase tracking-widest">Chargement des données...</p>
       </div>
       {[1, 2, 3].map(i => <div key={i} className="h-24 bg-slate-200 rounded-3xl animate-pulse" />)}
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto pb-24 px-4 sm:px-6 relative">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-orange-500/10 rounded-full blur-[100px] -z-10 pointer-events-none" />
      <div className="absolute top-40 left-0 w-[400px] h-[400px] bg-blue-500/5 rounded-full blur-[100px] -z-10 pointer-events-none" />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-12 mt-4">
        <div className="lg:col-span-8 bg-white/60 backdrop-blur-3xl border border-white/80 p-6 sm:p-12 rounded-[40px] shadow-xl shadow-slate-200/40 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-orange-400/20 to-transparent rounded-bl-full -z-10 transition-transform duration-700 group-hover:scale-110" />
          <div className="flex items-center gap-2 mb-4">
            <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Ouagadougou • Live</span>
          </div>
          <h1 className="text-4xl sm:text-7xl font-black text-slate-900 tracking-tighter mb-4 leading-none">
            Gérez vos <span className="text-orange-500 italic pr-4">livraisons.</span>
          </h1>
          <p className="text-slate-500 font-medium text-sm sm:text-lg max-w-lg mb-10">
            Bienvenue {profile?.name}. Accédez à vos expéditions, suivez vos coursiers en temps réel et commandez de nouveaux trajets en un clic.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Link to="/client/new" className="flex-1 sm:flex-none text-center px-10 py-5 bg-slate-900 text-white rounded-full font-black text-[11px] uppercase tracking-[0.2em] hover:bg-orange-500 hover:scale-105 hover:shadow-2xl hover:shadow-orange-500/30 transition-all duration-300">
              {t('commander')}
            </Link>
            <div className="flex-1 sm:flex-none justify-center px-6 py-5 bg-white/80 rounded-full font-bold text-xs sm:text-sm text-slate-600 shadow-sm border border-slate-100 flex items-center gap-3">
              <Clock className="w-5 h-5 text-orange-500" />
              Il est {localTime}
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 grid grid-cols-2 gap-4">
            {[
              { label: 'En Transit', value: deliveries.filter(d => ['accepted', 'picked_up'].includes(d.status)).length, icon: Navigation, theme: 'orange' },
              { label: 'Total Missions', value: deliveries.length, icon: Package, theme: 'slate' },
              { label: 'Livrées', value: deliveries.filter(d => d.status === 'delivered').length, icon: CheckCircle, theme: 'emerald' },
              { label: 'Points Star', value: 450, icon: AlertCircle, theme: 'blue' }
            ].map((stat, i) => (
              <div key={i} className={`bg-white/60 backdrop-blur-2xl border border-white p-6 rounded-[32px] flex flex-col justify-between shadow-lg shadow-slate-200/30 hover:-translate-y-1 transition-all duration-300 relative overflow-hidden`}>
                 <div className={`absolute -right-4 -top-4 w-20 h-20 bg-${stat.theme}-500/10 rounded-full blur-xl pointer-events-none`} />
                 <stat.icon className={`w-8 h-8 text-${stat.theme}-500 mb-6`} />
                 <div>
                   <p className="text-4xl font-black text-slate-900 tracking-tighter leading-none mb-2">{stat.value}</p>
                   <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-tight">{stat.label}</p>
                 </div>
              </div>
            ))}
        </div>
      </div>

      <div className="flex items-center gap-6 mb-8">
        <h3 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">Historique Récent</h3>
        <div className="h-px bg-slate-200 flex-1" />
      </div>

      {deliveries.length === 0 ? (
        <div className="text-center py-20 bg-white/40 backdrop-blur-3xl rounded-[40px] border border-white shadow-xl shadow-slate-200/20">
          <div className="bg-slate-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-8 border border-white shadow-inner">
            <Package className="w-10 h-10 text-slate-300" />
          </div>
          <h3 className="text-3xl font-black text-slate-900 mb-3 tracking-tight">Aucune course trouvée</h3>
          <p className="text-slate-500 font-medium text-lg mb-10">Il est temps de lancer votre première expédition.</p>
          <Link to="/client/new" className="text-slate-900 font-black hover:text-orange-500 uppercase tracking-widest text-xs border-b-2 border-slate-900 hover:border-orange-500 pb-1 transition-all">
            Commencer ici
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          <AnimatePresence>
            {deliveries.map((delivery, index) => (
              <DeliveryItem key={delivery.id} delivery={delivery} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
