import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/apiService';
import { DeliveryRequest, UserProfile } from '../types';
import { useAuth } from '../context/AuthContext';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import { ArrowLeft, Package, MessageSquare, CheckCircle, Navigation, Copy, Truck, Phone, Clock, ChevronRight, Loader2, X, Target, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Chat } from '../components/Chat';
import PaymentModal from '../components/PaymentModal';
import { cn, calculateDistance } from '../lib/utils';
import { LoadingScreen } from '../components/LoadingScreen';
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
    if (delivery.from) points.push([delivery.from.lat, delivery.from.lng]);
    if (delivery.to) points.push([delivery.to.lat, delivery.to.lng]);
    if (driver?.currentLocation) points.push([driver.currentLocation.lat, driver.currentLocation.lng]);

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

  useEffect(() => {
    if (!deliveryId) return;

    const fetchData = async () => {
      try {
        const deliveries = await api.deliveries.list();
        const found = deliveries.find((d: any) => d.id === deliveryId);
        if (found) {
          setDelivery(found);
          if (found.driverId) {
            const driversList = await api.admin.users.list();
            const dInfo = driversList.find((u: any) => u.userId === found.driverId);
            if (dInfo) setDriver(dInfo);
          }
          if (found.status === 'pending') {
            const bidsList = await api.deliveries.bids.list(deliveryId);
            setBids(bidsList);
          }
        } else {
          setDelivery(null);
        }
      } catch (err) {
        console.error("Local API fetch failed in tracking", err);
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
    if (!delivery || !paymentBid) return;
    try {
      const isCash = method === 'cash';
      const isDemo = !((window as any).Capacitor) && (window.location.hostname.includes('ais-dev') || window.location.hostname.includes('localhost'));
      
      const isUssd = method.includes('ussd');
      // For demo, we auto confirm if it's not USSD or standard mobile money that needs approval
      const shouldAutoConfirm = isVerified || isCash || (isDemo && !isUssd && method !== 'aggregator');
      
      const pickupCode = Math.random().toString(36).substring(2, 6).toUpperCase();
      const deliveryCode = Math.random().toString(36).substring(2, 6).toUpperCase();

      await api.deliveries.update(delivery.id, {
        status: 'accepted',
        driverId: paymentBid.driverId,
        driverName: paymentBid.driverName,
        cost: paymentBid.price,
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
           setRouteCoords([[delivery.from.lat, delivery.from.lng], [delivery.to.lat, delivery.to.lng]]);
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

  const centerOUAGA: [number, number] = [12.3714, -1.5197];
  const centerMap = delivery?.from ? [delivery.from.lat, delivery.from.lng] as [number, number] : centerOUAGA;

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
               {delivery.from && <Marker position={[delivery.from.lat, delivery.from.lng]} icon={customMarkerIcon} />}
               {delivery.to && <Marker position={[delivery.to.lat, delivery.to.lng]} icon={customMarkerIcon} />}
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

            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 scrollbar-hide">
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
                             const isCurrent = (i === 0 && (delivery.status === 'accepted' || delivery.status === 'pending' || delivery.status === 'ready_for_pickup')) || 
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
                  delivery.status === 'pending' && bids.length > 0 && (
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                       <h3 className="font-black text-xs uppercase tracking-[0.2em] text-indigo-600 mb-6">Offres reçues ({bids.length})</h3>
                       <div className="space-y-4">
                          {bids.map(bid => (
                             <div key={bid.id} className="p-5 rounded-[28px] border border-slate-100 bg-slate-50/50 flex flex-col gap-4">
                                <div className="flex justify-between items-start px-1">
                                   <div>
                                     <p className="font-black text-sm text-slate-900">{bid.driverName}</p>
                                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Livreur certifié</p>
                                   </div>
                                   <div className="text-right">
                                      <p className="font-black text-xl text-indigo-600 leading-none">{bid.price} F</p>
                                      <p className="text-[10px] text-indigo-400 font-bold mt-1.5 uppercase italic">{bid.timeEstimateMins} mins</p>
                                   </div>
                                </div>
                                <button 
                                   onClick={() => { setPaymentBid(bid); setShowPaymentModal(true); }}
                                   className="w-full bg-slate-900 text-white font-black py-4 rounded-[20px] text-[10px] uppercase tracking-widest hover:bg-slate-800 shadow-lg shadow-slate-900/10 active:scale-95 transition-all"
                                >
                                   Accepter l'offre
                                </button>
                             </div>
                          ))}
                       </div>
                    </div>
                  )
                )}

                {/* Security Codes for Active Deliveries */}
                {delivery.status !== 'delivered' && delivery.status !== 'cancelled' && delivery.isPaid && (
                   <div className="bg-slate-900 rounded-3xl p-5 lg:p-6 text-white shadow-2xl relative overflow-hidden ring-1 ring-white/10">
                      <div className="absolute top-0 left-0 w-24 h-24 bg-white/5 rounded-br-[60px] -ml-8 -mt-8" />
                      <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 mb-6 text-center ring-1 ring-white/5 py-2 rounded-full inline-block w-full">SÉCURITÉ • CODES LIVRA</p>
                      
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
                        onClick={() => handleCopy(`LIVRA - Codes: ${delivery.pickupCode} | ${delivery.deliveryCode}`)} 
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
        </>
      )}
    </div>
  );
}
