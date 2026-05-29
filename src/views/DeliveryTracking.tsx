import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/apiService';
import { DeliveryRequest, UserProfile } from '../types';
import { useAuth } from '../context/AuthContext';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import { ArrowLeft, Package, MessageSquare, CheckCircle, Navigation, Copy, Truck, Phone, Clock, ChevronRight, Loader2, X, Target, Eye, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Chat } from '../components/Chat';
import PaymentModal from '../components/PaymentModal';
import { cn, calculateDistance } from '../lib/utils';
import LoadingScreen from '../components/LoadingScreen';
import L from 'leaflet';

// @ts-ignore
import markerIcon from 'leaflet/dist/images/marker-icon.png';
// @ts-ignore
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

const customMarkerIcon = new L.Icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconAnchor: [12, 41]
});

function MapUpdater({ driver, delivery, isFollowing }: { driver: UserProfile | null, delivery: DeliveryRequest | null, isFollowing: boolean }) {
  const map = useMap();

  useEffect(() => {
    if (!delivery) return;

    const points: [number, number][] = [];
    if (delivery.from && typeof delivery.from.lat === 'number' && typeof delivery.from.lng === 'number') {
       points.push([delivery.from.lat, delivery.from.lng]);
    }
    if (delivery.to && typeof delivery.to.lat === 'number' && typeof delivery.to.lng === 'number') {
       points.push([delivery.to.lat, delivery.to.lng]);
    }
    if (driver?.currentLocation && typeof driver.currentLocation.lat === 'number') {
       points.push([driver.currentLocation.lat, driver.currentLocation.lng]);
    }

    if (points.length > 0) {
      if (isFollowing && driver?.currentLocation) {
        map.flyTo([driver.currentLocation.lat, driver.currentLocation.lng], map.getZoom(), { duration: 1 });
      } else if (points.length > 1) {
        const bounds = L.latLngBounds(points);
        map.fitBounds(bounds, { padding: [50, 50], duration: 1.5 });
      } else {
        map.flyTo(points[0], 15, { duration: 1.5 });
      }
    }
  }, [driver?.currentLocation, delivery?.id, isFollowing, map]);

  return null;
}

export default function DeliveryTracking() {
  const { deliveryId } = useParams<{ deliveryId: string }>();
  const { profile } = useAuth();
  const navigate = useNavigate();
  
  const [delivery, setDelivery] = useState<DeliveryRequest | null>(null);
  const [driver, setDriver] = useState<UserProfile | null>(null);
  const [bids, setBids] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [routeCoords, setRouteCoords] = useState<[number, number][]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  
  const [paymentBid, setPaymentBid] = useState<any>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isBoosting, setIsBoosting] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);

  const [showKeypadFor, setShowKeypadFor] = useState<'pickup' | 'delivery' | null>(null);
  const [enteredCode, setEnteredCode] = useState('');
  const [isValidatingCode, setIsValidatingCode] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const handleVerifyCode = async () => {
    if (!delivery || !showKeypadFor) return;
    setIsValidatingCode(true);
    setToastMessage('');

    try {
      if (showKeypadFor === 'pickup') {
        if (enteredCode !== delivery.pickupCode) {
          setToastMessage("Code de collecte invalide !");
          setIsValidatingCode(false);
          return;
        }
        await api.deliveries.update(delivery.id, {
          status: 'picked_up',
          updatedAt: new Date().toISOString()
        });
        setToastMessage("Colis récupéré !");
      } else {
        if (enteredCode !== delivery.deliveryCode) {
          setToastMessage("Code de livraison invalide !");
          setIsValidatingCode(false);
          return;
        }
        await api.deliveries.update(delivery.id, {
          status: 'delivered',
          updatedAt: new Date().toISOString()
        });
        setToastMessage("Livraison validée avec succès !");
      }

      const refreshed = await api.deliveries.get(delivery.id);
      if (refreshed) setDelivery(refreshed);
      setEnteredCode('');
      setShowKeypadFor(null);
    } catch (err: any) {
      setToastMessage(err.message || "Une erreur s'est produite lors de la validation.");
    } finally {
      setIsValidatingCode(false);
      setTimeout(() => setToastMessage(''), 4000);
    }
  };

  useEffect(() => {
    if (!deliveryId) return;

    const fetchData = async () => {
      try {
        const found = await api.deliveries.get(deliveryId);
        if (found) {
          setDelivery(found);
          if (found.driverId) {
            try {
              const dInfo = await api.users.get(found.driverId);
              if (dInfo) setDriver(dInfo);
            } catch (err) {
              console.warn("Could not fetch driver info");
            }
          }
          if (found.status === 'pending') {
            try {
              const bidsList = await api.deliveries.bids.list(deliveryId);
              setBids(Array.isArray(bidsList) ? bidsList : []);
            } catch (err) {
              console.warn("Could not fetch bids", err);
              setBids([]);
            }
          }
        } else {
          setDelivery(null);
        }
      } catch (err) {
        console.error("Local API fetch failed in tracking", err);
        setDelivery(null);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 8000); // Polling every 8s
    return () => clearInterval(interval);
  }, [deliveryId]);

  const getDriverInfo = async (driverId: string) => {
    // Already handled in fetchData loop for consistency
  };

  const handlePayBid = async (method: string, transactionId?: string, isVerified?: boolean) => {
    if (!delivery) return;
    
    // Si c'est un nouveau bid, paymentBid est défini. Sinon (retry), on utilise les infos du delivery actuel.
    const price = paymentBid?.price || delivery.cost;
    const driverIdToUse = paymentBid?.driverId || delivery.driverId;
    const driverNameToUse = paymentBid?.driverName || delivery.driverName;

    if (!driverIdToUse || !price) return;

    try {
      const isCash = method === 'cash';
      const isDemo = false;
      
      const isUssd = method.includes('ussd');
      // For demo, we auto confirm if it's not USSD or standard mobile money that needs approval
      const shouldAutoConfirm = isVerified || isCash || (isDemo && !isUssd && method !== 'aggregator');
      
      const pickupCode = delivery.pickupCode || Math.random().toString(36).substring(2, 6).toUpperCase();
      const deliveryCode = delivery.deliveryCode || Math.random().toString(36).substring(2, 6).toUpperCase();

      await api.deliveries.update(delivery.id, {
        status: 'accepted',
        driverId: driverIdToUse,
        driverName: driverNameToUse,
        cost: price,
        paymentMethod: method,
        paymentReference: transactionId || '',
        paymentStatus: shouldAutoConfirm ? 'confirmed' : 'pending_approval',
        isPaid: shouldAutoConfirm,
        pickupCode,
        deliveryCode,
        updatedAt: new Date().toISOString()
      });
      setShowPaymentModal(false);
      setPaymentBid(null);
      alert('Paiement enregistré sur le serveur local !');

      // Refresh delivery data
      const updatedDelivery = await api.deliveries.get(delivery.id);
      setDelivery(updatedDelivery);
    } catch (e) {
      console.error(e);
      alert('Erreur de paiement sur le serveur local.');
    }
  };

  useEffect(() => {
    if (delivery?.from && delivery?.to) {
      fetch(`https://router.project-osrm.org/route/v1/driving/${delivery.from.lng},${delivery.from.lat};${delivery.to.lng},${delivery.to.lat}?overview=full&geometries=geojson`)
        .then(res => {
          if (!res.ok) throw new Error("Network response was not ok");
          return res.json();
        })
        .then(data => {
          if (data.routes?.[0]) {
             setRouteCoords(data.routes[0].geometry.coordinates.map((c: any) => [c[1], c[0]]));
          }
        })
        .catch((e) => {
           console.log("Routing error", e);
           if (typeof delivery?.from?.lat === 'number' && typeof delivery?.to?.lat === 'number') {
             setRouteCoords([[delivery.from.lat, delivery.from.lng], [delivery.to.lat, delivery.to.lng]]);
           } else {
             setRouteCoords([]);
           }
        });
    }
  }, [delivery?.from, delivery?.to]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!loading && !delivery) {
      navigate('/client', { replace: true });
    }
  }, [loading, delivery, navigate]);

  const handleDelete = async () => {
    if(!deliveryId) return;
    setIsDeleting(true);
    try {
      await api.deliveries.delete(deliveryId);
      navigate('/client', { replace: true });
    } catch (error: any) {
      console.error("Delete Error", error);
      alert("Erreur de suppression locale : " + (error.message || 'Erreur inconnue'));
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleBoost = async () => {
    if(!delivery) return;
    setIsBoosting(true);
    try {
      const newCost = (delivery.cost || 0) + 200;
      await api.deliveries.update(delivery.id, { 
        cost: newCost, 
        clientProposedPrice: newCost,
        boostAmount: (delivery.boostAmount || 0) + 200,
        updatedAt: new Date().toISOString() 
      });
      alert('Course boostée localement !');
    } catch (err) {
      console.error(err);
      alert('Erreur lors du boost local.');
    } finally {
      setIsBoosting(false);
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

  if (!loading && !delivery) return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
      <Package className="w-16 h-16 text-slate-200 mb-4" />
      <h2 className="text-xl font-black text-slate-900 tracking-tight">Course introuvable</h2>
      <p className="text-slate-400 font-bold text-sm mt-2 mb-8">Cette livraison n'existe plus ou a été supprimée.</p>
      <button onClick={() => navigate('/client')} className="px-8 py-3 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-indigo-100">Retour</button>
    </div>
  );

  const hasValidFromCoords = delivery?.from && typeof delivery.from.lat === 'number' && typeof delivery.from.lng === 'number';
  const hasValidToCoords = delivery?.to && typeof delivery.to.lat === 'number' && typeof delivery.to.lng === 'number';
  
  const centerOUAGA: [number, number] = [12.3714, -1.5197];
  const centerMap = hasValidFromCoords ? [delivery.from.lat, delivery.from.lng] as [number, number] : centerOUAGA;

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans relative overflow-hidden">
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
      {delivery && (
        <>
          {/* Header Map */}
        <div className="absolute top-0 left-0 right-0 h-[45%] z-0">
           <MapContainer center={centerMap} zoom={13} className="w-full h-full" zoomControl={false}>
               <TileLayer url="https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}" subdomains={['mt0', 'mt1', 'mt2', 'mt3']} />
               <MapUpdater driver={driver} delivery={delivery} isFollowing={isFollowing} />
               {routeCoords.length > 0 && <Polyline positions={routeCoords} color="#4f46e5" weight={4} dashArray="10,10" />}
               {hasValidFromCoords && <Marker position={[delivery.from.lat, delivery.from.lng]} icon={customMarkerIcon} />}
               {hasValidToCoords && <Marker position={[delivery.to.lat, delivery.to.lng]} icon={customMarkerIcon} />}
               {driver?.currentLocation && (
                  <Marker 
                    position={[driver.currentLocation.lat, driver.currentLocation.lng]} 
                    icon={new L.DivIcon({ 
                      className: 'driver-marker', 
                      html: `<div class="relative w-10 h-10"><div class="absolute inset-0 bg-indigo-500/30 rounded-full animate-ping"></div><div class="relative w-10 h-10 bg-indigo-600 rounded-full border-4 border-white shadow-xl flex items-center justify-center text-white"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg></div></div>`, 
                      iconAnchor: [20,20] 
                    })} 
                  />
               )}
           </MapContainer>
           {/* Map Controls */}
           <div className="absolute top-20 right-4 z-[400] flex flex-col gap-2">
              {driver?.currentLocation && (
                <button 
                  onClick={() => setIsFollowing(!isFollowing)} 
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center shadow-lg border transition-all active:scale-90",
                    isFollowing ? "bg-indigo-600 border-indigo-500 text-white" : "bg-white/90 border-slate-100 text-slate-900"
                  )}
                  title={isFollowing ? "Arrêter de suivre" : "Suivre le livreur"}
                >
                  {isFollowing ? <Target className="w-5 h-5 animate-pulse" /> : <Eye className="w-5 h-5" />}
                </button>
              )}
           </div>
           {/* Gradient Overlay */}
           <div className="absolute inset-0 bg-gradient-to-t from-slate-50 via-transparent to-transparent pointer-events-none z-[300]" />
        </div>

        {/* Header Actions */}
        <header className="absolute top-0 left-0 right-0 z-50 p-4 flex items-center justify-between">
           <button onClick={() => navigate('/client')} className="w-10 h-10 bg-white/90 backdrop-blur-md rounded-full flex items-center justify-center shadow-lg border border-slate-100/50 text-slate-900 active:scale-90 transition-transform">
               <ArrowLeft className="w-5 h-5" />
           </button>
           <span className="bg-white/80 backdrop-blur-md px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm border border-slate-100/50">
               Course #{delivery.id.slice(-6).toUpperCase()}
           </span>
        </header>

        {/* Sliding Panel */}
        <div className="absolute bottom-0 left-0 right-0 h-[65%] z-50 bg-slate-50 rounded-t-[40px] shadow-[0_-15px_50px_rgba(0,0,0,0.06)] flex flex-col pb-[calc(8rem+env(safe-area-inset-bottom))] xl:pb-12 border-t border-white">
            {/* Handle Bar */}
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mt-4 mb-2 shrink-0" />

            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
                {/* PENDING APPROVAL WARNING */}
                {delivery.paymentStatus === 'pending_approval' && (
                   <div className="bg-yellow-50 border-2 border-yellow-200 p-4 rounded-3xl shadow-sm">
                     <div className="flex justify-between items-center mb-2">
                       <div className="flex items-center gap-3">
                         <div className="bg-white shadow-sm p-2 rounded-full text-yellow-600 border border-yellow-100">
                           <Clock className="w-5 h-5" />
                         </div>
                         <div>
                           <p className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-tight">Validation Manuelle</p>
                           <p className="text-[10px] font-bold text-yellow-700 uppercase tracking-widest italic mt-0.5">Paiement en attente de reçu</p>
                         </div>
                       </div>
                     </div>
                     <p className="text-[11px] sm:text-xs font-bold text-yellow-800 leading-relaxed mt-3 px-2">
                       Votre transaction a été identifiée. Un administrateur doit confirmer le paiement pour activer votre course. Veuillez patienter.
                     </p>
                   </div>
                )}

                {/* REJECTED PAYMENT WARNING */}
                {delivery.paymentStatus === 'rejected' && (
                   <div className="bg-rose-50 border-2 border-rose-200 p-4 rounded-3xl shadow-sm animate-pulse">
                     <div className="flex justify-between items-center mb-2">
                       <div className="flex items-center gap-3">
                         <div className="bg-white shadow-sm p-2 rounded-full text-rose-600 border border-rose-100">
                           <AlertCircle className="w-5 h-5" />
                         </div>
                         <div>
                           <p className="text-xs sm:text-sm font-black text-rose-900 uppercase tracking-tight">Paiement Rejeté</p>
                           <p className="text-[10px] font-bold text-rose-700 uppercase tracking-widest italic mt-0.5">La vérification du reçu a échoué</p>
                         </div>
                       </div>
                     </div>
                     <p className="text-[11px] sm:text-xs font-bold text-rose-800 leading-relaxed mt-3 px-2">
                       Votre preuve de paiement a été rejetée par l'administration de PANCHO EXPRESS. Vous pouvez soumettre à nouveau une preuve de paiement valide en cliquant ci-dessous, ou entrer en relation avec notre support client.
                     </p>
                     <div className="flex gap-2 mt-4 px-2">
                       <button
                         onClick={() => setShowPaymentModal(true)}
                         className="px-4 py-2.5 bg-rose-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-700 shadow-sm active:scale-95 transition-transform"
                       >
                         Réessayer
                       </button>
                       <button
                         onClick={() => setChatOpen(true)}
                         className="px-4 py-2.5 bg-white text-rose-700 border border-rose-200 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-50 shadow-sm active:scale-95 transition-transform"
                       >
                         Support client
                       </button>
                     </div>
                   </div>
                )}

                {/* Visual Progress Stepper */}
                <div className="bg-white rounded-3xl p-5 lg:p-6 shadow-[0_15px_40px_-10px_rgba(0,0,0,0.05)] border border-slate-100 mb-6 relative overflow-hidden">
                   <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/40 rounded-bl-[100px] -mr-12 -mt-12 z-0" />
                   
                   <div className="relative z-10 flex justify-between items-center mb-10">
                      <div className="flex items-center gap-3">
                        <div className="w-1.5 h-6 bg-indigo-600 rounded-full" />
                        <div className="flex flex-col">
                           <h3 className="font-black text-base tracking-tight text-slate-900 uppercase">Suivi de Course</h3>
                           <p className="text-[10px] text-slate-400 font-bold italic">Informations en temps réel</p>
                        </div>
                      </div>
                      <div className="flex gap-2 items-center bg-slate-50 px-3 py-2 rounded-2xl border border-slate-100/80 shadow-inner">
                         {driver?.currentLocation && (
                            <div className="flex items-center gap-1.5 mr-2 pr-2 border-r border-slate-200">
                               <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                               <span className="text-[8px] font-black text-rose-500 uppercase tracking-tighter mr-1">LIVE</span>
                               {delivery.status !== 'delivered' && (
                                 <span className="text-[9px] font-bold text-slate-500 whitespace-nowrap">
                                   {(() => {
                                      const target = (delivery.status === 'accepted' || delivery.status === 'ready_for_pickup') ? delivery.from : delivery.to;
                                      if (target && driver.currentLocation) {
                                        return `${calculateDistance(driver.currentLocation.lat, driver.currentLocation.lng, target.lat, target.lng).toFixed(1)} km`;
                                      }
                                      return '';
                                   })()}
                                 </span>
                                )}
                            </div>
                         )}
                         {delivery.status === 'pending' && <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse shadow-[0_0_8px_rgba(249,115,22,0.4)]" />}
                         {delivery.status === 'accepted' || delivery.status === 'ready_for_pickup' && <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />}
                         {delivery.status === 'picked_up' && <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.4)]" />}
                         {delivery.status === 'delivered' && <div className="w-2 h-2 rounded-full bg-emerald-500" />}
                         <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                           {delivery.status === 'pending' ? 'Attente' : delivery.status === 'accepted' ? 'Assigné' : delivery.status === 'picked_up' ? 'En Route' : delivery.status === 'delivered' ? 'Livré' : 'Annulé'}
                         </span>
                      </div>
                   </div>

                   <div className="relative mb-10 px-4">
                      {/* Track Line Container to fix width % relative to nodes */}
                      <div className="absolute left-[38px] right-[38px] top-[22px] -translate-y-1/2 h-[4px] z-0">
                         <div className="absolute inset-0 bg-slate-200 shadow-inner rounded-full" />
                         <div 
                            className="absolute left-0 top-0 bottom-0 bg-indigo-600 rounded-full transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(79,70,229,0.3)]" 
                            style={{ 
                               width: delivery.status === 'pending' || delivery.status === 'accepted' || delivery.status === 'ready_for_pickup' ? '0%' : 
                                      delivery.status === 'picked_up' ? '50%' : '100%' 
                            }}
                         />
                      </div>

                      {/* Nodes */}
                      <div className="relative flex justify-between items-center z-10">
                         {[
                           { id: 'enlèvement', status: ['picked_up', 'ready_for_pickup', 'delivered'], label: 'ENLEVÉ' },
                           { id: 'transit', status: ['picked_up', 'delivered'], label: 'TRANSIT' },
                           { id: 'livraison', status: ['delivered'], label: 'LIVRÉ' }
                         ].map((step, i) => {
                             const isCompleted = step.status.includes(delivery.status);
                             const isCurrent = delivery.status !== 'delivered' && (
                                               (i === 0 && (delivery.status === 'accepted' || delivery.status === 'pending' || delivery.status === 'ready_for_pickup')) || 
                                               (i === 1 && delivery.status === 'picked_up')
                                             );
                             const isCurrentOld = (i === 0 && (delivery.status === 'accepted' || delivery.status === 'pending' || delivery.status === 'ready_for_pickup')) || 
                                               (i === 1 && delivery.status === 'picked_up') || 
                                               (i === 2 && delivery.status === 'delivered');
                             
                             return (
                               <div key={step.id} className="flex flex-col items-center gap-3">
                                  <div className={cn(
                                     "w-11 h-11 rounded-full flex items-center justify-center transition-all duration-700 border-[3px] shadow-sm relative shrink-0",
                                     isCurrent ? "bg-white border-indigo-600 shadow-indigo-100 scale-110" : 
                                     isCompleted ? "bg-indigo-600 border-indigo-600 text-white" : "bg-white border-slate-200 text-slate-300"
                                  )}>
                                     {isCompleted && !isCurrent ? <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg> : <span className={cn("text-sm font-black text-center", isCurrent ? "text-indigo-600" : (isCompleted ? "text-white" : "text-slate-400"))}>{i + 1}</span>}
                                     {isCurrent && <div className="absolute -inset-2 rounded-full bg-indigo-500/10 animate-ping" />}
                                  </div>
                                  <span className={cn(
                                    "text-[10px] font-black tracking-widest transition-colors uppercase italic text-center", 
                                    (isCompleted || isCurrent) ? "text-slate-900" : "text-slate-400"
                                  )}>
                                     {step.label}
                                  </span>
                               </div>
                             );
                         })}
                      </div>
                   </div>

                   {/* Status Description */}
                   <div className="bg-slate-50/80 rounded-3xl p-5 mt-10 flex items-start gap-4 border border-slate-100 shadow-inner">
                      <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center text-indigo-600 shrink-0 border border-slate-100/50">
                         {delivery.status === 'pending' ? <Package className="w-6 h-6 animate-bounce" /> : <Truck className="w-6 h-6 animate-pulse" />}
                      </div>
                      <div className="flex-1">
                         <p className="text-sm font-black text-slate-900 tracking-tight leading-tight">
                            {delivery.status === 'pending' ? "Mise en relation avec un livreur" : 
                             delivery.status === 'accepted' ? "Le livreur récupère votre colis" : 
                             delivery.status === 'picked_up' ? "Colis récupéré ! Trajet en cours" : "Livraison confirmée. Merci !"}
                         </p>
                         <div className="flex items-center gap-2 mt-2">
                           <Clock className="w-3 h-3 text-slate-400" />
                           <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest italic">
                              MàJ : {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                           </p>
                         </div>
                      </div>
                      {delivery.status === 'pending' && (
                         <button 
                            onClick={handleBoost} 
                            disabled={isBoosting}
                            className="bg-indigo-600 text-white px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-600/20 active:scale-95 transition-all"
                         >
                            Boost +200F
                         </button>
                      )}
                   </div>
                </div>

                {/* Driver Interaction Panel */}
                {driver ? (
                   <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                         <div className="w-14 h-14 bg-indigo-50 rounded-2xl text-indigo-600 flex items-center justify-center font-black overflow-hidden border border-indigo-100/50 relative">
                            {driver.avatar ? <img src={driver.avatar} alt="Driver" className="w-full h-full object-cover" /> : <span className="text-xl">{driver.name[0]}</span>}
                         </div>
                         <div>
                            <p className="font-black text-sm text-slate-900 tracking-tight">{driver.name}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                               <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                               <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">En ligne</p>
                            </div>
                         </div>
                      </div>
                      <div className="flex gap-2">
                         <button onClick={() => window.open(`tel:${driver.phone}`)} className="w-12 h-12 bg-slate-50 text-slate-600 rounded-2xl flex items-center justify-center hover:bg-emerald-50 hover:text-emerald-500 transition-all active:scale-90 border border-slate-100/50">
                             <Phone className="w-5 h-5" />
                         </button>
                         <button onClick={() => setChatOpen(true)} className="w-12 h-12 bg-slate-50 text-slate-600 rounded-2xl flex items-center justify-center hover:bg-indigo-50 hover:text-indigo-600 transition-all active:scale-90 border border-slate-100/50">
                             <MessageSquare className="w-5 h-5" />
                         </button>
                      </div>
                   </div>
                ) : (
                  delivery.status === 'pending' && Array.isArray(bids) && bids.length > 0 && (
                    <div className="bg-white rounded-3xl p-6 shadow-xl shadow-indigo-100/50 border-2 border-indigo-50 relative overflow-hidden">
                       <div className="absolute -right-4 -top-4 w-24 h-24 bg-indigo-50 rounded-full blur-2xl opacity-50 mix-blend-multiply"></div>
                       <h3 className="font-black text-xs uppercase tracking-[0.2em] text-indigo-600 mb-6 flex items-center gap-2">
                         <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                         Négociation en cours ({(bids || []).filter(b => b.status === 'pending').length})
                       </h3>
                       <div className="space-y-4">
                          { (bids || []).filter(b => b.status === 'pending').map(bid => (
                             <div key={bid.id} className="p-5 rounded-[24px] border border-indigo-100 bg-indigo-50/30 flex flex-col gap-5 relative z-10">
                                <div className="flex justify-between items-start px-1">
                                   <div>
                                     <p className="font-black text-sm text-slate-900">{bid.driverName}</p>
                                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Livreur certifié</p>
                                   </div>
                                   <div className="text-right">
                                      <p className="font-black text-2xl text-indigo-600 leading-none">{bid.price} <span className="text-sm">FCFA</span></p>
                                      <p className="text-[10px] text-indigo-400 font-bold mt-1.5 uppercase italic">Dans ~{bid.timeEstimateMins} mins</p>
                                   </div>
                                </div>
                                <div className="flex gap-3">
                                   <button 
                                      onClick={async () => {
                                        try {
                                          await api.deliveries.coursesNegotiations.accepter(deliveryId, bid.driverId, bid.price);
                                          // Refresh data aggressively to update delivery state
                                          const found = await api.deliveries.get(deliveryId);
                                          if (found) setDelivery(found);
                                        } catch (err: any) {
                                          alert("Erreur lors de l'acceptation : " + (err.message || err));
                                        }
                                      }}
                                      className="flex-1 bg-indigo-600 text-white font-black py-4 rounded-[20px] text-[11px] uppercase tracking-widest hover:bg-indigo-700 shadow-xl shadow-indigo-600/20 active:scale-95 transition-all"
                                   >
                                      ACCEPTER
                                   </button>
                                   <button 
                                      onClick={async () => {
                                         if (confirm(`Voulez-vous rejeter l'offre de ${bid.price} FCFA ? Le livreur pourra soumettre une dernière proposition si limite non atteinte.`)) {
                                            try {
                                               await api.deliveries.coursesNegotiations.rejeter(deliveryId, bid.driverId);
                                               const bidsList = await api.deliveries.bids.list(deliveryId);
                                               setBids(Array.isArray(bidsList) ? bidsList : []);
                                               alert("Proposition refusée");
                                            } catch (err: any) {
                                               alert("Impossible de rejeter l'offre : " + (err.message || err));
                                            }
                                         }
                                      }}
                                      className="px-6 bg-white hover:bg-slate-50 text-slate-600 font-black py-4 rounded-[20px] text-[11px] uppercase tracking-widest border-2 border-slate-200 active:scale-95 transition-all"
                                   >
                                      REJETER
                                   </button>
                                </div>
                             </div>
                          ))}
                          {(bids || []).filter(b => b.status === 'pending').length === 0 && (bids || []).filter(b => b.status === 'rejected').length > 0 && (
                            <div className="p-4 bg-slate-50 rounded-2xl text-center border border-slate-100">
                               <p className="text-xs font-bold text-slate-500">Toutes les propositions ont été refusées.</p>
                            </div>
                          )}
                       </div>
                    </div>
                  )
                )}

                {/* Driver Action Control Panel on Tracking Page */}
                {profile?.role === 'driver' && delivery.driverId === profile.userId && delivery.status !== 'delivered' && delivery.status !== 'cancelled' && (
                   <div className="bg-white rounded-3xl p-6 shadow-xl border border-indigo-100 flex flex-col gap-4 mb-4">
                      <h3 className="font-black text-xs uppercase tracking-[0.2em] text-indigo-650 flex items-center gap-2">
                         <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                         Contrôles de livraison (Livreur)
                      </h3>
                      {delivery.status === 'accepted' || delivery.status === 'ready_for_pickup' ? (
                         <>
                            {(delivery.isPaid || delivery.paymentMethod === 'cash') ? (
                               <div className="space-y-4">
                                  <div className="p-4 bg-indigo-50/50 border border-indigo-100/50 rounded-2xl">
                                     <p className="text-[11px] font-semibold text-indigo-800">Votre colis est prêt à être récupéré chez le client.</p>
                                  </div>
                                  <button 
                                     onClick={() => { setEnteredCode(''); setShowKeypadFor('pickup'); }} 
                                     className="w-full py-4 bg-slate-900 hover:bg-black text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer font-bold"
                                  >
                                     Saisir le Code Collecte <Package className="w-4 h-4" />
                                  </button>
                               </div>
                            ) : (
                               <div className="p-5 bg-amber-50 rounded-2xl border border-amber-100 italic text-center text-xs font-semibold text-amber-600">
                                  En attente du paiement en ligne du client pour débloquer la collecte...
                               </div>
                            )}
                         </>
                      ) : delivery.status === 'picked_up' ? (
                         <div className="space-y-4">
                            <div className="p-4 bg-indigo-50/50 border border-indigo-100/50 rounded-2xl">
                               <p className="text-[11px] font-semibold text-indigo-800">Vous avez récupéré le colis. Livrez-le au destinataire et récupérez son code.</p>
                            </div>
                            <button 
                               onClick={() => { setEnteredCode(''); setShowKeypadFor('delivery'); }} 
                               className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer font-bold"
                            >
                               Saisir le Code Livraison pour Terminer <CheckCircle className="w-4 h-4" />
                            </button>
                         </div>
                      ) : null}
                   </div>
                )}

                {/* Security Codes for Active Deliveries */}
                {delivery.status !== 'delivered' && delivery.status !== 'cancelled' && (delivery.isPaid || delivery.paymentMethod === 'cash') && (
                   <div className="bg-slate-900 rounded-3xl p-5 lg:p-6 text-white shadow-2xl relative overflow-hidden ring-1 ring-white/10">
                      <div className="absolute top-0 left-0 w-24 h-24 bg-white/5 rounded-br-[60px] -ml-8 -mt-8" />
                      <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 mb-6 text-center ring-1 ring-white/5 py-2 rounded-full inline-block w-full">SÉCURITÉ • CODES PANCHO</p>
                      
                      <div className="grid grid-cols-2 gap-6 relative z-10">
                          <div className="bg-white/5 rounded-3xl p-5 text-center border border-white/10 shadow-inner group">
                             <p className="text-[9px] uppercase tracking-widest text-slate-500 mb-2 font-bold">Retrait</p>
                             <p className="text-3xl font-black tracking-[0.2em] group-hover:scale-110 transition-transform">{delivery.pickupCode}</p>
                          </div>
                          <div className="bg-white/5 rounded-3xl p-5 text-center border border-white/10 shadow-inner group">
                             <p className="text-[9px] uppercase tracking-widest text-slate-500 mb-2 font-bold">Livraison</p>
                             <p className="text-3xl font-black tracking-[0.2em] group-hover:scale-110 transition-transform">{delivery.deliveryCode}</p>
                          </div>
                      </div>

                      <button 
                        onClick={() => handleCopy(`PANCHO - Codes: ${delivery.pickupCode} | ${delivery.deliveryCode}`)} 
                        className="w-full mt-6 bg-white/5 hover:bg-white/10 rounded-2xl py-4 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all border border-white/5 active:scale-95"
                      >
                         <Copy className="w-4 h-4" /> Copier les codes
                      </button>
                   </div>
                )}

                {/* Details Section */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col gap-6">
                    <div className="flex items-center justify-between">
                       <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Détails de la course</h4>
                       <div className="flex items-center gap-2">
                          {delivery.paymentMethod && getPaymentLogo(delivery.paymentMethod) && (
                             <img src={getPaymentLogo(delivery.paymentMethod)!} alt={delivery.paymentMethod} className="w-6 h-6 object-contain" />
                          )}
                          <div className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black">
                             {delivery.cost} FCFA
                          </div>
                       </div>
                    </div>
                    <div className="space-y-4">
                       <div className="flex gap-4">
                          <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 shrink-0 border border-slate-100">
                             <div className="w-2 h-2 bg-indigo-500 rounded-full" />
                          </div>
                          <div>
                             <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-0.5">Point de retrait</p>
                             <p className="text-xs font-bold text-slate-900 leading-tight">{delivery.from.address}</p>
                          </div>
                       </div>
                       <div className="flex gap-4">
                          <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 shrink-0 border border-slate-100">
                             <div className="w-2 h-2 bg-rose-500 rounded-full" />
                          </div>
                          <div>
                             <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-0.5">Destination</p>
                             <p className="text-xs font-bold text-slate-900 leading-tight">{delivery.to.address}</p>
                          </div>
                       </div>
                    </div>
                </div>

                {((delivery.status !== 'delivered' && delivery.status !== 'cancelled') || profile?.role === 'admin' || profile?.role === 'superadmin') && (
                   <div className="mt-4 flex flex-col gap-2">
                      {!showDeleteConfirm ? (
                        <button 
                          onClick={() => setShowDeleteConfirm(true)} 
                          className="w-full text-center py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-rose-500 transition-all italic"
                        >
                          Supprimer la course
                        </button>
                      ) : (
                        <div className="flex items-center gap-2">
                           <button 
                              onClick={handleDelete} 
                              disabled={isDeleting}
                              className="flex-1 bg-rose-500 text-white py-3 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-rose-500/20 flex items-center justify-center gap-2"
                           >
                              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmer la suppression'}
                           </button>
                           <button 
                              onClick={() => setShowDeleteConfirm(false)} 
                              disabled={isDeleting}
                              className="w-12 h-12 bg-slate-100 text-slate-400 rounded-xl flex items-center justify-center font-black"
                           >
                              <X className="w-5 h-5" />
                           </button>
                        </div>
                      )}
                   </div>
                )}
            </div>
        </div>

        {/* Overlays */}
        {profile && delivery && (
            <Chat 
              deliveryId={delivery.id} 
              currentUser={profile} 
              isOpen={chatOpen} 
              onClose={() => setChatOpen(false)} 
            />
        )}

        <PaymentModal 
           isOpen={showPaymentModal}
           onClose={() => setShowPaymentModal(false)}
           amount={paymentBid?.price || delivery?.cost || 0}
           onConfirm={handlePayBid}
        />

        {/* COMPACT CENTERED KEYPAD MODAL FOR DRIVER */}
        {showKeypadFor && (
           <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-fade-in">
              <motion.div 
                 initial={{ scale: 0.9, opacity: 0, y: 20 }} 
                 animate={{ scale: 1, opacity: 1, y: 0 }} 
                 className="bg-white rounded-3xl w-full max-w-[340px] p-6 shadow-2xl relative my-auto animate-zoom-in"
              >
                 <button onClick={() => { setShowKeypadFor(null); setEnteredCode(''); setToastMessage(''); }} className="absolute top-4 right-4 w-8 h-8 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 transition-all active:scale-95 cursor-pointer border-none outline-none"><X className="w-4 h-4" /></button>
                 
                 <div className="text-center mb-6">
                    <div className={cn("w-12 h-12 mx-auto rounded-2xl flex items-center justify-center mb-4 shadow-inner", showKeypadFor === 'delivery' ? 'bg-indigo-50 text-indigo-600' : 'bg-orange-50 text-orange-600')}>
                       {showKeypadFor === 'delivery' ? <CheckCircle className="w-6 h-6" /> : <Package className="w-6 h-6" />}
                    </div>
                    <h2 className="text-xl font-black text-slate-900 tracking-tight">Code {showKeypadFor === 'pickup' ? 'Collecte' : 'Livraison'}</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Saisissez le code de sécurité</p>
                 </div>

                 {toastMessage && (
                    <div className="mb-4 p-3 bg-rose-50 border border-rose-100 rounded-2xl text-[11px] font-bold text-rose-600 text-center animate-pulse">
                       {toastMessage}
                    </div>
                 )}

                 <div className="relative mb-6">
                    <input 
                       type="text"
                       value={enteredCode}
                       onChange={(e) => setEnteredCode(e.target.value.toUpperCase())}
                       placeholder="EX: 7GZ4"
                       className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-center text-2xl font-black tracking-[0.2em] text-slate-900 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none uppercase"
                       maxLength={8}
                    />
                 </div>
                 
                 <div className="space-y-4">
                    <button 
                       onClick={handleVerifyCode} 
                       disabled={enteredCode.length < 4 || isValidatingCode} 
                       className={cn(
                          "w-full py-5 rounded-2xl text-[12px] font-black uppercase tracking-[0.2em] transition-all active:scale-95 shadow-xl cursor-pointer font-bold", 
                          showKeypadFor === 'delivery' ? 'bg-indigo-600 text-white shadow-indigo-600/30 hover:bg-indigo-700' : 'bg-slate-900 text-white hover:bg-black',
                          (enteredCode.length < 4 || isValidatingCode) && 'opacity-30 pointer-events-none'
                       )}
                    >
                       {isValidatingCode ? 'Traitement...' : 'Confirmer Validation'}
                    </button>
                 </div>
              </motion.div>
           </div>
        )}
        </>
      )}
    </div>
  );
}
