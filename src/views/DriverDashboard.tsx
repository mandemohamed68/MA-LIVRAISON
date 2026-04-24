import { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, setDoc, getDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { DeliveryRequest, CommissionSettings } from '../types';
import { MapPin, Truck, CheckCircle, Navigation, Package, DollarSign, XCircle, BellRing, AlertCircle, ShieldCheck, Zap, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { cn } from '../lib/utils';
import L from 'leaflet';

// Icons setup
// @ts-ignore
import markerIcon from 'leaflet/dist/images/marker-icon.png';
// @ts-ignore
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
// @ts-ignore
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

export default function DriverDashboard() {
  const { profile } = useAuth();
  const [pendingJobs, setPendingJobs] = useState<DeliveryRequest[]>([]);
  const [activeJob, setActiveJob] = useState<DeliveryRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  
  const [biddingOn, setBiddingOn] = useState<string | null>(null);
  const [bidPrice, setBidPrice] = useState<number | ''>('');
  const [bidTime, setBidTime] = useState<number | ''>('');
  const [bidReason, setBidReason] = useState('');
  const [submittedBids, setSubmittedBids] = useState<string[]>([]);
  const [commissionSettings, setCommissionSettings] = useState<CommissionSettings | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      const snap = await getDoc(doc(db, 'settings', 'commissions'));
      if (snap.exists()) {
        setCommissionSettings(snap.data() as CommissionSettings);
      }
    };
    fetchSettings();
  }, []);

  useEffect(() => {
    if (!profile) {
      // If we've waited and there's no profile, stop loading (might show error or null state)
      // but only after Auth state is definitely not loading
      setLoading(false);
      return;
    }

    // Track user location
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(coords);
        // Update driver location in Firestore
        if (profile.role === 'driver') {
          updateDoc(doc(db, 'users', profile.userId), { 
            currentLocation: coords,
            updatedAt: new Date().toISOString()
          });
        }
      },
      (err) => console.error(err),
      { enableHighAccuracy: true }
    );

    // Listen for pending jobs (No vehicle filter anymore)
    const qPending = query(
      collection(db, 'deliveries'),
      where('status', '==', 'pending')
    );

    const unsubPending = onSnapshot(qPending, 
      (snapshot) => {
        setPendingJobs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DeliveryRequest)));
      },
      (error) => {
        console.warn("Driver pending jobs listener error:", error.message);
      }
    );

    // Listen for active job assigned to this driver
    const qActive = query(
      collection(db, 'deliveries'),
      where('driverId', '==', profile.userId),
      where('status', 'in', ['accepted', 'picked_up'])
    );

    const unsubActive = onSnapshot(qActive, 
      (snapshot) => {
        const job = snapshot.docs[0];
        setActiveJob(job ? ({ id: job.id, ...job.data() } as DeliveryRequest) : null);
        setLoading(false);
      },
      (error) => {
        console.warn("Driver active job listener error:", error.message);
        setLoading(false);
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
      unsubPending();
      unsubActive();
    };
  }, [profile]);

  const submitBid = async (deliveryId: string, directPrice?: number) => {
    if (!profile) return;
    
    // If directPrice is provided, it means "Accepter au prix client" - direct assignment
    if (directPrice) {
      try {
        await updateDoc(doc(db, 'deliveries', deliveryId), {
          status: 'accepted',
          driverId: profile.userId,
          driverName: profile.name,
          cost: directPrice,
          updatedAt: new Date().toISOString()
        });
        setToastMessage("Course acceptée !");
      } catch (e) {
        console.error("Direct accept error:", e);
        setToastMessage("Erreur lors de l'acceptation");
      }
      return;
    }

    // Normal bidding process
    const finalPrice = Number(bidPrice);
    const finalTime = Number(bidTime);

    if (!finalPrice || !finalTime) {
      setToastMessage("Veuillez remplir le prix et le temps");
      return;
    }

    // Validate against max ratio
    const delivery = pendingJobs.find(d => d.id === deliveryId);
    if (delivery && delivery.baseCost && commissionSettings) {
      const maxPrice = delivery.baseCost * (commissionSettings.maxRatioLivreur || 2.0);
      if (finalPrice > maxPrice) {
        setToastMessage(`Prix trop élevé (Max: ${Math.round(maxPrice)} FCFA)`);
        return;
      }
    }

    try {
      await setDoc(doc(db, 'deliveries', deliveryId, 'bids', profile.userId), {
        deliveryId,
        driverId: profile.userId,
        driverName: profile.name,
        vehicleType: profile.vehicleType || 'moto',
        price: finalPrice,
        timeEstimateMins: finalTime,
        reason: bidReason,
        createdAt: new Date().toISOString()
      });
      setSubmittedBids(prev => [...prev, deliveryId]);
      setBiddingOn(null);
      setBidPrice('');
      setBidTime('');
      setBidReason('');
      setToastMessage("Offre envoyée !");
    } catch (e) {
      console.error(e);
      setToastMessage("Erreur d'offre");
    }
  };

  const [earnings, setEarnings] = useState(0);
  const [avgRating, setAvgRating] = useState(0);
  const [totalRatings, setTotalRatings] = useState(0);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);
  const [withdrawMethod, setWithdrawMethod] = useState<'mobile_money' | 'cash'>('mobile_money');
  const [withdrawPhone, setWithdrawPhone] = useState('');

  useEffect(() => {
    if (!profile?.userId) return;
    const qEarnings = query(
      collection(db, 'deliveries'),
      where('driverId', '==', profile.userId),
      where('status', '==', 'delivered')
    );
    const unsubEarnings = onSnapshot(qEarnings, (snap) => {
      const delivered = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as DeliveryRequest));
      const unpaid = delivered.filter(d => !d.paidToDriver);
      const total = unpaid.reduce((sum, d) => sum + (d.cost || 0), 0);
      setEarnings(total * (commissionSettings?.driverSharePercent || 85) / 100);

      const rated = delivered.filter(d => (d.rating || 0) > 0);
      if (rated.length > 0) {
        const sumRating = rated.reduce((acc, d) => acc + (d.rating || 0), 0);
        setAvgRating(Number((sumRating / rated.length).toFixed(1)));
        setTotalRatings(rated.length);
      }
    });
    return () => unsubEarnings();
  }, [profile, commissionSettings]);

  const handleWithdrawal = async () => {
    if (!profile || earnings < 500) {
       setToastMessage("Solde insuffisant (min. 500)");
       return;
    }
    
    if (withdrawMethod === 'mobile_money' && !withdrawPhone) {
      setToastMessage("Veuillez saisir un numéro");
      return;
    }

    setIsWithdrawing(true);
    try {
      await updateDoc(doc(db, 'users', profile.userId), {
        withdrawalRequested: true,
        withdrawalAmount: earnings,
        withdrawalMethod: withdrawMethod,
        withdrawalPhone: withdrawPhone || profile.phone || '',
        updatedAt: new Date().toISOString()
      });
      setToastMessage("Demande envoyée !");
      setShowWithdrawalModal(false);
    } catch (e) {
      console.error(e);
      setToastMessage("Erreur réseau");
    } finally {
      setIsWithdrawing(false);
    }
  };

  const [codeInput, setCodeInput] = useState('');
  const [pickupCodeInput, setPickupCodeInput] = useState('');

  const [toastMessage, setToastMessage] = useState('');
  useEffect(() => {
    if (toastMessage) {
      const t = setTimeout(() => setToastMessage(''), 4000);
      return () => clearTimeout(t);
    }
  }, [toastMessage]);

  const updateStatus = async (status: 'picked_up' | 'delivered') => {
    if (!activeJob) return;
    
    if (status === 'picked_up') {
      if (pickupCodeInput !== activeJob.pickupCode) {
        setToastMessage("Code d'enlèvement incorrect !");
        return;
      }
    }
    
    if (status === 'delivered') {
      if (codeInput !== activeJob.deliveryCode) {
        setToastMessage("Code de livraison incorrect !");
        return;
      }
    }
    
    try {
      await updateDoc(doc(db, 'deliveries', activeJob.id), {
        status,
        updatedAt: new Date().toISOString()
      });
      setCodeInput('');
      setPickupCodeInput('');
    } catch(err) {
      setToastMessage("Erreur réseau");
    }
  };

  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const cancelJob = async () => {
    if (!activeJob) return;
    if (showCancelConfirm) {
      await updateDoc(doc(db, 'deliveries', activeJob.id), {
        status: 'pending',
        driverId: null,
        driverName: null,
        updatedAt: new Date().toISOString()
      });
      setCodeInput('');
      setPickupCodeInput('');
      setShowCancelConfirm(false);
    } else {
      setShowCancelConfirm(true);
      setTimeout(() => setShowCancelConfirm(false), 3000);
    }
  };

  const ChangeView = ({ center }: { center: [number, number] }) => {
    const map = useMap();
    useEffect(() => {
      if (center && !isNaN(center[0]) && !isNaN(center[1])) {
        map.flyTo(center, 15, { duration: 1.5 });
      }
    }, [center, map]);
    return null;
  };

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center p-8">
    <div className="w-16 h-16 border-8 border-orange-500 border-t-white rounded-full animate-spin shadow-[0_0_30px_rgba(249,115,22,0.8)]" />
  </div>;

  return (
    <div className="min-h-screen bg-slate-950 font-sans selection:bg-orange-500/30 selection:text-orange-200 pb-20">
      
      {/* Top Navigation Cockpit */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-6 sm:px-8 mb-8 sticky top-0 z-50 shadow-2xl">
        <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]"></span>
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-emerald-500">Système Connecté</span>
            </div>
            <h1 className="text-3xl md:text-5xl font-black text-white tracking-tighter uppercase italic leading-none flex items-center gap-4">
              Terminal <span className="text-orange-500">Livreur.</span>
            </h1>
          </div>
          
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              {toastMessage && (
                <div className="absolute top-full right-0 mt-4 bg-orange-500 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-2xl z-50">
                  {toastMessage}
                </div>
              )}
              
              {/* Reliability Score Card */}
              <div className="flex items-center gap-4 px-6 py-3 bg-slate-800 rounded-3xl border border-slate-700 shadow-xl group hover:border-emerald-500/50 transition-all">
                <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                   <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                   <p className="text-[8px] font-black uppercase tracking-widest text-slate-500 mb-0.5">Reliability Score</p>
                   <div className="flex items-center gap-2">
                     <p className="text-xl font-black text-white italic">{avgRating || '5.0'}</p>
                     <div className="flex gap-0.5">
                       {[1, 2, 3, 4, 5].map(s => (
                         <div key={s} className={cn("w-1 h-3 rounded-full", (avgRating || 5) >= s ? "bg-emerald-500" : "bg-slate-700")} />
                       ))}
                     </div>
                   </div>
                </div>
              </div>

              <div className="hidden sm:flex flex-col items-end">
              <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.3em] mb-1">VEHICULE ACTIF</p>
              <div className="flex items-center gap-3 px-5 py-3 bg-slate-800 text-white rounded-2xl border border-slate-700">
                <Truck className="w-4 h-4 text-orange-500" />
                <span className="text-xs font-black uppercase tracking-widest">{profile?.vehicleType || 'MOTO'}</span>
              </div>
            </div>
            
            <div className="flex justify-between items-center bg-slate-950 border border-slate-800 px-6 py-4 rounded-3xl shadow-inner relative group overflow-hidden sm:min-w-[300px]">
              <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-[30px] -mr-10 -mt-10 pointer-events-none" />
              <div>
                <p className="text-[8px] font-black uppercase tracking-widest text-slate-500 mb-1">Portefeuille ({commissionSettings?.driverSharePercent || 85}%)</p>
                <p className="text-3xl font-black text-orange-500 tracking-tighter leading-none italic">{earnings.toLocaleString('fr-FR')} <span className="text-xs text-white opacity-50 not-italic">FCFA</span></p>
              </div>
              <button 
                onClick={() => setShowWithdrawalModal(true)}
                disabled={isWithdrawing || earnings < 500 || profile?.withdrawalRequested}
                className="ml-6 px-5 py-3 bg-white text-slate-900 hover:bg-orange-500 hover:text-white disabled:bg-slate-800 disabled:text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl active:scale-95"
              >
                {profile?.withdrawalRequested ? 'En attente' : 'Retirer'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Withdrawal Modal */}
      <AnimatePresence>
        {showWithdrawalModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowWithdrawalModal(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-slate-900 rounded-[40px] border border-slate-800 shadow-2xl p-8 overflow-hidden"
            >
              <div className="absolute -right-20 -top-20 w-48 h-48 bg-orange-500/10 rounded-full blur-[40px]" />
              
              <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter mb-2">Demander un <span className="text-orange-500">Retrait.</span></h2>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-8">Solde disponible : {earnings} FCFA</p>

              <div className="space-y-6">
                <div>
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-3">Méthode de Paiement</p>
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => setWithdrawMethod('mobile_money')}
                      className={cn(
                        "flex items-center justify-center gap-3 py-4 rounded-2xl border text-[10px] font-black uppercase tracking-widest transition-all",
                        withdrawMethod === 'mobile_money' ? "bg-orange-500 text-white border-orange-500 shadow-lg shadow-orange-500/20" : "bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-600"
                      )}
                    >
                      <Zap className="w-4 h-4" /> Mobile Money
                    </button>
                    <button 
                      onClick={() => setWithdrawMethod('cash')}
                      className={cn(
                        "flex items-center justify-center gap-3 py-4 rounded-2xl border text-[10px] font-black uppercase tracking-widest transition-all",
                        withdrawMethod === 'cash' ? "bg-orange-500 text-white border-orange-500 shadow-lg shadow-orange-500/20" : "bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-600"
                      )}
                    >
                      <DollarSign className="w-4 h-4" /> Espèces
                    </button>
                  </div>
                </div>

                {withdrawMethod === 'mobile_money' && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}>
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-2">Numéro Mobile Money</p>
                    <input 
                      type="tel" 
                      placeholder="Ex: 01020304"
                      value={withdrawPhone}
                      onChange={(e) => setWithdrawPhone(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 text-white p-4 rounded-2xl text-lg font-black tracking-widest focus:border-orange-500 transition-all outline-none"
                    />
                  </motion.div>
                )}

                <div className="pt-4 flex gap-4">
                   <button 
                    onClick={() => setShowWithdrawalModal(false)}
                    className="flex-1 py-4 text-slate-500 text-[10px] font-black uppercase tracking-widest hover:text-white transition-all"
                   >
                     Annuler
                   </button>
                   <button 
                    onClick={handleWithdrawal}
                    disabled={isWithdrawing}
                    className="flex-[2] py-4 bg-orange-500 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-orange-600 transition-all shadow-xl shadow-orange-500/20"
                   >
                     {isWithdrawing ? 'Envoi...' : 'Confirmer le retrait'}
                   </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Driver Type Selection (For new or unset profiles) */}
      {!profile?.driverType && (
        <div className="max-w-[1600px] mx-auto px-4 xl:px-8 mb-8">
           <div className="bg-orange-500/10 border border-orange-500/20 rounded-[32px] p-8 flex flex-col md:flex-row items-center justify-between gap-6">
              <div>
                 <h3 className="text-xl font-black text-white italic uppercase tracking-tighter mb-1">Configuration <span className="text-orange-500">Profil.</span></h3>
                 <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Précisez votre statut pour la gestion des revenus</p>
              </div>
              <div className="flex gap-4">
                 <button 
                  onClick={() => updateDoc(doc(db, 'users', profile?.userId!), { driverType: 'freelance', updatedAt: new Date().toISOString() })}
                  className="px-8 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest border border-slate-800 hover:border-orange-500 transition-all"
                 >
                   Je suis Indépendant
                 </button>
                 <button 
                  onClick={() => updateDoc(doc(db, 'users', profile?.userId!), { driverType: 'company', updatedAt: new Date().toISOString() })}
                  className="px-8 py-4 bg-orange-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-orange-500/20 active:scale-95 transition-all"
                 >
                   Je travaille pour une Société
                 </button>
              </div>
           </div>
        </div>
      )}

      <div className="max-w-[1600px] mx-auto px-4 xl:px-8">
        <div className="grid grid-cols-12 gap-8 h-full">
          {/* Left Column: Missions Radar */}
          <div className="col-span-12 lg:col-span-4 xl:col-span-3 flex flex-col gap-6">
            <div className="bg-slate-900 rounded-[40px] border border-slate-800 flex flex-col overflow-hidden min-h-[600px] shadow-2xl">
               <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
                 <h3 className="text-white font-black text-[11px] uppercase tracking-[0.3em]">Radar des Missions</h3>
                 <div className="w-6 h-6 rounded-full bg-orange-500/20 flex items-center justify-center">
                    <Zap className="w-3 h-3 text-orange-500" />
                 </div>
               </div>
              
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 custom-scrollbar">
                <AnimatePresence mode="popLayout">
                  {activeJob ? (
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="p-6 rounded-[32px] bg-slate-800 text-white shadow-2xl border border-slate-700 relative overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 w-full h-2 bg-orange-500" />
                      <div className="absolute -right-10 -top-10 w-32 h-32 bg-orange-500/10 blur-[20px] rounded-full pointer-events-none" />
                      
                      <div className="flex justify-between items-center mb-6 pt-2 relative z-10">
                        <span className="px-3 py-1 bg-orange-500/20 text-orange-400 font-black uppercase tracking-widest text-[8px] rounded-full border border-orange-500/30">
                          En CourS
                        </span>
                        <div className="flex items-center gap-2">
                           <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Gain</span>
                           <span className="text-xl font-black text-white italic">{activeJob.cost} <span className="text-[10px] opacity-50 not-italic">FCFA</span></span>
                        </div>
                      </div>

                      <div className="space-y-5 mb-8 relative z-10">
                         <div className="relative pl-6">
                           <div className="absolute left-0 top-1 w-3 h-3 rounded-full bg-slate-600 border-2 border-slate-800" />
                           <div className="absolute left-[5px] top-4 bottom-[-24px] w-0.5 bg-slate-700" />
                           <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">DÉPART</p>
                           <p className="text-sm font-bold text-white leading-tight">{activeJob.from.address}</p>
                           {activeJob.from.indications && <p className="text-[10px] text-slate-400 italic mt-1">{activeJob.from.indications}</p>}
                         </div>
                         <div className="relative pl-6">
                           <div className="absolute left-0 top-1 w-3 h-3 rounded-full bg-orange-500 border-2 border-slate-800 shadow-[0_0_10px_rgba(249,115,22,0.5)]" />
                           <p className="text-[8px] font-black text-orange-500 uppercase tracking-widest mb-1">DESTINATION</p>
                           <p className="text-sm font-bold text-white leading-tight">{activeJob.to.address}</p>
                           {activeJob.to.indications && <p className="text-[10px] text-slate-400 italic mt-1">{activeJob.to.indications}</p>}
                         </div>
                      </div>

                      <div className="bg-slate-900 rounded-[24px] p-5 border border-slate-800 space-y-4 mb-6 relative z-10">
                        {activeJob.status === 'accepted' ? (
                          <>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Code Enlèvement (par le client)</p>
                            <input 
                              type="text" 
                              placeholder="Entrer code PIN..."
                              value={pickupCodeInput}
                              onChange={e => setPickupCodeInput(e.target.value.toUpperCase())}
                              className="w-full bg-slate-950 border border-slate-700 text-white font-black text-lg p-3 rounded-xl focus:border-orange-500 focus:ring-1 focus:ring-orange-500 text-center tracking-[0.2em]"
                            />
                            <button 
                              onClick={() => updateStatus('picked_up')}
                              className="w-full py-4 bg-orange-500 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-xl hover:bg-orange-600 shadow-lg shadow-orange-500/20"
                            >
                              Valider l'Enlèvement
                            </button>
                          </>
                        ) : (
                          <>
                            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500 mb-2">Code Livraison (par le client)</p>
                            <input 
                              type="text" 
                              placeholder="Entrer code PIN final..."
                              value={codeInput}
                              onChange={e => setCodeInput(e.target.value.toUpperCase())}
                              className="w-full bg-slate-950 border border-slate-700 text-white font-black text-lg p-3 rounded-xl focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-center tracking-[0.2em]"
                            />
                            <button 
                              onClick={() => updateStatus('delivered')}
                              className="w-full py-4 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-xl hover:bg-emerald-500 shadow-lg shadow-emerald-500/20"
                            >
                              Terminer la Course
                            </button>
                          </>
                        )}
                      </div>

                      <button onClick={cancelJob} className="w-full py-3 bg-red-500/10 text-red-500 text-[9px] font-black uppercase tracking-widest rounded-xl hover:bg-red-500 hover:text-white transition-all border border-red-500/20 relative z-10">
                        {showCancelConfirm ? 'Confirmer l\'Annulation ?' : 'Bouton Panique / Annuler Course'}
                      </button>
                    </motion.div>
                  ) : (
                    pendingJobs.map((job) => (
                      <motion.div
                        key={job.id}
                        layout
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-[#111827] rounded-[28px] border border-slate-800 hover:border-slate-700 transition-all overflow-hidden shadow-xl group relative"
                      >
                        {/* Shimmer effect */}
                        <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />

                        <div className="p-5">
                          <div className="flex justify-between items-center mb-5">
                            <div className="flex gap-2">
                              <span className="px-3 py-1 bg-indigo-500/10 text-indigo-400 font-bold uppercase tracking-[0.2em] text-[8px] rounded-full border border-indigo-500/20">
                                Nouveau
                              </span>
                              {job.packageDetails && (
                                <span className="px-3 py-1 bg-amber-500/10 text-amber-500 font-bold uppercase tracking-[0.2em] text-[8px] rounded-full border border-amber-500/20">
                                  {job.packageDetails.size}
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] font-black tracking-widest text-slate-500 uppercase">
                              #{job.id.slice(-4)}
                            </span>
                          </div>

                          <div className="flex items-end justify-between mb-6 pb-6 border-b border-dashed border-slate-800">
                             <div>
                               <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">Offre Initiale</p>
                               <div className="flex items-baseline gap-1">
                                 <span className="text-2xl font-black text-white">{job.clientProposedPrice || job.cost}</span>
                                 <span className="text-[10px] font-bold text-emerald-400">FCFA</span>
                               </div>
                             </div>
                             <div className="text-right">
                               <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">Moyen</p>
                               <span className="text-xs font-black text-slate-300">{job.paymentMethod === 'cash' ? '💵 Espèces' : '💳 Mobile'}</span>
                             </div>
                          </div>

                          <div className="space-y-4 mb-6 relative">
                             <div className="absolute left-1.5 top-2 bottom-2 w-0.5 bg-gradient-to-b from-indigo-500/50 to-amber-500/50" />
                             
                             <div className="relative pl-6">
                                 <div className="absolute left-1 top-2 w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
                                 <p className="text-[8px] font-bold text-indigo-400 uppercase tracking-[0.2em] mb-0.5">Point A (Collecte)</p>
                                 <p className="text-[11px] font-medium text-slate-300 pr-2 truncate">{job.from.address}</p>
                             </div>
                             <div className="relative pl-6">
                                 <div className="absolute left-1 top-2 w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
                                 <p className="text-[8px] font-bold text-amber-500 uppercase tracking-[0.2em] mb-0.5">Point B (Dépôt)</p>
                                 <p className="text-[11px] font-medium text-slate-300 pr-2 truncate">{job.to.address}</p>
                             </div>
                          </div>
                          
                          {biddingOn === job.id ? (
                            <div className="space-y-3 mt-2 bg-[#0f141f] p-4 rounded-[20px] border border-slate-800">
                              <div className="flex gap-2">
                                <div className="flex-1">
                                  <input 
                                    type="number" 
                                    placeholder="Prix (FCFA)" 
                                    value={bidPrice} 
                                    onChange={e => setBidPrice(e.target.value ? Number(e.target.value) : '')} 
                                    className="w-full bg-slate-900 border border-slate-800 text-white rounded-xl p-3 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-bold placeholder:text-slate-600" 
                                  />
                                </div>
                                <div className="w-20">
                                  <input 
                                    type="number" 
                                    placeholder="Mins" 
                                    value={bidTime} 
                                    onChange={e => setBidTime(e.target.value ? Number(e.target.value) : '')} 
                                    className="w-full bg-slate-900 border border-slate-800 text-white rounded-xl p-3 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-bold placeholder:text-slate-600 text-center" 
                                  />
                                </div>
                              </div>
                              <input 
                                type="text" 
                                placeholder="Motifs ? (Loin, bouchons...)" 
                                value={bidReason} 
                                onChange={e => setBidReason(e.target.value)} 
                                className="w-full bg-slate-900 border border-slate-800 text-white rounded-xl p-3 text-xs focus:border-indigo-500 transition-all font-medium placeholder:text-slate-600" 
                              />
                              <div className="flex gap-2 pt-1">
                                <button 
                                  type="button"
                                  onClick={() => setBiddingOn(null)} 
                                  className="flex-1 bg-slate-800 text-slate-400 py-3.5 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] hover:bg-slate-700 hover:text-white transition-all active:scale-95"
                                >
                                  Annuler
                                </button>
                                <button 
                                  type="button"
                                  onClick={() => submitBid(job.id)} 
                                  className="flex-[2] bg-indigo-600 text-white py-3.5 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
                                >
                                  Proposer Prix
                                </button>
                              </div>
                            </div>
                          ) : submittedBids.includes(job.id) ? (
                            <div className="w-full bg-emerald-500/10 text-emerald-400 py-4 rounded-[16px] text-[10px] font-black uppercase tracking-[0.2em] border border-emerald-500/20 text-center flex items-center justify-center gap-2">
                              <CheckCircle className="w-4 h-4" /> Offre en attente
                            </div>
                          ) : (
                            <div className="flex flex-col gap-2">
                              <button 
                                onClick={() => submitBid(job.id, job.clientProposedPrice || job.cost)} 
                                className="w-full bg-emerald-500 hover:bg-emerald-400 text-white py-3.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                              >
                                Accepter directement
                              </button>
                              <button 
                                onClick={() => {
                                  setBidPrice(job.clientProposedPrice || job.cost || 0);
                                  setBiddingOn(job.id);
                                }} 
                                className="w-full bg-slate-800 text-white py-3.5 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] hover:bg-slate-700 transition-all border border-slate-700 hover:border-slate-600"
                              >
                                Proposer au client
                              </button>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))
                  )}
                  {!activeJob && pendingJobs.length === 0 && (
                    <div className="text-center py-12 px-6">
                      <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-700">
                        <Navigation className="w-6 h-6 text-slate-600 animate-pulse" />
                      </div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Scan du réseau en cours</p>
                      <p className="text-slate-600 text-xs mt-2">En attente de nouvelles missions...</p>
                    </div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Right Column: Dark Map Cockpit */}
          <div className="col-span-12 lg:col-span-8 xl:col-span-9 bg-slate-900 rounded-[48px] p-2 sm:p-4 border border-slate-800 h-[600px] lg:h-full min-h-[500px] lg:min-h-[800px] relative overflow-hidden shadow-2xl">
            <div className="map-container h-full rounded-[40px] border-none shadow-black/50 bg-slate-950 relative overflow-hidden z-0">
              <MapContainer center={[12.3714, -1.5197]} zoom={13} className="h-full w-full" zoomControl={false}>
                <TileLayer 
                  url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" 
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                />
                
                {!activeJob && pendingJobs.map(job => (
                  <Marker 
                    key={job.id} 
                    position={[job.from.lat, job.from.lng]} 
                    icon={new L.DivIcon({
                      className: 'custom-div-icon',
                      html: `<div class="w-8 h-8 bg-orange-500 rounded-lg border-2 border-white shadow-xl flex items-center justify-center text-white font-black text-[10px]">${job.id.slice(0, 1)}</div>`,
                      iconAnchor: [16, 16]
                    })}
                  >
                    <Popup>
                      <div className="p-1 text-center">
                        <p className="font-black text-xs uppercase mb-2 text-slate-900">
                          Colis {job.packageDetails?.size || ''}
                        </p>
                        <button 
                          onClick={() => setBiddingOn(job.id)}
                          className="w-full bg-slate-900 text-white py-2 px-6 rounded-lg font-black text-[10px] uppercase tracking-widest hover:bg-orange-500"
                        >
                          Faire une offre
                        </button>
                      </div>
                    </Popup>
                  </Marker>
                ))}
                
                {activeJob && (
                  <>
                    <Marker 
                      position={[activeJob.from.lat, activeJob.from.lng]} 
                      icon={new L.DivIcon({
                        className: 'from-icon',
                        html: `<div class="w-8 h-8 bg-blue-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white">A</div>`,
                        iconAnchor: [16, 16]
                      })} 
                    />
                    <Marker 
                      position={[activeJob.to.lat, activeJob.to.lng]} 
                      icon={new L.DivIcon({
                        className: 'to-icon',
                        html: `<div class="w-10 h-10 bg-orange-600 rounded-full border-2 border-white shadow-xl flex items-center justify-center text-white">B</div>`,
                        iconAnchor: [20, 20]
                      })} 
                    />
                  </>
                )}
                
                {userLocation && (
                  <Marker 
                    position={[userLocation.lat, userLocation.lng]} 
                    icon={new L.DivIcon({ 
                      className: 'driver-location-icon',
                      html: `<div class="w-12 h-12 bg-emerald-500 rounded-2xl border-4 border-white shadow-2xl flex items-center justify-center text-white"><img src="https://cdn-icons-png.flaticon.com/512/3655/3655682.png" class="w-10 h-10" /></div>`,
                      iconAnchor: [24, 24]
                    })}
                  />
                )}
                {activeJob && <ChangeView center={activeJob.status === 'accepted' ? [activeJob.from.lat, activeJob.from.lng] : [activeJob.to.lat, activeJob.to.lng]} />}
              </MapContainer>
            </div>
            
            {/* Un-inverted Overlays */}
            <div className="absolute top-8 right-8 flex flex-col gap-4 z-50">
              <div className="bg-slate-900/80 backdrop-blur-md px-6 py-3 rounded-2xl shadow-2xl flex items-center border border-slate-700/50">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-ping mr-3 shadow-[0_0_10px_rgba(239,68,68,0.8)]"></div>
                <span className="text-[8px] font-black text-white uppercase tracking-[0.3em]">GPS Actif</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
