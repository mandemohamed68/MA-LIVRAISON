import React, { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, setDoc, deleteDoc, getDocs, addDoc, writeBatch } from 'firebase/firestore';
import { DeliveryRequest, UserProfile, UserRole, CommissionSettings, AppConfig } from '../types';
import { 
  ShieldCheck, Package, Users, Truck, DollarSign, 
  ArrowUpRight, Clock, LayoutDashboard, MessageSquare, 
  ClipboardCheck, History, Store, Map as MapIcon, Globe, 
  BadgePercent, CreditCard, Wallet, LogOut, Bell, Settings, 
  Plus, Navigation, UserCircle, Percent, Database, Download, Building2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Navigate } from 'react-router-dom';

import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';

export default function AdminDashboard() {
  const { profile, updateRole, logout, isMasterAdmin } = useAuth();
  const navigate = useNavigate();
  const [deliveries, setDeliveries] = useState<DeliveryRequest[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [commission, setCommission] = useState<CommissionSettings | null>(null);
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeMenu, setActiveMenu] = useState('Vue d\'ensemble');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // Only subscribe if we have a valid admin profile
    const isAdmin = isMasterAdmin || profile?.role === 'admin' || profile?.role === 'superadmin';
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    const handleError = (collectionName: string) => (error: any) => {
      console.warn(`Permission error on ${collectionName}:`, error.message);
      // We don't want to crash, so we just log it. 
      // If it's a critical failure, we could show a UI state.
    };

    const unsubDeliveries = onSnapshot(
      query(collection(db, 'deliveries'), orderBy('createdAt', 'desc')), 
      (snap) => {
        setDeliveries(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as DeliveryRequest)));
      },
      handleError('deliveries')
    );

    const unsubUsers = onSnapshot(
      collection(db, 'users'), 
      (snap) => {
        setUsers(snap.docs.map(doc => ({ userId: doc.id, ...doc.data() } as UserProfile)));
      },
      handleError('users')
    );

    const unsubCommission = onSnapshot(
      doc(db, 'settings', 'commissions'), 
      (snap) => {
        if (snap.exists()) {
          setCommission(snap.data() as CommissionSettings);
        } else {
          const defaults: CommissionSettings = {
            id: 'global_config',
            platformFeePercent: 15,
            driverSharePercent: 85,
            minDeliveryCost: 500,
            insuranceFeePercent: 2,
            tarifKm: 150,
            tarifPoids: 100,
            fraisFixes: 500,
            minRatioClient: 0.7,
            maxRatioLivreur: 2.0,
            updatedAt: new Date().toISOString(),
            updatedBy: 'system'
          };
          setDoc(doc(db, 'settings', 'commissions'), defaults);
        }
        setLoading(false);
      },
      handleError('commissions')
    );

    const unsubConfig = onSnapshot(
      doc(db, 'settings', 'app_config'), 
      (snap) => {
        if (snap.exists()) {
          setAppConfig(snap.data() as AppConfig);
        } else {
          const defaults: AppConfig = {
            mode: 'test',
            updatedAt: new Date().toISOString()
          };
          setDoc(doc(db, 'settings', 'app_config'), defaults);
        }
      },
      handleError('app_config')
    );

    return () => {
      unsubDeliveries();
      unsubUsers();
      unsubCommission();
      unsubConfig();
    };
  }, [profile, isMasterAdmin]);

  const handleUpdateCommission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commission) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'settings', 'commissions'), {
        ...commission,
        updatedAt: new Date().toISOString(),
        updatedBy: profile?.userId || 'admin'
      });
      console.log('Paramètres mis à jour avec succès !');
    } catch (error) {
      console.error('Error updating commission:', error);
      console.log('Erreur lors de la mise à jour.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleMode = async () => {
    if (!appConfig) return;
    const newMode = appConfig.mode === 'test' ? 'prod' : 'test';
    try {
      await updateDoc(doc(db, 'settings', 'app_config'), {
        mode: newMode,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error updating mode:', error);
    }
  };

  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetCode, setResetCode] = useState('');

  const executeHardReset = async () => {
    if (resetCode.trim().toUpperCase() !== 'RESET') {
      alert("Veuillez taper exactement 'RESET' pour confirmer.");
      return;
    }
    
    try {
      setIsSaving(true);
      const promises: Promise<void>[] = [];

      // 1. Delete all Tracking & Bids for each delivery, then the delivery itself
      // Use local variable to avoid issues if state updates during loop
      const deliveriesToDelete = [...deliveries];
      
      for (const delivery of deliveriesToDelete) {
        try {
          const bidsSnap = await getDocs(collection(db, 'deliveries', delivery.id, 'bids'));
          bidsSnap.forEach(b => promises.push(deleteDoc(b.ref)));
          
          const trackSnap = await getDocs(collection(db, 'deliveries', delivery.id, 'tracking'));
          trackSnap.forEach(t => promises.push(deleteDoc(t.ref)));

          const msgSnap = await getDocs(collection(db, `deliveries/${delivery.id}/messages`));
          msgSnap.forEach(m => promises.push(deleteDoc(m.ref)));

          promises.push(deleteDoc(doc(db, 'deliveries', delivery.id)));
        } catch (e) {
          console.warn(`Could not delete delivery ${delivery.id}:`, e);
        }
      }

      // 2. Delete all Messages
      // Messages are now subcollections of deliveries, so they are deleted per delivery above
      
      // Wait, we need to add the messages deletion correctly inside the delivery loop:
      // Done below

      // 3. Delete non-admin Users
      const usersToDelete = [...users];
      for (const user of usersToDelete) {
        if (user.role !== 'admin' && user.role !== 'superadmin' && user.email !== 'mandemohamed68@gmail.com') {
          promises.push(deleteDoc(doc(db, 'users', user.userId)));
        }
      }

      await Promise.all(promises);
      
      alert("Hard Reset terminé avec succès. Toutes les données (sauf admins) ont été effacées.");
      setShowResetConfirm(false);
    } catch (err) {
      console.error(err);
      alert("Une erreur est survenue lors du hard reset. Vérifiez la console.");
    } finally {
      setIsSaving(false);
      setResetCode('');
    }
  };

  const chartData = [
    { name: 'Lun', express: 120, standard: 80 },
    { name: 'Mar', express: 150, standard: 90 },
    { name: 'Mer', express: 180, standard: 110 },
    { name: 'Jeu', express: 190, standard: 95 },
    { name: 'Ven', express: 210, standard: 130 },
    { name: 'Sam', express: 250, standard: 160 },
    { name: 'Dim', express: 160, standard: 70 },
  ];

  const handlePayDriver = async (driverId: string, deliveryIds: string[]) => {
    if (!deliveryIds.length) return;
    try {
      const batch = writeBatch(db);
      const timestamp = new Date().toISOString();
      deliveryIds.forEach(id => {
        batch.update(doc(db, 'deliveries', id), {
          paidToDriver: true,
          paidToDriverAt: timestamp
        });
      });
      
      // Also reset the withdrawal requested flag for this user
      batch.update(doc(db, 'users', driverId), {
        withdrawalRequested: false,
        withdrawalAmount: 0,
        updatedAt: timestamp
      });

      await batch.commit();
      alert('Paiement enregistré avec succès');
    } catch (e) {
      console.error(e);
      alert('Erreur lors du paiement');
    }
  };

  const sidebarItems = [
    { group: 'GÉNÉRAL', items: [
      { name: 'Vue d\'ensemble', icon: LayoutDashboard },
      { name: 'Support Chat', icon: MessageSquare },
    ]},
    { group: 'LOGISTIQUE', items: [
      { name: 'En cours', icon: Navigation },
      { name: 'En attente', icon: Clock },
      { name: 'Programmées', icon: History },
      { name: 'Historique', icon: ClipboardCheck },
    ]},
    { group: 'FLOTTE & RÉSEAU', items: [
      { name: 'Carte Live (GPS)', icon: MapIcon },
      { name: 'Livreurs (Zems)', icon: Truck },
      { name: 'Clients', icon: Users },
      { name: 'Secteurs d\'Ouaga', icon: Globe },
    ]},
    { group: 'FINANCES', items: [
      { name: 'Modèle Éco', icon: BadgePercent },
      { name: 'Transactions', icon: CreditCard },
      { name: 'Paiements Livreurs', icon: Wallet },
      { name: 'Commissions', icon: Percent },
    ]},
    { group: 'SYSTÈME & DATA', items: [
      { name: 'Base de Données', icon: Database },
    ]},
  ];

  const rolesList: { id: UserRole, label: string }[] = [
    { id: 'superadmin', label: 'SUPER ADMIN' },
    { id: 'admin', label: 'ADMINISTRATEUR' },
    { id: 'client', label: 'CLIENT' },
    { id: 'driver', label: 'LIVREUR' },
  ];

  const [selectedChatDeliveryId, setSelectedChatDeliveryId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [adminMessage, setAdminMessage] = useState('');

  // Fetch all active chats by checking deliveries that have lastMessageAt
  const chatDeliveries = deliveries
    .filter(d => Boolean(d.lastMessageAt))
    .sort((a, b) => (b.lastMessageAt || '').localeCompare(a.lastMessageAt || ''));

  useEffect(() => {
    if (!selectedChatDeliveryId) return;
    const q = query(collection(db, `deliveries/${selectedChatDeliveryId}/messages`), orderBy('timestamp', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      setChatMessages(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, [selectedChatDeliveryId]);

  const handleSendAdminMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminMessage.trim() || !selectedChatDeliveryId || !profile) return;
    try {
      await addDoc(collection(db, `deliveries/${selectedChatDeliveryId}/messages`), {
        senderId: profile.userId,
        text: adminMessage,
        timestamp: new Date().toISOString()
      });
      await updateDoc(doc(db, 'deliveries', selectedChatDeliveryId), {
         lastMessageAt: new Date().toISOString(),
         updatedAt: new Date().toISOString()
      });
      setAdminMessage('');
    } catch (e) {
      console.error(e);
    }
  };

  const renderContent = () => {
    switch (activeMenu) {
      case 'Vue d\'ensemble':
        return (
          <div className="space-y-8">
            {/* Watchtower Alerts Section */}
            {deliveries.filter(d => d.sosAlert || d.isWeatherPaused).length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {deliveries.filter(d => d.sosAlert).map(alert => (
                  <div key={alert.id} className="bg-red-500 rounded-3xl p-6 text-white shadow-xl shadow-red-500/20 flex flex-col gap-4 animate-pulse">
                     <div className="flex justify-between items-start">
                        <span className="text-[10px] font-black uppercase tracking-widest bg-white/20 px-3 py-1 rounded-lg">SOS URGENCE</span>
                        <span className="font-bold">Course {alert.id.slice(0,4)}</span>
                     </div>
                     <p className="font-medium text-sm leading-tight">Le livreur a déclenché une alerte. Merci de le contacter immédiatement.</p>
                     <div className="flex gap-2 mt-2">
                        <a href={`tel:${alert.driverId}`} className="px-4 py-2 bg-white text-red-600 rounded-xl text-xs font-black uppercase tracking-widest text-center flex-1">
                          Appeler Livreur
                        </a>
                     </div>
                  </div>
                ))}
                {deliveries.filter(d => d.isWeatherPaused).map(alert => (
                  <div key={alert.id} className="bg-blue-600 rounded-3xl p-6 text-white shadow-xl shadow-blue-500/20 flex flex-col gap-4">
                     <div className="flex justify-between items-start">
                        <span className="text-[10px] font-black uppercase tracking-widest bg-white/20 px-3 py-1 rounded-lg">PAUSE MÉTÉO</span>
                        <span className="font-bold">Course {alert.id.slice(0,4)}</span>
                     </div>
                     <p className="font-medium text-sm leading-tight">Le livreur s'est abrité en raison de la pluie. L'expéditeur a été notifié.</p>
                     <button className="px-4 py-2 bg-white text-blue-600 rounded-xl text-xs font-black uppercase tracking-widest text-center">
                        Contacter Expéditeur
                     </button>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {[
                { label: 'CLIENTS ACTIFS', value: users.filter(u => u.role === 'client').length, icon: Users, color: 'text-blue-500', trend: '+12%' },
                { label: 'COURSES TOTALES', value: deliveries.length, icon: Package, color: 'text-orange-500', trend: '+5%' },
                { label: 'VOLUME D\'AFFAIRES', value: `${deliveries.reduce((acc, curr) => acc + (curr.cost || 0), 0).toLocaleString()} FCFA`, icon: DollarSign, color: 'text-emerald-500', trend: '+18%' },
                { label: 'ZEMS EN SERVICE', value: users.filter(u => u.role === 'driver' && u.status === 'online').length, icon: Truck, color: 'text-indigo-500', trend: 'LIVE' },
              ].map((stat) => (
                <div key={stat.label} className="bg-white rounded-[24px] sm:rounded-[32px] p-5 sm:p-7 shadow-sm border border-slate-100 flex flex-col justify-between relative overflow-hidden group hover:shadow-xl transition-all">
                  <div className="flex items-center justify-between mb-4">
                    <div className={cn("w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110", stat.color)}>
                      <stat.icon className="w-6 h-6" />
                    </div>
                    <span className={cn("text-[9px] font-black px-2 py-1 rounded-md", 
                      stat.trend === 'LIVE' ? "bg-emerald-100 text-emerald-600 animate-pulse" : "bg-slate-100 text-slate-500"
                    )}>{stat.trend}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2 truncate opacity-70">{stat.label}</p>
                    <p className="text-xl sm:text-2xl font-black text-slate-900 tracking-tighter truncate leading-tight">{stat.value}</p>
                  </div>
                  <div className="absolute -bottom-2 -right-2 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity">
                    <stat.icon className="w-24 h-24 rotate-12" />
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-8 bg-white rounded-[32px] sm:rounded-[40px] p-6 sm:p-10 shadow-sm border border-slate-100 relative overflow-hidden">
                <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-50">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
                    <h3 className="text-xl font-black text-slate-900 tracking-tighter uppercase whitespace-nowrap">Derniers Mouvements</h3>
                  </div>
                  <button onClick={() => setActiveMenu('Historique')} className="text-[10px] font-black text-orange-600 uppercase tracking-widest hover:underline px-4 py-2 bg-orange-50 rounded-xl">Voir tout</button>
                </div>

                <div className="space-y-4">
                  {deliveries.slice(0, 5).map((delivery) => (
                    <div key={delivery.id} className="p-4 sm:p-5 bg-slate-50/50 rounded-[24px] sm:rounded-3xl border border-slate-100 flex items-center justify-between gap-4 group hover:bg-white hover:shadow-xl transition-all">
                      <div className="flex items-center gap-3 sm:gap-5">
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-orange-600 shadow-sm border border-slate-100 shrink-0">
                          <Package className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <h4 className="font-black text-slate-900 text-[11px] sm:text-xs truncate">Course #{delivery.id?.slice(0, 8) || 'N/A'}</h4>
                            <span className="text-[7px] font-black uppercase text-slate-300">| {delivery.clientName || 'Anonyme'}</span>
                          </div>
                          <p className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                            {delivery.createdAt ? new Date(delivery.createdAt).toLocaleDateString('fr-FR') : 'Date inconnue'} - <span className="text-orange-600 font-black">{delivery.cost || 0} FCFA</span>
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        <span className={cn(
                          "px-3 py-1 rounded-lg text-[7px] sm:text-[9px] font-black uppercase tracking-widest",
                          delivery.status === 'delivered' ? "bg-emerald-100 text-emerald-600" :
                          delivery.status === 'pending' ? "bg-amber-100 text-amber-600" : "bg-blue-100 text-blue-600 shadow-[0_0_15px_rgba(59,130,246,0.1)]"
                        )}>
                          {delivery.status}
                        </span>
                        <ArrowUpRight className="w-4 h-4 text-slate-200 group-hover:text-orange-500 transition-all opacity-0 group-hover:opacity-100" />
                      </div>
                    </div>
                  ))}
                  {deliveries.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 opacity-30 grayscale">
                      <Package className="w-16 h-16 mb-4" />
                      <p className="text-[10px] font-black uppercase tracking-[0.2em]">Aucune activité détectée</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="lg:col-span-4 space-y-8">
                <div className="bg-white rounded-[40px] p-10 shadow-sm border border-slate-100">
                  <h3 className="text-xl font-black text-slate-900 tracking-tighter uppercase mb-8">Utilisateurs</h3>
                  <div className="space-y-6">
                    {[
                      { label: 'Administrateurs', count: users.filter(u => u.role === 'admin' || u.role === 'superadmin').length, color: 'bg-orange-500' },
                      { label: 'Clients', count: users.filter(u => u.role === 'client').length, color: 'bg-emerald-500' },
                      { label: 'Livreurs (Zems)', count: users.filter(u => u.role === 'driver').length, color: 'bg-blue-500' },
                    ].map((p) => {
                      const total = users.length || 1;
                      return (
                        <div key={p.label}>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-black text-slate-700">{p.label}</span>
                            <span className="text-xs font-black text-slate-900">{p.count}</span>
                          </div>
                          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${(p.count / total) * 100}%` }}
                              className={cn("h-full", p.color)}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-[#111827] rounded-[40px] p-8 text-white relative overflow-hidden shadow-2xl">
                  <div className="absolute top-8 right-8 w-12 h-12 bg-orange-500/20 rounded-2xl flex items-center justify-center text-orange-400 border border-orange-500/30">
                    <ArrowUpRight className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="w-10 h-10 bg-orange-500/20 rounded-xl flex items-center justify-center text-orange-400 mb-6">
                      <Wallet className="w-5 h-5 rotate-45" />
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">GAINS PLATEFORME (GLOBAL)</p>
                    <p className="text-4xl font-black tracking-tighter mb-2">
                      {Math.floor(deliveries.reduce((acc, curr) => acc + (curr.cost || 0), 0) * (commission?.platformFeePercent || 15) / 100).toLocaleString()} <span className="text-lg opacity-60">FCFA</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-[32px] sm:rounded-[40px] p-6 sm:p-10 shadow-sm border border-slate-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-10">
                <h3 className="text-xl font-black text-slate-900 tracking-tighter uppercase">Analyse des Courses</h3>
                <div className="flex gap-4 sm:gap-6">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 bg-orange-500 rounded-full" />
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">EXPRESS</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 bg-blue-500 rounded-full" />
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">STANDARD</span>
                  </div>
                </div>
              </div>
              <div className="h-[250px] sm:h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorExpress" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f97316" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorStandard" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }} dx={-10} />
                    <Tooltip contentStyle={{ border: 'none', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgb(0 0 0/0.1)' }} />
                    <Area type="monotone" dataKey="express" stroke="#f97316" strokeWidth={4} fill="url(#colorExpress)" />
                    <Area type="monotone" dataKey="standard" stroke="#3b82f6" strokeWidth={4} fill="url(#colorStandard)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        );
      case 'En cours':
      case 'En attente':
      case 'Programmées':
      case 'Historique':
        const filteredDeliveries = deliveries.filter(d => {
          if (activeMenu === 'En cours') return ['accepted', 'picked_up'].includes(d.status);
          if (activeMenu === 'En attente') return d.status === 'pending';
          if (activeMenu === 'Historique') return ['delivered', 'cancelled'].includes(d.status);
          return true;
        });
        return (
          <div className="bg-white rounded-[40px] p-10 shadow-sm border border-slate-100">
            <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter mb-8">{activeMenu} ({filteredDeliveries.length})</h3>
            <div className="grid grid-cols-1 gap-4">
              {filteredDeliveries.map(d => (
                <div key={d.id} className="p-6 bg-slate-50 rounded-3xl border border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-orange-600 shadow-sm border border-slate-100">
                      <Package className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-black text-slate-900">#{d.id?.slice(0, 8) || 'N/A'}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{d.from?.address?.slice(0, 30) || 'Lieu inconnu'}... → {d.to?.address?.slice(0, 30) || 'Lieu inconnu'}...</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-slate-900">{d.cost} FCFA</p>
                    <span className="text-[8px] font-black uppercase bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">{d.status}</span>
                  </div>
                </div>
              ))}
              {filteredDeliveries.length === 0 && (
                <div className="text-center py-20 text-slate-400 font-black uppercase text-xs tracking-[0.2em]">Pas de courses dans cette catégorie</div>
              )}
            </div>
          </div>
        );
      case 'Livreurs (Zems)':
      case 'Clients':
        const filteredUsers = users.filter(u => activeMenu === 'Livreurs (Zems)' ? u.role === 'driver' : u.role === 'client');
        return (
          <div className="bg-white rounded-[40px] p-10 shadow-sm border border-slate-100">
            <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter mb-8">{activeMenu} ({filteredUsers.length})</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredUsers.map(u => (
                <div key={u.userId} className={cn(
                  "p-6 bg-slate-50 rounded-3xl border flex flex-col items-center text-center group hover:bg-white hover:shadow-2xl transition-all relative overflow-hidden",
                  u.accountStatus === 'suspended' ? 'border-red-500/30' : 'border-slate-100'
                )}>
                  {u.accountStatus === 'suspended' && (
                    <div className="absolute top-3 right-3 w-2 h-2 bg-red-500 rounded-full animate-pulse" title="Compte suspendu" />
                  )}
                  <div className="absolute top-3 left-3">
                    <button onClick={() => alert('Ouverture du support chat avec ' + u.name)} className="p-2 text-slate-400 hover:text-orange-500 transition-colors bg-white rounded-full shadow-sm">
                      <MessageSquare className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-orange-600 shadow-sm border border-slate-100 mb-4 group-hover:scale-110 transition-transform">
                    <UserCircle className="w-10 h-10" />
                  </div>
                  <h4 className="font-black text-slate-900 uppercase tracking-tight">{u.name}</h4>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{u.email}</p>
                  {u.role === 'driver' && (
                    <div className="mt-3 px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[8px] font-black uppercase tracking-widest">
                       {u.vehicleType || 'Moto'} • {u.licensePlate || 'Nouveau'}
                    </div>
                  )}
                  <div className="mt-6 flex flex-col gap-2 w-full">
                    <div className="flex gap-2">
                      <button 
                        onClick={() => alert(`Email: ${u.email}\nPhone: ${u.phone || 'Non renseigné'}\nType: ${(u as any).driverType || 'N/A'}\nAdresse: ${(u as any).address || 'N/A'}`)}
                        className="flex-1 bg-white border border-slate-200 py-2.5 rounded-xl text-[8px] font-black uppercase tracking-widest hover:bg-orange-50 transition-all font-sans"
                      >
                        Détails
                      </button>
                    </div>
                    <div className="flex gap-2">
                       <button 
                         onClick={async () => {
                           if (confirm(`Voulez-vous ${u.accountStatus === 'suspended' ? 'réactiver' : 'suspendre'} ce compte ?`)) {
                             try {
                               await updateDoc(doc(db, 'users', u.userId), { 
                                 accountStatus: u.accountStatus === 'suspended' ? 'active' : 'suspended',
                                 updatedAt: new Date().toISOString()
                               });
                             } catch(err) {
                               alert('Erreur lors de la modification');
                             }
                           }
                         }}
                         className={cn(
                           "flex-1 py-2.5 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all shadow-sm",
                           u.accountStatus === 'suspended' 
                             ? "bg-emerald-500 hover:bg-emerald-600 text-white" 
                             : "bg-red-50 text-red-600 hover:bg-red-100"
                         )}
                       >
                         {u.accountStatus === 'suspended' ? 'Réactiver' : 'Suspendre'}
                       </button>
                    </div>
                  </div>
                </div>
              ))}
              {filteredUsers.length === 0 && (
                <div className="col-span-full py-20 text-center">
                  <p className="text-slate-400 font-black uppercase text-xs tracking-widest">Aucun utilisateur trouvé</p>
                </div>
              )}
            </div>
          </div>
        );
      case 'Commissions':
        return (
           <div className="bg-white rounded-[40px] p-10 shadow-sm border border-slate-100">
             <div className="flex items-center justify-between mb-10">
               <div>
                 <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Journal des Commissions</h3>
                 <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1">Revenus générés par la plateforme</p>
               </div>
               <div className="bg-emerald-50 text-emerald-600 p-6 rounded-3xl border border-emerald-100 flex flex-col items-end">
                 <p className="text-[10px] font-black uppercase tracking-widest opacity-60">TOTAL PLATFORME</p>
                 <p className="text-2xl font-black tracking-tighter">
                   {Math.floor(deliveries.reduce((acc, curr) => acc + (curr.cost || 0), 0) * (commission?.platformFeePercent || 15) / 100).toLocaleString()} FCFA
                 </p>
               </div>
             </div>
             <div className="space-y-4">
                {deliveries.filter(d => d.status === 'delivered').map(d => (
                  <div key={d.id} className="p-6 bg-slate-50 rounded-3xl border border-slate-100 flex items-center justify-between group hover:bg-white hover:shadow-xl transition-all">
                    <div className="flex items-center gap-6">
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-emerald-500 shadow-sm">
                        <DollarSign className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-black text-slate-900 text-sm">Course #{d.id?.slice(0, 8) || 'N/A'}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          Montant: {d.cost || 0} FCFA • Commission: {Math.floor((d.cost || 0) * (commission?.platformFeePercent || 15) / 100)} FCFA
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                       <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest">{d.createdAt ? new Date(d.createdAt).toLocaleDateString() : '-'}</p>
                       <span className="text-[8px] font-black uppercase text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Encaissé</span>
                    </div>
                  </div>
                ))}
             </div>
           </div>
        );
      case 'Paiements Livreurs': {
        const [paymentFilter, setPaymentFilter] = useState<'all' | 'freelance' | 'company'>('all');
        const drivers = users.filter(u => u.role === 'driver');
        const driversWithPayments = drivers.map(driver => {
          const driverDeliveries = deliveries.filter(d => d.driverId === driver.userId && d.status === 'delivered' && !d.paidToDriver);
          return { driver, driverDeliveries };
        }).filter(item => {
          if (paymentFilter === 'all') return item.driverDeliveries.length > 0;
          return item.driverDeliveries.length > 0 && item.driver.driverType === paymentFilter;
        });

        return (
          <div className="bg-white rounded-[40px] p-10 shadow-sm border border-slate-100">
             <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Paiements des Livreurs</h3>
                <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-inner">
                   <button 
                     onClick={() => setPaymentFilter('all')}
                     className={cn("px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all", paymentFilter === 'all' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400")}
                   >
                     Tous
                   </button>
                   <button 
                     onClick={() => setPaymentFilter('freelance')}
                     className={cn("px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all", paymentFilter === 'freelance' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400")}
                   >
                     Indépendants
                   </button>
                   <button 
                     onClick={() => setPaymentFilter('company')}
                     className={cn("px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all", paymentFilter === 'company' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400")}
                   >
                     Sociétés
                   </button>
                </div>
             </div>

             {driversWithPayments.length === 0 ? (
               <div className="text-center py-10 bg-slate-50 rounded-3xl border border-slate-100">
                 <Wallet className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                 <p className="text-slate-500 font-medium">Aucun paiement en attente pour le moment.</p>
               </div>
             ) : (
               <div className="grid grid-cols-1 gap-6">
                  {driversWithPayments.map(({ driver, driverDeliveries }) => {
                    const earnings = driverDeliveries.reduce((acc, curr) => acc + (curr.cost || 0), 0) * (commission?.driverSharePercent || 85) / 100;
                    return (
                      <div key={driver.userId} className="p-8 bg-slate-50 rounded-[32px] border border-slate-100 flex items-center justify-between gap-8 group hover:bg-white hover:shadow-2xl transition-all">
                         <div className="flex items-center gap-6">
                           <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-blue-600 shadow-sm border border-slate-100 relative">
                             <Truck className="w-7 h-7" />
                             {driver.driverType === 'company' && (
                               <div className="absolute -top-2 -right-2 bg-blue-600 text-white p-1 rounded-lg">
                                 <Building2 className="w-3 h-3" />
                               </div>
                             )}
                           </div>
                           <div>
                             <div className="flex items-center gap-2 mb-1">
                               <h4 className="font-black text-slate-900 uppercase">
                                 {driver.name}
                               </h4>
                               <span className={cn(
                                 "text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full",
                                 driver.driverType === 'company' ? "bg-blue-50 text-blue-600" : "bg-slate-200 text-slate-600"
                               )}>
                                 {driver.driverType === 'company' ? 'Flotte / Société' : 'Indépendant'}
                               </span>
                               {driver.withdrawalRequested && (
                                 <span className="flex h-2 w-2 relative">
                                   <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                   <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                                 </span>
                               )}
                             </div>
                             <div className="flex flex-col gap-1">
                               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{driverDeliveries.length} Courses à régler</p>
                               {driver.withdrawalRequested && (
                                 <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[8px] font-black text-red-500 uppercase tracking-widest bg-red-50 px-2 py-0.5 rounded-full">Retrait via {driver.withdrawalMethod === 'mobile_money' ? `Mobile (${driver.withdrawalPhone})` : 'Espèces'}</span>
                                 </div>
                               )}
                             </div>
                           </div>
                         </div>
                         <div className="flex gap-10 items-center">
                           <div className="text-right">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">À PAYER</p>
                              <p className="text-2xl font-black text-slate-900 tracking-tighter">{Math.floor(earnings).toLocaleString()} FCFA</p>
                           </div>
                           <button 
                             onClick={() => handlePayDriver(driver.userId, driverDeliveries.map(d => d.id))}
                             className="bg-slate-900 text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-blue-600 transition-all shadow-xl shadow-slate-200"
                           >
                             Régler
                           </button>
                         </div>
                      </div>
                    );
                  })}
               </div>
             )}
          </div>
        );
      }
      case 'Modèle Éco':
        return (
          <div className="max-w-4xl bg-white rounded-[40px] p-10 shadow-sm border border-slate-100">
            <div className="flex items-center gap-6 mb-10">
              <div className="w-16 h-16 bg-orange-100 text-orange-600 rounded-3xl flex items-center justify-center">
                <BadgePercent className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">Configuration du Modèle Économique</h3>
                <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1">Définissez vos commissions et frais de plateforme</p>
              </div>
            </div>

            {commission && (
              <form onSubmit={handleUpdateCommission} className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-2">Commission Plateforme (%)</label>
                    <div className="relative">
                      <Percent className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        type="number" 
                        value={commission.platformFeePercent}
                        onChange={e => setCommission({ ...commission, platformFeePercent: Number(e.target.value) })}
                        className="w-full bg-white border-none rounded-xl pl-12 py-3 text-sm font-black focus:ring-4 focus:ring-orange-100 transition-all"
                      />
                    </div>
                  </div>

                  <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-2">Part des Livreurs (%)</label>
                    <div className="relative">
                      <Percent className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        type="number" 
                        value={commission.driverSharePercent}
                        onChange={e => setCommission({ ...commission, driverSharePercent: Number(e.target.value) })}
                        className="w-full bg-white border-none rounded-xl pl-12 py-3 text-sm font-black focus:ring-4 focus:ring-orange-100 transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-2">Course Minimum (FCFA)</label>
                    <div className="relative">
                      <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        type="number" 
                        value={commission.minDeliveryCost}
                        onChange={e => setCommission({ ...commission, minDeliveryCost: Number(e.target.value) })}
                        className="w-full bg-white border-none rounded-xl pl-12 py-3 text-sm font-black focus:ring-4 focus:ring-orange-100 transition-all"
                      />
                    </div>
                  </div>

                  <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-2">Assurance (%)</label>
                    <div className="relative">
                      <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        type="number" 
                        value={commission.insuranceFeePercent}
                        onChange={e => setCommission({ ...commission, insuranceFeePercent: Number(e.target.value) })}
                        className="w-full bg-white border-none rounded-xl pl-12 py-3 text-sm font-black focus:ring-4 focus:ring-orange-100 transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2 mb-4">Paramètres de Négociation</h4>
                  <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-2">Tarif par KM (FCFA)</label>
                    <div className="relative">
                      <Navigation className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        type="number" 
                        value={commission.tarifKm}
                        onChange={e => setCommission({ ...commission, tarifKm: Number(e.target.value) })}
                        className="w-full bg-white border-none rounded-xl pl-12 py-3 text-sm font-black focus:ring-4 focus:ring-orange-100 transition-all"
                      />
                    </div>
                  </div>
                  <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-2">Tarif par KG (FCFA)</label>
                    <div className="relative">
                      <Package className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        type="number" 
                        value={commission.tarifPoids}
                        onChange={e => setCommission({ ...commission, tarifPoids: Number(e.target.value) })}
                        className="w-full bg-white border-none rounded-xl pl-12 py-3 text-sm font-black focus:ring-4 focus:ring-orange-100 transition-all"
                      />
                    </div>
                  </div>
                  <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-2">Frais Fixes (FCFA)</label>
                    <div className="relative">
                      <Plus className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        type="number" 
                        value={commission.fraisFixes}
                        onChange={e => setCommission({ ...commission, fraisFixes: Number(e.target.value) })}
                        className="w-full bg-white border-none rounded-xl pl-12 py-3 text-sm font-black focus:ring-4 focus:ring-orange-100 transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2 mb-4">Limites de Négociation</h4>
                  <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-2">Ratio Min Client (ex: 0.7 = 70%)</label>
                    <div className="relative">
                      <Percent className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        type="number" 
                        step="0.1"
                        value={commission.minRatioClient}
                        onChange={e => setCommission({ ...commission, minRatioClient: Number(e.target.value) })}
                        className="w-full bg-white border-none rounded-xl pl-12 py-3 text-sm font-black focus:ring-4 focus:ring-orange-100 transition-all"
                      />
                    </div>
                  </div>
                  <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-2">Ratio Max Livreur (ex: 2.0 = 200%)</label>
                    <div className="relative">
                      <Percent className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        type="number" 
                        step="0.1"
                        value={commission.maxRatioLivreur}
                        onChange={e => setCommission({ ...commission, maxRatioLivreur: Number(e.target.value) })}
                        className="w-full bg-white border-none rounded-xl pl-12 py-3 text-sm font-black focus:ring-4 focus:ring-orange-100 transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div className="md:col-span-2 pt-8 flex items-center justify-between border-t border-slate-100 mt-4">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-tight">
                    Dernière modif par : {commission.updatedBy}<br/>
                    {new Date(commission.updatedAt).toLocaleString()}
                  </div>
                  <button 
                    disabled={isSaving}
                    type="submit"
                    className="flex items-center gap-3 px-10 py-5 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-orange-600 transition-all shadow-2xl shadow-slate-200 disabled:opacity-50"
                  >
                    {isSaving ? <Clock className="w-5 h-5 animate-spin" /> : <Settings className="w-5 h-5" />}
                    Mettre à jour la politique tarifaire
                  </button>
                </div>
              </form>
            )}
          </div>
        );
      case 'Carte Live (GPS)':
        return (
          <div className="bg-white rounded-[40px] p-6 sm:p-10 shadow-sm border border-slate-100 overflow-hidden flex flex-col h-[600px] lg:h-full">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Carte en Temps Réel</h3>
              <div className="flex gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full animate-ping" />
                  <span className="text-[10px] font-black uppercase text-blue-500">Flux Live</span>
                </div>
              </div>
            </div>
            <div className="flex-1 bg-slate-50 rounded-3xl overflow-hidden shadow-inner relative border-4 border-slate-50">
               <MapContainer 
                 center={[12.3714, -1.5197]} 
                 zoom={13} 
                 className="h-full w-full"
               >
                 <TileLayer 
                   url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" 
                   attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                 />
                 {deliveries.filter(d => ['accepted', 'picked_up'].includes(d.status) && d.from?.lat && d.from?.lng).map(delivery => (
                   <Marker 
                     key={delivery.id} 
                     position={[delivery.from.lat, delivery.from.lng]}
                     icon={new L.DivIcon({
                       className: 'custom-div-icon',
                       html: `<div class="w-8 h-8 bg-orange-500 rounded-lg border-2 border-white shadow-lg flex items-center justify-center text-white font-black text-[8px]">${delivery.id?.slice(0, 2) || 'X'}</div>`,
                       iconAnchor: [16, 16]
                     })}
                   >
                     <Popup className="rounded-2xl">
                       <div className="p-2">
                         <p className="font-black text-[10px] uppercase text-orange-500 mb-1">{delivery.status}</p>
                         <p className="font-bold text-xs">#{delivery.id?.slice(0,8) || 'N/A'}</p>
                         <p className="text-[10px] text-slate-500 mt-1">{delivery.clientName}</p>
                       </div>
                     </Popup>
                   </Marker>
                 ))}
                 {users.filter(u => u.role === 'driver' && u.currentLocation?.lat && u.currentLocation?.lng).map(driver => (
                   <Marker 
                     key={driver.userId} 
                     position={[driver.currentLocation!.lat, driver.currentLocation!.lng]}
                     icon={new L.DivIcon({
                       className: 'driver-icon',
                       html: `<div class="w-10 h-10 bg-blue-600 rounded-2xl border-2 border-white shadow-xl flex items-center justify-center text-white"><img src="https://cdn-icons-png.flaticon.com/512/3655/3655682.png" class="w-6 h-6" /></div>`,
                       iconAnchor: [20, 20]
                     })}
                   >
                     <Popup>
                       <div className="p-2">
                         <p className="font-black text-xs uppercase text-blue-600">{driver.name}</p>
                         <p className="text-[10px] text-slate-500">{driver.vehicleType || 'Moto'}</p>
                       </div>
                     </Popup>
                   </Marker>
                 ))}
               </MapContainer>
            </div>
          </div>
        );
      case 'Secteurs d\'Ouaga':
        const secteurs = ['Paspanga', 'Koulouba', 'Gounghin', 'Dassasgho', 'Patte d\'Oie', 'Ouaga 2000', 'Somgandé', 'Cissin', 'Larlé'];
        return (
          <div className="bg-white rounded-[40px] p-10 shadow-sm border border-slate-100">
             <div className="flex justify-between items-center mb-8">
               <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Maillage Territorial</h3>
               <p className="text-slate-400 font-bold text-xs uppercase tracking-widest leading-none">Cliquez sur un secteur pour filtrer l'activité</p>
             </div>
             <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {secteurs.map(s => {
                  const activityCount = deliveries.filter(d => d.from?.address?.toLowerCase().includes(s.toLowerCase()) || d.to?.address?.toLowerCase().includes(s.toLowerCase())).length;
                  return (
                    <button 
                      key={s} 
                      onClick={() => setActiveMenu('Historique')} // In a real app we'd pass the filter state
                      className="p-6 bg-slate-50 rounded-3xl border border-slate-100 hover:border-orange-500 hover:bg-white hover:shadow-2xl transition-all cursor-pointer group text-left"
                    >
                      <Globe className="w-6 h-6 text-slate-300 mb-4 group-hover:text-orange-500 transition-all" />
                      <div className="flex justify-between items-end">
                        <span className="font-black text-slate-900 text-sm uppercase">{s}</span>
                        <span className="text-[10px] font-black text-orange-500 bg-orange-50 px-2 py-1 rounded-lg">{activityCount} Flux</span>
                      </div>
                    </button>
                  );
                })}
             </div>
          </div>
        );
      case 'Transactions':
        return (
          <div className="bg-white rounded-[40px] p-10 shadow-sm border border-slate-100">
            <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter mb-8">Flux Financiers</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">ID</th>
                    <th className="py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Montant</th>
                    <th className="py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Mode</th>
                    <th className="py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveries.slice(0, 10).map(d => (
                    <tr key={d.id} className="border-b border-slate-50 hover:bg-slate-50 transition-all">
                      <td className="py-4 text-xs font-black text-slate-900">#{d.id?.slice(0, 6) || 'N/A'}</td>
                      <td className="py-4 text-xs font-black text-emerald-600">{d.cost || 0} FCFA</td>
                      <td className="py-4 text-[10px] font-bold text-slate-400 uppercase">{d.paymentMethod}</td>
                      <td className="py-4">
                        <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[8px] font-black uppercase tracking-widest">Payé</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      case 'Support Chat':
        const selectedDelivery = deliveries.find(d => d.id === selectedChatDeliveryId);
        const currentChatMessages = chatMessages;

        return (
          <div className="bg-white rounded-[40px] shadow-sm border border-slate-100 flex h-[700px] overflow-hidden">
             {/* Sidebar: List of Chats */}
             <div className="w-80 border-r border-slate-100 flex flex-col bg-slate-50/50">
                <div className="p-8 border-b border-slate-100 bg-white">
                   <h3 className="text-xl font-black text-slate-900 tracking-tighter uppercase">Discussions</h3>
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{chatDeliveries.length} actives</p>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                   {chatDeliveries.map(d => (
                     <button 
                       key={d.id}
                       onClick={() => setSelectedChatDeliveryId(d.id)}
                       className={cn(
                         "w-full p-4 rounded-2xl text-left transition-all border flex items-center gap-4",
                         selectedChatDeliveryId === d.id 
                           ? "bg-white border-orange-200 shadow-xl shadow-orange-100/50" 
                           : "bg-transparent border-transparent hover:bg-white hover:border-slate-100"
                       )}
                     >
                        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", selectedChatDeliveryId === d.id ? "bg-orange-500 text-white" : "bg-slate-100 text-slate-400")}>
                           <MessageSquare className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                           <p className="text-[10px] font-black text-slate-900 truncate">Course #{d.id?.slice(0, 8) || 'N/A'}</p>
                           <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest truncate">{d.clientName || 'Inconnu'} & {d.driverName || 'En attente'}</p>
                        </div>
                     </button>
                   ))}
                   {chatDeliveries.length === 0 && (
                     <div className="text-center py-20">
                        <MessageSquare className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4">En attente de messages clients ou zems...</p>
                     </div>
                   )}
                </div>
             </div>

             {/* Main: Active Chat */}
             <div className="flex-1 flex flex-col bg-white">
                {selectedChatDeliveryId ? (
                  <>
                    <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                       <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center">
                             <Package className="w-6 h-6" />
                          </div>
                          <div>
                            <h4 className="font-black text-slate-900 uppercase">Support Course #{selectedChatDeliveryId.slice(0, 8)}</h4>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                               {selectedDelivery?.from?.address?.slice(0, 20) || 'Lieu'}... → {selectedDelivery?.to?.address?.slice(0, 20) || 'Lieu'}...
                            </p>
                          </div>
                       </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-10 space-y-6 bg-slate-50/30">
                       {currentChatMessages.map((msg, idx) => {
                          const isMe = msg.senderId === profile?.userId;
                          const senderProfile = users.find(u => u.userId === msg.senderId);
                          return (
                            <div key={msg.id} className={cn("flex flex-col", isMe ? "items-end" : "items-start")}>
                               <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">
                                  {senderProfile?.name || 'Inconnu'} • {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString() : ''}
                               </span>
                               <div className={cn(
                                 "max-w-[70%] p-5 rounded-[24px] text-sm font-bold shadow-sm",
                                 isMe ? "bg-slate-900 text-white rounded-tr-none" : "bg-white text-slate-800 rounded-tl-none border border-slate-100"
                               )}>
                                  {msg.text}
                               </div>
                            </div>
                          );
                       })}
                    </div>

                    <form onSubmit={handleSendAdminMessage} className="p-6 border-t border-slate-100 flex gap-4">
                       <input 
                         type="text" 
                         value={adminMessage}
                         onChange={e => setAdminMessage(e.target.value)}
                         placeholder="Répondre à la discussion..."
                         className="flex-1 bg-slate-50 border-none rounded-2xl px-6 font-bold text-sm focus:ring-4 focus:ring-orange-100 transition-all"
                       />
                       <button 
                         type="submit"
                         className="px-8 bg-orange-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-orange-600 transition-all shadow-xl shadow-orange-100"
                       >
                         Envoyer
                       </button>
                    </form>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-20 text-center">
                     <div className="w-24 h-24 bg-slate-50 rounded-[40px] flex items-center justify-center mb-8">
                        <MessageSquare className="w-12 h-12 text-slate-200" />
                     </div>
                     <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter mb-4">Centre de Support Actif</h3>
                     <p className="text-slate-400 font-bold text-xs uppercase tracking-widest max-w-sm">Sélectionnez une discussion à gauche pour intervenir en tant qu'administrateur ou modérateur.</p>
                  </div>
                )}
             </div>
          </div>
        );
      case 'Base de Données':
        return (
          <div className="bg-white rounded-[40px] p-10 shadow-sm border border-slate-100 flex flex-col h-full min-h-[600px]">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Exploration de la Base de Données</h3>
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mt-1">
                  Accès structuré aux tables Firestore "users", "deliveries", "settings"
                </p>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => {
                    const csv = [
                      ['ID', 'Date', 'Type', 'Statut', 'Client', 'Livreur', 'Montant (FCFA)'],
                      ...deliveries.map(d => [d.id, d.createdAt, 'Course', d.status, d.clientId, d.driverId || '-', d.cost || 0])
                    ].map(row => row.join(',')).join('\n');
                    const blob = new Blob([csv], { type: 'text/csv' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `export-courses-${new Date().toISOString().slice(0, 10)}.csv`;
                    a.click();
                  }}
                  className="px-6 py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2"
                >
                  <Download className="w-4 h-4" /> Export CSV (Courses)
                </button>
                <button 
                  onClick={() => {
                    const csv = [
                      ['ID', 'Nom', 'Email', 'Role', 'Statut', 'Date Inscription'],
                      ...users.map(u => [u.userId, u.name, u.email, u.role, u.accountStatus || 'active', u.updatedAt || ''])
                    ].map(row => row.join(',')).join('\n');
                    const blob = new Blob([csv], { type: 'text/csv' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `export-users-${new Date().toISOString().slice(0, 10)}.csv`;
                    a.click();
                  }}
                  className="px-6 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2"
                >
                  <Download className="w-4 h-4" /> Export CSV (Users)
                </button>
              </div>
            </div>
            
            <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 flex-1 flex flex-col font-mono text-xs overflow-hidden shadow-inner">
               <div className="flex items-center gap-4 mb-4 border-b border-slate-700/50 pb-4">
                 <div className="flex items-center gap-2 text-emerald-400">
                    <Database className="w-4 h-4" />
                    <span className="font-bold">Firestore Enterprise Terminal</span>
                 </div>
               </div>
               
               <div className="flex-1 overflow-auto rounded-xl bg-slate-950 p-4 border border-slate-800 text-slate-300">
                 <div className="mb-6 space-y-2">
                   <p className="text-slate-500">// Collection: Users ({users.length} documents)</p>
                   {users.slice(0, 3).map(u => (
                     <pre key={u.userId} className="text-[10px] text-blue-300 whitespace-pre-wrap break-all bg-blue-900/10 p-2 rounded-lg border border-blue-900/30">
                       {JSON.stringify(u, null, 2)}
                     </pre>
                   ))}
                   {users.length > 3 && <p className="text-slate-500">... {users.length - 3} plus de documents. Appuyez sur Export CSV pour tous les voir.</p>}
                 </div>
                 
                 <div className="space-y-2">
                   <p className="text-slate-500">// Collection: Deliveries ({deliveries.length} documents)</p>
                   {deliveries.slice(0, 3).map(d => (
                     <pre key={d.id} className="text-[10px] text-orange-300 whitespace-pre-wrap break-all bg-orange-900/10 p-2 rounded-lg border border-orange-900/30">
                       {JSON.stringify(d, null, 2)}
                     </pre>
                   ))}
                   {deliveries.length > 3 && <p className="text-slate-500">... {deliveries.length - 3} plus de documents. Appuyez sur Export CSV pour tous les voir.</p>}
                 </div>
               </div>
            </div>
          </div>
        );
      default:
        return (
          <div className="flex flex-col items-center justify-center py-32 bg-white rounded-[40px] border border-slate-100 shadow-sm text-center px-10">
            <Store className="w-24 h-24 text-slate-100 mb-8" />
            <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter mb-4">Module {activeMenu}</h3>
            <p className="text-slate-400 font-bold text-sm uppercase tracking-widest max-w-md">Ce module de suivi en temps réel de Ma Livraison Burkina est en cours de déploiement sécurisé.</p>
          </div>
        );
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-[90vh]">
      <motion.div 
        animate={{ rotate: 360 }} 
        transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }} 
        className="w-16 h-16 border-8 border-orange-500 border-t-transparent rounded-full shadow-2xl" 
      />
    </div>
  );

  const handleRoleChange = async (newRole: UserRole) => {
    await updateRole(newRole);
    if (newRole === 'client') navigate('/client');
    else if (newRole === 'driver') navigate('/driver');
    else navigate('/admin');
  };

  // Safety redirection: If for some reason the profile role changes to non-admin 
  // and we are still on the admin view, redirect immediately.
  if (profile && profile.role !== 'admin' && profile.role !== 'superadmin' && !isMasterAdmin) {
    return <Navigate to={profile.role === 'driver' ? '/driver' : '/client'} />;
  }

  return (
    <div className="flex w-full h-[calc(100vh-80px)] bg-[#f8fafc] overflow-hidden">
      <aside className="w-72 bg-white border-r border-slate-200 overflow-y-auto hidden lg:block scrollbar-hide">
        <div className="p-10">
          <div className="flex items-center gap-4 mb-16">
            <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-slate-100">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div>
              <h2 className="font-black text-slate-900 text-xl tracking-tight leading-none">Admin</h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-1.5">Workspace</p>
            </div>
          </div>

          <div className="space-y-10">
            {sidebarItems.map((group) => (
              <div key={group.group}>
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 px-4">{group.group}</h3>
                <div className="space-y-1.5">
                  {group.items.map((item) => (
                    <button
                      key={item.name}
                      onClick={() => setActiveMenu(item.name)}
                      className={cn(
                        "w-full flex items-center justify-between px-5 py-4 rounded-[20px] text-[11px] font-black uppercase tracking-tight transition-all duration-300",
                        activeMenu === item.name 
                          ? "bg-slate-900 text-white shadow-sm scale-[1.02]" 
                          : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <item.icon className={cn("w-4.5 h-4.5", activeMenu === item.name ? "text-white" : "text-slate-400")} />
                        {item.name}
                      </div>
                      {item.name === 'Paiements Livreurs' && users.some(u => u.withdrawalRequested) && (
                        <span className="w-2 h-2 bg-red-500 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden bg-slate-50 shadow-inner">
        <header className="bg-white px-4 sm:px-8 py-4 flex flex-col gap-4 sm:flex-row sm:items-center justify-between sticky top-0 z-40 border-b border-slate-200 shrink-0 shadow-sm">
          <div className="flex items-center justify-between sm:justify-start gap-4">
             <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase">{activeMenu}</h3>
             {isMasterAdmin && (
               <button 
                onClick={() => setShowResetConfirm(true)} 
                disabled={isSaving}
                className="px-4 py-2 bg-red-100 hover:bg-red-500 hover:text-white text-red-600 rounded-lg text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-colors flex items-center gap-2"
               >
                 <ShieldCheck className="w-3 h-3" /> <span className="hidden sm:inline">Hard Reset</span>
               </button>
             )}
          </div>

          <div className="flex flex-wrap items-center gap-3 sm:gap-6 justify-between sm:justify-end">
            <div className="flex flex-col items-start sm:items-end">
              <span className="text-[7px] sm:text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Système Mode</span>
              <button 
                onClick={handleToggleMode}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all",
                  appConfig?.mode === 'prod' ? "bg-emerald-500 text-white shadow-lg shadow-emerald-200" : "bg-amber-400 text-amber-950"
                )}
              >
                <ShieldCheck className="w-3 h-3" />
                {appConfig?.mode === 'prod' ? 'Production' : 'Mode Test'}
              </button>
            </div>
            
            <div className="hidden sm:block h-10 w-px bg-slate-100 mx-2" />

            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <span className="text-[7px] sm:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Rôle :</span>
              <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-200 overflow-x-auto scrollbar-hide max-w-[200px] sm:max-w-none">
                {rolesList.map((role) => (
                  <button
                    key={role.id}
                    onClick={() => handleRoleChange(role.id)}
                    className={cn(
                      "px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-[10px] sm:text-xs font-bold uppercase tracking-wide transition-all whitespace-nowrap",
                      profile?.role === role.id 
                        ? "bg-white text-orange-600 shadow-sm border border-slate-100" 
                        : "text-slate-500 hover:text-slate-800"
                    )}
                  >
                    {role.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 sm:p-8 lg:p-10 scrollbar-hide">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeMenu}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Custom Reset Modal */}
      <AnimatePresence>
        {showResetConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowResetConfirm(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-8 max-w-sm w-full relative z-10 shadow-2xl"
            >
              <h3 className="text-xl font-black text-red-600 uppercase tracking-tighter mb-4">Hard Reset</h3>
              <p className="text-sm font-bold text-slate-500 mb-6 leading-relaxed">
                Cette action supprimera toutes les livraisons, enchères, tracking, messages et comptes utilisateurs (sauf les administrateurs). Tapez <span className="text-red-500 font-black">RESET</span> pour confirmer.
              </p>
              <input
                type="text"
                value={resetCode}
                onChange={(e) => setResetCode(e.target.value)}
                placeholder="Tapez RESET"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-black text-slate-900 uppercase tracking-widest text-center mb-6"
              />
              <div className="flex gap-4">
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="flex-1 px-4 py-3 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest"
                >
                  Annuler
                </button>
                <button
                  onClick={executeHardReset}
                  disabled={resetCode.trim().toUpperCase() !== 'RESET' || isSaving}
                  className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
                >
                  {isSaving ? 'Suppression...' : 'Confirmer'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
