import React, { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, orderBy, updateDoc, doc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { DeliveryRequest } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestoreUtils';
import { Link, useNavigate } from 'react-router-dom';
import { Package, Clock, CheckCircle, Navigation, User, Home, Plus, ChevronRight, X, Copy, Share } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { LoadingScreen } from '../components/LoadingScreen';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import PaymentModal from '../components/PaymentModal';
import AnnouncementBanner from '../components/AnnouncementBanner';

// @ts-ignore
import markerIcon from 'leaflet/dist/images/marker-icon.png';
// @ts-ignore
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

const customMarkerIcon = new L.Icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconAnchor: [12, 41]
});

export default function ClientDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [deliveries, setDeliveries] = useState<DeliveryRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState<'home' | 'deliveries' | 'profile'>('home');
  const [paymentDelivery, setPaymentDelivery] = useState<DeliveryRequest | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const scrollRef = React.useRef<HTMLDivElement>(null);

  const handleScroll = () => {
    if (scrollRef.current) {
      const scrollPosition = scrollRef.current.scrollLeft;
      const width = scrollRef.current.offsetWidth;
      const index = Math.round(scrollPosition / width);
      if (index !== activeIndex) {
        setActiveIndex(index);
      }
    }
  };

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
        handleFirestoreError(error, OperationType.LIST, 'deliveries');
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [profile]);

  const activeDeliveries = deliveries.filter(d => ['pending', 'accepted', 'picked_up', 'ready_for_pickup'].includes(d.status));
  const recentDeliveries = deliveries.filter(d => !activeDeliveries.some(ad => ad.id === d.id)).slice(0, 3);

      const copyCode = (code: string | undefined) => {
        if(code) {
          navigator.clipboard.writeText(code);
          alert('Code copié !');
        }
      };

      const handlePay = async (method: string, reference?: string, isVerified?: boolean) => {
        if (!paymentDelivery) return;
        try {
          const isCash = method === 'cash';
          const isDemo = !((window as any).Capacitor) && (window.location.hostname.includes('ais-dev') || window.location.hostname.includes('localhost'));
          const isUssd = method.includes('ussd');
          
          const shouldAutoConfirm = isVerified || isCash || (isDemo && !isUssd && method !== 'aggregator');
          
          const pickupCode = Math.random().toString(36).substring(2, 6).toUpperCase();
          const deliveryCode = Math.random().toString(36).substring(2, 6).toUpperCase();

          const updates: any = {
            paymentMethod: method,
            paymentReference: reference || null,
            paymentStatus: shouldAutoConfirm ? 'confirmed' : 'pending_approval',
            isPaid: shouldAutoConfirm,
            pickupCode,
            deliveryCode,
            updatedAt: new Date().toISOString()
          };
          await updateDoc(doc(db, 'deliveries', paymentDelivery.id), updates);
          setPaymentDelivery(null);
        } catch (e) {
          console.error(e);
        }
      };

  const getPaymentLogo = (method?: string | null) => {
    if (!method) return null;
    const id = method.replace('_ussd', '');
    const validMethods = ['orange', 'moov', 'telecel', 'coris'];
    if (validMethods.includes(id)) {
      return `/payments/${id}.png`;
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col relative pb-20 selection:bg-indigo-500/10 selection:text-indigo-600">
      {loading && (
        <div className="fixed top-0 left-0 right-0 z-[100] h-1 overflow-hidden bg-indigo-100">
          <motion.div 
            initial={{ x: '-100%' }}
            animate={{ x: '100%' }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
            className="h-full w-1/3 bg-indigo-600 shadow-[0_0_10px_rgba(79,70,229,0.5)]"
          />
        </div>
      )}
      <AnnouncementBanner userRole="client" />
      {/* Map Background Wrapper for active delivery or generic center */}
      <div className="absolute inset-0 h-[40vh] w-full z-0 overflow-hidden bg-slate-100 mask-image-b pointer-events-none">
         <div className="absolute inset-0 bg-gradient-to-b from-white/60 via-slate-50/80 to-slate-50 z-10" />
         {(activeDeliveries.length > 0 && (activeDeliveries[0].from || activeDeliveries[0].to)) ? (
            <MapContainer 
               center={activeDeliveries[0].from ? [activeDeliveries[0].from.lat, activeDeliveries[0].from.lng] : [12.3714, -1.5197]} 
               zoom={14} 
               style={{ height: '100%', width: '100%' }}
               zoomControl={false}
               dragging={false}
               scrollWheelZoom={false}
            >
               <TileLayer 
                 url="https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
                 subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
               />
               {activeDeliveries[0].from && <Marker position={[activeDeliveries[0].from.lat, activeDeliveries[0].from.lng]} icon={customMarkerIcon} />}
               {activeDeliveries[0].to && <Marker position={[activeDeliveries[0].to.lat, activeDeliveries[0].to.lng]} icon={customMarkerIcon} />}
            </MapContainer>
         ) : (
            <div className="w-full h-full bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
         )}
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex-1 flex flex-col p-4 sm:p-6 max-w-lg mx-auto w-full">
        
        {/* Header */}
        <header className="flex justify-between items-center pt-8 mb-8">
           <div>
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-0.5">LIVRA</p>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Bonjour {profile?.name?.split(' ')[0] || 'Client'}</h1>
           </div>
           <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm border border-slate-200 text-slate-900">
              <User className="w-5 h-5" />
           </div>
        </header>

        {/* Primary Action Button */}
        <button 
           onClick={() => navigate('/client/new')}
           className="w-full py-4 bg-indigo-600 text-white rounded-2xl shadow-xl shadow-indigo-600/20 font-black flex items-center justify-center gap-3 hover:bg-indigo-700 hover:scale-[1.02] transition-all mb-8"
        >
           <Plus className="w-6 h-6" />
           <span className="text-sm uppercase tracking-widest">Nouvelle Course</span>
        </button>
        {/* Active Deliveries Section */}
        {activeDeliveries.length > 0 && (
          <div className="mb-0 overflow-visible relative">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Courses Actives ({activeDeliveries.length})</h2>
            </div>
            
            <div className="flex flex-col xl:grid xl:grid-cols-2 gap-6 pb-10">
              {activeDeliveries.map((activeDelivery) => (
                <div key={activeDelivery.id} className="w-full">
                  <div className="flex items-center justify-between mb-3 px-1">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                      <h2 className="text-[10px] font-black uppercase tracking-widest text-indigo-600/80">En direct • #{activeDelivery.id.slice(-6).toUpperCase()}</h2>
                    </div>
                    <div className="flex gap-2">
                       <button onClick={() => navigate(`/delivery/${activeDelivery.id}`)} className="text-[10px] font-black uppercase tracking-widest text-indigo-600 bg-white border border-indigo-100 px-3 py-1.5 rounded-[12px] shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all active:scale-95 flex items-center gap-1.5">
                          Suivre <Navigation className="w-3 h-3" />
                       </button>
                    </div>
                  </div>
                  
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                    className="bg-white rounded-2xl p-5 sm:p-6 shadow-[0_15px_40px_-15px_rgba(15,23,42,0.1)] border border-slate-200/60 relative overflow-hidden flex flex-col"
                  >
                      {/* Decorative Background Element */}
                      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-indigo-50/80 to-transparent rounded-bl-[100px] z-0 pointer-events-none" />

                      <div className="relative z-10 flex flex-col h-full">
                        <div className="flex items-center gap-4 mb-4 pb-4 border-b border-slate-100">
                          <div className="w-12 h-12 bg-indigo-50 rounded-[20px] flex items-center justify-center text-indigo-600 border border-indigo-100/50 shadow-inner shrink-0 relative">
                            {activeDelivery.status === 'pending' && <div className="absolute inset-0 bg-indigo-200/40 rounded-[20px] animate-ping" />}
                            <Package className="w-6 h-6 relative z-10" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400 mb-0.5">État de la livraison</p>
                            <p className="text-xl font-black text-slate-900 leading-none tracking-tight truncate">
                                {activeDelivery.status === 'pending' && 'En recherche...'}
                                {activeDelivery.status === 'accepted' && 'Coursier en route'}
                                {activeDelivery.status === 'picked_up' && 'Livraison en cours'}
                                {activeDelivery.status === 'ready_for_pickup' && 'Livreur sur place'}
                            </p>
                          </div>
                        </div>

                        {activeDelivery.status === 'pending' ? (
                          <div className="flex-1 flex flex-col justify-center items-center py-6 bg-slate-50/50 rounded-2xl border border-slate-100/80 mt-2 mb-2">
                             <div className="w-8 h-8 rounded-full border-[3px] border-indigo-100 border-t-indigo-600 animate-spin mb-3 shadow-[0_0_15px_rgba(79,70,229,0.3)]" />
                             <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 text-center px-4 leading-relaxed">
                               Nous contactons les coursiers <br className="hidden sm:block" />à proximité
                             </p>
                          </div>
                        ) : (
                          <>
                            {/* Address Summary */}
                            <div className="flex flex-col gap-3 mb-5 mt-2">
                                <div className="flex items-start gap-3">
                                    <div className="mt-0.5 w-5 h-5 rounded-full bg-slate-50 flex items-center justify-center shrink-0 border border-slate-200"><div className="w-1.5 h-1.5 rounded-full bg-indigo-500" /></div>
                                    <p className="text-xs font-bold text-slate-700 leading-snug line-clamp-1 flex-1">{activeDelivery.from?.address || 'Point de retrait'}</p>
                                </div>
                                <div className="flex items-start gap-3 relative">
                                    <div className="absolute -top-3 left-[9.5px] w-0.5 h-3 bg-slate-200" />
                                    <div className="mt-0.5 w-5 h-5 rounded-full bg-slate-50 flex items-center justify-center shrink-0 border border-slate-200"><div className="w-1.5 h-1.5 rounded-full bg-rose-500" /></div>
                                    <p className="text-xs font-bold text-slate-700 leading-snug line-clamp-1 flex-1">{activeDelivery.to?.address || 'Destination'}</p>
                                </div>
                            </div>
    
                            {/* Minimal Stepper Timeline */}
                            <div className="relative mb-5 px-6">
                              {/* Track */}
                              <div className="absolute left-[42px] right-[42px] top-[18px] -translate-y-1/2 h-[4px] z-0">
                                <div className="absolute inset-0 bg-slate-200 rounded-full" />
                                <div 
                                  className="absolute left-0 top-0 bottom-0 bg-indigo-600 rounded-full transition-all duration-1000 ease-out shadow-[0_0_8px_rgba(79,70,229,0.4)]" 
                                  style={{ 
                                    width: activeDelivery.status === 'accepted' || activeDelivery.status === 'ready_for_pickup' ? '0%' : 
                                           activeDelivery.status === 'picked_up' ? '50%' : '100%' 
                                  }}
                                />
                              </div>
      
                              {/* Step Nodes */}
                              <div className="relative flex justify-between items-center z-10">
                                {[
                                  { id: 'enlèvement', status: ['picked_up', 'ready_for_pickup', 'delivered'], label: 'ENLEVÉ' },
                                  { id: 'transit', status: ['picked_up', 'delivered'], label: 'TRANSIT' },
                                  { id: 'livraison', status: ['delivered'], label: 'LIVRÉ' }
                                ].map((step, i) => {
                                    const isCompleted = step.status.includes(activeDelivery.status);
                                    const isCurrent = (i === 0 && (activeDelivery.status === 'accepted' || activeDelivery.status === 'ready_for_pickup')) || 
                                                      (i === 1 && activeDelivery.status === 'picked_up') || 
                                                      (i === 2 && activeDelivery.status === 'delivered');
                                    
                                    return (
                                      <div key={step.id} className="flex flex-col items-center gap-2 w-12">
                                          <div className={cn(
                                            "w-9 h-9 rounded-full flex items-center justify-center transition-all duration-700 border-[3px] shadow-sm relative shrink-0",
                                            isCurrent ? "bg-white border-indigo-600 shadow-indigo-100 scale-110" : 
                                            isCompleted ? "bg-indigo-600 border-indigo-600 text-white" : "bg-white border-slate-200 text-slate-300"
                                          )}>
                                            {isCompleted && !isCurrent ? <CheckCircle className="w-5 h-5" /> : <span className={cn("text-[10px] font-black", isCurrent ? "text-indigo-600" : "text-slate-400")}>{i + 1}</span>}
                                            {isCurrent && <div className="absolute -inset-1.5 rounded-full bg-indigo-500/10 animate-ping" />}
                                          </div>
                                          <span className={cn(
                                            "text-[9px] font-black tracking-widest transition-colors uppercase italic text-center w-full mt-1.5", 
                                            (isCompleted || isCurrent) ? "text-slate-800" : "text-slate-400"
                                          )}>
                                            {step.label}
                                          </span>
                                      </div>
                                    );
                                })}
                              </div>
                            </div>
                          </>
                        )}
  
                        {/* Footer Card Actions */}
                        <div className="mt-auto">
                          {activeDelivery.status === 'pending' ? (
                             <button 
                               onClick={() => navigate(`/delivery/${activeDelivery.id}`)}
                               className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10 active:scale-95"
                             >
                               Ouvrir les détails
                             </button>
                          ) : !activeDelivery.isPaid && activeDelivery.status === 'accepted' ? (
                            activeDelivery.paymentStatus === 'pending_approval' ? (
                              <div className="bg-amber-50/50 border border-amber-100/50 rounded-2xl p-4 text-center ring-1 ring-amber-100/20">
                                <Clock className="w-5 h-5 text-amber-500 mx-auto mb-2 animate-pulse" />
                                <p className="text-[9px] font-black uppercase text-amber-600 tracking-widest mb-1">Vérification en cours</p>
                              </div>
                            ) : (
                              <button 
                                onClick={() => setPaymentDelivery(activeDelivery)}
                                className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10 active:scale-95 group flex items-center justify-center gap-2"
                              >
                                Payer maintenant <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                              </button>
                            )
                          ) : (
                            (activeDelivery.status === 'accepted' || activeDelivery.status === 'picked_up' || activeDelivery.status === 'ready_for_pickup') && (
                            <div className="bg-slate-950 rounded-xl p-5 border border-slate-800 shadow-2xl relative group overflow-hidden">
                                <div className="absolute top-0 right-0 w-16 h-16 bg-white/5 rounded-bl-[40px] pointer-events-none" />
                                <div className="absolute top-2 right-4">
                                  <div className="flex gap-1">
                                    <div className="w-1 h-1 rounded-full bg-emerald-500" />
                                    <div className="w-1 h-1 rounded-full bg-emerald-500/50" />
                                  </div>
                                </div>
                                <p className="text-[8px] font-black uppercase tracking-[0.5em] text-slate-400 mb-3 text-center">
                                  SÉCURITÉ • {activeDelivery.status === 'ready_for_pickup' || activeDelivery.status === 'accepted' ? 'CODE ENLÈVEMENT' : 'CODE LIVRAISON'}
                                </p>
                                <div className="flex items-center justify-between gap-4 px-2">
                                  <div className="flex-1 text-center">
                                    <p className="text-4xl font-black tracking-[0.2em] text-white font-mono">
                                      {activeDelivery.status === 'ready_for_pickup' || activeDelivery.status === 'accepted' ? activeDelivery.pickupCode : activeDelivery.deliveryCode}
                                    </p>
                                  </div>
                                  <button onClick={() => copyCode(activeDelivery.status === 'ready_for_pickup' || activeDelivery.status === 'accepted' ? activeDelivery.pickupCode! : activeDelivery.deliveryCode!)} className="p-3.5 bg-white/5 rounded-[18px] hover:bg-white/10 text-white transition-all active:scale-90 border border-white/5 shadow-inner">
                                    <Copy className="w-5 h-5" />
                                  </button>
                                </div>
                            </div>
                            )
                          )}
                        </div>
                      </div>
                  </motion.div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* History Section */}
        <div>
           <div className="flex items-center justify-between mb-4">
             <h2 className="text-xs font-black uppercase tracking-widest text-slate-500">Historique rapide</h2>
             <button onClick={() => navigate('/client/history')} className="text-[10px] font-black uppercase tracking-widest text-indigo-600">Voir tout</button>
           </div>
           
           <div className="space-y-3">
              {recentDeliveries.length === 0 ? (
                <div className="text-center py-6 bg-white rounded-2xl border border-slate-100 border-dashed">
                  <p className="text-xs font-bold text-slate-400">Aucune course récente.</p>
                </div>
              ) : (
                recentDeliveries.map(d => {
                  const logo = getPaymentLogo(d.paymentMethod);
                  return (
                    <motion.div 
                      key={d.id} 
                      onClick={() => navigate(`/delivery/${d.id}`)} 
                      whileHover={{ scale: 1.02, x: 5 }}
                      whileTap={{ scale: 0.98 }}
                      className="bg-white p-4 rounded-2xl flex items-center gap-4 border border-slate-100 hover:border-indigo-100 transition-colors cursor-pointer group"
                    >
                       <div className={cn(
                         "w-10 h-10 rounded-full flex items-center justify-center shrink-0 overflow-hidden",
                         logo ? "bg-white border border-slate-100 p-1" : 
                         d.status === 'delivered' ? 'bg-emerald-50 text-emerald-500' : 'bg-amber-50 text-amber-500'
                       )}>
                         {logo ? (
                           <img src={logo} alt={d.paymentMethod || ''} className="w-full h-full object-contain" />
                         ) : (
                           d.status === 'delivered' ? <CheckCircle className="w-5 h-5" /> : <Clock className="w-5 h-5" />
                         )}
                       </div>
                       <div className="flex-1 min-w-0">
                         <p className="text-xs font-black text-slate-900 truncate">{d.to.address}</p>
                         <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                           {(() => {
                             if (!d.createdAt) return '-';
                             let dDate;
                             if (typeof (d.createdAt as any).toDate === 'function') {
                               dDate = (d.createdAt as any).toDate();
                             } else {
                               dDate = new Date(d.createdAt);
                             }
                             return isNaN(dDate.getTime()) ? '-' : dDate.toLocaleDateString();
                           })()}
                         </p>
                       </div>
                       <div className="text-right shrink-0">
                         <p className="text-sm font-black text-slate-900">{d.cost} F</p>
                         <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 mx-auto mt-0.5" />
                       </div>
                    </motion.div>
                  );
                })
              )}
           </div>
        </div>

      </div>

      {/* Payment Modal */}
      <PaymentModal 
        isOpen={!!paymentDelivery}
        onClose={() => setPaymentDelivery(null)}
        amount={paymentDelivery?.cost || 0}
        onConfirm={handlePay}
      />
    </div>
  );
}
