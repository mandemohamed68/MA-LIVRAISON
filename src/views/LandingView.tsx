import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Truck, Package, MapPin, ArrowRight, UserCheck, User, ShieldCheck, Mail, Lock, Phone, ChevronRight, Globe, Zap, Camera, CheckSquare, Settings, Facebook, Plus, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import { UserRole } from '../types';
import LoadingScreen from '../components/LoadingScreen';
import Logo from '../components/Logo';

const logoImg = '/logo-pancho.png';

type AuthMode = 'login' | 'register' | 'phone';

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

export default function LandingView() {
  const { 
    user, profile, loading: authLoading, login, loginWithEmail, registerWithEmail, loginWithPhone, 
    updateProfile, isMasterAdmin 
  } = useAuth();
  const navigate = useNavigate();
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [logoUrl, setLogoUrl] = useState(logoImg);
  const [logoError, setLogoError] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [role, setRole] = useState<UserRole>('client');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [withdrawalPhone, setWithdrawalPhone] = useState('');
  const [rib, setRib] = useState('');
  const [guarantorName, setGuarantorName] = useState('');
  const [guarantorPhone, setGuarantorPhone] = useState('');
  const [idCardFront, setIdCardFront] = useState('');
  const [idCardBack, setIdCardBack] = useState('');
  const [guarantorCniUrl, setGuarantorCniUrl] = useState('');
  const [city, setCity] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [address, setAddress] = useState('');
  const [driverType, setDriverType] = useState<'freelance' | 'company'>('freelance');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [confirmResult, setConfirmResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [localLoading, setLocalLoading] = useState(false);
  
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const [showServerConfig, setShowServerConfig] = useState(false);
  const [customApiUrl, setCustomApiUrl] = useState(() => {
    return localStorage.getItem('custom_api_base') || "http://41.78.54.60:3006/api";
  });
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'checking' | 'success' | 'error'>('idle');

  const handleSaveServerConfig = async () => {
    setConnectionStatus('checking');
    try {
      let url = customApiUrl.trim();
      if (url.endsWith('/')) {
        url = url.slice(0, -1);
      }
      
      const testRes = await fetch(`${url}/health`, { method: 'GET' });
      if (testRes.ok) {
        localStorage.setItem('custom_api_base', url);
        setConnectionStatus('success');
        setTimeout(() => {
          setShowServerConfig(false);
          setConnectionStatus('idle');
          window.location.reload();
        }, 1200);
      } else {
        setConnectionStatus('error');
      }
    } catch (e) {
      setConnectionStatus('error');
    }
  };

  const handleResetServerConfig = () => {
    localStorage.removeItem('custom_api_base');
    setCustomApiUrl("http://41.78.54.60:3006/api");
    setConnectionStatus('success');
    setTimeout(() => {
      setShowServerConfig(false);
      setConnectionStatus('idle');
      window.location.reload();
    }, 1200);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Veuillez entrer votre adresse email');
      return;
    }
    setLocalLoading(true);
    setError('');
    
    // Simulate forgot password action
    try {
      // If we had a real endpoint to request reset link, we would call it here.
      // await api.post('/auth/forgot-password', { email });
      await new Promise(resolve => setTimeout(resolve, 800));
      setResetSent(true);
    } catch (e: any) {
      setError(e.message || "Impossible d'envoyer le lien de réinitialisation.");
    } finally {
      setLocalLoading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, side: 'front' | 'back') => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const base64 = await compressImage(file);
        if (side === 'front') setIdCardFront(base64);
        else setIdCardBack(base64);
      } catch (err: any) {
        setError(err.message || "Erreur lors du traitement de l'image");
      }
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLocalLoading(true);
    try {
      if (isRegistering) {
        if (role === 'driver') {
          if (!termsAccepted) {
             setError('Vous devez accepter les conditions d\'utilisation.');
             setLocalLoading(false);
             return;
          }
          // ID Card validation removed (made optional)
        }

        await registerWithEmail(email, password, name, role, {
          city,
          neighborhood,
          address,
          driverType,
          phone,
          withdrawalPhone,
          rib,
          idCardFront,
          idCardBack,
          guarantorName,
          guarantorPhone,
          guarantorCniUrl,
          status: role === 'driver' ? 'online' : 'offline'
        });
      } else {
        await loginWithEmail(email, password);
      }
    } catch (err: any) {
      setLocalLoading(false);
      const msg = err.message || '';
      
      // If the message is already in French (from our server), use it directly
      if (/[éèàêîôû]/.test(msg) || msg.includes('déjà') || msg.includes('connexion')) {
        setError(msg);
        return;
      }

      if (msg.includes('Not allowed') || err.code === 'auth/operation-not-allowed') {
        setError("L'authentification par email/mot de passe n'est pas activée.");
      } else if (msg.includes('Invalid credentials') || err.code === 'auth/invalid-credential') {
        setError("L'adresse email ou le mot de passe est incorrect.");
      } else if (msg.includes('Rate limit') || err.code === 'auth/too-many-requests') {
        setError("Trop de tentatives. Veuillez réessayer plus tard.");
      } else if (msg.includes('Email already exists') || err.code === 'auth/email-already-in-use') {
        setError("Un compte existe déjà avec cette adresse email.");
      } else if (msg.includes('User not found') || err.code === 'auth/user-not-found') {
        setError("Aucun compte ne correspond à cette adresse email.");
      } else if (msg.includes('wrong-password') || err.code === 'auth/wrong-password') {
        setError("Le mot de passe renseigné est incorrect.");
      } else {
        setError(msg || "Erreur : Impossible de s'authentifier avec ces informations.");
      }
    }
  };


  if (user && (!profile || !profile.role)) {
    // Role selection for new users (e.g. from Google login)
    return (
      <div className="h-full flex-1 w-full bg-slate-50 flex items-center justify-center p-6 min-h-0 overflow-y-auto">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white border border-slate-100 rounded-3xl p-10 text-center shadow-2xl"
        >
          <h2 className="text-3xl font-black text-slate-900 tracking-tighter mb-8 italic uppercase">CHOISISSEZ VOTRE <span className="text-orange-500">RÔLE.</span></h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 text-left">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 italic">Ville</label>
              <input 
                type="text"
                value={city}
                onChange={e => setCity(e.target.value)}
                placeholder="Ex: Ouagadougou"
                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 focus:border-orange-500 transition-all outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 italic">Quartier</label>
              <input 
                type="text"
                value={neighborhood}
                onChange={e => setNeighborhood(e.target.value)}
                placeholder="Ex: Pissy"
                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 focus:border-orange-500 transition-all outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <button 
              disabled={!city || !neighborhood}
              onClick={() => updateProfile({ role: 'client', city, neighborhood })}
              className="group p-8 bg-slate-50 hover:bg-orange-500 rounded-3xl border border-slate-100 hover:border-orange-400 transition-all text-left disabled:opacity-50 disabled:hover:bg-slate-50 disabled:cursor-not-allowed"
            >
              <User className="w-10 h-10 text-orange-500 group-hover:text-white mb-4" />
              <h3 className="text-xl font-black text-slate-900 group-hover:text-white uppercase italic">Client</h3>
              <p className="text-slate-400 group-hover:text-orange-100 text-xs font-bold leading-tight mt-1">Envoyez vos colis en un clic partout à Ouaga.</p>
            </button>
            <button 
              disabled={!city || !neighborhood}
              onClick={() => updateProfile({ role: 'driver', city, neighborhood, accountStatus: 'pending_approval' })}
              className="group p-8 bg-slate-50 hover:bg-orange-600 rounded-3xl border border-slate-100 hover:border-orange-400 transition-all text-left disabled:opacity-50 disabled:hover:bg-slate-50 disabled:cursor-not-allowed"
            >
              <Truck className="w-10 h-10 text-orange-600 group-hover:text-white mb-4" />
              <h3 className="text-xl font-black text-slate-900 group-hover:text-white uppercase italic">Livreur</h3>
              <p className="text-slate-400 group-hover:text-orange-100 text-xs font-bold leading-tight mt-1">Gagnez de l'argent en livrant avec votre moto ou auto.</p>
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-full flex-1 w-full grid grid-cols-1 lg:grid-cols-2 bg-white overflow-hidden min-h-0">
      {/* Left Pane: Branding & Visuals */}
      <div className="relative hidden lg:flex flex-col justify-between p-16 overflow-hidden bg-slate-50">
        <div className="absolute inset-0 z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-primary/10 blur-[120px] rounded-full" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-600/5 blur-[100px] rounded-full" />
        </div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-12">
            <div className="w-28 h-28 rounded-2xl flex items-center justify-center bg-white shadow-xl shadow-orange-500/10 border-2 border-orange-100 overflow-hidden p-1">
              {!logoError ? (
                 <img src={logoUrl} alt="PANCHO EXPRESS Logo" onError={() => setLogoError(true)} className="w-full h-full object-contain" />
              ) : (
                 <Logo className="w-full h-full text-orange-600" />
              )}
            </div>
            <div className="flex flex-col">
              <div className="flex items-baseline space-x-0.5">
                <span className="text-3xl font-black text-slate-900 tracking-tighter italic uppercase leading-none">PANCHO</span>
                <span className="text-3xl font-black text-orange-600 tracking-tighter italic uppercase leading-none">EXPRESS</span>
              </div>
              <span className="text-[10px] font-black tracking-[0.4em] text-slate-400 uppercase mt-1">Plateforme Logistique</span>
            </div>
          </div>
          
          <h1 className="text-[100px] xl:text-[120px] font-black text-slate-900 leading-[0.85] tracking-tighter uppercase italic select-none">
            VITESSE.<br />
            <span className="text-primary">SÉCURITÉ.</span><br />
            PANCHO EXPRESS.
          </h1>

          <div className="mt-8">
             <p className="text-slate-400 text-xl font-bold max-w-sm leading-tight italic">
               La logistique 2.0 au cœur de <span className="text-slate-900 underline decoration-primary decoration-4">Ouagadougou.</span>
             </p>
          </div>
        </div>

        <div className="relative z-10 flex gap-12 pt-20">
          <div className="flex flex-col">
            <span className="text-5xl font-black text-slate-900 italic">24/7</span>
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mt-2">Disponibilité Totale</span>
          </div>
          <div className="flex flex-col">
            <span className="text-5xl font-black text-slate-900 italic">15m</span>
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mt-2">Ramassage Moyen</span>
          </div>
        </div>
      </div>

      {/* Right Pane: Auth Forms */}
      <div className="flex flex-col items-center justify-center p-6 sm:p-10 bg-white lg:rounded-l-[40px] border-l border-slate-100 shadow-2xl relative z-10 w-full min-h-[100dvh] overflow-y-auto">
        <div className="w-full max-w-md my-auto pb-10 mt-12 lg:mt-auto">
          <div className="text-center mb-8 flex flex-col items-center">
            <div className="w-32 h-32 sm:hidden rounded-2xl flex items-center justify-center bg-white shadow-xl shadow-orange-500/10 border-2 border-orange-100 overflow-hidden p-1 mb-4">
              {!logoError ? (
                 <img src={logoUrl} alt="PANCHO EXPRESS Logo" onError={() => setLogoError(true)} className="w-full h-full object-contain" />
              ) : (
                 <Logo className="w-full h-full text-orange-600" />
              )}
            </div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase mb-2 italic">
              {isRegistering ? "Création de compte" : "Bienvenue"}
            </h2>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Plateforme de Livraison Professionnelle PANCHO EXPRESS</p>
          </div>

          <div className="flex p-1 bg-slate-50 rounded-2xl border border-slate-100 mb-8">
            <button 
              onClick={() => { setIsRegistering(false); setAuthMode('login'); confirmResult && setConfirmResult(null); setIsForgotPassword(false); setResetSent(false); }}
              className={cn(
                "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300",
                (!isRegistering && authMode !== 'phone' && !isForgotPassword) ? "bg-white text-slate-900 shadow-sm border border-slate-100" : "text-slate-400 hover:text-slate-600"
              )}
            >
              Email
            </button>
            <button 
              onClick={() => { setIsRegistering(true); setAuthMode('login'); setIsForgotPassword(false); setResetSent(false); }}
              className={cn(
                "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300",
                isRegistering ? "bg-white text-slate-900 shadow-sm border border-slate-100" : "text-slate-400 hover:text-slate-600"
              )}
            >
              Inscription
            </button>
            <button 
              onClick={() => { setAuthMode('phone'); setIsRegistering(false); setIsForgotPassword(false); setResetSent(false); }}
              className={cn(
                "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300",
                authMode === 'phone' ? "bg-white text-slate-900 shadow-sm border border-slate-100" : "text-slate-400 hover:text-slate-600"
              )}
            >
              Mobile
            </button>
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-500 text-[10px] font-black uppercase tracking-widest text-center"
            >
              {error}
            </motion.div>
          )}

          {isForgotPassword ? (
            <div className="space-y-4">
              <h3 className="text-lg font-black text-slate-900 uppercase italic tracking-tight text-center mb-4">Réinitialisation</h3>
              {resetSent ? (
                <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl text-center">
                  <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">
                    Lien envoyé ! Vérifiez votre boîte mail.
                  </p>
                  <button 
                    type="button"
                    onClick={() => { setIsForgotPassword(false); setResetSent(false); }}
                    className="mt-4 text-[10px] font-black text-emerald-700 hover:text-emerald-800 uppercase tracking-widest transition-colors underline"
                  >
                    Retour à la connexion
                  </button>
                </div>
              ) : (
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                    <input 
                      required
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="Adresse email"
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl pl-12 pr-4 py-3.5 text-sm font-bold text-slate-900 focus:border-orange-500 transition-all outline-none"
                    />
                  </div>
                  <button 
                    type="submit"
                    disabled={localLoading}
                    className="w-full bg-slate-900 hover:bg-orange-600 text-white rounded-xl py-4 font-black text-[10px] uppercase tracking-[0.3em] shadow-xl transition-all flex items-center justify-center gap-2 group mt-2"
                  >
                    {localLoading ? "Chargement..." : "Envoyer le lien"}
                    <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </button>
                  <button 
                    type="button"
                    onClick={() => setIsForgotPassword(false)}
                    className="w-full text-center text-[10px] font-black text-slate-400 hover:text-slate-600 uppercase tracking-widest transition-colors mt-2"
                  >
                    Annuler
                  </button>
                </form>
              )}
            </div>
          ) : authMode === 'phone' ? (
            <div className="py-12 flex flex-col items-center justify-center bg-slate-50 rounded-2xl border border-slate-200 border-dashed">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] italic text-center">SMS OTP INDISPONIBLE</p>
            </div>
          ) : isRegistering ? (
            <form onSubmit={handleAuth} className="space-y-4">
              <div className="flex gap-2 p-1 bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden mb-6">
                <button 
                  type="button"
                  onClick={() => setRole('client')}
                  className={cn(
                    "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                    role === 'client' ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20" : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  Client
                </button>
                <button 
                  type="button"
                  onClick={() => setRole('driver')}
                  className={cn(
                    "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                    role === 'driver' ? "bg-slate-900 text-white shadow-lg" : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  Livreur
                </button>
              </div>

              {role === 'driver' && (
                <div className="flex bg-slate-50 rounded-2xl p-1 border border-slate-100 mb-6">
                   <button
                     type="button"
                     onClick={() => setDriverType('freelance')}
                     className={cn(
                       "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all", 
                       driverType === 'freelance' ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20" : "text-slate-400 hover:text-slate-600"
                     )}
                   >
                     Indépendant
                   </button>
                   <button
                     type="button"
                     onClick={() => setDriverType('company')}
                     className={cn(
                       "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all", 
                       driverType === 'company' ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20" : "text-slate-400 hover:text-slate-600"
                     )}
                   >
                     Société
                   </button>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 italic">{role === 'driver' && driverType === 'company' ? 'Nom de la Société' : 'Nom Complet'}</label>
                  <input 
                    required
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder={role === 'driver' && driverType === 'company' ? 'Ex: Pancho Log' : 'Ex: Jean Dupont'}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 focus:border-orange-500 transition-all outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1 italic">Email</label>
                  <input 
                    required
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="Ex: contact@email.com"
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 focus:border-orange-500 transition-all outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 italic">Téléphone</label>
                  <input 
                    required
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="Ex: +226 70 00 00 00"
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 focus:border-orange-500 transition-all outline-none"
                  />
                </div>
                {role === 'driver' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 italic" title="Ce numéro sera utilisé pour vos retraits de gains">Téléphone de compensation (Optionnel)</label>
                      <input 
                        type="tel"
                        value={withdrawalPhone}
                        onChange={e => setWithdrawalPhone(e.target.value)}
                        placeholder="Numéro Mobile Money"
                        className="w-full bg-orange-50 border border-orange-100 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 focus:border-orange-500 transition-all outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 italic">RIB / Compte Bancaire (Optionnel)</label>
                      <input 
                        type="text"
                        value={rib}
                        onChange={e => setRib(e.target.value)}
                        placeholder="Votre RIB ou IBAN"
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 focus:border-orange-500 transition-all outline-none"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1 italic">Mot de Passe</label>
                    <input 
                      required
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Min. 6 caractères"
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 focus:border-orange-500 transition-all outline-none"
                    />
                  </div>
                )}
              </div>

              {role === 'driver' && (
                <div className="space-y-6 bg-slate-50 p-6 rounded-3xl border border-slate-100">
                  <div className="flex items-center gap-2 mb-2">
                    <ShieldCheck className="w-5 h-5 text-orange-500" />
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Dossier Chauffeur (Optionnel)</h3>
                  </div>
                  
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 italic">
                      Photos des Documents d'identité
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                       <label className={cn(
                         "border border-dashed rounded-xl p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all group",
                         idCardFront ? "bg-orange-50 border-orange-500" : "border-slate-200 bg-white hover:border-orange-500"
                       )}>
                          <input 
                            type="file" 
                            accept="image/*" 
                            onChange={e => handleFileChange(e, 'front')} 
                            className="hidden" 
                          />
                          {idCardFront ? (
                            <div className="relative w-full aspect-video rounded-lg overflow-hidden">
                              <img src={idCardFront} alt="Recto" className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-orange-500/40 flex items-center justify-center text-white">
                                <UserCheck className="w-6 h-6" />
                              </div>
                            </div>
                          ) : (
                            <>
                              <Camera className="w-6 h-6 text-slate-300 group-hover:text-orange-500 mb-2" />
                              <span className="text-[9px] font-black text-slate-400 uppercase">
                                {driverType === 'company' ? 'RCCM / Statuts (Optionnel)' : 'CNIB Recto (Optionnel)'}
                              </span>
                            </>
                          )}
                       </label>
                       <label className={cn(
                         "border border-dashed rounded-xl p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all group",
                         idCardBack ? "bg-orange-50 border-orange-500" : "border-slate-200 bg-white hover:border-orange-500"
                       )}>
                          <input 
                            type="file" 
                            accept="image/*" 
                            onChange={e => handleFileChange(e, 'back')} 
                            className="hidden" 
                          />
                          {idCardBack ? (
                            <div className="relative w-full aspect-video rounded-lg overflow-hidden">
                              <img src={idCardBack} alt="Verso" className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-orange-500/40 flex items-center justify-center text-white">
                                <UserCheck className="w-6 h-6" />
                              </div>
                            </div>
                          ) : (
                            <>
                              <Camera className="w-6 h-6 text-slate-300 group-hover:text-orange-500 mb-2" />
                              <span className="text-[9px] font-black text-slate-400 uppercase">
                                {driverType === 'company' ? 'NIF / IFU (Optionnel)' : 'CNIB Verso (Optionnel)'}
                              </span>
                            </>
                          )}
                       </label>
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-slate-200">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 italic">Références d'un Garant (Optionnel)</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <input 
                        type="text"
                        value={guarantorName}
                        onChange={e => setGuarantorName(e.target.value)}
                        placeholder="Nom du garant"
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 focus:border-orange-500 transition-all outline-none"
                      />
                      <input 
                        type="tel"
                        value={guarantorPhone}
                        onChange={e => setGuarantorPhone(e.target.value)}
                        placeholder="Téléphone du garant"
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 focus:border-orange-500 transition-all outline-none"
                      />
                    </div>
                  </div>

                  <div className="p-4 bg-orange-50 border border-orange-100 rounded-2xl flex gap-3">
                    <Info className="w-5 h-5 text-orange-500 shrink-0" />
                    <p className="text-[10px] font-bold text-orange-700 leading-relaxed">
                      L'envoi de ces documents n'est pas obligatoire pour l'inscription, mais votre dossier devra être complété pour valider définitivement votre accès.
                    </p>
                  </div>

                  <div className="space-y-1.5 pt-4 border-t border-slate-200">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1 italic">Définir un Mot de Passe</label>
                    <input 
                      required
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Min. 6 caractères"
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 focus:border-orange-500 transition-all outline-none"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 italic">Ville</label>
                  <input 
                    required
                    type="text"
                    value={city}
                    onChange={e => setCity(e.target.value)}
                    placeholder="Ex: Ouagadougou"
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 focus:border-orange-500 transition-all outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 italic">Quartier</label>
                  <input 
                    required
                    type="text"
                    value={neighborhood}
                    onChange={e => setNeighborhood(e.target.value)}
                    placeholder="Ex: Pissy"
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 focus:border-orange-500 transition-all outline-none"
                  />
                </div>
              </div>

              {role === 'driver' && (
                <div className="mt-4 p-5 bg-slate-50 border border-slate-100 rounded-2xl space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 italic">Adresse / Zone d'activité</label>
                    <input 
                      type="text"
                      value={address}
                      onChange={e => setAddress(e.target.value)}
                      placeholder="Ex: Ouagadougou, Secteur 1"
                      className="w-full bg-white border border-slate-100 rounded-xl px-4 py-4 text-sm font-bold text-slate-900 focus:border-orange-500 transition-all outline-none"
                    />
                  </div>

                  <div className="flex items-start gap-4 pt-4 border-t border-slate-100">
                     <input 
                       type="checkbox" 
                       required
                       checked={termsAccepted}
                       onChange={(e) => setTermsAccepted(e.target.checked)}
                       className="mt-1 w-5 h-5 rounded border-slate-200 text-orange-500 focus:ring-orange-500 cursor-pointer"
                     />
                     <div>
                       <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Conditions d'utilisation</p>
                       <p className="text-[9px] font-medium text-slate-400 mt-1 leading-relaxed">
                         En cochant cette case, vous vous engagez à respecter les conditions de service de PANCHO EXPRESS.
                       </p>
                     </div>
                  </div>
                </div>
              )}

              <button 
                type="submit"
                disabled={localLoading}
                className="w-full mt-6 bg-slate-900 hover:bg-orange-600 text-white rounded-xl py-5 font-black text-[10px] uppercase tracking-[0.3em] shadow-xl transition-all flex items-center justify-center gap-2 group"
              >
                {localLoading ? "Chargement..." : "Créer mon compte"}
                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </form>
          ) : (
            <form onSubmit={handleAuth} className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                <input 
                  required
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="Adresse email"
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl pl-12 pr-4 py-3.5 text-sm font-bold text-slate-900 focus:border-orange-500 transition-all outline-none"
                />
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                <input 
                  required
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Mot de passe"
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl pl-12 pr-4 py-3.5 text-sm font-bold text-slate-900 focus:border-orange-500 transition-all outline-none"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsForgotPassword(true)}
                  className="text-[10px] font-black text-slate-400 hover:text-orange-500 uppercase tracking-widest transition-colors"
                >
                  Mot de passe oublié ?
                </button>
              </div>
              <button 
                type="submit"
                disabled={localLoading}
                className="w-full bg-slate-900 hover:bg-orange-600 text-white rounded-xl py-4 font-black text-[10px] uppercase tracking-[0.3em] shadow-xl transition-all flex items-center justify-center gap-2 group mt-2"
              >
                {localLoading ? "Chargement..." : "Se connecter"}
                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </form>
          )}

          <div className="mt-10 pt-8 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4 text-center sm:text-left">
             <div className="flex flex-col">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 italic">Édité par NME TECHNOLOGIE Group</span>
                <span className="text-slate-900 font-black text-sm tracking-tighter italic">72567606</span>
             </div>
             <div className="flex gap-2.5">
                <a href="tel:+22672567606" title="Téléphone" className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 hover:text-orange-600 hover:bg-orange-50 transition-all cursor-pointer border border-slate-100 shadow-sm active:scale-95 duration-150">
                   <Phone className="w-4 h-4" />
                </a>
                <a href="https://wa.me/22672567606" target="_blank" rel="noopener noreferrer" title="WhatsApp" className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all cursor-pointer border border-slate-100 shadow-sm active:scale-95 duration-150">
                   <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                     <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.725 1.451 5.436 0 9.86-4.42 9.864-9.864.002-2.637-1.03-5.115-2.906-6.99C16.452 1.876 13.977 1.05 11.35 1.05 5.91 11.35 1.488 5.474 1.484 10.916c-.002 1.71.459 3.382 1.332 4.885L1.875 22.03l6.398-1.679c.002-.001.002-.001.003-.001zm11.45-6.72c-.178-.089-1.055-.52-1.22-.58-.164-.06-.284-.09-.404.09-.12.18-.464.58-.57.7-.104.12-.21.134-.388.045-1.748-.875-2.902-1.534-4.053-3.513-.105-.18-.105-.29-.016-.379.08-.08.178-.21.267-.315.09-.105.12-.178.18-.299.06-.12.03-.225-.015-.315-.045-.09-.404-.975-.555-1.343-.146-.356-.296-.307-.404-.313-.105-.005-.224-.006-.344-.006-.12 0-.315.045-.48.225-.164.18-.63.615-.63 1.502s.645 1.739.735 1.859c.09.12 1.268 1.938 3.073 2.719.43.186.765.298 1.026.381.431.137.824.117 1.135.07.347-.053 1.055-.431 1.205-.826.15-.395.15-.734.105-.806-.045-.072-.165-.112-.343-.201z"/>
                   </svg>
                </a>
                <a href="https://facebook.com/panchoexpress" target="_blank" rel="noopener noreferrer" title="Facebook" className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all cursor-pointer border border-slate-100 shadow-sm active:scale-95 duration-150">
                   <Facebook className="w-4 h-4" />
                </a>
                <a href="mailto:nmetechnologiegroup@gmail.com" title="Email" className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 hover:text-orange-600 hover:bg-orange-50 transition-all cursor-pointer border border-slate-100 shadow-sm active:scale-95 duration-150">
                   <Mail className="w-4 h-4" />
                </a>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
