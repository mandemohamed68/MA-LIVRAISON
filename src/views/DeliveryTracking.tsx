import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../lib/firebase';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { DeliveryRequest, UserProfile } from '../types';
import { useAuth } from '../context/AuthContext';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import { Truck, MapPin, Navigation, Phone, MessageSquare, ArrowLeft, Package, Clock, CheckCircle, ShieldCheck, CreditCard, Lock, ArrowUpRight, Share2, Star, User } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Chat from '../components/Chat';
import PaymentModal from '../components/PaymentModal';
import { cn } from '../lib/utils';
import L from 'leaflet';
// @ts-ignore
import markerIcon from 'leaflet/dist/images/marker-icon.png';
// @ts-ignore
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
// @ts-ignore
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

export default function DeliveryTracking() {
  const { deliveryId } = useParams<{ deliveryId: string }>();
  const { profile } = useAuth();
  const [delivery, setDelivery] = useState<DeliveryRequest | null>(null);
  const [driver, setDriver] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [showRating, setShowRating] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const navigate = useNavigate();
  const { t } = useAuth();

  const isClient = profile?.role === 'client' || (profile?.role === 'admin' && delivery?.clientId === profile.userId);
  const isDriver = profile?.role === 'driver' || (profile?.role === 'admin' && delivery?.driverId === profile.userId);

  useEffect(() => {
    if (delivery?.status === 'delivered' && isClient && !delivery.rating) {
      setShowRating(true);
    }
  }, [delivery?.status, isClient]);

  const handleSubmitRating = async () => {
    if (!deliveryId || rating === 0) return;
    await updateDoc(doc(db, 'deliveries', deliveryId), {
      rating,
      feedback,
      updatedAt: new Date().toISOString()
    });
    setShowRating(false);
  };

  useEffect(() => {
    if (!deliveryId) return;

    const unsubDelivery = onSnapshot(doc(db, 'deliveries', deliveryId), (snap) => {
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() } as DeliveryRequest;
        setDelivery(data);
        
        // Load driver info separately to avoid blocking the main view
        if (data.driverId) {
          onSnapshot(doc(db, 'users', data.driverId), (driverSnap) => {
            if (driverSnap.exists()) {
              setDriver(driverSnap.data() as UserProfile);
            }
          });
        }
      } else {
        setDelivery(null);
      }
      setLoading(false);
    }, (error) => {
      console.error("Firestore error:", error);
      setLoading(false);
    });

    return () => unsubDelivery();
  }, [deliveryId]);

  const handlePayment = async () => {
    if (!delivery) return;
    await updateDoc(doc(db, 'deliveries', delivery.id), {
      isPaid: true,
      updatedAt: new Date().toISOString()
    });
  };

  // Center map component
  const ChangeView = ({ center }: { center: [number, number] }) => {
    const map = useMap();
    useEffect(() => {
      if (center && !isNaN(center[0]) && !isNaN(center[1])) {
        map.flyTo(center, 15, { duration: 1.5 });
      }
    }, [center, map]);
    return null;
  };

  const statusMap = {
    'accepted': { label: 'Livreur en route', color: 'text-orange-500', bg: 'bg-orange-50' },
    'picked_up': { label: 'En cours de livraison', color: 'text-blue-600', bg: 'bg-blue-50' },
    'delivered': { label: 'Livré !', color: 'text-emerald-500', bg: 'bg-emerald-50' },
  };

  const isValidCoords = (coords: any) => coords && !isNaN(coords.lat) && !isNaN(coords.lng) && coords.lat !== 0;

  if (loading && !delivery) {
    return (
      <div className="max-w-7xl mx-auto h-[calc(100vh-10rem)] flex flex-col gap-8 px-4 lg:px-0 animate-pulse">
        {/* Header Skeleton */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-slate-200 rounded-[24px]" />
            <div className="space-y-2">
              <div className="w-24 h-4 bg-slate-200 rounded" />
              <div className="w-48 h-10 bg-slate-200 rounded" />
            </div>
          </div>
          <div className="w-48 h-12 bg-slate-100 rounded-2xl" />
        </div>

        {/* Timeline Skeleton */}
        <div className="bg-white rounded-[32px] p-8 border border-slate-100">
          <div className="flex justify-between">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="flex flex-col items-center gap-3">
                <div className="w-14 h-14 bg-slate-100 rounded-2xl" />
                <div className="w-12 h-2 bg-slate-100 rounded" />
              </div>
            ))}
          </div>
        </div>

        {/* Main Content Skeleton */}
        <div className="flex-1 grid grid-cols-12 gap-8 min-h-0">
          <div className="col-span-12 lg:col-span-8 bg-slate-50 rounded-[50px] border-8 border-white shadow-2xl" />
          <div className="col-span-12 lg:col-span-4 space-y-6">
            <div className="h-2/3 bg-white rounded-[32px] border border-slate-100" />
            <div className="h-1/3 bg-slate-100 rounded-[32px]" />
          </div>
        </div>
      </div>
    );
  }

  if (!delivery && !loading) {
    return (
      <div className="max-w-7xl mx-auto h-[calc(100vh-10rem)] flex flex-col items-center justify-center gap-6 text-center">
        <div className="w-24 h-24 bg-rose-50 text-rose-500 rounded-[40px] flex items-center justify-center border-4 border-white shadow-xl">
          <Package className="w-12 h-12" />
        </div>
        <div>
          <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Commande Introuvable</h2>
          <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-2">Cette course n'existe plus ou le lien est invalide.</p>
        </div>
        <button 
          onClick={() => navigate('/')}
          className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-orange-500 transition-all shadow-xl"
        >
          Retour à l'accueil
        </button>
      </div>
    );
  }

  const currentStatus = statusMap[delivery.status as keyof typeof statusMap] || { label: delivery.status, color: 'text-slate-600', bg: 'bg-slate-50' };

  const timelineSteps = [
    { key: 'pending', label: 'Commande', icon: Clock },
    { key: 'accepted', label: 'En route', icon: Truck },
    { key: 'picked_up', label: 'Collecté', icon: Package },
    { key: 'delivered', label: 'Livré', icon: CheckCircle },
  ];

  const currentStepIndex = timelineSteps.findIndex(s => s.key === delivery.status) === -1 ? 0 : timelineSteps.findIndex(s => s.key === delivery.status);

  return (
    <div className="max-w-7xl mx-auto h-[calc(100vh-10rem)] flex flex-col gap-8 px-4 lg:px-0">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4 sm:gap-6">
          <button onClick={() => navigate(-1)} className="p-3 sm:p-4 bg-white hover:bg-slate-900 hover:text-white rounded-[20px] sm:rounded-[24px] shadow-xl border border-slate-100 transition-all group shrink-0">
            <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6 text-slate-600 group-hover:text-white" />
          </button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[8px] font-black uppercase tracking-widest">REF-{delivery.id.slice(0, 8).toUpperCase()}</span>
              {delivery.status === 'delivered' && (
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-600 rounded text-[8px] font-black uppercase tracking-widest">Terminé</span>
              )}
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tighter uppercase leading-none">Suivi Expédition</h1>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="bg-white/90 backdrop-blur-md px-6 py-3 rounded-2xl shadow-xl flex items-center border border-slate-100">
            <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse mr-3"></div>
            <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">{delivery.status === 'delivered' ? 'Livraison Terminée' : 'Mise à jour en direct'}</span>
          </div>
        </div>
      </div>

      {/* Progress Timeline */}
      <div className="bg-white rounded-[32px] p-6 sm:p-8 shadow-sm border border-slate-100">
        <div className="relative flex justify-between">
          {/* Progress Line */}
          <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-100 -translate-y-1/2 z-0" />
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${(currentStepIndex / (timelineSteps.length - 1)) * 100}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="absolute top-1/2 left-0 h-1 bg-orange-500 -translate-y-1/2 z-0 shadow-[0_0_15px_rgba(249,115,22,0.5)]"
          />

          {timelineSteps.map((step, idx) => {
            const Icon = step.icon;
            const isCompleted = idx <= currentStepIndex;
            const isActive = idx === currentStepIndex;

            return (
              <div key={step.key} className="relative z-10 flex flex-col items-center gap-3">
                <motion.div 
                  initial={false}
                  animate={isActive ? { scale: 1.25 } : { scale: 1 }}
                  className={cn(
                    "w-10 h-10 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center transition-all border-4",
                    isCompleted ? "bg-orange-500 border-white text-white shadow-xl shadow-orange-500/20" : "bg-white border-slate-50 text-slate-300"
                  )}
                >
                  <Icon className="w-5 h-5 sm:w-7 sm:h-7" />
                </motion.div>
                <span className={cn(
                  "text-[8px] sm:text-[10px] font-black uppercase tracking-widest whitespace-nowrap",
                  isCompleted ? "text-slate-900" : "text-slate-200"
                )}>
                  {step.label}
                </span>
                {isActive && (
                  <motion.div 
                    layoutId="active-ping"
                    className="absolute -top-1 w-2 h-2 bg-orange-500 rounded-full animate-ping"
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex-1 grid grid-cols-12 gap-8 min-h-0">
        <div className="col-span-12 lg:col-span-8 bg-white rounded-[50px] p-3 shadow-2xl border-8 border-white relative overflow-hidden group min-h-[400px] lg:min-h-0">
          <div className="h-full rounded-[38px] overflow-hidden relative bg-slate-50">
            {!isValidCoords(delivery.from) ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center">
                <div className="w-20 h-20 bg-orange-100 rounded-3xl flex items-center justify-center text-orange-500 mb-6 animate-bounce">
                  <MapPin className="w-10 h-10" />
                </div>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter mb-2">GPS en cours d'acquisition</h3>
                <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest max-w-[200px] mx-auto">Nous tentons de localiser votre colis sur le maillage d'Ouagadougou...</p>
              </div>
            ) : (
              <MapContainer 
                center={[delivery.from.lat, delivery.from.lng]} 
                zoom={13} 
                className="h-full w-full" 
                zoomControl={false}
              >
              <TileLayer 
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" 
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
              />
              <Marker position={[delivery.from.lat, delivery.from.lng]} icon={new L.DivIcon({ 
                className: 'custom-marker',
                html: `<div class="w-8 h-8 bg-blue-500 rounded-full border-4 border-white shadow-xl flex items-center justify-center text-white"><div class="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-25"></div><div class="w-2 h-2 bg-white rounded-full"></div></div>`,
                iconAnchor: [16, 16]
              })} />
              <Marker position={[delivery.to.lat, delivery.to.lng]} icon={new L.DivIcon({ 
                className: 'custom-marker',
                html: `<div class="w-8 h-8 bg-orange-500 rounded-full border-4 border-white shadow-xl flex items-center justify-center text-white"><div class="absolute inset-0 bg-orange-500 rounded-full animate-ping opacity-25"></div><div class="w-2 h-2 bg-white rounded-full"></div></div>`,
                iconAnchor: [16, 16]
              })} />
              
              {driver?.currentLocation && (
                <>
                  <Marker position={[driver.currentLocation.lat, driver.currentLocation.lng]} icon={new L.DivIcon({ 
                    className: 'driver-marker',
                    html: `<div class="w-12 h-12 bg-emerald-500 rounded-3xl border-4 border-white shadow-2xl flex items-center justify-center text-white"><div class="absolute inset-0 bg-emerald-500 rounded-full animate-ping opacity-20"></div><img src="https://cdn-icons-png.flaticon.com/512/3655/3655682.png" class="w-6 h-6" /></div>`,
                    iconAnchor: [24, 24]
                  })} />
                  <ChangeView center={[driver.currentLocation.lat, driver.currentLocation.lng]} />
                </>
              )}
            </MapContainer>
          )}
          </div>

          <div className="absolute top-6 left-6 right-6 space-y-4">
            <AnimatePresence>
              {/* Client Flows */}
              {isClient && (
                <>
                  {!delivery.isPaid && delivery.status === 'accepted' && (
                    <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-orange-500 p-6 rounded-[32px] shadow-2xl border-4 border-white text-white flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest mb-1">Action requise</p>
                        <p className="font-black text-xl leading-none">{t('pay_btn')} ({delivery.cost} FCFA)</p>
                      </div>
                      <button onClick={() => setIsPaymentModalOpen(true)} className="px-8 py-3 bg-white text-orange-600 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg">{t('pay_btn')}</button>
                      
                      <PaymentModal 
                        isOpen={isPaymentModalOpen}
                        onClose={() => setIsPaymentModalOpen(false)}
                        onConfirm={handlePayment}
                        amount={delivery.cost}
                      />
                    </motion.div>
                  )}

                  {delivery.isPaid && delivery.status === 'accepted' && (
                    <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-slate-900 p-8 rounded-[40px] shadow-2xl border-4 border-white/10 backdrop-blur-xl text-white text-center">
                      <div className="flex flex-col items-center gap-4">
                        <div className="p-3 bg-orange-500 rounded-2xl">
                          <Lock className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.3em] mb-2 opacity-50">Code de Sécurisation Enlèvement</p>
                          <p className="text-6xl font-black tracking-[0.4em] mb-4 text-orange-500 underline decoration-white/20 underline-offset-8">{delivery.pickupCode}</p>
                          <p className="text-[10px] font-medium opacity-60 max-w-xs mx-auto">Donnez ce code secret au livreur uniquement après vérification de votre marchandise.</p>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {delivery.status === 'picked_up' && (
                    <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-[#111827] p-8 rounded-[40px] shadow-2xl border-4 border-white/10 backdrop-blur-xl text-white text-center">
                      <div className="flex flex-col items-center gap-4">
                        <div className="p-3 bg-emerald-500 rounded-2xl">
                          <Package className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.3em] mb-2 opacity-50">Code de Validation Livraison</p>
                          <p className="text-6xl font-black tracking-[0.4em] mb-4 text-emerald-500 underline decoration-white/20 underline-offset-8">{delivery.deliveryCode}</p>
                          <p className="text-[10px] font-medium opacity-60 max-w-xs mx-auto text-emerald-100/60">Ce code doit être saisi par le livreur pour confirmer la fin de la mission.</p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </>
              )}

              {/* Driver Flows via Dashboard only, simplifying this UI */}
              {isDriver && (
                  <div className="bg-slate-100 p-6 rounded-[32px] shadow-inner text-center">
                    <p className="text-xs font-bold text-slate-500">Gérez les statuts de la course via l'espace livreur afin de pouvoir communiquer les imprévus.</p>
                    <button onClick={() => navigate('/driver')} className="mt-4 px-6 py-2 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-orange-500 transition-all">Retour au Dashboard</button>
                  </div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-4 flex flex-col gap-6 overflow-y-auto pr-2 custom-scrollbar">
          {driver && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white rounded-[32px] p-8 shadow-sm border border-slate-100 relative overflow-hidden group"
            >
              <div className="flex items-center gap-6 mb-8">
                <div className="relative">
                  <div className="w-16 h-16 bg-blue-600 rounded-3xl flex items-center justify-center text-white shadow-xl relative z-10">
                    <User className="w-8 h-8" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full border-4 border-white z-20 flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                  </div>
                </div>
                <div>
                  <h3 className="font-black text-slate-900 uppercase tracking-tight">{driver.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex text-yellow-400">
                      {[1, 2, 3, 4, 5].map(i => <Star key={i} className="w-3 h-3 fill-current" />)}
                    </div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">(4.9)</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => driver.phone && (window.location.href = `tel:${driver.phone}`)}
                  disabled={!driver.phone}
                  className="flex items-center justify-center gap-3 py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-orange-500 transition-all shadow-xl disabled:opacity-50"
                >
                  <Phone className="w-4 h-4" /> {t('call_btn')}
                </button>
                <button 
                  onClick={() => {
                    const chatBtn = document.querySelector('.fixed.bottom-6.right-6 button') as HTMLButtonElement;
                    chatBtn?.click();
                  }}
                  className="flex items-center justify-center gap-3 py-4 bg-orange-50 text-orange-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-orange-600 hover:text-white transition-all border border-orange-100"
                >
                  <MessageSquare className="w-4 h-4" /> Message
                </button>
              </div>

              <div className="mt-8 pt-8 border-t border-slate-50 flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest leading-none mb-1">Véhicule</p>
                  <p className="font-black text-xs text-slate-700 uppercase">{driver.vehicleType || 'Moto'} • {driver.licensePlate || 'BFA-9900'}</p>
                </div>
                <button 
                  onClick={() => {
                    if (navigator.share) {
                      navigator.share({
                        title: 'Suivi de livraison',
                        text: `Suivez mon colis Ma Livraison: ${window.location.href}`,
                        url: window.location.href
                      });
                    } else {
                      navigator.clipboard.writeText(window.location.href);
                      alert("Lien de suivi copié !");
                    }
                  }}
                  className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-orange-100 hover:text-orange-600 transition-all"
                >
                   <Share2 className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          )}

          <div className="bg-white rounded-[32px] p-8 shadow-sm border border-slate-100 flex-1 flex flex-col">
            <h3 className="text-slate-400 font-black text-[10px] uppercase tracking-[0.2em] mb-10 pb-4 border-b border-slate-50">DÉTAILS COMMANDE</h3>
            
            <div className="space-y-10 flex-1">
              <div className="flex gap-6">
                <div className="flex flex-col items-center gap-1 shrink-0">
                  <div className="w-4 h-4 bg-orange-500 rounded-full shadow-[0_0_15px_rgba(249,115,22,0.4)]" />
                  <div className="w-0.5 flex-1 bg-slate-100 rounded-full" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Enlèvement</p>
                  <p className="text-sm font-bold text-slate-700 leading-snug">{delivery.from.address}</p>
                </div>
              </div>
              <div className="flex gap-6">
                <div className="flex flex-col items-center gap-1 shrink-0">
                  <div className="w-0.5 flex-1 bg-slate-100 rounded-full" />
                  <div className="w-4 h-4 bg-blue-600 rounded-full shadow-lg" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Destination</p>
                  <p className="text-sm font-bold text-slate-700 leading-snug">{delivery.to.address}</p>
                </div>
              </div>
            </div>

            <div className="mt-10 pt-10 border-t border-slate-50 flex justify-between items-end">
              <div>
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">{t('cost')}</p>
                <p className="text-4xl font-black text-slate-900 tracking-tighter">{delivery.cost} FCFA</p>
                {delivery.hasInsurance && (
                  <p className="text-[10px] font-black text-emerald-500 uppercase flex items-center gap-1 mt-1">
                    <ShieldCheck className="w-3 h-3" />
                    + {delivery.insuranceCost} FCFA (Assuré)
                  </p>
                )}
                <p className={cn("text-[8px] font-black uppercase mt-1", delivery.isPaid ? "text-emerald-500" : "text-rose-500")}>
                  {delivery.isPaid ? '✓ RÉGLÉ' : '⚠ EN ATTENTE DE PAIEMENT'}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-yellow-400 rounded-[32px] p-8 shadow-xl border-4 border-white flex items-center gap-6">
            <div className="w-14 h-14 bg-white/40 rounded-2xl flex items-center justify-center shrink-0 border border-white/50">
              <Clock className="w-8 h-8 text-yellow-900" />
            </div>
            <div>
              <p className="text-[10px] font-black text-yellow-900 uppercase tracking-widest leading-none mb-1">Statut Courant</p>
              <div className="font-black text-xl text-yellow-950 tracking-tight flex items-center gap-2">
                {currentStatus.label}
                <div className="w-2 h-2 bg-yellow-950 rounded-full animate-ping" />
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <Chat 
        deliveryId={delivery.id} 
        recipientName={profile?.role === 'client' ? (delivery.driverName || 'Livreur') : (delivery.clientName || 'Client')} 
      />

      {/* Rating Modal */}
      <AnimatePresence>
        {showRating && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white rounded-[40px] p-10 max-w-md w-full shadow-2xl border-4 border-white text-center"
            >
              <div className="w-20 h-20 bg-orange-100 rounded-[30px] flex items-center justify-center mx-auto mb-8">
                <CheckCircle className="w-10 h-10 text-orange-600" />
              </div>
              <h3 className="text-3xl font-black text-slate-900 tracking-tighter uppercase mb-2">{t('delivered')}</h3>
              <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mb-8">{t('rate_delivery')}</p>
              
              <div className="flex justify-center gap-3 mb-8">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button 
                    key={star}
                    onClick={() => setRating(star)}
                    className={cn(
                      "w-12 h-12 rounded-2xl flex items-center justify-center transition-all border-2",
                      rating >= star ? "bg-orange-500 border-orange-500 text-white" : "bg-slate-50 border-slate-100 text-slate-300"
                    )}
                  >
                    <ArrowUpRight className={cn("w-6 h-6", rating >= star ? "rotate-45" : "")} />
                  </button>
                ))}
              </div>

              <textarea 
                placeholder={t('feedback_placeholder')}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm font-bold focus:ring-4 focus:ring-orange-100 transition-all mb-8 min-h-[100px]"
              />

              <button 
                onClick={handleSubmitRating}
                disabled={rating === 0}
                className="w-full py-5 bg-orange-500 text-white rounded-3xl font-black text-sm uppercase tracking-widest shadow-xl shadow-orange-100 disabled:opacity-50"
              >
                {t('submit_rating')}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

