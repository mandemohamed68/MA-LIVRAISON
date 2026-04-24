import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { User, Phone, MapPin, Truck, Save, ArrowLeft } from 'lucide-react';

export default function Settings() {
  const { profile, loading } = useAuth();
  const navigate = useNavigate();
  
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [vehicleType, setVehicleType] = useState('moto');
  const [licensePlate, setLicensePlate] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (profile) {
      setName(profile.name || '');
      setPhone(profile.phone || '');
      setAddress((profile as any).address || '');
      setVehicleType(profile.vehicleType || 'moto');
      setLicensePlate(profile.licensePlate || '');
    }
  }, [profile]);

  if (loading || !profile) return (
    <div className="flex justify-center py-20">
      <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSuccessMsg('');
    try {
      const updates: any = {
        name,
        phone,
        address,
        updatedAt: new Date().toISOString()
      };
      
      if (profile.role === 'driver') {
        updates.vehicleType = vehicleType;
        updates.licensePlate = licensePlate;
      }
      
      await updateDoc(doc(db, 'users', profile.userId), updates);
      setSuccessMsg('Profil mis à jour avec succès');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      console.error(err);
      alert('Erreur lors de la mise à jour du profil');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <button 
        onClick={() => navigate(-1)} 
        className="flex items-center gap-2 text-slate-500 hover:text-slate-900 mb-8 transition-colors font-bold text-xs uppercase tracking-widest"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour
      </button>

      <div className="bg-white rounded-[40px] p-8 md:p-12 shadow-sm border border-slate-100">
        <div className="flex items-center gap-4 mb-10">
          <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-slate-900/20">
            <User className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase leading-none">Mon Profil</h1>
            <p className="text-[10px] font-bold text-slate-400 tracking-[0.2em] uppercase mt-2">Paramètres du compte</p>
          </div>
        </div>

        {successMsg && (
          <div className="mb-8 p-4 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100 text-sm font-bold text-center">
            {successMsg}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-2">Nom complet</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input 
                type="text" 
                value={name}
                onChange={e => setName(e.target.value)}
                required
                className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:outline-none focus:border-orange-500 focus:bg-white text-slate-900 font-bold transition-all text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-2">Téléphone</label>
            <div className="relative">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input 
                type="tel" 
                value={phone}
                onChange={e => setPhone(e.target.value)}
                required
                placeholder="+226 XX XX XX XX"
                className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:outline-none focus:border-orange-500 focus:bg-white text-slate-900 font-bold transition-all text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-2">Adresse</label>
            <div className="relative">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input 
                type="text" 
                value={address}
                onChange={e => setAddress(e.target.value)}
                placeholder="Ex: Ouagadougou, Secteur 1"
                className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:outline-none focus:border-orange-500 focus:bg-white text-slate-900 font-bold transition-all text-sm"
              />
            </div>
          </div>

          {profile.role === 'driver' && (
            <div className="space-y-6 pt-6 border-t border-slate-100">
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter">Informations Livreur</h3>
              
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-2">Type de véhicule</label>
                <div className="relative">
                  <Truck className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <select 
                    value={vehicleType}
                    onChange={e => setVehicleType(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:outline-none focus:border-orange-500 focus:bg-white text-slate-900 font-bold transition-all text-sm appearance-none"
                  >
                    <option value="moto">Moto</option>
                    <option value="tricycle">Tricycle</option>
                    <option value="voiture">Voiture</option>
                    <option value="fourgonnette">Fourgonnette</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-2">Numéro d'immatriculation (Optionnel)</label>
                <div className="relative">
                  <input 
                    type="text" 
                    value={licensePlate}
                    onChange={e => setLicensePlate(e.target.value)}
                    placeholder="Ex: 11 HH 1111 BF"
                    className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:outline-none focus:border-orange-500 focus:bg-white text-slate-900 font-bold transition-all text-sm uppercase"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="pt-8">
            <button 
              type="submit" 
              disabled={isSaving}
              className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white p-5 rounded-2xl font-black text-sm tracking-widest uppercase hover:bg-orange-600 transition-all shadow-xl shadow-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Sauvegarde...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Garder les modifications
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}