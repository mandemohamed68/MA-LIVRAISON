import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { DeliveryRequest, CommissionSettings } from '../types';
import { Compass, History as HistoryIcon, Wallet, User, Navigation, Package, DollarSign, Zap, CheckCircle, ShieldCheck, MapPin, X, ArrowRight, ArrowLeft, ChevronRight, Menu, List, Check, Info, Camera, Target, FileText, FileCheck, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import { api } from '../services/apiService';
import L from 'leaflet';
import { cn, calculateDistance } from '../lib/utils';
import { LoadingScreen } from '../components/LoadingScreen';
import AnnouncementBanner from '../components/AnnouncementBanner';
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';
import { Chat } from '../components/Chat';
import { sendNotification } from '../lib/notificationService';

const mockChartData = [
  { name: 'Lun', amount: 15000 },
  { name: 'Mar', amount: 20000 },
  { name: 'Mer', amount: 25000 },
  { name: 'Jeu', amount: 5000 },
  { name: 'Ven', amount: 35000 },
  { name: 'Sam', amount: 45000 },
  { name: 'Dim', amount: 12000 },
];

const compressImage = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (file.type === 'application/pdf') {
       if (file.size > 1000000) {
          reject(new Error("Le fichier PDF est trop volumineux (maximum 1 Mo). Veuillez réduire sa taille ou envoyer une photo."));
          return;
       }
       const reader = new FileReader();
       reader.onloadend = () => resolve(reader.result as string);
       reader.onerror = reject;
       reader.readAsDataURL(file);
       return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        const MAX_DIM = 800; // Smaller dimension for lighter payload
        if (width > height) {
          if (width > MAX_DIM) {
            height *= MAX_DIM / width;
            width = MAX_DIM;
          }
        } else {
          if (height > MAX_DIM) {
            width *= MAX_DIM / height;
            height = MAX_DIM;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
           ctx.drawImage(img, 0, 0, width, height);
           const dataUrl = canvas.toDataURL('image/jpeg', 0.5); // 50% quality JPEG
           resolve(dataUrl);
        } else {
           resolve(e.target?.result as string);
        }
      };
      img.onerror = () => reject(new Error("Erreur de lecture de l'image"));
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};


function ChangeView({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    if (center && !isNaN(center[0]) && !isNaN(center[1])) map.flyTo(center, 15, { duration: 1.5 });
  }, [center, map]);
  return null;
}

export default function DriverDashboard() {
  const { profile, signOut, updateProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const queryParams = new URLSearchParams(location.search);
  const queryTab = queryParams.get('tab');
  
  const [currentTab, setCurrentTab] = useState<'radar' | 'history' | 'wallet' | 'profile'>(
    (queryTab as 'radar' | 'history' | 'wallet' | 'profile') || 'radar'
  );
  
  useEffect(() => {
    if (queryTab) {
      setCurrentTab(queryTab as 'radar' | 'history' | 'wallet' | 'profile');
    } else {
      setCurrentTab('radar');
    }
  }, [queryTab]);
  
  const [pendingJobs, setPendingJobs] = useState<DeliveryRequest[]>([]);
  const [activeJobs, setActiveJobs] = useState<DeliveryRequest[]>([]);
  const [deliveredJobs, setDeliveredJobs] = useState<DeliveryRequest[]>([]);
  
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatDeliveryId, setChatDeliveryId] = useState<string | null>(null);
  
  const [commissionSettings, setCommissionSettings] = useState<CommissionSettings | null>(null);
  const [toastMessage, setToastMessage] = useState('');
  const isOnline = profile ? (profile.status === 'online' || profile.status === 'busy') : false;

  const filteredPendingJobs = useMemo(() => {
    if (!profile) return [];
    return pendingJobs.filter(job => !job.rejectedBy?.includes(profile.userId));
  }, [pendingJobs, profile]);
  
  useEffect(() => {
    if (!profile || profile.role !== 'driver') return;
    const isCurrentlyOnline = profile.status === 'online' || profile.status === 'busy';
    if (!isCurrentlyOnline) return;

    const maxSimultaneous = commissionSettings?.maxSimultaneousDeliveries || 2;
    const newStatus = activeJobs.length >= maxSimultaneous ? 'busy' : 'online';
    
    if (newStatus !== profile.status) {
      api.profile.update({ status: newStatus }).catch(() => {});
    }
  }, [activeJobs.length, profile?.status, commissionSettings]);

  // Radar State
  const [radarMode, setRadarMode] = useState<'search' | 'focus'>('search');
  const [isListView, setIsListView] = useState(false);
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);
  const [verificationForm, setVerificationForm] = useState({
    guarantorName: '',
    guarantorPhone: '',
    cniFront: null as string | null,
    criminalRecord: null as string | null
  });

  const handleVerificationSubmit = async () => {
    if (!profile) return;
    setIsProcessingAction(true);
    try {
      const updates = {
        verificationStatus: 'pending',
        guarantorName: verificationForm.guarantorName,
        guarantorPhone: verificationForm.guarantorPhone,
        identityCardUrl: verificationForm.cniFront,
        criminalRecordUrl: verificationForm.criminalRecord,
        updatedAt: new Date().toISOString()
      };
      await api.profile.update(updates);
      
      setIsVerificationModalOpen(false);
      setToastMessage("Dossier soumis avec succès !");
    } catch (e) {
      console.error(e);
      setToastMessage("Erreur lors de la soumission");
    }
    setIsProcessingAction(false);
  };
  const [selectedPendingJob, setSelectedPendingJob] = useState<DeliveryRequest | null>(null);
  
  // Bid State
  const [bidPrice, setBidPrice] = useState<number | ''>('');
  const [bidTime, setBidTime] = useState<number | ''>('');
  const [bidReason, setBidReason] = useState<string>('');
  const [showBidForm, setShowBidForm] = useState(false);

  useEffect(() => {
    if (!selectedPendingJob) {
      setShowBidForm(false);
      setBidPrice('');
      setBidTime('');
      setBidReason('');
    }
  }, [selectedPendingJob]);
  
  // Focus State
  const [focusedJobId, setFocusedJobId] = useState<string | null>(null);
  const [routeCoords, setRouteCoords] = useState<[number, number][]>([]);
  
  // Active Action State
  const [showKeypadFor, setShowKeypadFor] = useState<'pickup' | 'delivery' | null>(null);
  const [enteredCode, setEnteredCode] = useState('');
  const [proofImage, setProofImage] = useState<string | null>(null);
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const codeInputRef = useRef<HTMLInputElement>(null);

  // Withdraw state
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  
  const [activeDriverCount, setActiveDriverCount] = useState(0);
  
  useEffect(() => {
    // Real-time listener for competition count - Placeholder for local API count or skip
    setActiveDriverCount(5); // Simulated or simplified for now to avoid complexity
  }, []);

  useEffect(() => {
    if (toastMessage) {
      const t = setTimeout(() => setToastMessage(''), 4000);
      return () => clearTimeout(t);
    }
  }, [toastMessage]);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const comm = await api.config.get('commissions');
        if (comm) setCommissionSettings(comm as CommissionSettings);
      } catch (e) {
        console.warn("Could not fetch settings locally");
      }
    };
    fetchSettings();
  }, []);

  const requestGeolocation = () => {
    if (!("geolocation" in navigator)) {
      setGpsError("GPS non supporté sur cet appareil.");
      return undefined;
    }

    setLoading(true);
    let lastUpdate = 0;
    let lastCoords: { lat: number, lng: number } | null = null;
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(coords);
        setGpsError(null);
        setLoading(false);
        const now = Date.now();
        
        // Critical: Distance check to avoid redundant writes if stationary
        let significantMove = true;
        if (lastCoords) {
          const distance = calculateDistance(lastCoords.lat, lastCoords.lng, coords.lat, coords.lng);
          significantMove = distance > 0.02; // More than 20 meters
        }

        if (profile?.role === 'driver' && (now - lastUpdate > 60000 || (significantMove && now - lastUpdate > 30000))) { 
          lastUpdate = now;
          lastCoords = coords;
          api.profile.update({ 
            currentLocation: coords, 
            updatedAt: new Date().toISOString() 
          }).catch(() => {});
        }
      },
      (err) => {
        setLoading(false);

        if (err.code === 1) setGpsError("GPS refusé par le navigateur.");
        else if (err.code === 2) setGpsError("GPS indisponible sur cet appareil.");
        else if (err.code === 3) setGpsError("Timeout lors de la recherche GPS.");
        else setGpsError("Erreur GPS inconnue.");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );
    return id;
  };

  const fetchData = async () => {
    if (!profile) return;
    try {
      const jobs = await api.deliveries.list();
      
      const allMyJobs = jobs.filter((j: any) => j.driverId === profile.userId);
      allMyJobs.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      const activeList = allMyJobs.filter((j: any) => ['accepted', 'picked_up', 'ready_for_pickup'].includes(j.status));
      const deliveredList = allMyJobs.filter((j: any) => j.status === 'delivered');
      
      setActiveJobs(activeList);
      setDeliveredJobs(deliveredList);
      
      if (isOnline) {
        setPendingJobs(jobs.filter((j: any) => j.status === 'pending'));
      } else {
        setPendingJobs([]);
      }
    } catch (err) {
      console.warn("Local API fetch failed in driver dashboard", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!profile) {
      setLoading(false);
      return;
    }

    const watchId = requestGeolocation();

    fetchData();
    const interval = setInterval(fetchData, 8000);

    return () => {
      if (watchId !== undefined) navigator.geolocation.clearWatch(watchId);
      clearInterval(interval);
    };
  }, [profile, isOnline]);

  // Keep track of previous active jobs length to only auto-switch when a new job is accepted
  const prevActiveJobsLength = useRef(0);
  
  useEffect(() => {
    if (activeJobs.length > 0) {
      if (activeJobs.length > prevActiveJobsLength.current) {
        setRadarMode('focus');
      }
      if (!focusedJobId || !activeJobs.find(j => j.id === focusedJobId)) {
        setFocusedJobId(activeJobs[0].id);
      }
    } else {
      setRadarMode('search');
      setFocusedJobId(null);
    }
    prevActiveJobsLength.current = activeJobs.length;
  }, [activeJobs, focusedJobId]);

  const handleRejectJob = async (jobId: string) => {
    if (!profile) return;
    try {
      const job = pendingJobs.find(j => j.id === jobId);
      if (job) {
        const rejectedBy = job.rejectedBy || [];
        if (!rejectedBy.includes(profile.userId)) {
          await api.deliveries.update(jobId, {
            rejectedBy: [...rejectedBy, profile.userId],
            updatedAt: new Date().toISOString()
          });
        }
      }
      setSelectedPendingJob(null);
      setToastMessage("Mission refusée");
    } catch (e) {
      console.error("Error rejecting job:", e);
      setToastMessage("Erreur lors du refus");
    }
  };

  useEffect(() => {
    // Route fetching for focused active job
    if (radarMode === 'focus' && focusedJobId && userLocation) {
      const job = activeJobs.find(j => j.id === focusedJobId);
      if (job) {
        const target = job.status === 'accepted' ? job.from : job.to;
        fetch(`https://router.project-osrm.org/route/v1/driving/${userLocation.lng},${userLocation.lat};${target.lng},${target.lat}?overview=full&geometries=geojson`)
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
             if (userLocation && typeof userLocation.lat === 'number' && target && typeof target.lat === 'number') {
               setRouteCoords([[userLocation.lat, userLocation.lng], [target.lat, target.lng]]);
             } else {
               setRouteCoords([]);
             }
          });
      }
    } else {
      setRouteCoords([]);
    }
  }, [radarMode, focusedJobId, userLocation, activeJobs]);

  const focusedJob = useMemo(() => activeJobs.find(j => j.id === focusedJobId), [activeJobs, focusedJobId]);
  
  const earnings = useMemo(() => {
    // Tous les gains (les courses complétées online, c'est ce que la plateforme doit au livreur)
    const onlineJobs = deliveredJobs.filter(d => d.paymentMethod !== 'cash');
    const totalEarnings = onlineJobs.reduce((sum, d) => sum + (d.cost || 0), 0) * (commissionSettings?.driverSharePercent || 85) / 100;
    // On soustrait l'historique des retraits
    return totalEarnings - (profile?.totalWithdrawn || 0);
  }, [deliveredJobs, commissionSettings, profile?.totalWithdrawn]);

  const dailyEarnings = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const dailyTotal = deliveredJobs
        .filter(job => {
          const updatedAtStr = job.updatedAt && (typeof (job.updatedAt as any).toDate === 'function' ? (job.updatedAt as any).toDate().toISOString() : job.updatedAt);
          const createdAtStr = job.createdAt && (typeof (job.createdAt as any).toDate === 'function' ? (job.createdAt as any).toDate().toISOString() : job.createdAt);
          return (updatedAtStr?.startsWith(today)) || (createdAtStr?.startsWith(today));
        })
        .reduce((acc, job) => acc + (job.clientProposedPrice || job.cost || 0), 0);
    const share = commissionSettings?.driverSharePercent || 85;
    return Math.floor((dailyTotal * share) / 100);
  }, [deliveredJobs, commissionSettings]);

  const [isBidding, setIsBidding] = useState(false);

  const submitBid = async (jobId: string, isDirectAccept = false) => {
    if (!profile) return;
    const maxSimultaneous = commissionSettings?.maxSimultaneousDeliveries || 2;
    if (activeJobs.length >= maxSimultaneous) {
      setToastMessage(`Maximum ${maxSimultaneous} missions simultanées !`);
      return;
    }
    const job = pendingJobs.find(j => j.id === jobId);
    if (!job) return;

    setIsBidding(true);
    if (isDirectAccept) {
      try {
      const updates = {
        status: 'accepted',
        driverId: profile.userId,
        driverName: profile.name,
        cost: job.clientProposedPrice || job.cost,
        updatedAt: new Date().toISOString()
      };
      await api.deliveries.update(jobId, updates);
      
      await sendNotification(job.clientId, "Livreur assigné", `${profile.name} a accepté la course. Veuillez payer pour générer les codes.`, 'success', `/client`);
      setToastMessage("Mission acceptée !");
      setSelectedPendingJob(null);
      await fetchData();
    } catch (e) {
      console.error(e);
      setToastMessage("Erreur d'acceptation");
    }
      setIsBidding(false);
      return;
    }

    // Bid logic
    const price = Number(bidPrice);
    const time = Number(bidTime);
    if (!price || !time) { setToastMessage("Remplissez prix et temps"); setIsBidding(false); return; }

    try {
      await api.deliveries.bids.place(jobId, {
        price,
        proposedTime: time,
        reason: bidReason,
        driverId: profile.userId,
        driverName: profile.name,
      });
      await sendNotification(job.clientId, "Nouvelle offre", `${profile.name} propose ${price} FCFA.`, 'info', '/client');
      setToastMessage("Offre envoyée !");
      setSelectedPendingJob(null);
      setBidPrice(''); setBidTime(''); setBidReason('');
      await fetchData();
    } catch(e) { setToastMessage("Erreur réseau"); }
    setIsBidding(false);
  };

  const [isWithdrawalModalOpen, setIsWithdrawalModalOpen] = useState(false);
  const [withdrawalAmountInput, setWithdrawalAmountInput] = useState('');

  const handleWithdrawal = async () => {
    const amount = Number(withdrawalAmountInput);
    if (!profile || earnings < 500) { setToastMessage("Solde insuffisant"); return; }
    if (!amount || amount < 500 || amount > earnings) { setToastMessage("Montant invalide"); return; }
    setIsWithdrawing(true);
    try {
      await api.profile.update({
        withdrawalRequested: true,
        withdrawalAmount: amount,
        withdrawalMethod: 'mobile_money',
        withdrawalPhone: profile.phone || '',
        withdrawalRequestedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      setToastMessage("Demande envoyée !");
      setIsWithdrawalModalOpen(false);
      setWithdrawalAmountInput('');
    } catch (err) {
      console.error(err);
      setToastMessage("Erreur lors de la demande");
    } finally {
      setIsWithdrawing(false);
    }
  };

  const processJobAction = async () => {
    if (!focusedJob || !showKeypadFor) return;
    setIsProcessingAction(true);

    if (showKeypadFor === 'pickup') {
      if (enteredCode !== focusedJob.pickupCode) {
        setToastMessage("Code d'enlèvement invalide !");
        setEnteredCode('');
        setIsProcessingAction(false);
        return;
      }
      const data: any = { status: 'picked_up', updatedAt: new Date().toISOString() };
      if (proofImage) data.proofImage = proofImage;
      await api.deliveries.update(focusedJob.id, data);
      
      await api.notifications.create({
        userId: focusedJob.clientId,
        title: "Colis récupéré",
        message: "Votre colis est en route.",
        type: 'success',
        link: `/delivery/${focusedJob.id}`
      }).catch(() => {});

      setToastMessage("Colis récupéré !");
      setShowKeypadFor(null);
    } 
    else if (showKeypadFor === 'delivery') {
      if (enteredCode !== focusedJob.deliveryCode) {
        setToastMessage("Code de livraison invalide !");
        setEnteredCode('');
        setIsProcessingAction(false);
        return;
      }
      const data: any = { status: 'delivered', updatedAt: new Date().toISOString() };
      if (proofImage) data.proofImage = proofImage;
      await api.deliveries.update(focusedJob.id, data);
      
      await api.notifications.create({
        userId: focusedJob.clientId,
        title: "Colis livré",
        message: "Succès de la livraison !",
        type: 'success',
        link: `/delivery/${focusedJob.id}`
      }).catch(() => {});

      setToastMessage("Livraison terminée !");
      setShowKeypadFor(null);
    }

    setProofImage(null);
    setEnteredCode('');
    setIsProcessingAction(false);
    await fetchData();
  };

  const cancelJob = async (jobId: string) => {
    // Proceed directly for iframe compatibility without confirm
    await api.deliveries.update(jobId, {
      status: 'pending', 
      driverId: null, 
      driverName: null, 
      updatedAt: new Date().toISOString()
    });
    await fetchData();
  };

  const toggleOnline = async () => {
    if (!profile) return;
    
    // Check if account is actually active for missions
    if (profile.accountStatus === 'pending_approval' || profile.verificationStatus !== 'verified') {
      setToastMessage("Attention: Votre dossier est incomplet. Finalisez votre KYC pour recevoir des missions.");
    }

    const currentIsOnline = profile.status === 'online' || profile.status === 'busy';
    const newLogicalOnline = !currentIsOnline;
    
    const newStatus = newLogicalOnline ? (activeJobs.length >= (commissionSettings?.maxSimultaneousDeliveries || 2) ? 'busy' : 'online') : 'offline';
    
    try {
      await updateProfile({
         status: newStatus,
         updatedAt: new Date().toISOString()
      });
      setToastMessage(newStatus !== 'offline' ? "Vous êtes EN LIGNE" : "Vous êtes HORS LIGNE");
    } catch (err) {
      console.error("Failed to update status", err);
      setToastMessage("Erreur de connexion. Réessayez.");
    }
  };

  const getPaymentLogo = (method?: string | null) => {
    if (!method) return null;
    const id = method.replace('_ussd', '').toLowerCase();
    const validMethods = ['orange', 'moov', 'telecel', 'coris'];
    if (validMethods.includes(id)) {
      return `/payments/${id}.png`;
    }
    return null;
  };

  return (
    <div className="relative flex-1 bg-slate-50 flex flex-col font-sans overflow-hidden">
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
      <AnnouncementBanner userRole="driver" />
      {/* Dynamic Main Content */}
      <div className="flex-1 relative overflow-hidden bg-slate-100">
        <AnimatePresence mode="wait">
          
          {/* RADAR / ACTIVE VIEW */}
          {currentTab === 'radar' && (
             <motion.div key="radar" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="absolute inset-0">
                {/* MAP BACKGROUND */}
                <div className="absolute inset-0 z-0 bg-slate-200">
                   {gpsError && (
                     <div className="absolute top-24 left-1/2 -translate-x-1/2 z-[40]">
                       <div className="bg-rose-500/90 backdrop-blur text-white px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest shadow-lg flex items-center gap-2">
                         <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                         {gpsError}
                       </div>
                     </div>
                   )}

                   <MapContainer center={[12.3714, -1.5197]} zoom={13} className="h-full w-full" zoomControl={false} ref={(r) => { if (r) (window as any).driverMap = r; }}>
                     <TileLayer url="https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}" subdomains={['mt0', 'mt1', 'mt2', 'mt3']} />
                     
                     {radarMode === 'search' && filteredPendingJobs.map(job => {
                        const isHighValue = (job.clientProposedPrice || job.cost || 0) >= 2000;
                        const isUrgent = job.isUrgent;
                        const pulseBg = isUrgent ? 'bg-rose-500/30' : (isHighValue ? 'bg-orange-500/30' : 'bg-indigo-500/30');
                        const bgColor = isUrgent ? 'bg-rose-500' : (isHighValue ? 'bg-orange-500' : 'bg-indigo-500');
                        if (!job.from || typeof job.from.lat !== 'number' || typeof job.from.lng !== 'number') return null;
                        return (
                          <Marker key={job.id} position={[job.from.lat, job.from.lng]} 
                            eventHandlers={{ click: () => setSelectedPendingJob(job) }}
                            icon={new L.DivIcon({ className: 'custom-pulse', html: `<div class="relative w-8 h-8"><div class="absolute inset-0 ${pulseBg} rounded-full animate-ping"></div><div class="relative w-8 h-8 ${bgColor} rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white">${isUrgent ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m13 2-2 10h9L7 22l2-10H1L13 2z"/></svg>' : '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle></svg>'}</div></div>`, iconAnchor: [16,16] })}
                          />
                        );
                     })}

                     {radarMode === 'focus' && focusedJob && (
                        <>
                           <Marker position={[focusedJob.from.lat, focusedJob.from.lng]} icon={new L.DivIcon({ className: '', html: `<div class="w-6 h-6 bg-slate-900 border-2 border-white rounded-full shadow-lg flex items-center justify-center text-white text-[10px] font-black">A</div>`, iconAnchor: [12,12] })} />
                           <Marker position={[focusedJob.to.lat, focusedJob.to.lng]} icon={new L.DivIcon({ className: '', html: `<div class="w-6 h-6 bg-indigo-600 border-2 border-white rounded-full shadow-lg flex items-center justify-center text-white text-[10px] font-black">B</div>`, iconAnchor: [12,12] })} />
                        </>
                     )}

                     {routeCoords.length > 0 && radarMode === 'focus' && <Polyline positions={routeCoords} color="#4f46e5" weight={5} opacity={0.8} />}
                     
                     {userLocation && (
                        <Marker position={[userLocation.lat, userLocation.lng]} icon={new L.DivIcon({ className: '', html: `<div class="relative w-10 h-10"><div class="absolute inset-0 bg-blue-500/20 rounded-full animate-ping"></div><div class="relative w-10 h-10 bg-blue-600 rounded-full border-4 border-white shadow-xl flex items-center justify-center text-white"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polygon points="3 11 22 2 13 21 11 13 3 11"></polygon></svg></div></div>`, iconAnchor: [20,20] })} />
                     )}
                     
                     {userLocation && radarMode === 'search' && <ChangeView center={[userLocation.lat, userLocation.lng]} />}
                     {focusedJob && radarMode === 'focus' && <ChangeView center={focusedJob.status === 'accepted' ? [focusedJob.from.lat, focusedJob.from.lng] : [focusedJob.to.lat, focusedJob.to.lng]} />}
                   </MapContainer>

                   {/* Map Controls */}
                   <div className="absolute top-28 right-4 z-10 flex flex-col gap-3 pointer-events-auto">
                     <button onClick={() => setIsListView(!isListView)} className="w-10 h-10 sm:w-12 sm:h-12 bg-white rounded-full shadow-lg border border-slate-100 flex items-center justify-center text-slate-700 hover:text-indigo-600 transition-colors">
                        {isListView ? <Compass className="w-4 h-4 sm:w-5 sm:h-5" /> : <List className="w-4 h-4 sm:w-5 sm:h-5" />}
                     </button>
                     <button onClick={() => { if(userLocation) (window as any).driverMap?.flyTo([userLocation.lat, userLocation.lng], 15) }} className="w-10 h-10 sm:w-12 sm:h-12 bg-white rounded-full shadow-lg border border-slate-100 flex items-center justify-center text-slate-700 hover:text-indigo-600 transition-colors">
                        <Navigation className="w-4 h-4 sm:w-5 sm:h-5" />
                     </button>
                     {radarMode === 'focus' && focusedJob && (
                        <button onClick={() => { 
                          const target = focusedJob.status === 'accepted' ? [focusedJob.from.lat, focusedJob.from.lng] : [focusedJob.to.lat, focusedJob.to.lng];
                          (window as any).driverMap?.flyTo(target, 15);
                        }} className="w-10 h-10 sm:w-12 sm:h-12 bg-white rounded-full shadow-lg border border-indigo-100 flex items-center justify-center text-indigo-600 hover:bg-indigo-50 transition-all shadow-indigo-100">
                           <Target className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>
                     )}
                   </div>
                </div>

                      <div className="absolute inset-0 z-20 pointer-events-none p-4 flex flex-col justify-between">
                   {/* Top HUD Layout */}
                   <div className="flex justify-between items-start gap-2">
                       {/* Left HUD: Status */}
                       <div className="flex flex-col gap-2 max-w-[180px]">
                           {activeJobs.length > 0 && radarMode === 'focus' ? (
                                <div className="bg-slate-900/90 backdrop-blur-xl p-2 rounded-2xl border border-slate-800 shadow-2xl flex items-center gap-2 pointer-events-auto">
                                   <div className="flex bg-slate-800 rounded-xl p-1 overflow-x-auto no-scrollbar">
                                     {activeJobs.length > 1 ? (
                                       activeJobs.map((j, i) => (
                                         <button key={j.id} onClick={() => setFocusedJobId(j.id)} className={cn("px-3 py-2 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all whitespace-nowrap", focusedJobId === j.id ? "bg-indigo-500 text-white shadow-md" : "text-slate-400 hover:text-white")}>
                                           M#{i+1}
                                         </button>
                                       ))
                                     ) : (
                                       <div className="px-3 py-1.5 text-[8px] font-black uppercase tracking-widest text-indigo-400 flex items-center gap-2">
                                         <div className="w-1 h-1 rounded-full bg-indigo-500 animate-pulse" />
                                         Active
                                       </div>
                                     )}
                                   </div>
                                   <button onClick={() => setRadarMode('search')} className="w-8 h-8 bg-white/10 rounded-xl flex items-center justify-center text-white hover:bg-white/20 flex-shrink-0" title="Radar">
                                       <Compass className="w-3.5 h-3.5" />
                                   </button>
                                </div>
                             ) : (
                                <div className="bg-white/90 backdrop-blur-xl p-3 rounded-2xl border border-slate-200 shadow-lg pointer-events-auto">
                                    <div className="flex items-center gap-3 justify-between">
                                       <div>
                                          <p className={cn("text-[8px] font-black uppercase tracking-widest flex items-center gap-1.5", profile?.status === 'online' ? "text-emerald-500" : (profile?.status === 'busy' ? "text-orange-500" : "text-slate-400"))}>
                                             <span className={cn("w-1.5 h-1.5 rounded-full", profile?.status === 'online' ? "bg-emerald-500 animate-pulse" : (profile?.status === 'busy' ? "bg-orange-500" : "bg-slate-300"))} /> 
                                             {profile?.status === 'online' ? "En Ligne" : (profile?.status === 'busy' ? "Occupé" : "Hors Ligne")}
                                          </p>
                                          <h2 className="text-xs font-black italic tracking-tight text-slate-900 mt-0.5">Livra EXPRESS</h2>
                                       </div>
                                       <button onClick={toggleOnline} className={cn("p-2 rounded-xl transition-all shadow-sm", isOnline ? "bg-slate-900 text-white" : "bg-emerald-500 text-white")}>
                                           <Zap className="w-3.5 h-3.5" />
                                       </button>
                                    </div>
                                </div>
                             )}
                             
                             {/* Verification Warning Floating below status */}
                             {profile?.verificationStatus !== 'verified' && (
                                <motion.button 
                                  initial={{ x: -20, opacity: 0 }} 
                                  animate={{ x: 0, opacity: 1 }} 
                                  onClick={() => { setCurrentTab('profile'); navigate('/driver?tab=profile'); }}
                                  className="bg-orange-500 p-3 rounded-2xl flex items-center gap-3 shadow-lg pointer-events-auto border-2 border-white/20"
                                >
                                   <ShieldCheck className="w-4 h-4 text-white" />
                                   <div className="text-left">
                                      <p className="text-[8px] font-black uppercase tracking-widest text-orange-100 leading-none">Dossier Incomplet</p>
                                      <p className="text-[9px] font-bold text-white mt-1">Finalisez KYC</p>
                                   </div>
                                </motion.button>
                             )}
                       </div>

                       {/* Right HUD: Earnings */}
                       <div className="flex flex-col gap-3">
                            <motion.div 
                              initial={{ x: 20, opacity: 0 }} 
                              animate={{ x: 0, opacity: 1 }}
                              className="bg-white/90 backdrop-blur-md border border-slate-200 p-3 px-4 rounded-2xl flex items-center gap-3 shadow-lg pointer-events-auto shadow-emerald-500/5"
                            >
                               <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                                  <DollarSign className="w-4 h-4" />
                               </div>
                               <div>
                                  <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 leading-none mb-1">Gains</p>
                                  <p className="text-sm font-black text-slate-900 leading-none">{dailyEarnings} F</p>
                               </div>
                               <div className="pl-3 border-l border-slate-100 flex flex-col items-center">
                                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse mb-0.5" />
                                  <span className="text-[7px] font-black text-emerald-500">LIVE</span>
                               </div>
                            </motion.div>
                       </div>
                   </div>

                   {/* Footer Info (Active Mission) */}
                   <div className="mt-auto pointer-events-none pb-8">
                       <div className="pointer-events-auto px-4 w-full max-w-sm mx-auto relative">
                          {/* FOCUS MODE BOTTOM SHEET */}
                          {radarMode === 'focus' && focusedJob && !showKeypadFor && (
                             <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className={cn("rounded-3xl p-5 shadow-2xl border relative z-[60]", focusedJob.status === 'picked_up' ? "bg-indigo-50 border-indigo-100" : "bg-white border-slate-100")}>
                                {focusedJob.status === 'accepted' ? (
                                   <>
                                  <div className="flex justify-between items-start mb-4">
                                     <div className="flex-1">
                                        <div className="flex gap-2 items-center mb-1">
                                          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Étape 1 : Collecte</p>
                                          <span className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded text-[8px] font-black tracking-widest">#{focusedJob.id.slice(-4).toUpperCase()}</span>
                                          {userLocation && (
                                             <span className="bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded text-[8px] font-black">
                                                {calculateDistance(userLocation.lat, userLocation.lng, focusedJob.from.lat, focusedJob.from.lng).toFixed(1)} km
                                             </span>
                                          )}
                                        </div>
                                        <h3 className="text-base font-black text-slate-900 leading-tight line-clamp-1">{focusedJob.from.address}</h3>
                                        {focusedJob.from.precision && (
                                           <div className="mt-1 flex items-center gap-1 bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded text-[10px] font-bold w-fit">
                                              <span>📍 {focusedJob.from.precision}</span>
                                           </div>
                                        )}
                                        <div className="flex items-center gap-2 mt-1">
                                           <p className="text-[10px] font-bold text-slate-500 truncate">{focusedJob.clientName}</p>
                                           <span className="text-[10px] text-slate-300">•</span>
                                           <p className="text-[9px] font-bold text-slate-400 uppercase">Trajet: {calculateDistance(focusedJob.from.lat, focusedJob.from.lng, focusedJob.to.lat, focusedJob.to.lng).toFixed(1)} km</p>
                                        </div>
                                     </div>
                                     <div className="flex gap-2">
                                    <button 
                                       onClick={() => {
                                          setChatDeliveryId(focusedJob.id);
                                          setChatOpen(true);
                                       }}
                                       className="w-12 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center hover:bg-indigo-100 transition-all active:scale-95"
                                       title="Chat avec client"
                                    >
                                       <MessageSquare className="w-5 h-5" />
                                    </button>
                                    {focusedJob.isPaid ? (
                                      <button onClick={() => setShowKeypadFor('pickup')} className="flex-1 py-4 bg-slate-900 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all">
                                         Récupéré <Package className="w-4 h-4" />
                                      </button>
                                    ) : (
                                      <div className="flex-1 py-4 bg-orange-50 text-orange-600 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 border border-orange-100 italic">
                                         Attente paiement client
                                      </div>
                                    )}
                                    <button 
                                       onClick={() => {
                                         const target = focusedJob.status === 'accepted' ? focusedJob.from : focusedJob.to;
                                         window.open(`https://www.google.com/maps/dir/?api=1&destination=${target.lat},${target.lng}`, '_blank');
                                       }} 
                                       className="w-12 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center hover:bg-indigo-100 transition-all active:scale-95"
                                       title="Ouvrir GPS"
                                    >
                                       <Navigation className="w-5 h-5" />
                                    </button>
                                    <button onClick={() => cancelJob(focusedJob.id)} className="w-12 h-14 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center hover:text-rose-500 transition-all active:scale-95">
                                       <X className="w-5 h-5" />
                                    </button>
                                  </div>
                               </div>
                            </>
                         ) : (
                               <>
                                  <div className="flex justify-between items-start mb-4">
                                     <div className="flex-1">
                                        <div className="flex gap-2 items-center mb-1">
                                          <p className="text-[9px] font-black uppercase tracking-widest text-indigo-600">Étape 2 : Livraison</p>
                                          <span className="bg-indigo-200 text-indigo-700 px-1.5 py-0.5 rounded text-[8px] font-black tracking-widest">#{focusedJob.id.slice(-4).toUpperCase()}</span>
                                        </div>
                                        <h3 className="text-base font-black text-slate-900 leading-tight line-clamp-1">{focusedJob.to.address}</h3>
                                        {focusedJob.to.precision && (
                                           <div className="mt-1 flex items-center gap-1 bg-rose-50 text-rose-600 px-2 py-0.5 rounded text-[10px] font-bold w-fit">
                                              <span>📍 {focusedJob.to.precision}</span>
                                           </div>
                                        )}
                                        <a href={`tel:${focusedJob.recipientPhone}`} className="text-[10px] font-bold text-slate-500 mt-1 line-clamp-1 hover:text-indigo-600 transition-colors">📞 {focusedJob.recipientPhone || 'Inconnu'}</a>
                                     </div>
                                     <div className="bg-emerald-500 text-white px-3 py-1.5 rounded-xl text-[10px] font-black italic shadow-md shrink-0 ml-2">
                                        {focusedJob.cost} F
                                     </div>
                                  </div>
                                  <button onClick={() => setShowKeypadFor('delivery')} className="w-full py-4 bg-indigo-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all">
                                     Livraison Complète <CheckCircle className="w-4 h-4" />
                                  </button>
                               </>
                            )}
                         </motion.div>
                      )}

                      {/* COMPACT CENTERED KEYPAD MODAL */}
                      {showKeypadFor && (
                         <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 overflow-y-auto">
                            <motion.div 
                               initial={{ scale: 0.9, opacity: 0, y: 20 }} 
                               animate={{ scale: 1, opacity: 1, y: 0 }} 
                               className="bg-white rounded-2xl w-full max-w-[340px] p-6 shadow-2xl relative my-auto"
                            >
                               <button onClick={() => { setShowKeypadFor(null); setEnteredCode(''); }} className="absolute top-4 right-4 w-8 h-8 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 transition-all active:scale-95"><X className="w-4 h-4" /></button>
                               
                               <div className="text-center mb-6">
                                  <div className={cn("w-12 h-12 mx-auto rounded-2xl flex items-center justify-center mb-4 shadow-inner", showKeypadFor === 'delivery' ? 'bg-indigo-50 text-indigo-600' : 'bg-orange-50 text-orange-600')}>
                                     {showKeypadFor === 'delivery' ? <CheckCircle className="w-6 h-6" /> : <Package className="w-6 h-6" />}
                                  </div>
                                  <h2 className="text-xl font-black text-slate-900 tracking-tight">Code {showKeypadFor === 'pickup' ? 'Collecte' : 'Livraison'}</h2>
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Saisissez le code fourni par le client</p>
                               </div>

                               <div className="relative mb-6">
                                  <input 
                                     ref={codeInputRef}
                                     type="text"
                                     value={enteredCode}
                                     onChange={(e) => setEnteredCode(e.target.value.toUpperCase())}
                                     placeholder="EX: 7GZ4"
                                     className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-center text-2xl font-black tracking-[0.2em] text-slate-900 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none uppercase"
                                     maxLength={8}
                                     autoFocus
                                  />
                               </div>
                               
                               <div className="space-y-4">
                                  <input 
                                     type="file" 
                                     accept="image/*" 
                                     capture="environment" 
                                     id="proofImageInput"
                                     className="hidden"
                                     onChange={async (e) => {
                                       const file = e.target.files?.[0];
                                       if (file) {
                                         try {
                                           setToastMessage("Compression de l'image...");
                                           const base64 = await compressImage(file);
                                           setProofImage(base64);
                                           setToastMessage("");
                                         } catch (err: any) {
                                           setToastMessage(err.message || "Erreur lors de la compression");
                                         }
                                       }
                                     }}
                                  />
                                  {!proofImage ? (
                                     <label htmlFor="proofImageInput" className="bg-slate-50 border-2 border-dashed border-slate-200 w-full rounded-2xl py-4 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-slate-100 hover:border-slate-300 transition-all text-slate-400 group">
                                       <Camera className="w-6 h-6 group-hover:text-slate-600" />
                                       <span className="text-[10px] font-black uppercase tracking-widest group-hover:text-slate-700">Preuve Photo (Optionnelle)</span>
                                     </label>
                                  ) : (
                                     <div className="relative w-full h-32 rounded-2xl overflow-hidden border-2 border-indigo-100 group">
                                       <img src={proofImage} alt="Proof" className="w-full h-full object-cover" />
                                       <button onClick={() => setProofImage(null)} className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"><X className="w-6 h-6" /></button>
                                     </div>
                                  )}

                                  <button 
                                     onClick={processJobAction} 
                                     disabled={enteredCode.length < 4 || isProcessingAction} 
                                     className={cn(
                                       "w-full py-5 rounded-2xl text-[12px] font-black uppercase tracking-[0.2em] transition-all active:scale-95 shadow-xl", 
                                       showKeypadFor === 'delivery' ? 'bg-indigo-600 text-white shadow-indigo-600/30 hover:bg-indigo-700' : 'bg-slate-900 text-white shadow-slate-900/30 hover:bg-black',
                                       (enteredCode.length < 4 || isProcessingAction) && 'opacity-30'
                                     )}
                                  >
                                     {isProcessingAction ? 'Traitement...' : 'Confirmer Validation'}
                                  </button>
                               </div>
                            </motion.div>
                         </div>
                      )}

                      {/* SEARCH MODE BOTTOM SHEET (Selected Job) */}
                      {radarMode === 'search' && selectedPendingJob && (
                      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} className="absolute bottom-6 left-4 right-4 bg-white rounded-2xl p-4 sm:p-6 shadow-2xl border border-slate-100 z-[110] max-h-[85vh] overflow-y-auto hide-scrollbar">
                           <div className="flex justify-between items-start mb-4">
                              <div>
                                <div className="flex gap-2">
                                  <span className="px-3 py-1 bg-orange-100 text-orange-600 rounded-full text-[9px] font-black uppercase tracking-widest">
                                    Course Express
                                  </span>
                                  <span className="px-3 py-1 bg-slate-100 text-slate-500 rounded-full text-[9px] font-black uppercase tracking-widest">
                                    #{selectedPendingJob.id.slice(-6).toUpperCase()}
                                  </span>
                                  {userLocation && (
                                    <span className="px-3 py-1 bg-indigo-50 text-indigo-500 rounded-full text-[9px] font-black uppercase tracking-widest">
                                      {calculateDistance(userLocation.lat, userLocation.lng, selectedPendingJob.from.lat, selectedPendingJob.from.lng).toFixed(1)} km
                                    </span>
                                  )}
                                </div>
                                <h3 className="text-3xl font-black italic tracking-tighter text-slate-900 mt-2">{selectedPendingJob.clientProposedPrice || selectedPendingJob.cost} <span className="text-[14px]">FCFA</span>
                                    <span className="ml-4 text-sm font-bold text-slate-400 not-italic tracking-normal">({calculateDistance(selectedPendingJob.from.lat, selectedPendingJob.from.lng, selectedPendingJob.to.lat, selectedPendingJob.to.lng).toFixed(1)} km)</span>
                                 </h3>
                              </div>
                              <button onClick={() => setSelectedPendingJob(null)} className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-500"><X className="w-4 h-4" /></button>
                           </div>
                           
                           <div className="space-y-3 mb-6 relative pl-3">
                              <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-slate-200" />
                              <div className="relative z-10 pl-5">
                                 <div className="absolute left-[-2px] top-1.5 w-2 h-2 rounded-full bg-slate-400" />
                                 <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">Collecte</p>
                                 <p className="text-sm font-bold text-slate-900 truncate">{selectedPendingJob.from.address}</p>
                                 {selectedPendingJob.senderPhone && <a href={`tel:${selectedPendingJob.senderPhone}`} className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:underline block mt-1">📞 Appeler Client</a>}
                              </div>
                              <div className="relative z-10 pl-5">
                                 <div className="absolute left-[-2px] top-1.5 w-2 h-2 rounded-full bg-orange-500" />
                                 <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">Livraison</p>
                                 <p className="text-sm font-bold text-slate-900 truncate">{selectedPendingJob.to.address}</p>
                              </div>
                           </div>

                           <div className="flex gap-2">
                              <button onClick={() => submitBid(selectedPendingJob.id, true)} disabled={isBidding} className={cn("flex-[2] py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-slate-900/20 active:scale-95 transition-all text-center", isBidding ? "opacity-50" : "hover:bg-slate-800")}>
                                 {isBidding ? "..." : "Accepter"}
                              </button>
                               <button onClick={() => {
                                 setBidPrice(selectedPendingJob.clientProposedPrice || selectedPendingJob.cost || 2000);
                                 const dist = calculateDistance(selectedPendingJob.from.lat, selectedPendingJob.from.lng, selectedPendingJob.to.lat, selectedPendingJob.to.lng);
                                 setBidTime(Math.max(15, Math.ceil(dist * 4) + 10)); // realistic default time based on distance
                                 setShowBidForm(true);
                                 setRadarMode('search'); // keep search mode
                              }} disabled={isBidding} className={cn("flex-1 py-4 bg-orange-50 text-orange-600 rounded-2xl text-[10px] font-black uppercase tracking-[0.1em] active:scale-95 transition-all text-center", isBidding ? "opacity-50" : "hover:bg-orange-100")}>
                                 Négocier
                              </button>
                              <button onClick={() => handleRejectJob(selectedPendingJob.id)} className="w-12 h-14 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center hover:bg-rose-100 active:scale-95 transition-all" title="Refuser">
                                 <X className="w-5 h-5" />
                              </button>
                           </div>
                           {/* Quick Bid Inline Expansion */}
                           {showBidForm && (
                              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="mt-4 pt-4 border-t border-slate-100 flex flex-col gap-2">
                                <div className="flex gap-2">
                                  <input type="number" placeholder="FCFA" value={bidPrice} onChange={e => setBidPrice(Number(e.target.value) || '')} className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold" />
                                  <input type="number" placeholder="Min" value={bidTime} onChange={e => setBidTime(Number(e.target.value) || '')} className="w-20 bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold text-center" />
                                </div>
                                <select value={bidReason} onChange={e => setBidReason(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold">
                                  <option value="">Sélectionner un motif...</option>
                                  <option value="Distance trop longue">Distance trop longue</option>
                                  <option value="Trafic dense dans la zone">Trafic dense dans la zone</option>
                                  <option value="Charge encombrante/lourde">Charge encombrante/lourde</option>
                                  <option value="Heure de pointe">Heure de pointe</option>
                                  <option value="Autre">Autre</option>
                                </select>
                                <button onClick={() => submitBid(selectedPendingJob.id)} className="w-full px-4 py-3 bg-orange-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest mt-2">Envoyer l'offre</button>
                              </motion.div>
                           )}
                        </motion.div>
                      )}

                   </div>
                </div>
              </div>

                 {/* OVERLAY PENDING MISSIONS LIST */}
                 {radarMode === 'search' && !selectedPendingJob && filteredPendingJobs.length > 0 && (
                    <motion.div 
                      initial={{ y: 100, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      className="absolute bottom-8 left-4 right-4 z-[40] max-w-lg mx-auto"
                    >
                      <div className="flex overflow-x-auto gap-4 pb-4 snap-x hide-scrollbar">
                        <AnimatePresence>
                          {filteredPendingJobs.map((job, index) => (
                             <motion.div 
                               key={job.id} 
                               initial={{ x: 50, opacity: 0 }}
                               animate={{ x: 0, opacity: 1 }}
                               transition={{ delay: index * 0.1 }}
                               onClick={() => setSelectedPendingJob(job)} 
                               className="bg-white rounded-2xl p-4 shadow-xl border border-slate-100 min-w-[260px] snap-center shrink-0 active:scale-95 transition-all relative group"
                             >
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRejectJob(job.id);
                                  }}
                                  className="absolute -top-1 -right-1 w-6 h-6 bg-rose-500 text-white rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                                <div className="flex justify-between items-center mb-3">
                                   <div className="flex gap-1.5">
                                     <span className="px-1.5 py-0.5 bg-orange-100 text-orange-600 rounded text-[8px] font-black italic tracking-widest">#{job.id.slice(-4).toUpperCase()}</span>
                                     {job.isUrgent && <Zap className="w-3 h-3 text-rose-500 fill-rose-500" />}
                                   </div>
                                   <span className="text-sm font-black text-slate-900">{job.clientProposedPrice || job.cost} F</span>
                                </div>
                                <div className="space-y-1.5 border-l-2 border-slate-100 ml-1 pl-3 relative">
                                   <div className="absolute -left-[5px] top-1 w-2 h-2 rounded-full bg-slate-300" />
                                   <p className="text-[10px] font-bold text-slate-500 truncate">{job.from.address}</p>
                                   <div className="absolute -left-[5px] bottom-1 w-2 h-2 rounded-full bg-indigo-500" />
                                   <p className="text-[10px] font-bold text-slate-900 truncate">{job.to.address}</p>
                                </div>
                             </motion.div>
                          ))}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                 )}

                 {!isOnline && (
                    <motion.div 
                      initial={{ y: 50, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      className="absolute bottom-8 left-1/2 -translate-x-1/2 w-full max-w-sm px-4 z-[40]"
                    >
                      <div className="bg-slate-900/95 backdrop-blur-xl p-5 rounded-3xl shadow-2xl border border-slate-800 flex flex-col items-center justify-between gap-4 pointer-events-auto">
                        <div className="flex items-center gap-3 w-full">
                          <div className="w-10 h-10 bg-rose-500/10 text-rose-400 rounded-full flex items-center justify-center shrink-0">
                            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                          </div>
                          <div className="text-left flex-1">
                            <h4 className="text-white text-xs font-black uppercase tracking-wider">Vous êtes Hors Ligne</h4>
                            <p className="text-[10px] text-slate-400 mt-0.5 leading-normal">
                              Activez votre statut pour recevoir les requêtes de livraison.
                            </p>
                          </div>
                        </div>
                        <button 
                          onClick={toggleOnline} 
                          className="w-full px-5 py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-lg shadow-emerald-500/25 active:scale-95 transition-all text-center cursor-pointer"
                        >
                          Passer En Ligne
                        </button>
                      </div>
                    </motion.div>
                 )}

                 {isOnline && filteredPendingJobs.length === 0 && activeJobs.length === 0 && !selectedPendingJob && (
                    <motion.div 
                      initial={{ y: 50, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      className="absolute bottom-8 left-1/2 -translate-x-1/2 w-full max-w-sm px-4 z-[40]"
                    >
                      <div className="bg-slate-900/90 backdrop-blur-xl p-4 rounded-3xl shadow-2xl border border-slate-800 flex flex-col items-center gap-3 pointer-events-auto">
                        <div className="flex items-center gap-3 w-full">
                          <div className="relative w-10 h-10 shrink-0 bg-indigo-500/10 text-indigo-400 rounded-full flex items-center justify-center">
                            <div className="absolute inset-0 rounded-full border border-indigo-500/35 animate-ping opacity-75" />
                            <Compass className="w-4 h-4 animate-spin-slow" />
                          </div>
                          <div className="text-left flex-1">
                            <h4 className="text-white text-[11px] font-black uppercase tracking-wider flex items-center gap-2">
                              <span>Radar Actif (En Ligne)</span>
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            </h4>
                            <p className="text-[9px] text-slate-400 mt-0.5 leading-normal">
                              Recherche de commandes à proximité de votre position...
                            </p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                 )}
             </motion.div>
          )}

          {/* HISTORY TAB */}
          {currentTab === 'history' && (
             <motion.div key="history" initial={{opacity:0, scale: 0.98}} animate={{opacity:1, scale: 1}} exit={{opacity:0}} className="absolute inset-0 overflow-y-auto pb-32 px-6 pt-12 bg-slate-50">
                <div className="flex items-center gap-4 mb-8">
                   <button onClick={() => { setCurrentTab('radar'); navigate('/driver'); }} className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-slate-400 border border-slate-100 shadow-sm active:scale-90 transition-all">
                      <ArrowLeft className="w-5 h-5" />
                   </button>
                   <h1 className="text-4xl font-black italic tracking-tighter text-slate-900"><span className="text-indigo-600">Historique</span>.</h1>
                </div>
                
                <div className="space-y-4">
                  {deliveredJobs.length === 0 ? (
                    <div className="bg-white rounded-3xl p-5 lg:p-6 text-center border border-slate-200">
                      <HistoryIcon className="w-10 h-10 text-slate-300 mx-auto mb-4" />
                      <p className="text-sm font-bold text-slate-500">Aucune mission terminée.</p>
                    </div>
                  ) : (
                    deliveredJobs.map(job => {
                      const logo = getPaymentLogo(job.paymentMethod);
                      return (
                        <div key={job.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 group hover:shadow-md transition-all">
                           <div className="flex justify-between items-center mb-3">
                              <div className="flex items-center gap-2">
                                 <div className={cn(
                                   "w-8 h-8 rounded-lg flex items-center justify-center text-indigo-600 overflow-hidden shrink-0",
                                   logo ? "bg-white p-1 border border-slate-100" : "bg-indigo-50"
                                 )}>
                                    {logo ? (
                                      <img src={logo} alt={job.paymentMethod || ''} className="w-full h-full object-contain" />
                                    ) : (
                                      <Package className="w-4 h-4" />
                                    )}
                                 </div>
                                 <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                   {(() => {
                                     if (!job.createdAt) return '-';
                                     let dDate;
                                     if (typeof (job.createdAt as any).toDate === 'function') {
                                       dDate = (job.createdAt as any).toDate();
                                     } else {
                                       dDate = new Date(job.createdAt);
                                     }
                                     return isNaN(dDate.getTime()) ? '-' : dDate.toLocaleDateString('fr-FR');
                                   })()}
                                 </span>
                              </div>
                              <span className="text-xs font-black text-emerald-600">+{job.cost} F</span>
                           </div>
                           <div className="space-y-1.5 border-l-2 border-slate-100 ml-4 pl-4 relative">
                              <div className="absolute -left-[5px] top-1 w-2 h-2 rounded-full bg-slate-300" />
                              <p className="text-[11px] font-medium text-slate-500 truncate">{job.from.address}</p>
                              <div className="absolute -left-[5px] bottom-1 w-2 h-2 rounded-full bg-indigo-500" />
                              <p className="text-[11px] font-bold text-slate-900 truncate">{job.to.address}</p>
                           </div>
                        </div>
                      );
                    })
                  )}
                </div>
             </motion.div>
          )}

          {/* WALLET TAB */}
          {currentTab === 'wallet' && (
             <motion.div key="wallet" initial={{opacity:0, scale: 0.98}} animate={{opacity:1, scale: 1}} exit={{opacity:0}} className="absolute inset-0 overflow-y-auto pb-32 px-6 pt-12 bg-slate-50">
                <div className="flex items-center gap-4 mb-8">
                   <button onClick={() => { setCurrentTab('radar'); navigate('/driver'); }} className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-slate-400 border border-slate-100 shadow-sm active:scale-90 transition-all">
                      <ArrowLeft className="w-5 h-5" />
                   </button>
                   <h1 className="text-4xl font-black italic tracking-tighter text-slate-900">Mon <span className="text-indigo-600">Portefeuille.</span></h1>
                </div>
                
                <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-xl shadow-slate-200 mb-8 relative overflow-hidden">
                   <div className="absolute right-0 top-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-[40px] -mr-16 -mt-16" />
                   <div className="flex justify-between items-start mb-6">
                      <div>
                        <p className="text-[9px] uppercase tracking-[0.2em] font-black text-slate-400 mb-1 flex items-center gap-2">Solde Disponible</p>
                        <div className="flex items-baseline gap-1">
                          <h2 className="text-4xl font-black tracking-tight">{earnings.toLocaleString('fr-FR')}</h2>
                          <span className="text-sm font-bold text-slate-500">FCFA</span>
                        </div>
                      </div>
                      <div className="w-10 h-10 bg-white/5 rounded-2xl flex items-center justify-center">
                         <Wallet className="w-5 h-5 text-indigo-400" />
                      </div>
                   </div>
                   
                   <button onClick={() => setIsWithdrawalModalOpen(true)} disabled={profile?.withdrawalRequested || earnings < 500} className="w-full py-4 bg-indigo-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.15em] shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-all disabled:opacity-30 flex items-center justify-center gap-2 active:scale-95">
                      {profile?.withdrawalRequested ? (
                         <> <Zap className="w-3 h-3 animate-pulse" /> Traitement... </>
                      ) : (
                         <> <ArrowRight className="w-3 h-3" /> Demander un retrait </>
                      )}
                   </button>
                </div>

                <div className="flex gap-4 mb-8">
                   <div className="flex-1 bg-white p-4 rounded-3xl border border-slate-100 flex flex-col items-center justify-center text-center">
                      <div className="w-10 h-10 bg-orange-50 rounded-full flex items-center justify-center text-orange-500 mb-2">
                         <span className="font-bold text-xs">MM</span>
                      </div>
                      <p className="text-[9px] font-black uppercase text-slate-400">Orange / MTN</p>
                   </div>
                   <div className="flex-1 bg-white p-4 rounded-3xl border border-slate-100 flex flex-col items-center justify-center text-center">
                      <div className="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-500 mb-2">
                         <DollarSign className="w-5 h-5" />
                      </div>
                      <p className="text-[9px] font-black uppercase text-slate-400">Cash Direct</p>
                   </div>
                </div>

                <p className="text-[10px] uppercase tracking-widest font-black text-slate-400 mb-4 px-2">Évolution Hebdomadaire</p>
                <div className="bg-white rounded-2xl border border-slate-100 p-6 h-56 min-h-[224px] mb-8 shadow-sm">
                   <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                      <LineChart data={mockChartData}>
                        <Line type="monotone" dataKey="amount" stroke="#4f46e5" strokeWidth={4} dot={{ r: 4, fill: '#4f46e5', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                        <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', fontWeight: 'bold' }} />
                      </LineChart>
                   </ResponsiveContainer>
                </div>
                
                <div className="bg-orange-50 rounded-3xl p-6 border border-orange-100 flex items-start gap-4">
                  <Info className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-black text-orange-800 mb-1">Commission actuelle</h4>
                    <p className="text-xs font-medium text-orange-600">Vous conservez {commissionSettings?.driverSharePercent || 85}% des revenus générés sur vos courses.</p>
                  </div>
                </div>
             </motion.div>
          )}

          {/* PROFILE TAB */}
          {currentTab === 'profile' && (
             <motion.div key="profile" initial={{opacity:0, scale: 0.98}} animate={{opacity:1, scale: 1}} exit={{opacity:0}} className="absolute inset-0 overflow-y-auto pb-32 px-6 pt-12 bg-slate-50">
                <div className="flex items-center gap-4 mb-8">
                   <button onClick={() => { setCurrentTab('radar'); navigate('/driver'); }} className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-slate-400 border border-slate-100 shadow-sm active:scale-90 transition-all">
                      <ArrowLeft className="w-5 h-5" />
                   </button>
                   <h1 className="text-4xl font-black italic tracking-tighter text-slate-900"><span className="text-indigo-600">Profil</span>.</h1>
                </div>
                
                 <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex items-center gap-6 mb-8">
                    <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 border-4 border-slate-50 shadow-inner overflow-hidden">
                       {profile?.photoURL ? <img src={profile.photoURL} alt="Profil" className="w-full h-full object-cover" /> : <User className="w-8 h-8" />}
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-slate-900">{profile?.displayName || profile?.name}</h3>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1 flex items-center gap-2">
                        {profile?.vehicleType || 'Livreur'} • ⭐ {profile?.performanceScore ? (profile.performanceScore / 20).toFixed(1) : '5.0'}
                      </p>
                      <div className="mt-2 flex gap-2">
                        <button 
                          onClick={() => setIsWithdrawalModalOpen(true)}
                          className="px-2 py-1 bg-orange-100 text-orange-600 rounded-md text-[8px] font-black uppercase hover:bg-orange-200 transition-colors"
                        >
                          Demander un retrait
                        </button>
                        <span className="px-2 py-1 bg-indigo-50 text-indigo-600 rounded-md text-[8px] font-black uppercase">Vérifié</span>
                      </div>
                    </div>
                 </div>

                 {/* Stats Grid */}
                 <div className="grid grid-cols-2 gap-4 mb-8">
                    <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
                       <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1 leading-none">Annulations</p>
                       <p className="text-2xl font-black text-slate-900 leading-none">{profile?.cancellationRate || 0}%</p>
                       <div className="w-full h-1 bg-slate-100 mt-3 rounded-full overflow-hidden">
                          <div className="h-full bg-rose-500" style={{ width: `${profile?.cancellationRate || 5}%` }} />
                       </div>
                    </div>
                    <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
                       <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1 leading-none">Score Global</p>
                       <p className="text-2xl font-black text-slate-900 leading-none">{profile?.performanceScore || 100}/100</p>
                       <div className="w-full h-1 bg-slate-100 mt-3 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500" style={{ width: `${profile?.performanceScore || 95}%` }} />
                       </div>
                    </div>
                 </div>

                 {/* Gains Journaliers */}
                 <div className="bg-slate-900 rounded-2xl p-6 text-white mb-8 relative overflow-hidden">
                    <div className="relative z-10">
                       <div className="flex justify-between items-center mb-4">
                          <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Gains du jour</h4>
                          <DollarSign className="w-4 h-4 text-emerald-500" />
                       </div>
                       <p className="text-3xl font-black mb-1">{dailyEarnings} F</p>
                       <p className="text-[10px] font-bold text-slate-400 mt-2 italic text-left">Chaque course complète s'ajoute ici instantanément.</p>
                       <button 
                         onClick={() => setIsWithdrawalModalOpen(true)}
                         className="mt-6 w-full py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2"
                       >
                         <DollarSign className="w-3.5 h-3.5" />
                         Demander un retrait
                       </button>
                    </div>
                    {/* Decorative radial gradient */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/20 rounded-full blur-[60px] translate-x-1/2 -translate-y-1/2" />
                 </div>

                {/* Badges Section */}
                <div className="mb-8">
                   <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4 px-2">Performances & Badges</h3>
                   <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar px-2 -mx-2">
                      <div className="bg-orange-50 shrink-0 w-32 rounded-2xl p-4 border border-orange-100/50 flex flex-col items-center text-center">
                         <div className="w-12 h-12 bg-orange-100 text-orange-500 rounded-full flex items-center justify-center mb-3">
                            <Zap className="w-6 h-6" />
                         </div>
                         <span className="text-[10px] font-black uppercase text-orange-800">Top Livreur</span>
                         <span className="text-[9px] font-bold text-orange-600/70 mt-1">Quartier ZAD</span>
                      </div>
                      <div className="bg-indigo-50 shrink-0 w-32 rounded-2xl p-4 border border-indigo-100/50 flex flex-col items-center text-center">
                         <div className="w-12 h-12 bg-indigo-100 text-indigo-500 rounded-full flex items-center justify-center mb-3">
                            <CheckCircle className="w-6 h-6" />
                         </div>
                         <span className="text-[10px] font-black uppercase text-indigo-800">100 Courses</span>
                         <span className="text-[9px] font-bold text-indigo-600/70 mt-1">Sans incident</span>
                      </div>
                   </div>
                </div>

                <div className="space-y-4">
                  <button onClick={() => setIsVerificationModalOpen(true)} className="w-full bg-white rounded-3xl p-5 shadow-sm border border-slate-100 flex items-center justify-between hover:bg-slate-50">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-500"><ShieldCheck className="w-5 h-5"/></div>
                      <div>
                        <span className="font-bold text-slate-700 block text-left">Documents & Vérification</span>
                        {profile?.verificationStatus === 'pending' && <span className="bg-orange-100 text-orange-600 px-2 py-0.5 rounded text-[8px] font-black uppercase inline-block">En attente</span>}
                        {profile?.verificationStatus === 'verified' && <span className="bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded text-[8px] font-black uppercase inline-block">Vérifié</span>}
                        {!profile?.verificationStatus && <span className="bg-slate-100 text-slate-400 px-2 py-0.5 rounded text-[8px] font-black uppercase inline-block">Non configuré</span>}
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                  </button>
                  <button onClick={() => signOut()} className="w-full bg-rose-50 rounded-3xl p-5 border border-rose-100 flex items-center justify-between text-rose-600 hover:bg-rose-100 mt-8">
                     <span className="font-black uppercase tracking-widest text-[12px]">Déconnexion</span>
                  </button>
                </div>
             </motion.div>
          )}

        </AnimatePresence>

        {/* VERIFICATION MODAL */}
        <AnimatePresence>
          {isVerificationModalOpen && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center">
              <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="bg-white w-full max-w-md rounded-t-[40px] sm:rounded-3xl p-5 lg:p-6 max-h-[90vh] overflow-y-auto">
                 <div className="flex justify-between items-center mb-8">
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">Vérification Sécurisée</h3>
                    <button onClick={() => setIsVerificationModalOpen(false)} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500"><X className="w-5 h-5" /></button>
                 </div>

                 <div className="space-y-6 mb-8">
                    <div>
                       <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Identité du Guaranteur (Référence physique)</label>
                       <input 
                          type="text" 
                          placeholder="Nom complet du garant" 
                          value={verificationForm.guarantorName} 
                          onChange={e => setVerificationForm({...verificationForm, guarantorName: e.target.value})}
                          className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm font-bold focus:border-indigo-500 outline-none"
                       />
                       <input 
                          type="tel" 
                          placeholder="Téléphone du garant" 
                          value={verificationForm.guarantorPhone} 
                          onChange={e => setVerificationForm({...verificationForm, guarantorPhone: e.target.value})}
                          className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm font-bold focus:border-indigo-500 outline-none mt-2"
                       />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Pièce d'identité</label>
                          <div className={cn("relative h-32 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center overflow-hidden", verificationForm.cniFront ? 'border-indigo-500' : '')}>
                             {verificationForm.cniFront ? (
                                <img src={verificationForm.cniFront} className="w-full h-full object-cover" />
                             ) : (
                                <Camera className="w-6 h-6 text-slate-300" />
                             )}
                             <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={async e => {
                                const file = e.target.files?.[0];
                                if (file) {
                                   try {
                                     setToastMessage("Compression de l'image...");
                                     const base64 = await compressImage(file);
                                     setVerificationForm({...verificationForm, cniFront: base64});
                                     setToastMessage("");
                                   } catch (err: any) {
                                     setToastMessage(err.message || "Erreur de traitement de l'image");
                                   }
                                }
                             }} />
                          </div>
                       </div>
                       <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Casier Judiciaire</label>
                          <div className={cn("relative h-32 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center overflow-hidden", verificationForm.criminalRecord ? 'border-indigo-500' : '')}>
                             {verificationForm.criminalRecord ? (
                                <div className="text-emerald-500 flex flex-col items-center">
                                   <FileCheck className="w-8 h-8" />
                                   <span className="text-[8px] font-bold mt-1">AJOUTÉ</span>
                                </div>
                             ) : (
                                <FileText className="w-6 h-6 text-slate-300" />
                             )}
                             <input type="file" accept="image/*,application/pdf" className="absolute inset-0 opacity-0 cursor-pointer" onChange={async e => {
                                const file = e.target.files?.[0];
                                if (file) {
                                   try {
                                     setToastMessage("Compression du fichier...");
                                     const base64 = await compressImage(file);
                                     setVerificationForm({...verificationForm, criminalRecord: base64});
                                     setToastMessage("");
                                   } catch (err: any) {
                                     setToastMessage(err.message || "Erreur de traitement du fichier");
                                   }
                                }
                             }} />
                          </div>
                       </div>
                    </div>
                 </div>

                 <div className="bg-indigo-50 rounded-2xl p-4 border border-indigo-100 flex items-start gap-3 mb-8">
                    <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                    <p className="text-[11px] font-medium text-indigo-700 leading-relaxed">
                       Ces informations sont strictement confidentielles. Elles permettent de certifier votre compte et de protéger la plateforme contre les incidents.
                    </p>
                 </div>

                 <button 
                  onClick={handleVerificationSubmit}
                  disabled={!verificationForm.guarantorName || !verificationForm.guarantorPhone || !verificationForm.cniFront || isProcessingAction}
                  className="w-full py-5 bg-indigo-600 text-white rounded-2xl text-[12px] font-black uppercase tracking-[0.2em] shadow-xl shadow-indigo-200 disabled:opacity-50 active:scale-95 transition-all"
                 >
                    {isProcessingAction ? 'Envoi en cours...' : 'Soumettre mon dossier'}
                 </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isWithdrawalModalOpen && (
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-[150] flex items-center justify-center p-6 pb-32">
              <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsWithdrawalModalOpen(false)} />
              <motion.div initial={{scale:0.95, opacity:0, y:20}} animate={{scale:1, opacity:1, y:0}} exit={{scale:0.95, opacity:0, y:20}} className="bg-white rounded-3xl p-6 w-full max-w-sm relative z-10 shadow-2xl flex flex-col gap-6">
                 <div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tighter mb-2">Montant du retrait</h2>
                    <p className="text-xs text-slate-500">Combien souhaitez-vous retirer ? (Solde max: {earnings} FCFA)</p>
                 </div>
                 
                 <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                       <span className="text-slate-400 font-bold">FCFA</span>
                    </div>
                    <input 
                      type="number"
                      value={withdrawalAmountInput}
                      onChange={e => setWithdrawalAmountInput(e.target.value)}
                      placeholder="Ex: 5000"
                      className="w-full pl-16 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-xl font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all placeholder:text-slate-300 placeholder:font-medium"
                    />
                 </div>
                 
                 <div className="flex gap-4">
                    <button onClick={() => setIsWithdrawalModalOpen(false)} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition-colors">
                      Annuler
                    </button>
                    <button onClick={handleWithdrawal} disabled={isWithdrawing || !withdrawalAmountInput || Number(withdrawalAmountInput) < 500 || Number(withdrawalAmountInput) > earnings} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 disabled:opacity-50">
                      Confirmer
                    </button>
                 </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {toastMessage && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[200] px-6 py-3 bg-slate-900/90 backdrop-blur-md border border-slate-700 text-white rounded-full text-[10px] font-black uppercase tracking-[0.15em] shadow-2xl flex items-center gap-3">
           <Zap className="w-4 h-4 text-orange-500" />
           {toastMessage}
        </div>
      )}
     {profile && chatDeliveryId && (
        <Chat 
           deliveryId={chatDeliveryId} 
           currentUser={profile} 
           isOpen={chatOpen} 
           onClose={() => setChatOpen(false)} 
        />
      )}
    </div>
  );
}
