import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Truck, Package, MapPin, ArrowRight, UserCheck, User, ShieldCheck, Mail, Lock, Phone, ChevronRight, Globe, Zap, Camera, CheckSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { UserRole } from '../types';

type AuthMode = 'login' | 'register' | 'phone';

export default function LandingView() {
  const { 
    user, profile, login, loginWithEmail, registerWithEmail, loginWithPhone, 
    updateProfile, isMasterAdmin 
  } = useAuth();
  const navigate = useNavigate();
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [isRegistering, setIsRegistering] = useState(false);
  const [role, setRole] = useState<UserRole>('client');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [driverType, setDriverType] = useState<'freelance' | 'company'>('freelance');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [confirmResult, setConfirmResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isRegistering) {
        // Driver specific validation
        if (role === 'driver' && !termsAccepted) {
           setError('Vous devez accepter les conditions d\'utilisation.');
           setLoading(false);
           return;
        }
        await registerWithEmail(email, password, name, role); 
        if (role === 'driver') {
          await updateProfile({ 
            address, 
            driverType, 
            termsAcceptedAt: new Date().toISOString() 
          });
        }
      } else {
        await loginWithEmail(email, password);
      }
    } catch (err: any) {
      if (err.code === 'auth/operation-not-allowed') {
        setError("L'authentification par email/mot de passe (ou téléphone) n'est pas activée dans Firebase. Allez dans Firebase Console > Authentication > Sign-in method pour l'activer.");
      } else {
        setError(err.message || 'Une erreur est survenue');
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (!confirmResult) {
        const result = await loginWithPhone(phone, 'recaptcha-container');
        setConfirmResult(result);
      } else {
        await confirmResult.confirm(verificationCode);
      }
    } catch (err: any) {
      if (err.code === 'auth/operation-not-allowed') {
        setError("L'authentification par téléphone n'est pas activée dans Firebase. Allez dans Firebase Console > Authentication > Sign-in method pour l'activer.");
      } else if (err.code === 'auth/invalid-phone-number') {
        setError("Le format du numéro de téléphone est invalide. Utilisez le format +226...");
      } else {
        setError(err.message || 'Erreur auth téléphone');
      }
    } finally {
      setLoading(false);
    }
  };

  // Redirect if logged in and profile complete
  React.useEffect(() => {
    if (user && profile && profile.role) {
      // Role assigned? Go to dashboard
      if (profile.phone || profile.role === 'superadmin') {
         const path = (profile.role === 'superadmin' || profile.role === 'admin') ? '/admin' : 
                   profile.role === 'client' ? '/client' : '/driver';
         navigate(path);
      }
    }
  }, [user, profile, navigate]);

  if (user && profile && !profile.role) {
    // Role selection for new users (e.g. from Google login)
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-[40px] p-10 text-center shadow-2xl"
        >
          <h2 className="text-3xl font-black text-white tracking-tighter mb-8 italic uppercase">CHOISISSEZ VOTRE <span className="text-orange-500">RÔLE.</span></h2>
          <div className="grid grid-cols-1 gap-4">
            <button 
              onClick={() => updateProfile({ role: 'client' })}
              className="group p-8 bg-slate-800/50 hover:bg-orange-500 rounded-3xl border border-slate-700 hover:border-orange-400 transition-all text-left"
            >
              <User className="w-10 h-10 text-orange-500 group-hover:text-white mb-4" />
              <h3 className="text-xl font-black text-white uppercase italic">Client</h3>
              <p className="text-slate-400 group-hover:text-orange-100 text-xs font-bold leading-tight mt-1">Envoyez vos colis en un clic partout à Ouaga.</p>
            </button>
            <button 
              onClick={() => updateProfile({ role: 'driver' })}
              className="group p-8 bg-slate-800/50 hover:bg-blue-600 rounded-3xl border border-slate-700 hover:border-blue-400 transition-all text-left"
            >
              <Truck className="w-10 h-10 text-blue-500 group-hover:text-white mb-4" />
              <h3 className="text-xl font-black text-white uppercase italic">Livreur</h3>
              <p className="text-slate-400 group-hover:text-blue-100 text-xs font-bold leading-tight mt-1">Gagnez de l'argent en livrant avec votre moto ou auto.</p>
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-slate-950 overflow-hidden">
      {/* Left Pane: Branding & Visuals */}
      <div className="relative hidden lg:flex flex-col justify-between p-16 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-orange-500/20 blur-[120px] rounded-full" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-600/10 blur-[100px] rounded-full" />
        </div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center">
              <Truck className="text-white w-6 h-6" />
            </div>
            <span className="text-xl font-black text-white tracking-widest uppercase italic">Ma Livraison.</span>
          </div>
          
          <h1 className="text-[100px] xl:text-[120px] font-black text-white leading-[0.85] tracking-tighter uppercase italic select-none">
            VITESSE.<br />
            <span className="text-orange-500">SÉCURITÉ.</span><br />
            EXPRESS.
          </h1>

          <div className="mt-8">
             <p className="text-slate-400 text-xl font-bold max-w-sm leading-tight italic">
               La logistique 2.0 au cœur de <span className="text-white underline decoration-orange-500 decoration-4">Ouagadougou.</span>
             </p>
          </div>
        </div>

        <div className="relative z-10 flex gap-12 pt-20">
          <div className="flex flex-col">
            <span className="text-5xl font-black text-white italic">24/7</span>
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mt-2">Disponibilité Totale</span>
          </div>
          <div className="flex flex-col">
            <span className="text-5xl font-black text-white italic">15m</span>
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mt-2">Ramassage Moyen</span>
          </div>
        </div>
      </div>

      {/* Right Pane: Auth Forms */}
      <div className="flex items-center justify-center p-8 bg-slate-900 lg:rounded-l-[60px] border-l border-slate-800 shadow-[-40px_0_80px_rgba(0,0,0,0.5)]">
        <div className="max-w-md w-full">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-orange-500/10 rounded-full border border-orange-500/20 mb-6">
              <Zap className="w-3 h-3 text-orange-500" />
              <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest leading-none">Version Pro 2.1</span>
            </div>
            <h2 className="text-4xl font-black text-white tracking-tight italic uppercase mb-2">
              {isRegistering ? "Rejoindre l'élite" : "Bon Retour"}
            </h2>
            <p className="text-slate-500 text-sm font-medium">Connectez-vous pour commencer.</p>
          </div>

          <div className="flex p-1 bg-slate-800/50 rounded-2xl border border-slate-700 mb-8 overflow-hidden">
            <button 
              onClick={() => { setIsRegistering(false); setAuthMode('login'); confirmResult && setConfirmResult(null); }}
              className={cn(
                "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                (!isRegistering && authMode !== 'phone') ? "bg-white text-slate-900 shadow-xl" : "text-slate-500"
              )}
            >
              Email
            </button>
            <button 
              onClick={() => { setIsRegistering(true); setAuthMode('login'); }}
              className={cn(
                "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                isRegistering ? "bg-white text-slate-900 shadow-xl" : "text-slate-500"
              )}
            >
              S'inscrire
            </button>
            <button 
              onClick={() => { setAuthMode('phone'); setIsRegistering(false); }}
              className={cn(
                "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                authMode === 'phone' ? "bg-white text-slate-900 shadow-xl" : "text-slate-500"
              )}
            >
              Mobile
            </button>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500 text-[10px] font-black uppercase tracking-wider">
              {error}
            </div>
          )}

          {authMode === 'phone' ? (
            <form onSubmit={handlePhoneSignIn} className="space-y-4">
              {/* Phone auth UI remained untouched */}
              <div id="recaptcha-container"></div>
              {!confirmResult ? (
                <div className="relative">
                  <Phone className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input 
                    required
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+226 XX XX XX XX"
                    className="w-full bg-slate-800 border-none rounded-2xl pl-14 pr-6 py-5 text-sm font-bold text-white focus:ring-2 focus:ring-orange-500 transition-all outline-none"
                  />
                </div>
              ) : (
                <div className="relative">
                  <Lock className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input 
                    required
                    type="text"
                    value={verificationCode}
                    onChange={e => setVerificationCode(e.target.value)}
                    placeholder="CODE SMS"
                    className="w-full bg-slate-800 border-none rounded-2xl pl-14 pr-6 py-5 text-sm font-bold text-white focus:ring-2 focus:ring-orange-500 tracking-[0.5em] text-center outline-none"
                  />
                </div>
              )}
              <button 
                type="submit"
                disabled={loading}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white rounded-2xl py-5 font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-orange-900/20 transition-all flex items-center justify-center gap-2 group"
              >
                {loading ? "Chargement..." : !confirmResult ? "Envoyer le code" : "Confirmer"}
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </form>
          ) : isRegistering ? (
            <form onSubmit={handleAuth} className="space-y-4">
              <div className="flex gap-2 p-1 bg-slate-800/50 rounded-2xl border border-slate-700 overflow-hidden mb-6">
                <button 
                  type="button"
                  onClick={() => setRole('client')}
                  className={cn(
                    "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                    role === 'client' ? "bg-orange-500 text-white shadow-lg" : "text-slate-500 hover:text-white"
                  )}
                >
                  Compte Client
                </button>
                <button 
                  type="button"
                  onClick={() => setRole('driver')}
                  className={cn(
                    "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                    role === 'driver' ? "bg-blue-600 text-white shadow-lg" : "text-slate-500 hover:text-white"
                  )}
                >
                  Compte Livreur
                </button>
              </div>

              {role === 'driver' && (
                <div className="flex bg-slate-800/50 rounded-xl p-1 border border-slate-700 mb-6">
                   <button
                     type="button"
                     onClick={() => setDriverType('freelance')}
                     className={cn("flex-1 py-2 rounded-lg text-[10px] font-bold uppercase transition-all", driverType === 'freelance' ? "bg-slate-700 text-white" : "text-slate-500 hover:text-white")}
                   >
                     Individu
                   </button>
                   <button
                     type="button"
                     onClick={() => setDriverType('company')}
                     className={cn("flex-1 py-2 rounded-lg text-[10px] font-bold uppercase transition-all", driverType === 'company' ? "bg-slate-700 text-white" : "text-slate-500 hover:text-white")}
                   >
                     Société de livraison
                   </button>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 px-2">{role === 'driver' && driverType === 'company' ? 'Nom de la Société' : 'Nom Complet'}</label>
                  <input 
                    required
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder={role === 'driver' && driverType === 'company' ? 'Ex: Express Logistique' : 'Ex: Jean Dupont'}
                    className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-5 py-4 text-sm font-bold text-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 px-2">Email</label>
                  <input 
                    required
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="Ex: contact@email.com"
                    className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-5 py-4 text-sm font-bold text-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 px-2">Téléphone</label>
                  <input 
                    required
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="Ex: +226 70 00 00 00"
                    className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-5 py-4 text-sm font-bold text-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 px-2">Mot de Passe</label>
                  <input 
                    required
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Min. 6 caractères"
                    className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-5 py-4 text-sm font-bold text-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all outline-none"
                  />
                </div>
              </div>

              {role === 'driver' && (
                <div className="mt-4 p-5 bg-slate-900/50 border border-slate-800 rounded-3xl space-y-5">
                  <div className="flex items-center gap-2">
                    <CheckSquare className="w-4 h-4 text-emerald-500" />
                    <h3 className="text-xs font-black text-white uppercase tracking-widest">Documents et Vérification</h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     <div className="border-2 border-dashed border-slate-700 rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:border-orange-500 hover:bg-slate-800/50 transition-all group">
                        <Camera className="w-6 h-6 text-slate-500 group-hover:text-orange-500 mb-2 transition-colors" />
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest group-hover:text-orange-400">
                          {driverType === 'company' ? 'RCCM / Statuts' : 'CNI Recto *'}
                        </span>
                     </div>
                     <div className="border-2 border-dashed border-slate-700 rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:border-orange-500 hover:bg-slate-800/50 transition-all group">
                        <Camera className="w-6 h-6 text-slate-500 group-hover:text-orange-500 mb-2 transition-colors" />
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest group-hover:text-orange-400">
                          {driverType === 'company' ? 'NIF / IFU' : 'CNI Verso *'}
                        </span>
                     </div>
                  </div>

                  <div className="space-y-1 pt-2">
                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 px-2">Adresse / Zone d'activité</label>
                    <input 
                      type="text"
                      value={address}
                      onChange={e => setAddress(e.target.value)}
                      placeholder="Ex: Ouagadougou, Secteur 1"
                      className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-5 py-4 text-sm font-bold text-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all outline-none"
                    />
                  </div>

                  <div className="flex items-start gap-4 pt-4 border-t border-slate-800">
                     <input 
                       type="checkbox" 
                       required
                       checked={termsAccepted}
                       onChange={(e) => setTermsAccepted(e.target.checked)}
                       className="mt-1 w-5 h-5 rounded border-slate-700 bg-slate-800 text-orange-500 focus:ring-orange-500 focus:ring-offset-slate-900 cursor-pointer"
                     />
                     <div>
                       <p className="text-[11px] font-black text-slate-300">Conditions d'utilisation</p>
                       <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                         En cochant cette case, le livreur s'engage à respecter les normes de sécurité des colis et à maintenir une conduite professionnelle irréprochable.
                       </p>
                     </div>
                  </div>
                </div>
              )}

              <button 
                type="submit"
                disabled={loading}
                className="w-full mt-4 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl py-5 font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-orange-900/20 transition-all flex items-center justify-center gap-2 group"
              >
                {loading ? "Chargement..." : "Créer mon compte"}
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </form>
          ) : (
            <form onSubmit={handleAuth} className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input 
                  required
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="ADRESSE EMAIL"
                  className="w-full bg-slate-800 border-none rounded-2xl pl-14 pr-6 py-5 text-sm font-bold text-white focus:ring-2 focus:ring-orange-500 transition-all outline-none"
                />
              </div>
              <div className="relative">
                <Lock className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input 
                  required
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="MOT DE PASSE"
                  className="w-full bg-slate-800 border-none rounded-2xl pl-14 pr-6 py-5 text-sm font-bold text-white focus:ring-2 focus:ring-orange-500 transition-all outline-none"
                />
              </div>
              <button 
                type="submit"
                disabled={loading}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white rounded-2xl py-5 font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-orange-900/20 transition-all flex items-center justify-center gap-2 group"
              >
                {loading ? "Chargement..." : "Se Connecter"}
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </form>
          )}

          <div className="mt-10 flex items-center gap-4">
            <div className="flex-1 h-px bg-slate-800" />
            <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest leading-none">Ou continuer avec</span>
            <div className="flex-1 h-px bg-slate-800" />
          </div>

          <button 
            onClick={() => login()}
            className="mt-8 w-full bg-white text-slate-900 rounded-2xl py-5 font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:bg-slate-50 transition-all flex items-center justify-center gap-3"
          >
            <Globe className="w-4 h-4 text-blue-600" />
            Google Connect
          </button>
          
          <div className="mt-10 pt-10 border-t border-slate-800/50 flex justify-between items-center">
             <div className="flex flex-col">
                <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1">Assistance 24/7</span>
                <span className="text-white font-bold text-xs">+226 00 00 00 00</span>
             </div>
             <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer">
                   <Phone className="w-4 h-4" />
                </div>
                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer">
                   <Mail className="w-4 h-4" />
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
