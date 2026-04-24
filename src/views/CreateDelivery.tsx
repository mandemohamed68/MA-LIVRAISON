import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { collection, addDoc, doc, getDoc } from 'firebase/firestore';
import { Navigation, Send, ArrowLeft, Loader2, Crosshair, Mic, Package, ShieldCheck, CheckCircle, Percent, DollarSign, Truck, BadgePercent } from 'lucide-react';
import { cn, calculateDistance } from '../lib/utils';
import { CommissionSettings } from '../types';
import L from 'leaflet';

// @ts-ignore
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
// @ts-ignore
import markerIcon from 'leaflet/dist/images/marker-icon.png';
// @ts-ignore
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

const markerIconL = new L.Icon({ iconUrl: markerIcon, shadowUrl: markerShadow, iconAnchor: [12, 41] });
const markerIcon2xL = new L.Icon({ iconUrl: markerIcon2x, shadowUrl: markerShadow, iconAnchor: [12, 41] });

const reverseGeocode = async (lat: number, lng: number) => {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
    const data = await res.json();
    return data.display_name.split(',').slice(0, 3).join(',') || 'Emplacement inconnu';
  } catch (error) {
    return 'Ma position (GPS)';
  }
};

const MapPicker = ({ onSelect }: { onSelect: (coords: {lat: number, lng: number, address?: string}) => void }) => {
  useMapEvents({
    async click(e) {
      const address = await reverseGeocode(e.latlng.lat, e.latlng.lng);
      onSelect({ lat: e.latlng.lat, lng: e.latlng.lng, address });
    },
  });
  return null;
};

const LocateButton = ({ onLocate }: { onLocate: (coords: {lat: number, lng: number, address: string}) => void }) => {
  const map = useMap();
  const [loading, setLoading] = useState(false);
  
  const handleLocate = () => {
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const address = await reverseGeocode(coords.lat, coords.lng);
        onLocate({ ...coords, address });
        map.flyTo([coords.lat, coords.lng], 15);
        setLoading(false);
      },
      (err) => {
        alert("GPS indisponible");
        setLoading(false);
      },
      { enableHighAccuracy: true }
    );
  };

  return (
    <button 
      onClick={handleLocate}
      disabled={loading}
      className="p-4 bg-orange-500 text-white rounded-full shadow-xl hover:bg-orange-600 transition-all border-4 border-white/50 disabled:opacity-50 backdrop-blur-md"
    >
      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Crosshair className="w-5 h-5" />}
    </button>
  );
};

export default function CreateDelivery() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [from, setFrom] = useState<{lat: number, lng: number, address: string, indications?: string} | null>(null);
  const [to, setTo] = useState<{lat: number, lng: number, address: string, indications?: string} | null>(null);
  
  const [senderPhone, setSenderPhone] = useState(profile?.phone || '');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [fromIndications, setFromIndications] = useState('');
  const [toIndications, setToIndications] = useState('');
  
  // Package details
  const [size, setSize] = useState<'small'|'medium'|'large'>('small');
  const [weightStr, setWeightStr] = useState('');
  const [isFragile, setIsFragile] = useState(false);
  const [contentCategory, setContentCategory] = useState('');
  const [valueDeclared, setValueDeclared] = useState<number | ''>('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Pricing State
  const [commissionSettings, setCommissionSettings] = useState<CommissionSettings | null>(null);
  const [estimatedCost, setEstimatedCost] = useState<number>(0);
  const [proposedPrice, setProposedPrice] = useState<number>(0);
  const [distance, setDistance] = useState<number>(0);

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
    if (from && to && commissionSettings && weightStr) {
      const dist = calculateDistance(from.lat, from.lng, to.lat, to.lng);
      setDistance(dist);
      const weight = Number(weightStr) || 1;
      const base = (dist * (commissionSettings.tarifKm || 150)) + 
                   (weight * (commissionSettings.tarifPoids || 100)) + 
                   (commissionSettings.fraisFixes || 500);
      const finalBase = Math.max(base, commissionSettings.minDeliveryCost || 500);
      setEstimatedCost(Math.round(finalBase));
      setProposedPrice(Math.round(finalBase));
    }
  }, [from, to, commissionSettings, weightStr]);

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(''), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const [isListening, setIsListening] = useState(false);
  const { t } = useAuth();

  const centerOUAGA: [number, number] = [12.3714, -1.5197];

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const address = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
        setFrom({ ...coords, address });
        setStep(2);
      },
      () => console.log('Location access denied'),
      { enableHighAccuracy: true }
    );
  }, []);

  const generateCode = () => Math.random().toString(36).substring(2, 6).toUpperCase();

  const handleCreate = async () => {
    if (!profile || !from || !to || !recipientPhone) {
      setToastMessage("Veuillez remplir le numéro du destinataire.");
      return;
    }

    setIsSubmitting(true);
    try {
      const pickupCode = generateCode();
      const deliveryCode = generateCode();

      // Enforce min price
      const minPrice = estimatedCost * (commissionSettings?.minRatioClient || 0.7);
      if (proposedPrice < (Math.max(minPrice, commissionSettings?.minDeliveryCost || 500))) {
        setToastMessage(`Le prix proposé est trop bas.`);
        setIsSubmitting(false);
        return;
      }
      
      await addDoc(collection(db, 'deliveries'), {
        clientId: profile.userId,
        clientName: profile.name,
        from: { ...from, indications: fromIndications },
        to: { ...to, indications: toIndications },
        senderPhone,
        recipientPhone,
        packageDetails: {
          size,
          weightStr,
          isFragile,
          contentCategory,
          valueDeclared: valueDeclared ? Number(valueDeclared) : null,
        },
        baseCost: estimatedCost,
        clientProposedPrice: proposedPrice,
        cost: proposedPrice, 
        paymentMethod: 'cash',
        isPaid: false, 
        pickupCode,
        deliveryCode,
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      navigate('/client');
    } catch (error) {
      console.error("Error creating delivery:", error);
      setToastMessage("Erreur lors de la création de la course");
    } finally {
      setIsSubmitting(false);
    }
  };

  const startVoiceSearch = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setToastMessage("La reconnaissance vocale n'est pas supportée par votre navigateur.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'fr-FR';
    recognition.start();
    setIsListening(true);

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      if (step === 1) {
        setFrom(prev => prev ? { ...prev, address: transcript } : { lat: centerOUAGA[0], lng: centerOUAGA[1], address: transcript });
      } else {
        setTo(prev => prev ? { ...prev, address: transcript } : { lat: centerOUAGA[0], lng: centerOUAGA[1], address: transcript });
      }
      setIsListening(false);
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
  }, [step]);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-slate-950 font-sans">
      {toastMessage && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur-md text-white px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-2xl z-[9999] border border-white/10">
          {toastMessage}
        </div>
      )}
      <div className="absolute inset-0 z-0 h-full w-full">
         <MapContainer center={centerOUAGA} zoom={13} style={{ height: '100%', width: '100%' }} zoomControl={false}>
            <TileLayer 
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" 
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            />
            <MapPicker 
              onSelect={(coords) => {
                if (step === 1) setFrom({ ...coords, address: `${t('pickup')} (${coords.lat.toFixed(4)})` });
                if (step === 2) setTo({ ...coords, address: `${t('destination')} (${coords.lat.toFixed(4)})` });
              }} 
            />
            
            <div className="absolute top-24 right-4 z-[1000] drop-shadow-2xl">
              <LocateButton onLocate={(coords) => {
                setFrom({ ...coords, address: coords.address || "Ma position (GPS)" });
                setStep(2);
              }} />
            </div>

            {from && (
              <Marker 
                position={[from.lat, from.lng]} 
                icon={new L.DivIcon({
                  className: 'from-marker',
                  html: `<div class="w-10 h-10 bg-slate-900 rounded-2xl border-4 border-white shadow-2xl flex items-center justify-center text-white font-black">A</div>`,
                  iconAnchor: [20, 20]
                })} 
              />
            )}
            {to && (
              <Marker 
                position={[to.lat, to.lng]} 
                icon={new L.DivIcon({
                  className: 'to-marker',
                  html: `<div class="w-10 h-10 bg-orange-600 rounded-2xl border-4 border-white shadow-2xl flex items-center justify-center text-white font-black">B</div>`,
                  iconAnchor: [20, 20]
                })} 
              />
            )}
          </MapContainer>
      </div>

      <div className="absolute top-0 left-0 right-0 p-4 sm:p-6 z-20 pointer-events-none">
        <div className="max-w-7xl mx-auto flex justify-between items-start">
          <button onClick={() => navigate(-1)} className="pointer-events-auto w-14 h-14 bg-white/70 backdrop-blur-2xl hover:bg-slate-900 hover:text-white rounded-[24px] shadow-2xl border border-white/50 transition-all flex items-center justify-center shrink-0">
            <ArrowLeft className="w-6 h-6 text-slate-900 hover:text-white" />
          </button>
          
          <div className="bg-slate-900/80 backdrop-blur-2xl px-6 py-3 rounded-full border border-white/10 shadow-2xl pointer-events-auto hidden sm:block">
            <div className="flex items-center gap-3">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white">Création demande de devis</span>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 lg:top-0 lg:right-6 lg:left-auto lg:bottom-auto lg:w-[450px] lg:h-screen lg:py-6 z-20 pointer-events-none flex flex-col justify-end lg:justify-start">
        
        <div className="pointer-events-auto w-full bg-slate-50/95 backdrop-blur-3xl lg:rounded-[40px] rounded-t-[40px] border-t lg:border border-white shadow-[0_-10px_60px_rgba(0,0,0,0.15)] lg:shadow-2xl overflow-hidden flex flex-col max-h-[85vh] lg:h-full">
          
          <div className="px-6 py-4 sm:p-8 shrink-0 bg-white/60">
            <div className="w-10 h-1 bg-slate-200/80 rounded-full mx-auto mb-4 lg:hidden" />
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tighter uppercase italic leading-none mb-1">Nouvelle <span className="text-orange-500">Course.</span></h1>
            <p className="text-slate-400 font-bold text-[8px] sm:text-[10px] uppercase tracking-widest">Soumettez votre colis aux livreurs locaux.</p>
          </div>

          <div className="p-6 sm:px-8 sm:py-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
            
            <div className="space-y-4">
              <div className="bg-white/90 rounded-[28px] p-5 shadow-sm border border-white relative">
                <div className="absolute left-9 top-10 bottom-10 w-0.5 border-l-2 border-dashed border-slate-200" />
                
                <div className="relative z-10 flex gap-4 mb-6">
                  <div className="w-8 h-8 rounded-xl bg-slate-900 flex items-center justify-center shrink-0 border border-slate-800 shadow-md">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  </div>
                  <div className="flex-1">
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{t('pickup')}</label>
                    <input 
                      type="text"
                      value={from?.address || ''}
                      onChange={(e) => setFrom(prev => prev ? { ...prev, address: e.target.value } : { lat: centerOUAGA[0], lng: centerOUAGA[1], address: e.target.value })}
                      onFocus={() => setStep(1)}
                      placeholder="Saisir adresse..."
                      className="w-full bg-transparent border-b-2 border-slate-100 px-0 py-1.5 text-sm font-bold focus:ring-0 focus:border-slate-900 transition-all placeholder:text-slate-300"
                    />
                    <input 
                      type="text"
                      value={fromIndications}
                      onChange={(e) => setFromIndications(e.target.value)}
                      placeholder="Indications (facultatif)"
                      className="w-full bg-transparent border-none px-0 py-1.5 text-xs font-medium text-slate-500 focus:ring-0 placeholder:text-slate-300 mt-1"
                    />
                  </div>
                </div>

                <div className="relative z-10 flex gap-4">
                  <div className="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center shrink-0 border border-orange-100 shadow-sm">
                    <Navigation className="w-4 h-4 text-orange-500" />
                  </div>
                  <div className="flex-1">
                    <label className="block text-[9px] font-black text-orange-500 uppercase tracking-[0.2em] mb-1">{t('destination')}</label>
                    <input 
                      type="text"
                      value={to?.address || ''}
                      onChange={(e) => setTo(prev => prev ? { ...prev, address: e.target.value } : { lat: centerOUAGA[0], lng: centerOUAGA[1], address: e.target.value })}
                      onFocus={() => setStep(2)}
                      placeholder="Adresse de destination..."
                      className="w-full bg-transparent border-b-2 border-slate-100 px-0 py-1.5 text-sm font-bold focus:ring-0 focus:border-orange-500 transition-all placeholder:text-slate-300"
                    />
                    <input 
                      type="text"
                      value={toIndications}
                      onChange={(e) => setToIndications(e.target.value)}
                      placeholder="Indications précises (Obligatoire)"
                      className="w-full bg-transparent border-none px-0 py-1.5 text-xs font-medium text-slate-500 focus:ring-0 placeholder:text-slate-300 mt-1"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-4 items-center">
              <div className="flex-1 bg-white/90 rounded-[24px] p-4 shadow-sm border border-white">
                 <label className="block text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Contact Destinataire</label>
                 <input 
                   type="tel"
                   required
                   value={recipientPhone}
                   onChange={(e) => setRecipientPhone(e.target.value)}
                   placeholder="Ex: 70 00 00 00"
                   className="w-full bg-transparent border-none px-2 py-1 text-sm font-black outline-none focus:ring-0 text-slate-900"
                 />
              </div>
              <button 
                onClick={startVoiceSearch} 
                className={cn(
                  "w-16 h-16 rounded-[24px] flex items-center justify-center shrink-0 transition-all shadow-md bg-white border border-white",
                  isListening ? "text-orange-500 shadow-orange-500/20 animate-pulse border-orange-200" : "text-slate-400 hover:text-slate-900 hover:shadow-slate-200"
                )}
              >
                <Mic className="w-6 h-6" />
              </button>
            </div>

            {/* Nouveau: Package Details */}
            <div className="bg-white/80 rounded-[28px] p-5 shadow-sm border border-white space-y-4">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Détails du colis</p>
              
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: 'small', label: 'Petit', icon: <Package className="w-4 h-4 mb-1" /> },
                  { id: 'medium', label: 'Moyen', icon: <Package className="w-5 h-5 mb-1" /> },
                  { id: 'large', label: 'Encombrant', icon: <Package className="w-6 h-6 mb-1" /> },
                ].map((s) => (
                  <button 
                    key={s.id}
                    onClick={() => setSize(s.id as any)}
                    className={cn(
                      "flex flex-col items-center justify-center py-3 px-2 rounded-[20px] transition-all border",
                      size === s.id ? "bg-slate-900 border-slate-900 text-white shadow-lg scale-[1.02]" : "bg-white border-white text-slate-500 hover:bg-slate-50 shadow-sm"
                    )}
                  >
                    {s.icon}
                    <span className="text-[8px] font-black uppercase tracking-widest leading-none mt-1">{s.label}</span>
                  </button>
                ))}
              </div>

              <input 
                type="text"
                value={weightStr}
                onChange={(e) => setWeightStr(e.target.value)}
                placeholder="Poids approx. (ex: Moins de 5kg)"
                className="w-full bg-white border-none rounded-xl px-4 py-3 text-xs font-bold focus:ring-2 focus:ring-orange-500/20 transition-all"
              />

              <div className="flex gap-4">
                <input 
                  type="text"
                  value={contentCategory}
                  onChange={(e) => setContentCategory(e.target.value)}
                  placeholder="Type (ex: Documents, Nourriture...)"
                  className="flex-1 bg-white border-none rounded-xl px-4 py-3 text-xs font-bold focus:ring-2 focus:ring-orange-500/20 transition-all"
                />
                
                <button 
                  onClick={() => setIsFragile(!isFragile)}
                  className={cn(
                    "rounded-xl px-4 py-3 border transition-all flex items-center justify-center gap-2 font-black text-xs",
                    isFragile ? "bg-red-50 text-red-600 border-red-200" : "bg-white border-white text-slate-400"
                  )}
                >
                  <ShieldCheck className="w-4 h-4" />
                  Fragile
                </button>
              </div>

              <input 
                type="number"
                value={valueDeclared}
                onChange={(e) => setValueDeclared(e.target.value ? Number(e.target.value) : '')}
                placeholder="Valeur déclarée (optionnel) en FCFA"
                className="w-full bg-white border-none rounded-xl px-4 py-3 text-xs font-bold focus:ring-2 focus:ring-orange-500/20 transition-all"
              />
            </div>

            {/* Système de Prix Proposé & Négociation */}
            {estimatedCost > 0 && commissionSettings && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-slate-900 rounded-[32px] p-6 sm:p-8 shadow-2xl text-white relative overflow-hidden"
              >
                {/* Background Decor */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
                
                <div className="flex items-center gap-4 mb-6 relative z-10">
                  <div className="w-12 h-12 bg-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20">
                    <BadgePercent className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-widest text-white">Coût Suggéré par l'App</h3>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Optimisé selon vos critères</p>
                  </div>
                </div>

                {/* Price Breakdown Grid */}
                <div className="grid grid-cols-2 gap-3 mb-8 relative z-10">
                  <div className="bg-white/5 rounded-2xl p-3 border border-white/10 hover:bg-white/10 transition-colors">
                    <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest mb-1">Distance ({distance.toFixed(1)} km)</p>
                    <p className="text-xs font-black text-white">{Math.round(distance * (commissionSettings.tarifKm || 150))} <span className="text-[8px] opacity-40">FCFA</span></p>
                  </div>
                  <div className="bg-white/5 rounded-2xl p-3 border border-white/10 hover:bg-white/10 transition-colors">
                    <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest mb-1">Impact Poids</p>
                    <p className="text-xs font-black text-white">{Math.round((Number(weightStr) || 1) * (commissionSettings.tarifPoids || 100))} <span className="text-[8px] opacity-40">FCFA</span></p>
                  </div>
                  <div className="bg-white/5 rounded-2xl p-3 border border-white/10 hover:bg-white/10 transition-colors">
                    <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest mb-1">Frais Fixes</p>
                    <p className="text-xs font-black text-white">{commissionSettings.fraisFixes || 500} <span className="text-[8px] opacity-40">FCFA</span></p>
                  </div>
                  <div className="bg-white/5 rounded-2xl p-3 border border-orange-500/20 bg-orange-500/5 transition-colors">
                    <p className="text-[7px] font-black text-orange-500 uppercase tracking-widest mb-1">Estimation Totale</p>
                    <p className="text-base font-black text-orange-500">{estimatedCost} <span className="text-[8px] uppercase">FCFA</span></p>
                  </div>
                </div>

                <div className="space-y-4 relative z-10">
                  <div className="bg-white rounded-2xl p-5 shadow-inner">
                    <div className="flex justify-between items-center mb-3">
                      <label className="block text-[8px] font-black text-slate-500 uppercase tracking-widest">Ajuster votre offre (FCFA)</label>
                      <span className="text-[7px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full uppercase">Flexibilité ±</span>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <button 
                        type="button"
                        onClick={() => setProposedPrice(prev => Math.max(prev - 100, Math.round(estimatedCost * (commissionSettings.minRatioClient || 0.7))))}
                        className="w-12 h-12 rounded-xl bg-slate-100 text-slate-900 flex items-center justify-center font-black hover:bg-slate-200 transition-all text-xl"
                      >
                        -
                      </button>
                      <input 
                        type="number"
                        value={proposedPrice}
                        onChange={(e) => setProposedPrice(Number(e.target.value))}
                        className="flex-1 bg-transparent border-none text-center text-3xl font-black text-slate-900 focus:ring-0"
                      />
                      <button 
                        type="button"
                        onClick={() => setProposedPrice(prev => prev + 100)}
                        className="w-12 h-12 rounded-xl bg-slate-100 text-slate-900 flex items-center justify-center font-black hover:bg-slate-200 transition-all text-xl"
                      >
                        +
                      </button>
                    </div>
                    
                    <p className="text-[8px] text-center text-slate-400 font-bold uppercase tracking-wider mt-4">
                      Minimum requis : {Math.round(estimatedCost * (commissionSettings.minRatioClient || 0.7))} FCFA pour rester attractif
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
            
            <div className="h-2"></div>
          </div>

          <div className="p-5 sm:p-8 bg-white shrink-0 border-t border-slate-100 relative z-20 text-center">
            <button
              onClick={handleCreate}
              disabled={isSubmitting || !from || !to || !recipientPhone}
              className={cn(
                "w-full py-5 rounded-[24px] font-black text-[11px] uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all",
                (!from || !to || !recipientPhone) 
                  ? "bg-slate-100 text-slate-400 cursor-not-allowed" 
                  : "bg-slate-900 text-white hover:scale-[1.02] shadow-2xl shadow-slate-900/30 active:scale-95"
              )}
            >
              {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : (
                <>
                  <span>Demander des devis</span>
                  <Send className="w-4 h-4" />
                </>
              )}
            </button>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-4">Votre demande sera envoyée aux livreurs proches</p>
          </div>
        </div>
      </div>
    </div>
  );
}
