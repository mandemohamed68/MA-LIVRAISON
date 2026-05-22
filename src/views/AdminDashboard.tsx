import React, { useEffect, useState, useRef } from 'react';
import { api } from '../services/apiService';
import { DeliveryRequest, UserProfile, UserRole, CommissionSettings, AppConfig, DistancePricingRule, Sector, AppAnnouncement } from '../types';
import { 
  ShieldCheck, Package, Users, Truck, DollarSign, 
  ArrowUpRight, Clock, LayoutDashboard, MessageSquare, 
  ClipboardCheck, History, Store, Map as MapIcon, Globe, 
  BadgePercent, CreditCard, Wallet, LogOut, Bell, Settings, 
  Plus, Navigation, UserCircle, Percent, Database, Download, Building2, X, Trash2, Zap, Smartphone, Menu,
  CheckCircle, AlertCircle, Landmark
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { cn } from '../lib/utils';
import { LoadingScreen } from '../components/LoadingScreen';
import { useAuth, ADMIN_EMAILS } from '../context/AuthContext';
import { useNavigate, Navigate, useLocation } from 'react-router-dom';
import LiveMap from '../components/LiveMap';
import { sendNotification } from '../lib/notificationService';

export default function AdminDashboard() {
  const { profile, logout, isMasterAdmin, updateRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const queryTab = queryParams.get('tab');

  const [deliveries, setDeliveries] = useState<DeliveryRequest[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [commission, setCommission] = useState<CommissionSettings | null>(null);
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);
  const [configForm, setConfigForm] = useState<AppConfig | null>(null);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [announcements, setAnnouncements] = useState<AppAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeMenu, setActiveMenu] = useState(queryTab || 'Vue d\'ensemble');
  const [isSaving, setIsSaving] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    if (queryTab && queryTab !== activeMenu) {
      setActiveMenu(queryTab);
    }
  }, [queryTab]);

  useEffect(() => {
    if (appConfig && !configForm) {
      setConfigForm(appConfig);
    }
  }, [appConfig]);

  const handleUpdateConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!configForm) return;
    setIsSaving(true);
    try {
      await api.config.update('app_config', {
        ...configForm,
        updatedAt: new Date().toISOString()
      });
      alert('Modifications enregistrées avec succès sur le serveur local !');
    } catch (err) {
      console.error(err);
      alert('Erreur lors de l\'enregistrement: ' + (err instanceof Error ? err.message : 'Une erreur inconnue est survenue'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleMenuChange = (menuName: string) => {
    setActiveMenu(menuName);
    setIsSidebarOpen(false);
    navigate(`/admin?tab=${menuName}`, { replace: true });
  };
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'freelance' | 'company'>('all');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [showNewAnnonceForm, setShowNewAnnonceForm] = useState(false);
  const [newAnnonce, setNewAnnonce] = useState({ title: '', message: '', type: 'info' as 'info' | 'warning' | 'success' });

  const generateCode = () => Math.random().toString(36).substring(2, 6).toUpperCase();

  const prevPendingCount = useRef(0);

  useEffect(() => {
    // Check if there are new validations waiting (payments or withdrawals)
    const currentPendingPayments = deliveries.filter(d => d.paymentStatus === 'pending' || d.paymentStatus === 'pending_approval').length;
    const currentPendingWithdrawals = withdrawals.filter(w => w.status === 'en_attente').length;
    
    const totalPendingCount = currentPendingPayments + currentPendingWithdrawals;

    if (totalPendingCount > prevPendingCount.current) {
      // Something new needs validation, play a beep
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(800, audioCtx.currentTime); // 800 Hz
        oscillator.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.1);
        
        gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + 0.05); // quick fade in
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3); // fade out
        
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.3);
      } catch (e) {
        console.warn("Audio notification suppressed or unsupported:", e);
      }
    }
    prevPendingCount.current = totalPendingCount;
  }, [deliveries, users]);

  const fetchData = async () => {
    try {
      const [usersList, deliveriesList, configData, commissionsData, sectorsData, announcementsData, withdrawalsList] = await Promise.all([
        api.admin.users.list().then(res => res || []).catch(() => []),
        api.deliveries.list().then(res => res || []).catch(() => []),
        api.config.get('app_config').then(res => res || { mode: 'prod' }).catch(() => ({ mode: 'prod' })),
        api.config.get('commissions').then(res => res || null).catch(() => null),
        api.sectors.list().then(res => res || []).catch(() => []),
        api.announcements.list().then(res => res || []).catch(() => []),
        api.admin.withdrawals.list().then(res => res || []).catch(() => [])
      ]);

      setUsers(usersList);
      setDeliveries(deliveriesList);
      if (configData) setAppConfig(configData);
      if (commissionsData) setCommission(commissionsData);
      setSectors(sectorsData);
      setAnnouncements(announcementsData);
      setWithdrawals(withdrawalsList);
    } catch (err) {
      console.error("Error polling local API:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Only subscribe if we have a valid admin profile
    const isAdmin = isMasterAdmin || profile?.role === 'admin' || profile?.role === 'superadmin';
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    fetchData();
    const interval = setInterval(fetchData, 10000); // Poll every 10s

    return () => clearInterval(interval);
  }, [profile, isMasterAdmin]);

  const handleAddDistanceRule = () => {
    if (!commission) return;
    const newRule: DistancePricingRule = {
      id: Math.random().toString(36).substr(2, 9),
      minKm: 0,
      maxKm: 0,
      price: 0
    };
    setCommission({
      ...commission,
      distancePricingRules: [...(commission.distancePricingRules || []), newRule]
    });
  };

  const handleRemoveDistanceRule = (id: string) => {
    if (!commission || !commission.distancePricingRules) return;
    setCommission({
      ...commission,
      distancePricingRules: commission.distancePricingRules.filter(r => r.id !== id)
    });
  };

  const handleUpdateDistanceRule = (id: string, updates: Partial<DistancePricingRule>) => {
    if (!commission || !commission.distancePricingRules) return;
    setCommission({
      ...commission,
      distancePricingRules: commission.distancePricingRules.map(r => r.id === id ? { ...r, ...updates } : r)
    });
  };

  const handleUpdateCommission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commission) return;
    setIsSaving(true);
    try {
      await api.config.update('commissions', {
        ...commission,
        updatedAt: new Date().toISOString(),
        updatedBy: profile?.userId || 'admin'
      });
      alert('Paramètres de commission locaux mis à jour !');
    } catch (err) {
      console.error(err);
      alert('Erreur lors de la mise à jour des commissions.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleMode = async () => {
    if (!appConfig) return;
    const newMode = appConfig.mode === 'test' ? 'prod' : 'test';
    setIsProcessingAction(true);
    try {
      await api.config.update('app_config', {
        ...appConfig,
        mode: newMode,
        updatedAt: new Date().toISOString()
      });
      alert(`Mode ${newMode === 'test' ? 'Test' : 'Production'} activé sur le serveur local !`);
    } catch (err) {
      console.error(err);
      alert('Erreur lors du changement de mode.');
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleSeedData = async () => {
    if (!window.confirm('Voulez-vous injecter des données de test locales ?')) return;
    setIsProcessingAction(true);
    try {
      await api.admin.seed();
      alert('Données de test injectées sur le serveur local !');
    } catch (err) {
      console.error(err);
      alert('Erreur lors de l\'injection locale.');
    } finally {
      setIsProcessingAction(false);
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
      await api.admin.reset();
      alert("Application réinitialisée localement (Données supprimées) !");
      setShowResetConfirm(false);
      setResetCode('');
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la réinitialisation locale.");
    } finally {
      setIsSaving(false);
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

  const handleValidateWithdrawal = async (withdrawalId: string) => {
    setIsProcessingAction(true);
    try {
      await api.admin.withdrawals.validate(withdrawalId);
      alert('Paiement enregistré avec succès.');
      fetchData();
    } catch (e: any) {
      console.error(e);
      alert(`Erreur lors de la validation: ${e.message || 'Erreur inconnue'}`);
    } finally {
      setIsProcessingAction(false);
    }
  };

  const isSuperAdmin = profile?.role === 'superadmin' || isMasterAdmin;

  const allSidebarItems = [
    { group: 'GÉNÉRAL', items: [
      { name: 'Vue d\'ensemble', icon: LayoutDashboard },
    ]},
    { group: 'COMMUNICATION', items: [
      { name: 'Support Chat', icon: MessageSquare },
      ...(isSuperAdmin ? [{ name: 'Annonces Globales', icon: Bell }] : []),
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
      ...(isSuperAdmin ? [{ name: 'Administrateurs', icon: ShieldCheck }] : []),
      ...(isSuperAdmin ? [{ name: 'Secteurs d\'Ouaga', icon: Globe }] : []),
    ]},
    { group: 'FINANCES', items: [
      ...(isSuperAdmin ? [{ name: 'Modèle Éco', icon: BadgePercent }] : []),
      { name: 'Validations Paiements', icon: CreditCard },
      { name: 'Paiements Livreurs', icon: Wallet },
      ...(isSuperAdmin ? [{ name: 'Commissions', icon: Percent }] : []),
    ]},
    ...(isSuperAdmin ? [{
      group: 'SYSTÈME & DATA', items: [
        { name: 'Paramètres App', icon: Settings },
        { name: 'Base de Données', icon: Database },
        { name: 'Logs Système', icon: ClipboardCheck },
      ]
    }] : []),
  ];

  const sidebarItems = allSidebarItems.filter(group => group.items.length > 0);

  const rolesList: { id: UserRole, label: string }[] = [
    { id: 'superadmin', label: 'SUPER ADMIN' },
    { id: 'admin', label: 'ADMINISTRATEUR' },
    { id: 'client', label: 'CLIENT' },
    { id: 'driver', label: 'LIVREUR' },
  ];

  const [selectedChatDeliveryId, setSelectedChatDeliveryId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [adminMessage, setAdminMessage] = useState('');
  
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [isSubmittingNewUser, setIsSubmittingNewUser] = useState(false);
  const [newUserData, setNewUserData] = useState<any>({
    role: 'client',
    name: '', email: '', phone: '', password: '',
    // driver specific defaults
    vehicleType: 'Moto',
    licensePlate: '',
    driverType: 'freelance',
    sectors: []
  });

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserData.email || !newUserData.password || !newUserData.name) {
      alert("Veuillez remplir les informations obligatoires (Nom, Email, Mot de passe).");
      return;
    }
    
    setIsSubmittingNewUser(true);
    try {
      const newUserProfile: any = {
        name: newUserData.name,
        email: newUserData.email,
        password: newUserData.password,
        phone: newUserData.phone || '',
        role: newUserData.role,
        accountStatus: 'active',
      };

      if (newUserData.role === 'driver') {
        newUserProfile.vehicleType = newUserData.vehicleType;
        newUserProfile.licensePlate = newUserData.licensePlate;
        newUserProfile.driverType = newUserData.driverType;
        newUserProfile.sectors = JSON.stringify(newUserData.sectors);
      }

      await api.admin.users.create(newUserProfile);
      
      alert("Utilisateur créé avec succès sur le serveur local !");
      setShowCreateUserModal(false);
      setNewUserData({
        role: 'client',
        name: '', email: '', phone: '', password: '',
        vehicleType: 'Moto', licensePlate: '', driverType: 'freelance', sectors: []
      });
    } catch (err: any) {
      console.error(err);
      alert("Erreur lors de la création locale : " + (err.message || 'Erreur inconnue'));
    } finally {
      setIsSubmittingNewUser(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!isSuperAdmin) return;
    if (!window.confirm('Supprimer définitivement cet utilisateur ?')) return;
    try {
      await api.admin.users.delete(userId);
      alert('Utilisateur supprimé.');
      setSelectedUser(null);
    } catch (err) {
      console.error(err);
      alert('Erreur lors de la suppression.');
    }
  };

  // Fetch all active chats by checking deliveries that have lastMessageAt
  const chatDeliveries = deliveries
    .filter(d => Boolean(d.lastMessageAt))
    .sort((a, b) => (b.lastMessageAt || '').localeCompare(a.lastMessageAt || ''));

  useEffect(() => {
    if (!selectedChatDeliveryId) return;
    
    const fetchMessages = async () => {
      try {
        const msgs = await api.deliveries.messages.list(selectedChatDeliveryId);
        setChatMessages(msgs);
      } catch (err) {
        console.error("Error fetching chat messages:", err);
      }
    };

    fetchMessages();
    const interval = setInterval(fetchMessages, 3000); // Polling chat every 3s
    return () => clearInterval(interval);
  }, [selectedChatDeliveryId]);

  const handleSendAdminMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminMessage.trim() || !selectedChatDeliveryId || !profile) return;
    try {
      await api.deliveries.messages.send(selectedChatDeliveryId, {
        text: adminMessage,
        senderId: profile.userId,
        senderName: profile.name,
        senderRole: 'admin'
      });
      setAdminMessage('');
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

  const renderContent = () => {
    switch (activeMenu) {
      case 'Validations Paiements':
        const pendingPayments = deliveries.filter(d => d.paymentStatus === 'pending' || d.paymentStatus === 'pending_approval');
        return (
          <div className="bg-white rounded-3xl p-6 lg:p-5 lg:p-6 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Validations de Paiements</h3>
                <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1">Approbation des transactions USSD et Agrégateurs</p>
              </div>
              <div className="w-12 h-12 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center">
                <CreditCard className="w-6 h-6" />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {pendingPayments.map(d => {
                const logo = getPaymentLogo(d.paymentMethod);
                return (
                  <div key={d.id} className="p-6 bg-slate-50 rounded-3xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-white transition-all shadow-sm">
                    <div className="flex items-center gap-6">
                      <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm border border-slate-100 relative overflow-hidden">
                        {logo ? (
                          <img src={logo} alt={d.paymentMethod || ''} className="w-full h-full object-cover" />
                        ) : (
                          <Wallet className="w-7 h-7" />
                        )}
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 rounded-full border-2 border-white animate-pulse" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-black text-slate-900 truncate">Course #{d.id?.slice(0, 8)}</p>
                          <span className={cn(
                            "text-[7px] font-black uppercase px-2 py-0.5 rounded-full",
                            logo ? "bg-slate-900 text-white" :
                            d.paymentMethod?.includes('ussd') ? "bg-orange-100 text-orange-600" :
                            d.paymentMethod === 'aggregator' ? "bg-indigo-100 text-indigo-600" : "bg-blue-100 text-blue-600"
                          )}>
                            {d.paymentMethod}
                          </span>
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Client: {d.clientName} • {d.cost} FCFA</p>
                        {d.paymentReference && (
                          <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mt-2 border-l-2 border-indigo-500 pl-2">
                             REF: {d.paymentReference}
                          </p>
                        )}
                        <p className="text-[8px] font-black text-orange-500 uppercase tracking-widest mt-1 italic">Attend confirmation manuelle</p>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <button 
                        onClick={async () => {
                          try {
                             const pickupCode = generateCode();
                             const deliveryCode = generateCode();
                             await api.deliveries.update(d.id, {
                               paymentStatus: 'confirmed',
                               isPaid: true,
                               pickupCode,
                               deliveryCode,
                               updatedAt: new Date().toISOString()
                             });
                             if (d.driverId) {
                               await sendNotification(d.driverId, "Paiement validé", `Le client a payé pour la course #${d.id.slice(-6)}.`, 'success', '/driver');
                             }
                             await sendNotification(d.clientId, "Paiement Confirmé", `Votre paiement pour la course #${d.id.slice(-6)} a été validé. Les codes sont disponibles.`, 'success', '/client');
                             alert('Paiement confirmé localement !');
                             fetchData();
                          } catch(e) { console.error('Error confirming payment:', e); alert('Erreur lors de la confirmation.'); }
                        }}
                        className="px-6 py-3 bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20"
                      >
                        Confirmer Réception
                      </button>
                      <button 
                        onClick={async () => {
                          try {
                             await api.deliveries.update(d.id, {
                               paymentStatus: 'rejected',
                               isPaid: false,
                               updatedAt: new Date().toISOString()
                             });
                             await sendNotification(d.clientId, "Paiement Rejeté", `Votre preuve de paiement pour la course #${d.id.slice(-6)} a été rejetée. Veuillez contacter le support.`, 'error', '/client');
                             alert('Paiement rejeté localement !');
                             fetchData();
                          } catch(e) { console.error('Error rejecting payment:', e); alert('Erreur lors du rejet.'); }
                        }}
                        className="px-4 py-3 bg-white text-rose-500 border border-red-100 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-rose-50 transition-all"
                      >
                        Rejeter
                      </button>
                    </div>
                  </div>
                );
              })}
              {pendingPayments.length === 0 && (
                <div className="py-20 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                  <ClipboardCheck className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                  <p className="text-slate-400 font-black uppercase text-xs tracking-widest">Aucun paiement en attente d'approbation</p>
                </div>
              )}
            </div>
          </div>
        );
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
                { label: 'VOLUME D\'AFFAIRES', value: `${deliveries.reduce((acc, curr) => acc + (curr.clientProposedPrice || curr.cost || 0), 0).toLocaleString()} FCFA`, icon: DollarSign, color: 'text-emerald-500', trend: '+18%' },
                { label: 'ZEMS EN SERVICE', value: users.filter(u => u.role === 'driver' && u.status === 'online').length, icon: Truck, color: 'text-indigo-500', trend: 'LIVE' },
              ].map((stat) => (
                <div key={stat.label} className="bg-white rounded-xl sm:rounded-2xl p-5 sm:p-7 shadow-sm border border-slate-100 flex flex-col justify-between relative overflow-hidden group hover:shadow-xl transition-all">
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

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:p-6">
              <div className="lg:col-span-8 bg-white rounded-2xl sm:rounded-3xl p-6 sm:p-6 lg:p-5 lg:p-6 shadow-sm border border-slate-100 relative overflow-hidden">
                <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-50">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
                    <h3 className="text-xl font-black text-slate-900 tracking-tighter uppercase whitespace-nowrap">Derniers Mouvements</h3>
                  </div>
                  <button onClick={() => setActiveMenu('Historique')} className="text-[10px] font-black text-orange-600 uppercase tracking-widest hover:underline px-4 py-2 bg-orange-50 rounded-xl">Voir tout</button>
                </div>

                <div className="space-y-4">
                  {deliveries.slice(0, 5).map((delivery) => (
                    <div key={delivery.id} className="p-4 sm:p-5 bg-slate-50/50 rounded-xl sm:rounded-3xl border border-slate-100 flex items-center justify-between gap-4 group hover:bg-white hover:shadow-xl transition-all">
                      <div className="flex items-center gap-3 sm:gap-5">
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-orange-600 shadow-sm border border-slate-100 shrink-0 overflow-hidden">
                          {getPaymentLogo(delivery.paymentMethod) ? (
                            <img src={getPaymentLogo(delivery.paymentMethod)!} alt={delivery.paymentMethod || ''} className="w-full h-full object-contain p-1" />
                          ) : (
                            <Package className="w-5 h-5" />
                          )}
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
                <div className="bg-white rounded-3xl p-6 lg:p-5 lg:p-6 shadow-sm border border-slate-100">
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

                <div className="bg-[#111827] rounded-3xl p-5 lg:p-6 text-white relative overflow-hidden shadow-2xl">
                  <div className="absolute top-5 lg:p-6 right-8 w-12 h-12 bg-orange-500/20 rounded-2xl flex items-center justify-center text-orange-400 border border-orange-500/30">
                    <ArrowUpRight className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="w-10 h-10 bg-orange-500/20 rounded-xl flex items-center justify-center text-orange-400 mb-6">
                      <Wallet className="w-5 h-5 rotate-45" />
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">GAINS PLATEFORME (GLOBAL)</p>
                    <p className="text-4xl font-black tracking-tighter mb-2">
                      {Math.floor(deliveries.reduce((acc, curr) => acc + (curr.clientProposedPrice || curr.cost || 0), 0) * (commission?.platformFeePercent || 15) / 100).toLocaleString()} <span className="text-lg opacity-60">FCFA</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl sm:rounded-3xl p-6 sm:p-6 lg:p-5 lg:p-6 shadow-sm border border-slate-100">
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
              <div className="h-[250px] sm:h-[400px] w-full min-h-[250px]">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
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
          <div className="bg-white rounded-3xl p-6 lg:p-5 lg:p-6 shadow-sm border border-slate-100">
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
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="font-black text-slate-900">{d.cost} FCFA</p>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-[8px] font-black uppercase bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">{d.status}</span>
                        {(d.paymentStatus === 'pending' || d.paymentStatus === 'pending_approval') && (
                          <span className="text-[7px] font-black uppercase bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full animate-pulse">Paiement à Valider</span>
                        )}
                      </div>
                    </div>
                    {(d.paymentStatus === 'pending' || d.paymentStatus === 'pending_approval') && (
                      <button 
                        onClick={async () => {
                          try {
                            const pickupCode = generateCode();
                            const deliveryCode = generateCode();
                            await api.deliveries.update(d.id, { 
                              paymentStatus: 'confirmed', 
                              isPaid: true,
                              pickupCode,
                              deliveryCode,
                              updatedAt: new Date().toISOString() 
                            });
                            fetchData();
                            if (d.driverId) {
                              await sendNotification(d.driverId, "Paiement validé", `Le client a payé pour la course #${d.id.slice(-6)}.`, 'success', '/driver');
                            }
                            await sendNotification(d.clientId, "Paiement Confirmé", `Votre paiement pour la course #${d.id.slice(-6)} a été validé.`, 'success', '/client');
                          } catch(e) {
                            console.error('Erreur lors de la validation:', e);
                          }
                        }}
                        className="px-4 py-2 bg-emerald-500 text-white text-[9px] font-black uppercase rounded-xl hover:bg-emerald-600 shadow-lg shadow-emerald-500/20"
                      >
                        Valider Paiement
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {filteredDeliveries.length === 0 && (
                <div className="text-center py-20 text-slate-400 font-black uppercase text-xs tracking-[0.2em]">Pas de courses dans cette catégorie</div>
              )}
            </div>
          </div>
        );
      case 'Administrateurs':
      case 'Livreurs (Zems)':
      case 'Clients':
        const filteredUsers = users.filter(u => {
          if (activeMenu === 'Livreurs (Zems)') return u.role === 'driver';
          if (activeMenu === 'Clients') return u.role === 'client';
          if (activeMenu === 'Administrateurs') return u.role === 'admin' || u.role === 'superadmin';
          return false;
        });
        return (
          <div className="bg-white rounded-3xl p-6 lg:p-5 lg:p-6 shadow-sm border border-slate-100">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">{activeMenu} ({filteredUsers.length})</h3>
              <button 
                onClick={() => {
                  setNewUserData(prev => ({ 
                    ...prev, 
                    role: activeMenu === 'Clients' ? 'client' : (activeMenu === 'Administrateurs' ? 'admin' : 'driver') 
                  }));
                  setShowCreateUserModal(true);
                }}
                className="bg-indigo-600 text-white px-6 py-3 rounded-2xl text-[10px] uppercase font-black tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-600/20 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Nouvel Utilisateur
              </button>
            </div>
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
                  
                  <div className="flex flex-wrap justify-center gap-2 mt-3">
                    {u.role === 'driver' && (
                      <div className="flex flex-col gap-1 items-center">
                        <div className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[8px] font-black uppercase tracking-widest">
                           {u.vehicleType || 'Moto'} • {u.licensePlate || 'Nouveau'}
                        </div>
                        <div className={cn(
                          "px-3 py-1 rounded-full text-[7px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-sm border",
                          u.status === 'online' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                          u.status === 'busy' ? "bg-amber-50 text-amber-600 border-amber-100" :
                          "bg-slate-50 text-slate-400 border-slate-100"
                        )}>
                          <div className={cn("w-1.5 h-1.5 rounded-full", u.status === 'online' ? "bg-emerald-500 animate-pulse" : u.status === 'busy' ? "bg-amber-500" : "bg-slate-300")} />
                          {u.status === 'online' ? 'Disponible' : u.status === 'busy' ? 'Occupé' : 'Hors Ligne'}
                        </div>
                      </div>
                    )}
                    {u.role === 'driver' && u.verificationStatus === 'pending' && (
                      <div className="px-3 py-1 bg-blue-100 text-blue-600 rounded-full text-[8px] font-black uppercase tracking-widest animate-pulse border border-blue-200">
                         Dossier à vérifier
                      </div>
                    )}
                    {u.accountStatus === 'pending_approval' && (
                      <div className="px-3 py-1 bg-amber-100 text-amber-600 rounded-full text-[8px] font-black uppercase tracking-widest animate-pulse">
                         Attente Approbation
                      </div>
                    )}
                  </div>

                  <div className="mt-6 flex flex-col gap-2 w-full">
                    {(u.accountStatus === 'pending_approval' || u.verificationStatus === 'pending') && u.role === 'driver' && (
                      <button 
                        onClick={async () => {
                          try {
                            const updates = { 
                              accountStatus: 'active',
                              verificationStatus: 'verified',
                              isVerified: true,
                              updatedAt: new Date().toISOString()
                            };
                            await api.admin.users.update(u.userId, updates);
                            fetchData();
                            
                            await sendNotification(
                              u.userId, 
                              "Dossier Approuvé 🎉", 
                              "Bienvenue chez LIVRA EXPRESS ! Votre compte est activé et vos documents sont validés.", 
                              'success'
                            );
                          } catch(err) {
                            console.error(err);
                          }
                        }}
                        className="w-full bg-emerald-500 text-white py-2.5 rounded-xl text-[8px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20"
                      >
                        Valider Livreur & Dossier
                      </button>
                    )}
                    
                    <div className="flex gap-2">
                       <button 
                         onClick={() => setSelectedUser(u)}
                         className="flex-1 bg-white border border-slate-200 py-2.5 rounded-xl text-[8px] font-black uppercase tracking-widest hover:bg-orange-50 transition-all font-sans"
                       >
                         Détails
                       </button>
                    </div>
                    {isSuperAdmin && (
                      <div className="flex gap-2">
                         <button 
                           onClick={async () => {
                             const action = u.accountStatus === 'suspended' ? 'active' : 'suspended';
                             try {
                               await api.admin.users.update(u.userId, { 
                                 accountStatus: action,
                                 updatedAt: new Date().toISOString()
                               });
                                fetchData();
                             } catch(err) {
                               console.error('Erreur lors de la modification');
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
                    )}
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
           <div className="bg-white rounded-3xl p-6 lg:p-5 lg:p-6 shadow-sm border border-slate-100">
             <div className="flex items-center justify-between mb-10">
               <div>
                 <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Journal des Commissions</h3>
                 <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1">Revenus générés par la plateforme</p>
               </div>
               <div className="bg-emerald-50 text-emerald-600 p-6 rounded-3xl border border-emerald-100 flex flex-col items-end">
                 <p className="text-[10px] font-black uppercase tracking-widest opacity-60">TOTAL PLATFORME</p>
                 <p className="text-2xl font-black tracking-tighter">
                   {Math.floor(deliveries.reduce((acc, curr) => acc + (curr.clientProposedPrice || curr.cost || 0), 0) * (commission?.platformFeePercent || 15) / 100).toLocaleString()} FCFA
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
        const pendingWithdrawals = withdrawals.filter(w => w.status === 'en_attente');

        return (
          <div className="bg-white rounded-3xl p-6 lg:p-5 lg:p-6 shadow-sm border border-slate-100">
             <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Paiements des Livreurs</h3>
             </div>

             {pendingWithdrawals.length === 0 ? (
               <div className="text-center py-10 bg-slate-50 rounded-3xl border border-slate-100">
                 <Wallet className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                 <p className="text-slate-500 font-medium">Aucun paiement en attente pour le moment.</p>
               </div>
             ) : (
               <div className="grid grid-cols-1 gap-6">
                  {pendingWithdrawals.map((withdrawal) => {
                    const driver = users.find(u => u.userId === withdrawal.driverId);
                    return (
                      <div key={withdrawal.id} className="p-5 lg:p-6 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-5 group hover:bg-white hover:shadow-2xl transition-all">
                         <div className="flex items-center gap-6">
                           <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-blue-600 shadow-sm border border-slate-100 relative">
                             <Truck className="w-7 h-7" />
                             {driver?.driverType === 'company' && (
                               <div className="absolute -top-2 -right-2 bg-blue-600 text-white p-1 rounded-lg">
                                 <Building2 className="w-3 h-3" />
                               </div>
                             )}
                           </div>
                           <div>
                             <div className="flex items-center gap-2 mb-1">
                               <h4 className="font-black text-slate-900 uppercase">
                                 {withdrawal.driverName}
                               </h4>
                               <span className={cn(
                                 "text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full",
                                 "bg-slate-200 text-slate-600"
                               )}>
                                 {driver?.phone || withdrawal.phone || 'Non renseigné'}
                               </span>
                             </div>
                             <div className="flex flex-col gap-1">
                               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                  Du {new Date(withdrawal.createdAt).toLocaleDateString()}
                               </p>
                               <div className="flex items-center gap-2 mt-1">
                                  <span className="text-[8px] font-black text-red-500 uppercase tracking-widest bg-red-50 px-2 py-0.5 rounded-full">Demande de {withdrawal.amount} F</span>
                               </div>
                             </div>
                           </div>
                         </div>
                         <div className="flex gap-6 items-center">
                           <div className="text-right">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">À PAYER</p>
                              <p className="text-2xl font-black text-slate-900 tracking-tighter">
                                {withdrawal.amount?.toLocaleString()} FCFA
                              </p>
                           </div>
                           <button 
                             onClick={() => handleValidateWithdrawal(withdrawal.id)}
                             disabled={isProcessingAction}
                             className="bg-slate-900 text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-blue-600 transition-all shadow-xl shadow-slate-200 disabled:opacity-50"
                           >
                             Valider
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
          <div className="max-w-4xl bg-white rounded-3xl p-6 lg:p-5 lg:p-6 shadow-sm border border-slate-100">
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
              <form onSubmit={handleUpdateCommission} className="grid grid-cols-1 md:grid-cols-2 gap-5 lg:p-6">
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
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-2">Missions Simultanées Max</label>
                    <div className="relative">
                      <Package className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        type="number" 
                        value={commission.maxSimultaneousDeliveries || 2}
                        onChange={e => setCommission({ ...commission, maxSimultaneousDeliveries: Number(e.target.value) })}
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

                <div className="md:col-span-2 mt-8 space-y-6">
                  <div className="flex items-center justify-between px-2 mb-4 bg-orange-50 p-6 rounded-3xl border border-orange-100">
                    <div>
                      <h4 className="text-[12px] font-black text-orange-600 uppercase tracking-widest flex items-center gap-2">
                        <BadgePercent className="w-5 h-5" />
                        Activer la Promo (Tarifs Réduits)
                      </h4>
                      <p className="text-[10px] text-orange-500/80 mt-1 font-bold">Applique les tarifs promotionnels définis ci-dessous.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        value="" 
                        className="sr-only peer"
                        checked={commission.promoEnabled ?? false}
                        onChange={(e) => setCommission({ ...commission, promoEnabled: e.target.checked })}
                      />
                      <div className="w-14 h-7 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-orange-500"></div>
                    </label>
                  </div>
                  <div className="flex items-center justify-between px-2">
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Tarification Promo & Intervalles de Distance</h4>
                    <button 
                      type="button"
                      onClick={handleAddDistanceRule}
                      className="text-[10px] font-black text-orange-600 uppercase tracking-widest flex items-center gap-2 hover:text-orange-700 transition-colors"
                    >
                      <Plus className="w-4 h-4" /> Ajouter un Intervalle
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    {(commission.distancePricingRules || []).map((rule) => (
                      <div key={rule.id} className="bg-slate-50 p-6 rounded-3xl border border-slate-100 grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
                        <div className="sm:col-span-1">
                          <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Min (KM)</label>
                          <input 
                            type="number"
                            value={rule.minKm}
                            onChange={(e) => handleUpdateDistanceRule(rule.id, { minKm: Number(e.target.value) })}
                            className="w-full bg-white border-none rounded-xl px-4 py-2 text-xs font-black focus:ring-2 focus:ring-orange-100"
                          />
                        </div>
                        <div className="sm:col-span-1">
                          <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Max (KM)</label>
                          <input 
                            type="number"
                            value={rule.maxKm}
                            onChange={(e) => handleUpdateDistanceRule(rule.id, { maxKm: Number(e.target.value) })}
                            className="w-full bg-white border-none rounded-xl px-4 py-2 text-xs font-black focus:ring-2 focus:ring-orange-100"
                          />
                        </div>
                        <div className="sm:col-span-1">
                          <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Prix (FCFA)</label>
                          <input 
                            type="number"
                            value={rule.price}
                            onChange={(e) => handleUpdateDistanceRule(rule.id, { price: Number(e.target.value) })}
                            className="w-full bg-white border-none rounded-xl px-4 py-2 text-xs font-black focus:ring-2 focus:ring-orange-100"
                          />
                        </div>
                        <div className="flex justify-end">
                          <button 
                            type="button"
                            onClick={() => handleRemoveDistanceRule(rule.id)}
                            className="w-10 h-10 bg-white text-red-500 rounded-xl flex items-center justify-center border border-slate-100 hover:bg-red-50 transition-colors shadow-sm"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    ))}

                    {(commission.distancePricingRules || []).length === 0 && (
                      <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-6 lg:p-5 lg:p-6 text-center">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Aucun intervalle défini. Le tarif par KM standard sera utilisé.</p>
                      </div>
                    )}
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
        const activeDrivers = users.filter(u => u.role === 'driver');
        return (
          <div className="bg-white rounded-3xl p-6 sm:p-6 lg:p-5 lg:p-6 shadow-sm border border-slate-100 overflow-hidden flex flex-col h-[600px] lg:h-full">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
              <div>
                <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Carte en Temps Réel</h3>
                <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mt-1">Suivi en direct de la flotte et des colis</p>
              </div>
              <div className="flex gap-4">
                <div className="flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-full border border-blue-100">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                  <span className="text-[9px] font-black uppercase text-blue-600 tracking-wider">Flux Live Actif</span>
                </div>
              </div>
            </div>
            
            <div className="flex-1 min-h-0">
               <LiveMap 
                 drivers={activeDrivers} 
                 deliveries={deliveries} 
               />
            </div>
          </div>
        );
      case 'Secteurs d\'Ouaga':
        return (
          <div className="bg-white rounded-3xl p-6 lg:p-5 lg:p-6 shadow-sm border border-slate-100">
             <div className="flex justify-between items-center mb-8">
               <div>
                  <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Maillage Territorial</h3>
                  <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1">Secteurs actifs et couverture réseau</p>
               </div>
               <button 
                 onClick={async () => {
                   const name = prompt('Nom du nouveau secteur (ex: Wayalghin) :');
                   if (name) {
                     await api.sectors.create({ name, city: 'Ouagadougou', isActive: true });
                    fetchData();
                   }
                 }}
                 className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-orange-600 transition-all shadow-xl"
               >
                 <Plus className="w-4 h-4" /> Ajouter Secteur
               </button>
             </div>
             <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {sectors.map(s => {
                  const activityCount = deliveries.filter(d => 
                    d.from?.address?.toLowerCase().includes(s.name.toLowerCase()) || 
                    d.to?.address?.toLowerCase().includes(s.name.toLowerCase())
                  ).length;
                  return (
                    <div 
                      key={s.id} 
                      className="p-6 bg-slate-50 rounded-3xl border border-slate-100 group transition-all relative"
                    >
                      <button 
                        onClick={async () => {
                          await api.sectors.delete(s.id);
                          fetchData();
                        }}
                        className="absolute top-4 right-4 w-6 h-6 bg-white rounded-lg flex items-center justify-center text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity border border-rose-100 hover:bg-rose-50"
                      >
                         <Trash2 className="w-3 h-3" />
                      </button>
                      <Globe className="w-6 h-6 text-slate-300 mb-4 group-hover:text-orange-500 transition-all" />
                      <div className="flex justify-between items-end">
                        <span className="font-black text-slate-900 text-sm uppercase">{s.name}</span>
                        <span className={cn(
                          "text-[10px] font-black px-2 py-1 rounded-lg",
                          activityCount > 0 ? "text-emerald-500 bg-emerald-50" : "text-slate-400 bg-white border border-slate-100"
                        )}>
                          {activityCount} Flux
                        </span>
                      </div>
                    </div>
                  );
                })}
                {sectors.length === 0 && (
                  <div className="col-span-full py-20 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                    <p className="text-slate-400 font-black uppercase text-[10px] tracking-widest leading-none">Aucun secteur défini dans la base de données</p>
                    <p className="text-slate-300 font-bold text-[9px] uppercase tracking-widest mt-2 leading-none cursor-pointer" onClick={async () => {
                       for (const n of ['Paspanga', 'Koulouba', 'Gounghin', 'Dassasgho', 'Ouaga 2000']) {
                         await api.sectors.create({ name: n, city: 'Ouagadougou', isActive: true });
                       }
                       fetchData();
                    }}>Initialiser avec les secteurs par défaut</p>
                  </div>
                )}
             </div>
          </div>
        );
      case 'Annonces Globales':
        return (
          <div className="bg-white rounded-3xl p-6 lg:p-5 lg:p-6 shadow-sm border border-slate-100">
             <div className="flex justify-between items-center mb-8">
               <div>
                  <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Centre d'Annonces</h3>
                  <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1">Diffuser des alertes à toute la plateforme</p>
               </div>
               <button 
                 onClick={() => setShowNewAnnonceForm(!showNewAnnonceForm)}
                 className="flex items-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-orange-600 transition-all shadow-xl shadow-orange-200"
               >
                 {showNewAnnonceForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                 {showNewAnnonceForm ? 'Fermer' : 'Nouvelle Annonce'}
               </button>
             </div>

             {showNewAnnonceForm && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mb-10 p-5 lg:p-6 bg-slate-50 rounded-2xl border border-slate-200 shadow-inner"
                >
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Titre de l'alerte</label>
                        <input 
                          type="text" 
                          placeholder="Maintenance, Promo, etc." 
                          value={newAnnonce.title}
                          onChange={e => setNewAnnonce({...newAnnonce, title: e.target.value})}
                          className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 text-sm font-bold focus:border-orange-500 outline-none shadow-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Niveau d'Urgence</label>
                        <select 
                          value={newAnnonce.type}
                          onChange={e => setNewAnnonce({...newAnnonce, type: e.target.value as any})}
                          className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 text-sm font-bold focus:border-orange-500 outline-none shadow-sm"
                        >
                          <option value="info">Information</option>
                          <option value="warning">Alerte Critique</option>
                          <option value="success">Notification Succès</option>
                        </select>
                      </div>
                      <div className="md:col-span-2 space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Message détaillé</label>
                        <textarea 
                          className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 text-sm font-bold focus:border-orange-500 outline-none h-32 shadow-sm"
                          placeholder="Décrivez l'annonce aux utilisateurs..."
                          value={newAnnonce.message}
                          onChange={e => setNewAnnonce({...newAnnonce, message: e.target.value})}
                        />
                      </div>
                   </div>
                   <div className="flex justify-end pt-4 border-t border-slate-200">
                      <button 
                        onClick={async () => {
                          if (!newAnnonce.title || !newAnnonce.message) return;
                          await api.announcements.create({
                            ...newAnnonce,
                            targetRole: 'all',
                            activeUntil: new Date(Date.now() + 86400000 * 7).toISOString(),
                            createdAt: new Date().toISOString()
                          });
                          setNewAnnonce({ title: '', message: '', type: 'info' });
                          setShowNewAnnonceForm(false);
                          fetchData();
                        }}
                        className="px-12 py-5 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-orange-600 transition-all shadow-xl active:scale-95"
                      >
                        Publier l'annonce
                      </button>
                   </div>
                </motion.div>
             )}

             <div className="space-y-4">
                {announcements.map(a => (
                  <div key={a.id} className="p-6 bg-slate-50 rounded-3xl border border-slate-100 flex items-center justify-between gap-6 hover:bg-white transiton-all group">
                    <div className="flex items-center gap-6">
                       <div className={cn(
                         "w-12 h-12 rounded-2xl flex items-center justify-center",
                         a.type === 'warning' ? "bg-orange-100 text-orange-600" :
                         a.type === 'success' ? "bg-emerald-100 text-emerald-600" : "bg-blue-100 text-blue-600"
                       )}>
                         <Bell className="w-6 h-6" />
                       </div>
                       <div>
                         <h4 className="font-black text-slate-900 uppercase text-sm tracking-tight">{a.title}</h4>
                         <p className="text-xs font-bold text-slate-500 mt-0.5">{a.message}</p>
                         <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2">Expire le : {new Date(a.activeUntil).toLocaleDateString()}</p>
                       </div>
                    </div>
                    <button 
                      onClick={async () => {
                        await api.announcements.delete(a.id);
                        fetchData();
                      }}
                      className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-rose-500 border border-slate-100 opacity-0 group-hover:opacity-100 transition-all hover:bg-rose-50"
                    >
                       <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {announcements.length === 0 && (
                  <div className="py-20 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                    <p className="text-slate-400 font-black uppercase text-[10px] tracking-widest leading-none">Aucune annonce active en ce moment</p>
                  </div>
                )}
             </div>
          </div>
        );
      case 'Paramètres App':
        return (
          <form onSubmit={handleUpdateConfig} className="bg-white rounded-3xl p-6 lg:p-5 lg:p-6 shadow-sm border border-slate-100">
             <div className="flex justify-between items-center mb-8">
               <div>
                  <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Configuration Système</h3>
                  <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1">Modes de fonctionnement et maintenance</p>
               </div>
               <button 
                 disabled={isSaving}
                 type="submit"
                 className="flex items-center gap-3 px-6 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-orange-600 transition-all shadow-xl shadow-slate-200 disabled:opacity-50"
               >
                 {isSaving ? <Clock className="w-4 h-4 animate-spin" /> : <Settings className="w-4 h-4" />}
                 Enregistrer
               </button>
             </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-5 lg:p-6">
                  <div className="p-5 lg:p-6 bg-slate-50 rounded-2xl border border-slate-100">
                     <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-4">
                           <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
                              <Zap className="w-5 h-5" />
                           </div>
                           <h4 className="font-black text-slate-900 uppercase text-sm tracking-tight">Mode de Production</h4>
                        </div>
                        <span className={cn(
                          "text-[9px] font-black uppercase px-2 py-1 rounded-lg",
                          configForm?.mode === 'prod' ? "bg-emerald-100 text-emerald-600" : "bg-orange-100 text-orange-600"
                        )}>
                          {configForm?.mode || 'TEST'}
                        </span>
                     </div>
                     <div className="flex gap-2">
                        <button 
                          type="button"
                          onClick={() => setConfigForm({ ...configForm!, mode: 'test' })}
                          className={cn("flex-1 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all", configForm?.mode === 'test' ? "bg-orange-500 text-white shadow-lg shadow-orange-200" : "bg-white border border-slate-200 text-slate-400 hover:bg-white")}
                        >
                          Mode Test
                        </button>
                        <button 
                          type="button"
                          onClick={() => setConfigForm({ ...configForm!, mode: 'prod' })}
                          className={cn("flex-1 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all", configForm?.mode === 'prod' ? "bg-emerald-500 text-white shadow-lg shadow-emerald-200" : "bg-white border border-slate-200 text-slate-400 hover:bg-white")}
                        >
                          Production
                        </button>
                     </div>
                     <p className="text-[10px] text-slate-400 font-bold mt-4 leading-relaxed uppercase tracking-tight">Le mode test désactive les vrais paiements bancaires et utilise les sandbox opérateurs.</p>
                  </div>

                  <div className="p-5 lg:p-6 bg-slate-50 rounded-2xl border border-slate-100">
                     <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-4">
                           <div className="w-10 h-10 bg-rose-100 text-rose-600 rounded-xl flex items-center justify-center">
                              <ShieldCheck className="w-5 h-5" />
                           </div>
                           <h4 className="font-black text-slate-900 uppercase text-sm tracking-tight">Mode Maintenance</h4>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={configForm?.isMaintenanceMode || false}
                            onChange={(e) => setConfigForm({ ...configForm!, isMaintenanceMode: e.target.checked })}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-rose-500 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                        </label>
                     </div>
                     <input 
                        type="text"
                        placeholder="Message de maintenance..."
                        value={configForm?.maintenanceMessage || ''}
                        onChange={(e) => setConfigForm({ ...configForm!, maintenanceMessage: e.target.value })}
                        className="w-full bg-white border-none rounded-xl px-4 py-3 text-xs font-bold focus:ring-4 focus:ring-rose-100"
                     />
                     <p className="text-[10px] text-slate-400 font-bold mt-4 leading-relaxed uppercase tracking-tight">Une fois actif, bloquera tout accès aux clients et drivers avec le message ci-dessus.</p>
                  </div>
               </div>

               <div className="mt-8 p-6 lg:p-8 bg-slate-50 rounded-[32px] border border-slate-100">
                  <div className="flex items-center gap-5 mb-8">
                     <div className="w-12 h-12 bg-indigo-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200">
                        <Smartphone className="w-6 h-6" />
                     </div>
                     <div>
                        <h4 className="font-black text-slate-900 uppercase text-lg tracking-tight">Syntaxes USSD (Paiement Manuel)</h4>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Configurez les codes que les clients composeront sur leur téléphone</p>
                     </div>
                  </div>

                  <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 mb-8 flex gap-4 items-start">
                    <div className="w-8 h-8 bg-amber-100 text-amber-600 rounded-lg flex items-center justify-center shrink-0">
                      <Zap className="w-4 h-4" />
                    </div>
                    <div>
                      <h5 className="text-[10px] font-black text-amber-900 uppercase tracking-widest mb-1">Instruction Importante</h5>
                      <p className="text-xs text-amber-800 font-medium leading-relaxed">
                        Utilisez le mot-clé <span className="font-black bg-amber-200 px-1.5 py-0.5 rounded text-amber-950">{"{amount}"}</span> n'importe où dans la syntaxe. L'application le remplacera automatiquement par le prix de la course avant d'afficher le code au client.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                     {/* Orange Money */}
                     <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 hover:shadow-xl transition-all group">
                        <div className="flex items-center gap-4 mb-4">
                           <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center overflow-hidden border border-orange-100">
                              <img src="/payments/orange.png" alt="Orange" className="w-full h-full object-contain p-1" onError={(e) => { (e.target as HTMLImageElement).src = '//placehold.co/40?text=O' }}/>
                           </div>
                           <label className="text-[11px] font-black uppercase tracking-[0.1em] text-slate-800">Orange Money</label>
                        </div>
                        <input 
                           type="text"
                           placeholder="Ex: *144*4*6*{amount}#"
                           value={configForm?.ussdSyntaxOrange || ''}
                           onChange={(e) => setConfigForm({ ...configForm!, ussdSyntaxOrange: e.target.value })}
                           className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl px-5 py-4 text-sm font-black text-slate-900 focus:outline-none focus:border-orange-500 focus:bg-white transition-all outline-none"
                        />
                        <p className="text-[9px] text-slate-400 font-bold mt-3 leading-relaxed italic">Exemple: *144*4*6*{"{amount}"}#</p>
                     </div>

                     {/* Moov Money */}
                     <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 hover:shadow-xl transition-all group">
                        <div className="flex items-center gap-4 mb-4">
                           <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center overflow-hidden border border-blue-100">
                              <img src="/payments/moov.png" alt="Moov" className="w-full h-full object-contain p-1" onError={(e) => { (e.target as HTMLImageElement).src = '//placehold.co/40?text=M' }}/>
                           </div>
                           <label className="text-[11px] font-black uppercase tracking-[0.1em] text-slate-800">Moov Money</label>
                        </div>
                        <input 
                           type="text"
                           placeholder="Ex: *155*4*1*{amount}#"
                           value={configForm?.ussdSyntaxMoov || ''}
                           onChange={(e) => setConfigForm({ ...configForm!, ussdSyntaxMoov: e.target.value })}
                           className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl px-5 py-4 text-sm font-black text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white transition-all outline-none"
                        />
                        <p className="text-[9px] text-slate-400 font-bold mt-3 leading-relaxed italic">Exemple: *155*4*1*{"{amount}"}#</p>
                     </div>

                     {/* Telecel Money */}
                     <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 hover:shadow-xl transition-all group">
                        <div className="flex items-center gap-4 mb-4">
                           <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center overflow-hidden border border-indigo-100">
                              <img src="/payments/telecel.png" alt="Telecel" className="w-full h-full object-contain p-1" onError={(e) => { (e.target as HTMLImageElement).src = '//placehold.co/40?text=T' }}/>
                           </div>
                           <label className="text-[11px] font-black uppercase tracking-[0.1em] text-slate-800">Telecel Money</label>
                        </div>
                        <input 
                           type="text"
                           placeholder="Ex: *156*4*2*{amount}#"
                           value={configForm?.ussdSyntaxTelecel || ''}
                           onChange={(e) => setConfigForm({ ...configForm!, ussdSyntaxTelecel: e.target.value })}
                           className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl px-5 py-4 text-sm font-black text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all outline-none"
                        />
                        <p className="text-[9px] text-slate-400 font-bold mt-3 leading-relaxed italic">Exemple: *156*4*2*{"{amount}"}#</p>
                     </div>

                     {/* Coris Money */}
                     <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 hover:shadow-xl transition-all group">
                        <div className="flex items-center gap-4 mb-4">
                           <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center overflow-hidden border border-blue-100">
                              <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center text-white font-bold text-[8px]">C</div>
                           </div>
                           <label className="text-[11px] font-black uppercase tracking-[0.1em] text-slate-800">Coris Money</label>
                        </div>
                        <input 
                           type="text"
                           placeholder="Ex: *555*1*1*{amount}#"
                           value={configForm?.ussdSyntaxCoris || ''}
                           onChange={(e) => setConfigForm({ ...configForm!, ussdSyntaxCoris: e.target.value })}
                           className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl px-5 py-4 text-sm font-black text-slate-900 focus:outline-none focus:border-blue-400 focus:bg-white transition-all outline-none"
                        />
                        <p className="text-[9px] text-slate-400 font-bold mt-3 leading-relaxed italic">Exemple: *555*1*1*{"{amount}"}#</p>
                     </div>

                     {/* Autre */}
                     <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 hover:shadow-xl transition-all group">
                        <div className="flex items-center gap-4 mb-4">
                           <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center overflow-hidden border border-slate-100">
                              <Landmark className="w-5 h-5 text-slate-400" />
                           </div>
                           <label className="text-[11px] font-black uppercase tracking-[0.1em] text-slate-800">Autre Syntaxe</label>
                        </div>
                        <input 
                           type="text"
                           placeholder="Ex: *000*0*0*{amount}#"
                           value={configForm?.ussdSyntaxGeneric || ''}
                           onChange={(e) => setConfigForm({ ...configForm!, ussdSyntaxGeneric: e.target.value })}
                           className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl px-5 py-4 text-sm font-black text-slate-900 focus:outline-none focus:border-slate-400 focus:bg-white transition-all outline-none"
                        />
                        <p className="text-[9px] text-slate-400 font-bold mt-3 leading-relaxed italic">Syntaxe générique par défaut.</p>
                     </div>
                  </div>

                  <div className="mt-8 pt-8 border-t border-slate-200">
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest leading-relaxed text-center">
                      Ces syntaxes sont cruciales pour le parcours utilisateur "Paiement Manuel". <br/>
                      <span className="text-orange-600">Assurez-vous de vérifier le code court de votre compte marchand avant de valider.</span>
                    </p>
                  </div>
               </div>
            </form>
        );
      case 'Transactions':
        return (
          <div className="bg-white rounded-3xl p-6 lg:p-5 lg:p-6 shadow-sm border border-slate-100">
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
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 flex h-[700px] overflow-hidden">
             {/* Sidebar: List of Chats */}
             <div className="w-80 border-r border-slate-100 flex flex-col bg-slate-50/50">
                <div className="p-5 lg:p-6 border-b border-slate-100 bg-white">
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
                    <div className="p-5 lg:p-6 border-b border-slate-100 flex items-center justify-between">
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

                    <div className="flex-1 overflow-y-auto p-6 lg:p-5 lg:p-6 space-y-6 bg-slate-50/30">
                       {currentChatMessages.map((msg, idx) => {
                          const isMe = msg.senderId === profile?.userId;
                          const senderProfile = users.find(u => u.userId === msg.senderId);
                          return (
                            <div key={msg.id} className={cn("flex flex-col", isMe ? "items-end" : "items-start")}>
                               <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">
                                  {msg.senderName || 'Inconnu'} • {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString() : ''}
                               </span>
                               <div className={cn(
                                 "max-w-[70%] p-5 rounded-xl text-sm font-bold shadow-sm",
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
                     <div className="w-24 h-24 bg-slate-50 rounded-3xl flex items-center justify-center mb-8">
                        <MessageSquare className="w-12 h-12 text-slate-200" />
                     </div>
                     <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter mb-4">Centre de Support Actif</h3>
                     <p className="text-slate-400 font-bold text-xs uppercase tracking-widest max-w-sm">Sélectionnez une discussion à gauche pour intervenir en tant qu'administrateur ou modérateur.</p>
                  </div>
                )}
             </div>
          </div>
        );
      case 'Logs Système':
        const systemLogs = [
          { id: 1, type: 'AUTH', text: 'Nouvelle connexion SuperAdmin', user: 'Admin', time: 'Il y a 2 min', color: 'text-indigo-500' },
          { id: 2, type: 'PAYMENT', text: `Validation attendue: course de ${deliveries[0]?.clientName || 'un client'}`, user: 'System', time: 'Il y a 5 min', color: 'text-orange-500' },
          { id: 3, type: 'LOGISTICS', text: 'Nouvelle mission publiée à Ouaga 2000', user: 'Client', time: 'Il y a 12 min', color: 'text-emerald-500' },
          { id: 4, type: 'DB', text: 'Optimisation des index Firestore complétée', user: 'Vercel/Fire', time: 'Il y a 45 min', color: 'text-slate-500' },
          { id: 5, type: 'AUTH', text: 'Tentative de connexion échouée (IP: 192.168.1.1)', user: 'Guest', time: 'Il y a 1h', color: 'text-red-500' },
        ];
        return (
          <div className="bg-white rounded-3xl p-6 lg:p-5 lg:p-6 shadow-sm border border-slate-100 h-full overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Journaux du Système LIVRA</h3>
                <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1">Surveillance en temps réel des activités plateforme</p>
              </div>
              <div className="flex gap-2">
                 <div className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                    Live Watcher
                 </div>
              </div>
            </div>

            <div className="space-y-4 overflow-y-auto pr-2">
              {systemLogs.map(log => (
                <div key={log.id} className="p-5 bg-slate-50 rounded-3xl border border-slate-100 flex items-center justify-between hover:bg-white transition-all group">
                   <div className="flex items-center gap-4">
                      <div className={cn("w-2 h-10 rounded-full bg-slate-200 group-hover:w-3 transition-all", log.color.replace('text-', 'bg-'))} />
                      <div>
                         <div className="flex items-center gap-2 mb-1">
                            <span className={cn("text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-white border border-slate-100", log.color)}>
                               {log.type}
                            </span>
                            <span className="text-[9px] font-bold text-slate-400 uppercase">{log.time}</span>
                         </div>
                         <p className="text-sm font-bold text-slate-800 tracking-tight">{log.text}</p>
                      </div>
                   </div>
                   <div className="text-right">
                      <p className="text-[9px] font-black uppercase text-slate-400 mb-0.5">Acteur</p>
                      <p className="text-xs font-black text-slate-900">{log.user}</p>
                   </div>
                </div>
              ))}
            </div>

            <div className="mt-8 pt-8 border-t border-slate-100">
               <div className="bg-slate-900 rounded-2xl p-6 text-emerald-400 font-mono text-[10px] leading-relaxed shadow-xl">
                  <p className="opacity-50 break-all mb-2">DEBUG_TRACE: 0x44F9A... Initializing Watchtower core...</p>
                  <p className="opacity-70 break-all mb-2">DB_CONNECTED: Firestore Enterprise v2.b42 (Ouagadougou-1)</p>
                  <p className="animate-pulse">_ READY: Waiting for socket incoming requests...</p>
               </div>
            </div>
          </div>
        );
      case 'Base de Données':
        return (
          <div className="bg-white rounded-3xl p-6 lg:p-5 lg:p-6 shadow-sm border border-slate-100 flex flex-col h-full min-h-[600px]">
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
          <div className="flex flex-col items-center justify-center py-32 bg-white rounded-3xl border border-slate-100 shadow-sm text-center px-10">
            <Store className="w-24 h-24 text-slate-100 mb-8" />
            <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter mb-4">Module {activeMenu}</h3>
            <p className="text-slate-400 font-bold text-sm uppercase tracking-widest max-w-md">Ce module de suivi en temps réel de LIVRA est en cours de déploiement sécurisé.</p>
          </div>
        );
    }
  };

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
    <div className="flex-1 flex w-full bg-[#f8fafc] overflow-hidden min-h-0">
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
      <aside className="w-64 bg-white border-r border-slate-200 overflow-y-auto hidden lg:block scrollbar-hide">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-xl shadow-indigo-100">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-black text-slate-900 text-lg tracking-tight leading-none uppercase">LIVRA</h2>
              <p className="text-[9px] font-black text-indigo-500 uppercase tracking-[0.3em] mt-1.5">Administration</p>
            </div>
          </div>

          <div className="space-y-8">
            {sidebarItems.map((group) => (
              <div key={group.group}>
                <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 px-3">{group.group}</h3>
                <div className="space-y-1">
                  {group.items.map((item) => (
                    <button
                      key={item.name}
                      onClick={() => handleMenuChange(item.name)}
                      className={cn(
                        "w-full flex items-center justify-between px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-tight transition-all duration-300",
                        activeMenu === item.name 
                          ? "bg-slate-900 text-white shadow-sm scale-[1.02]" 
                          : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <item.icon className={cn("w-4 h-4", activeMenu === item.name ? "text-white" : "text-slate-400")} />
                        {item.name}
                      </div>
                      {item.name === 'Paiements Livreurs' && withdrawals.some(w => w.status === 'en_attente') && (
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

      <main className="flex-1 flex flex-col overflow-hidden bg-slate-50 shadow-inner min-h-0">
        <header className="bg-white px-4 sm:px-8 py-4 flex flex-col gap-4 sm:flex-row sm:items-center justify-between sticky top-0 z-40 border-b border-slate-200 shrink-0 shadow-sm">
          <div className="flex items-center justify-between sm:justify-start gap-4">
             <button 
               onClick={() => setIsSidebarOpen(true)}
               className="lg:hidden w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-600"
             >
               <Menu className="w-5 h-5" />
             </button>
             <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase">{activeMenu}</h3>
             {isMasterAdmin && (
               <div className="flex gap-2">
                 <button 
                  onClick={handleSeedData} 
                  disabled={isSaving}
                  className="px-4 py-2 bg-emerald-100 hover:bg-emerald-500 hover:text-white text-emerald-600 rounded-lg text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-colors flex items-center gap-2"
                 >
                   <Package className="w-3 h-3" /> <span className="hidden sm:inline">Générer Données</span>
                 </button>
                 <button 
                  onClick={() => setShowResetConfirm(true)} 
                  disabled={isSaving}
                  className="px-4 py-2 bg-red-100 hover:bg-red-500 hover:text-white text-red-600 rounded-lg text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-colors flex items-center gap-2"
                 >
                   <ShieldCheck className="w-3 h-3" /> <span className="hidden sm:inline">Hard Reset</span>
                 </button>
               </div>
             )}
          </div>

          <div className="flex flex-wrap items-center gap-3 sm:gap-6 justify-between sm:justify-end">
            {isSuperAdmin && (
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
            )}
            
            {isSuperAdmin && <div className="hidden sm:block h-10 w-px bg-slate-100 mx-2" />}

            {isMasterAdmin && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <span className="text-[7px] sm:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Tester Rôle:</span>
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
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 lg:p-6 lg:p-6 lg:p-5 lg:p-6 scrollbar-hide">
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

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {isSidebarOpen && (
          <div className="fixed inset-0 z-[60] lg:hidden">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" 
            />
            <motion.aside 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute inset-y-0 left-0 w-80 bg-white shadow-2xl flex flex-col pt-[env(safe-area-inset-top)]"
            >
               <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <span className="font-black text-slate-900 uppercase">LIVRA ADMIN</span>
                  </div>
                  <button onClick={() => setIsSidebarOpen(false)} className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center">
                    <X className="w-5 h-5" />
                  </button>
               </div>
               <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-hide py-[env(safe-area-inset-bottom)]">
                  {sidebarItems.map((group) => (
                    <div key={group.group}>
                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 px-3">{group.group}</h3>
                      <div className="space-y-1">
                        {group.items.map((item) => (
                          <button
                            key={item.name}
                            onClick={() => handleMenuChange(item.name)}
                            className={cn(
                              "w-full flex items-center justify-between px-4 py-3 rounded-xl text-[11px] font-black uppercase tracking-tight transition-all",
                              activeMenu === item.name 
                                ? "bg-slate-900 text-white shadow-lg" 
                                : "text-slate-500 hover:bg-slate-50"
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <item.icon className="w-4 h-4" />
                              {item.name}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
               </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* Custom Reset Modal */}
      <AnimatePresence>
        {showResetConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowResetConfirm(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-5 lg:p-6 max-w-sm w-full relative z-10 shadow-2xl"
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

      {/* Create User Modal */}
      <AnimatePresence>
        {showCreateUserModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !isSubmittingNewUser && setShowCreateUserModal(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl p-6 lg:p-5 lg:p-6 max-w-lg w-full relative z-10 shadow-2xl overflow-y-auto max-h-[90vh]"
            >
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">Créer un Utilisateur</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                    {newUserData.role === 'client' ? 'Nouveau Client' : 'Nouveau Livreur'}
                  </p>
                </div>
                <button onClick={() => !isSubmittingNewUser && setShowCreateUserModal(false)} className="text-slate-300 hover:text-slate-900 transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleCreateUser} className="space-y-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Nom complet *</label>
                  <input type="text" value={newUserData.name} onChange={e => setNewUserData({...newUserData, name: e.target.value})} required className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm font-bold focus:ring-4 focus:ring-indigo-100" />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Email *</label>
                  <input type="email" value={newUserData.email} onChange={e => setNewUserData({...newUserData, email: e.target.value})} required className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm font-bold focus:ring-4 focus:ring-indigo-100" />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Mot de passe temporaire *</label>
                  <input type="password" value={newUserData.password} onChange={e => setNewUserData({...newUserData, password: e.target.value})} required className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm font-bold focus:ring-4 focus:ring-indigo-100" />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Téléphone</label>
                  <input type="tel" value={newUserData.phone} onChange={e => setNewUserData({...newUserData, phone: e.target.value})} className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm font-bold focus:ring-4 focus:ring-indigo-100" />
                </div>

                {newUserData.role === 'driver' && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Type véhicule</label>
                        <select value={newUserData.vehicleType} onChange={e => setNewUserData({...newUserData, vehicleType: e.target.value})} className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm font-bold focus:ring-4 focus:ring-indigo-100">
                          <option>Moto</option>
                          <option>Tricycle</option>
                          <option>Camionnette</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Statut Pro</label>
                        <select value={newUserData.driverType} onChange={e => setNewUserData({...newUserData, driverType: e.target.value})} className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm font-bold focus:ring-4 focus:ring-indigo-100">
                          <option value="freelance">Indépendant</option>
                          <option value="company">Flotte Entreprise</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Immatriculation</label>
                      <input type="text" value={newUserData.licensePlate || ''} onChange={e => setNewUserData({...newUserData, licensePlate: e.target.value})} className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm font-bold focus:ring-4 focus:ring-indigo-100" />
                    </div>
                  </>
                )}

                <div className="pt-6">
                  <button type="submit" disabled={isSubmittingNewUser} className="w-full py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl hover:bg-indigo-700 transition-all disabled:opacity-50">
                    {isSubmittingNewUser ? 'Création...' : 'Créer l\'utilisateur'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* User Details Modal */}
      <AnimatePresence>
        {selectedUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setSelectedUser(null)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[32px] p-5 max-w-lg w-full relative z-10 shadow-2xl max-h-[80vh] overflow-y-auto custom-scrollbar"
            >
              <div className="flex justify-between items-center mb-6 px-1">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center text-orange-500 border-2 border-white shadow-lg shadow-orange-100/50">
                    <UserCircle className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900 tracking-tighter uppercase leading-tight">{selectedUser.name}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                       {isSuperAdmin && profile?.userId !== selectedUser.userId ? (
                         <select
                           value={selectedUser.role}
                           onChange={async (e) => {
                             const newRole = e.target.value;
                             try {
                               await api.admin.users.update(selectedUser.userId, { 
                                 role: newRole,
                                 updatedAt: new Date().toISOString()
                               });
                               setSelectedUser({ ...selectedUser, role: newRole as any });
                                fetchData();
                             } catch (err) {
                               console.error(err);
                             }
                           }}
                           className={cn(
                             "px-2 py-0.5 rounded-md text-[7px] font-black uppercase tracking-widest border-none cursor-pointer focus:ring-2 appearance-none shadow-sm",
                             selectedUser.role === 'driver' ? "bg-blue-50 text-blue-600 focus:ring-blue-200" : 
                             (selectedUser.role === 'admin' || selectedUser.role === 'superadmin') ? "bg-orange-50 text-orange-600 focus:ring-orange-200" :
                             "bg-emerald-50 text-emerald-600 focus:ring-emerald-200"
                           )}
                         >
                           <option value="client">CLIENT</option>
                           <option value="driver">LIVREUR</option>
                           <option value="admin">ADMIN</option>
                           <option value="superadmin">SUPER ADMIN</option>
                         </select>
                       ) : (
                         <span className={cn(
                           "px-2 py-0.5 rounded-md text-[7px] font-black uppercase tracking-widest",
                           selectedUser.role === 'driver' ? "bg-blue-50 text-blue-600" : 
                           (selectedUser.role === 'admin' || selectedUser.role === 'superadmin') ? "bg-orange-50 text-orange-600" :
                           "bg-emerald-50 text-emerald-600"
                         )}>
                           {selectedUser.role}
                         </span>
                       )}
                       {selectedUser.accountStatus === 'suspended' && (
                         <span className="bg-red-50 text-red-600 px-2 py-0.5 rounded-md text-[7px] font-black uppercase tracking-widest shadow-sm">Suspendu</span>
                       )}
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedUser(null)} 
                  className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-full text-slate-400 hover:text-slate-900 transition-all border border-slate-100 active:scale-95 shadow-sm"
                >
                  <span className="text-[10px] font-black uppercase tracking-widest px-1">Fermer</span>
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100">
                    <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1 text-left">Email</p>
                    <p className="text-xs font-bold text-slate-900 break-all text-left">{selectedUser.email}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100">
                    <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1 text-left">Téléphone</p>
                    <p className="text-xs font-bold text-slate-900 text-left">{selectedUser.phone || 'Non renseigné'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100">
                    <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1 text-left">Type de compte</p>
                    <p className="text-xs font-bold text-slate-900 uppercase tracking-tighter text-left">{(selectedUser as any).driverType || 'Standard'}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100">
                    <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1 text-left">Inscrit le</p>
                    <p className="text-xs font-bold text-slate-900 text-left">{selectedUser.createdAt ? new Date(selectedUser.createdAt).toLocaleDateString() : 'Inconnu'}</p>
                  </div>
                </div>

                {selectedUser.role === 'driver' && (
                  <div className="p-5 bg-slate-900 rounded-[32px] space-y-4 shadow-xl shadow-slate-200">
                    <div className="flex items-center justify-between text-white">
                      <p className="text-[9px] font-black uppercase tracking-[0.2em]">Détails du véhicule</p>
                      <Truck className="w-4 h-4 text-orange-500" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest mb-1 text-left">Modèle</p>
                        <p className="text-xs font-bold text-white uppercase text-left">{selectedUser.vehicleType || 'Moto'}</p>
                      </div>
                      <div>
                        <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest mb-1 text-left">Immatriculation</p>
                        <p className="text-xs font-bold text-white uppercase text-left">{selectedUser.licensePlate || 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                )}

                {selectedUser.role === 'driver' && (selectedUser.guarantorName || selectedUser.guarantorPhone) && (
                   <div className="bg-indigo-50 p-4 rounded-[32px] border border-indigo-100 space-y-3">
                      <div className="flex items-center gap-3">
                         <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 shadow-sm"><ShieldCheck className="w-4 h-4" /></div>
                         <p className="text-[9px] font-black uppercase tracking-widest text-indigo-900">Garanti / Référence</p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                         <div>
                            <p className="text-[7px] font-black text-indigo-400 uppercase tracking-widest mb-1 text-left">Nom du garant</p>
                            <p className="text-xs font-bold text-indigo-900 text-left">{selectedUser.guarantorName || 'N/A'}</p>
                         </div>
                         <div>
                            <p className="text-[7px] font-black text-indigo-400 uppercase tracking-widest mb-1 text-left">Téléphone</p>
                            <p className="text-xs font-bold text-indigo-900 text-left">{selectedUser.guarantorPhone || 'N/A'}</p>
                         </div>
                      </div>
                   </div>
                )}
                
                {selectedUser.role === 'driver' && (
                  <div className="space-y-4">
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 px-2 text-left">DOCUMENTS ET PIÈCES JOINTES</p>
                    <div className="grid grid-cols-2 gap-3">
                       {/* Identity Recto */}
                       <div className="space-y-1">
                          <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest pl-1 text-left">ID (Recto/Statuts)</p>
                          {(selectedUser.identityCardUrl || selectedUser.idCardFront) ? (
                            <button className="w-full relative group" onClick={() => window.open((selectedUser.identityCardUrl || selectedUser.idCardFront)!, '_blank')}>
                              <img src={selectedUser.identityCardUrl || selectedUser.idCardFront} alt="ID Front" className="w-full aspect-video object-cover rounded-2xl border border-slate-200 shadow-sm" />
                              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-2xl">
                                <span className="text-[8px] font-black text-white uppercase tracking-widest">Voir</span>
                              </div>
                            </button>
                          ) : (
                            <div className="w-full aspect-video bg-slate-50 rounded-2xl flex items-center justify-center text-[10px] text-slate-300 font-bold border border-dashed border-slate-200">Non fourni</div>
                          )}
                       </div>

                       {/* Identity Verso */}
                       <div className="space-y-1">
                          <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest pl-1 text-left">ID (Verso / Complément)</p>
                          {(selectedUser.identityCardBackUrl || selectedUser.idCardBack) ? (
                            <button className="w-full relative group" onClick={() => window.open((selectedUser.identityCardBackUrl || selectedUser.idCardBack)!, '_blank')}>
                              <img src={selectedUser.identityCardBackUrl || selectedUser.idCardBack} alt="ID Back" className="w-full aspect-video object-cover rounded-2xl border border-slate-200 shadow-sm" />
                              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-2xl">
                                <span className="text-[8px] font-black text-white uppercase tracking-widest">Voir</span>
                              </div>
                            </button>
                          ) : (
                            <div className="w-full aspect-video bg-slate-50 rounded-2xl flex items-center justify-center text-[10px] text-slate-300 font-bold border border-dashed border-slate-200">Non fourni</div>
                          )}
                       </div>

                       {/* Casier Judiciaire */}
                       <div className="space-y-1">
                          <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest pl-1 text-left">Casier / NIF</p>
                          {selectedUser.criminalRecordUrl ? (
                            <button className="w-full relative group" onClick={() => window.open(selectedUser.criminalRecordUrl!, '_blank')}>
                              <img src={selectedUser.criminalRecordUrl} alt="Record" className="w-full aspect-video object-cover rounded-2xl border border-slate-200 shadow-sm" />
                              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-2xl">
                                <span className="text-[8px] font-black text-white uppercase tracking-widest">Voir</span>
                              </div>
                            </button>
                          ) : (
                            <div className="w-full aspect-video bg-slate-50 rounded-2xl flex items-center justify-center text-[10px] text-slate-300 font-bold border border-dashed border-slate-200">Non fourni</div>
                          )}
                       </div>

                       {/* CNI Garant */}
                       <div className="space-y-1">
                          <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest pl-1 text-left">CNI du Garant / Autre</p>
                          {selectedUser.guarantorCniUrl ? (
                            <button className="w-full relative group" onClick={() => window.open(selectedUser.guarantorCniUrl!, '_blank')}>
                              <img src={selectedUser.guarantorCniUrl} alt="Guarantor CNI" className="w-full aspect-video object-cover rounded-2xl border border-slate-200 shadow-sm" />
                              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-2xl">
                                <span className="text-[8px] font-black text-white uppercase tracking-widest">Voir</span>
                              </div>
                            </button>
                          ) : (
                            <div className="w-full aspect-video bg-slate-50 rounded-2xl flex items-center justify-center text-[10px] text-slate-300 font-bold border border-dashed border-slate-200">Non fourni</div>
                          )}
                       </div>
                    </div>
                  </div>
                )}

                {selectedUser.role === 'driver' && (
                  <div className="mt-8 pt-6 border-t border-slate-100 space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="text-left">
                        <p className="text-[10px] font-black text-slate-900 uppercase tracking-tight">Statut Dossier</p>
                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Vérification de l'identité du livreur</p>
                      </div>
                      <span className={cn(
                        "px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest shadow-sm",
                        selectedUser.verificationStatus === 'verified' ? "bg-emerald-50 text-emerald-600 border border-emerald-100" :
                        selectedUser.verificationStatus === 'rejected' ? "bg-red-50 text-red-600 border border-red-100" :
                        "bg-amber-50 text-amber-600 border border-amber-100 animate-pulse"
                      )}>
                        {selectedUser.verificationStatus === 'verified' ? "Validé" : 
                         selectedUser.verificationStatus === 'rejected' ? "Rejeté" : "En attente"}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-4">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        disabled={isProcessingAction || selectedUser.verificationStatus === 'verified'}
                        onClick={async (e) => {
                          e.stopPropagation();
                          setIsProcessingAction(true);
                          try {
                            await api.admin.users.update(selectedUser.userId, {
                              verificationStatus: 'verified',
                              accountStatus: 'active',
                              isVerified: true,
                              updatedAt: new Date().toISOString()
                            });
                            setSelectedUser({ ...selectedUser, verificationStatus: 'verified', accountStatus: 'active', isVerified: true });
                            fetchData();
                            await sendNotification(selectedUser.userId, "Dossier Validé ! 🎉", "Votre dossier a été approuvé. Bienvenue !", 'success');
                          } catch (err) {
                            console.error(err);
                          } finally {
                            setIsProcessingAction(false);
                          }
                        }}
                        className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.1em] shadow-lg shadow-emerald-100 hover:bg-emerald-700 active:bg-emerald-800 transition-all disabled:opacity-50 disabled:grayscale flex items-center justify-center gap-2"
                      >
                        {isProcessingAction ? <Clock className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                        {selectedUser.verificationStatus === 'verified' ? 'Déjà Validé' : (isProcessingAction ? 'Attente...' : 'Valider')}
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        disabled={isProcessingAction || selectedUser.verificationStatus === 'rejected'}
                        onClick={async (e) => {
                          e.stopPropagation();
                          setIsProcessingAction(true);
                          const reason = "Documents incomplets ou non conformes";
                          try {
                            await api.admin.users.update(selectedUser.userId, {
                              verificationStatus: 'rejected',
                              accountStatus: 'pending_approval',
                              isVerified: false,
                              updatedAt: new Date().toISOString()
                            });
                            setSelectedUser({ ...selectedUser, verificationStatus: 'rejected', accountStatus: 'pending_approval', isVerified: false });
                            fetchData();
                            await sendNotification(selectedUser.userId, "Dossier à corriger ⚠️", `Rejeté. Raison : ${reason || "Doc non conformes"}`, 'warning');
                          } catch (err) {
                            console.error(err);
                          } finally {
                            setIsProcessingAction(false);
                          }
                        }}
                        className="flex-1 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.1em] shadow-lg shadow-slate-200 hover:bg-black transition-all disabled:opacity-50 disabled:grayscale flex items-center justify-center gap-2"
                      >
                         {isProcessingAction ? <Clock className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                         {selectedUser.verificationStatus === 'rejected' ? 'Rejeté' : (isProcessingAction ? 'Attente...' : 'Rejeter')}
                      </motion.button>
                    </div>
                  </div>
                )}
                
                <div className="bg-orange-50 p-4 rounded-3xl border border-orange-100 mt-4">
                   <p className="text-[7px] font-black text-orange-400 uppercase tracking-widest mb-1 text-left">Localisation / Zone</p>
                   <p className="text-xs font-bold text-orange-900 text-left">{(selectedUser as any).address || 'Ouagadougou'}</p>
                </div>
              </div>

              <div className="mt-8 flex flex-col gap-3">
                {isSuperAdmin && profile?.userId !== selectedUser.userId && (
                  <button 
                    onClick={async () => {
                      await handleDeleteUser(selectedUser.userId);
                      setSelectedUser(null);
                    }}
                    className="w-full py-4 bg-rose-50 text-rose-600 border border-rose-100 rounded-2xl text-[10px] font-black uppercase tracking-[0.1em] hover:bg-rose-600 hover:text-white transition-all"
                  >
                    Supprimer Compte
                  </button>
                )}
                <button 
                  onClick={() => setSelectedUser(null)}
                  className="w-full py-5 bg-slate-100 text-slate-900 rounded-[28px] text-[11px] font-black uppercase tracking-[0.3em] hover:bg-slate-200 active:scale-95 transition-all"
                >
                  Fermer
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
