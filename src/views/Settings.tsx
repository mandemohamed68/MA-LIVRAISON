import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { User, Phone, MapPin, Truck, Save, ArrowLeft, ShieldCheck, CheckCircle, Camera } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export default function Settings() {
  const { profile, loading, updateProfile } = useAuth();
  const navigate = useNavigate();
  
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [address, setAddress] = useState('');
  const [vehicleType, setVehicleType] = useState('moto');
  const [licensePlate, setLicensePlate] = useState('');
  const [driverType, setDriverType] = useState<'freelance' | 'company'>(profile?.driverType || 'freelance');
  const [photoURL, setPhotoURL] = useState('');
  const [password, setPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (profile) {
      setName(profile.name || '');
      setPhone(profile.phone || '');
      setCity(profile.city || '');
      setNeighborhood(profile.neighborhood || '');
      setAddress((profile as any).address || '');
      setVehicleType(profile.vehicleType || 'moto');
      setLicensePlate(profile.licensePlate || '');
      setPhotoURL(profile.photoURL || '');
      if (profile.driverType) setDriverType(profile.driverType);
    }
  }, [profile]);

  if (loading || !profile) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert("La photo ne doit pas dépasser 2 Mo.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoURL(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSuccessMsg('');
    try {
      const payload: any = {
        name,
        phone,
        city,
        neighborhood,
        address,
        vehicleType,
        licensePlate,
        driverType,
        photoURL,
        updatedAt: new Date().toISOString()
      };
      if (password) payload.password = password;
      await updateProfile(payload);
      setSuccessMsg('Profil mis à jour avec succès !');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 lg:p-12 pb-24 selection:bg-orange-500 selection:text-white overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        <button 
          onClick={() => navigate(-1)} 
          className="flex items-center gap-2 text-slate-400 hover:text-slate-900 mb-8 transition-colors font-black text-[10px] uppercase tracking-[0.3em] group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Retour au Dashboard
        </button>

        <header className="mb-12">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-1 bg-orange-500 rounded-full" />
            <p className="text-[10px] font-black text-orange-500 uppercase tracking-[0.3em]">Espace Personnel</p>
          </div>
          <h1 className="text-4xl lg:text-5xl font-black text-slate-900 italic uppercase tracking-tighter leading-none mb-6">
            Configuration <span className="text-orange-500">Profil.</span>
          </h1>
          
          {profile.role === 'driver' && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white border border-slate-200 p-2 rounded-[32px] flex flex-col md:flex-row items-center gap-4 shadow-sm"
            >
              <div className="flex-1 px-6">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-relaxed">Précisez votre statut pour la gestion des revenus</p>
              </div>
              <div className="flex bg-slate-50 p-1.5 rounded-[24px] w-full md:w-auto">
                <button 
                  type="button"
                  onClick={() => setDriverType('freelance')}
                  className={cn(
                    "px-8 py-4 rounded-[18px] text-[10px] font-black uppercase tracking-widest transition-all",
                    driverType === 'freelance' ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20" : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  Je suis Indépendant
                </button>
                <button 
                  type="button"
                  onClick={() => setDriverType('company')}
                  className={cn(
                    "px-8 py-4 rounded-[18px] text-[10px] font-black uppercase tracking-widest transition-all",
                    driverType === 'company' ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20" : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  Je travaille pour une société
                </button>
              </div>
            </motion.div>
          )}
        </header>

        <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white border border-slate-200 rounded-[40px] p-8 md:p-10 space-y-8 relative overflow-hidden shadow-sm">
              <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 blur-[60px] rounded-full" />
              
              <h3 className="text-xl font-black text-slate-900 italic uppercase tracking-tight flex items-center gap-4">
                <User className="w-6 h-6 text-orange-500" /> Informations générales
              </h3>

              <div className="flex flex-col sm:flex-row items-center gap-6 pb-6 border-b border-slate-100">
                <div className="relative group w-24 h-24 rounded-full overflow-hidden bg-slate-100 border-2 border-slate-200 shadow-inner flex items-center justify-center">
                  {photoURL ? (
                    <img src={photoURL} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-10 h-10 text-slate-400" />
                  )}
                  <label className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                    <Camera className="w-6 h-6 text-white" />
                    <input type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
                  </label>
                </div>
                <div className="text-center sm:text-left">
                  <p className="text-sm font-black text-slate-900">Photo de profil</p>
                  <p className="text-xs text-slate-400 mt-1">Formats acceptés : PNG, JPG. Max 2 Mo.</p>
                  <label className="mt-2 inline-block bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors border border-slate-200">
                    Choisir un fichier
                    <input type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
                  </label>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 pl-2">Nom Complet</label>
                  <input 
                    type="text" 
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 text-slate-900 p-5 rounded-2xl focus:outline-none focus:border-orange-500 transition-all font-bold text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 pl-2">Email</label>
                  <input 
                    disabled
                    type="email" 
                    value={profile.email}
                    className="w-full bg-slate-50/50 border border-slate-100 text-slate-400 p-5 rounded-2xl cursor-not-allowed font-bold text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 pl-2">Téléphone</label>
                  <input 
                    type="tel" 
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 text-slate-900 p-5 rounded-2xl focus:outline-none focus:border-orange-500 transition-all font-bold text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 pl-2">Ville</label>
                  <input 
                    type="text" 
                    value={city}
                    onChange={e => setCity(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 text-slate-900 p-5 rounded-2xl focus:outline-none focus:border-orange-500 transition-all font-bold text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 pl-2">Quartier</label>
                  <input 
                    type="text" 
                    value={neighborhood}
                    onChange={e => setNeighborhood(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 text-slate-900 p-5 rounded-2xl focus:outline-none focus:border-orange-500 transition-all font-bold text-sm"
                  />
                </div>
                <div className="space-y-2 lg:col-span-2">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 pl-2">Adresse Complète</label>
                  <input 
                    type="text" 
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 text-slate-900 p-5 rounded-2xl focus:outline-none focus:border-orange-500 transition-all font-bold text-sm"
                  />
                </div>
                <div className="space-y-2 lg:col-span-2">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 pl-2">Mot de passe (laisser vide pour ne pas modifier)</label>
                  <input 
                    type="password" 
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Nouveau mot de passe..."
                    className="w-full bg-slate-50 border border-slate-100 text-slate-900 p-5 rounded-2xl focus:outline-none focus:border-orange-500 transition-all font-bold text-sm"
                  />
                </div>
              </div>
            </div>

            {profile.role === 'driver' && (
              <div className="bg-white border border-slate-200 rounded-[40px] p-8 md:p-10 space-y-8 relative overflow-hidden shadow-sm">
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-500/5 blur-[60px] rounded-full" />
                
                <h3 className="text-xl font-black text-slate-900 italic uppercase tracking-tight flex items-center gap-4">
                  <Truck className="w-6 h-6 text-blue-500" /> Détails Logistiques
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 pl-2">Type de Véhicule</label>
                    <select 
                      value={vehicleType}
                      onChange={e => setVehicleType(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-100 text-slate-900 p-5 rounded-2xl focus:outline-none focus:border-orange-500 transition-all font-bold text-sm appearance-none"
                    >
                      <option value="moto">Moto (P4, Zem)</option>
                      <option value="tricycle">Tricycle Cargo</option>
                      <option value="voiture">Voiture / Van</option>
                      <option value="camionnette">Fourgonnette</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 pl-2">Immatriculation</label>
                    <input 
                      type="text" 
                      value={licensePlate}
                      onChange={e => setLicensePlate(e.target.value)}
                      placeholder="Ex: 11 HH 1111"
                      className="w-full bg-slate-50 border border-slate-100 text-slate-900 p-5 rounded-2xl focus:outline-none focus:border-orange-500 transition-all font-bold text-sm uppercase"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-[40px] p-10 flex flex-col items-center text-center shadow-sm relative overflow-hidden">
              <div className="w-24 h-24 bg-orange-50 rounded-[30px] flex items-center justify-center text-orange-500 mb-6 border border-orange-100">
                <ShieldCheck className="w-12 h-12" />
              </div>
              <h4 className="text-slate-900 font-black uppercase tracking-tight mb-2 italic">Compte Sécurisé</h4>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-loose">
                Vos données biométriques et documents sont cryptés (Bf-Law 2024).
              </p>
            </div>

            <button 
              type="submit"
              disabled={isSaving}
              className="w-full py-6 bg-slate-900 text-white rounded-[30px] font-black uppercase tracking-[0.3em] text-xs shadow-xl shadow-slate-200 hover:bg-orange-600 transition-all flex items-center justify-center gap-4 disabled:opacity-50"
            >
              {isSaving ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Sauvegarder
                </>
              )}
            </button>

            <AnimatePresence>
              {successMsg && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="p-5 bg-emerald-50 border border-emerald-100 rounded-3xl flex items-center gap-4 text-emerald-600"
                >
                  <CheckCircle className="w-5 h-5 shrink-0" />
                  <p className="text-[10px] font-black uppercase tracking-widest">{successMsg}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </form>
      </div>
    </div>
  );
}