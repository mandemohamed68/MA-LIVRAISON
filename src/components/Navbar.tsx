import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Truck, User, LogOut, Package, ShieldCheck, MapPin, Clock, CheckCircle, Navigation, Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import NotificationBell from './NotificationBell';
import { cn } from '../lib/utils';
import { AppLanguage } from '../lib/translations';
import { db } from '../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { AppConfig } from '../types';

export default function Navbar() {
  const { user, profile, logout, language, setLanguage, t, isMasterAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'app_config'), 
      (snap) => {
        if (snap.exists()) setAppConfig(snap.data() as AppConfig);
      },
      (error) => {
        console.warn("AppConfig listener error:", error.message);
      }
    );
    return () => unsub();
  }, []);

  const isAdminView = location.pathname.startsWith('/admin') && (isMasterAdmin || profile?.role === 'admin' || profile?.role === 'superadmin');

  if (!user) return null;

  const languages: { code: AppLanguage, label: string, flag: string }[] = [
    { code: 'fr', label: 'Français', flag: '🇫🇷' },
    { code: 'moore', label: 'Mooré', flag: '🇧🇫' },
    { code: 'dioula', label: 'Dioula', flag: '🇧🇫' },
  ];

  const NavLink = ({ to, icon: Icon, children, exact = false, onClick }: { to: string, icon: any, children: React.ReactNode, exact?: boolean, onClick?: () => void }) => {
    const isActive = exact ? location.pathname === to : location.pathname.startsWith(to);
    return (
      <Link 
        to={to} 
        onClick={onClick}
        className={cn(
          "px-4 py-2 rounded-xl transition-all flex items-center gap-2 text-xs font-black uppercase tracking-widest w-full lg:w-auto",
          isActive ? "bg-white text-orange-600 shadow-lg" : "text-white/70 hover:text-white hover:bg-orange-600/50"
        )}
      >
        <Icon className="h-4 w-4" />
        <span>{children}</span>
      </Link>
    );
  };

  const navItems = (onClick?: () => void) => (
    <>
      {/* Client Specific Menus */}
      {profile?.role === 'client' && (
        <>
          <NavLink to="/client/new" icon={Package} onClick={onClick}>{t('commander')}</NavLink>
          <NavLink to="/client" exact icon={Clock} onClick={onClick}>{t('active_delivery')}</NavLink>
          <NavLink to="/client/history" icon={CheckCircle} onClick={onClick}>{t('history')}</NavLink>
        </>
      )}

      {/* Driver Specific Menus */}
      {profile?.role === 'driver' && (
        <>
          <NavLink to="/driver" exact icon={MapPin} onClick={onClick}>{t('missions')}</NavLink>
          <NavLink to="/driver/active" icon={Navigation} onClick={onClick}>{t('active_delivery')}</NavLink>
          <NavLink to="/driver/history" icon={CheckCircle} onClick={onClick}>{t('history')}</NavLink>
        </>
      )}

      {/* Admin Specific Menus */}
      {(profile?.role === 'admin' || profile?.role === 'superadmin') && (
        <>
          <NavLink to="/admin" exact icon={ShieldCheck} onClick={onClick}>{t('admin_board')}</NavLink>
        </>
      )}

      {/* Master Admin Emergency Switch (Always visible for the owner but not mixed with other roles) */}
      {isMasterAdmin && profile?.role !== 'admin' && profile?.role !== 'superadmin' && (
        <NavLink to="/admin" icon={ShieldCheck} onClick={onClick}>{t('admin_board')}</NavLink>
      )}
    </>
  );

  return (
    <nav className="bg-[#111827] text-white sticky top-0 z-50 shadow-2xl border-b border-white/5 overflow-hidden">
      {/* Test Mode Banner */}
      <AnimatePresence>
        {appConfig?.mode === 'test' && (
          <motion.div 
            initial={{ height: 0 }} 
            animate={{ height: 'auto' }} 
            className="bg-amber-400 text-amber-950 text-[10px] font-black uppercase tracking-[0.3em] flex items-center justify-center h-8"
          >
            <ShieldCheck className="w-3 h-3 mr-2" />
            Environnement de Test Actif • Ma Livraison Express
          </motion.div>
        )}
      </AnimatePresence>

      <div className="w-full">
        <div className={cn(
          "mx-auto flex justify-between items-center h-24",
          isAdminView ? "px-10" : "container px-6"
        )}>
          <Link to="/" className="flex items-center gap-4 group shrink-0">
            <div className="w-12 h-12 bg-orange-500 rounded-[18px] flex items-center justify-center shadow-[0_0_20px_rgba(249,115,22,0.3)] group-hover:scale-110 transition-all duration-500">
              <Truck className="h-7 w-7 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-black tracking-tighter uppercase leading-none italic">Ma <span className="text-orange-500">Livraison.</span></span>
              <span className="text-[9px] font-black tracking-[0.4em] text-slate-500 uppercase mt-1">Express Logistique</span>
            </div>
          </Link>

          <div className="flex items-center gap-2 sm:gap-6">
            <div className="hidden xl:flex items-center gap-1 p-1 bg-white/5 rounded-xl border border-white/10">
              {navItems()}
            </div>
            
            <div className="flex items-center gap-2 sm:gap-4 lg:pl-6 lg:border-l lg:border-white/10">
              <div className="hidden md:flex bg-white/5 p-1 rounded-xl border border-white/10">
                {languages.map(lang => (
                  <button
                    key={lang.code}
                    onClick={() => setLanguage(lang.code)}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-[9px] font-black transition-all uppercase tracking-widest",
                      language === lang.code ? "bg-orange-500 text-white shadow-lg" : "text-slate-400 hover:text-white"
                    )}
                  >
                    {lang.code.toUpperCase()}
                  </button>
                ))}
              </div>

              <NotificationBell />
              
              <div className="hidden md:flex flex-col items-end">
                <span className="text-[7px] font-black uppercase tracking-[0.2em] text-slate-500 leading-none mb-1">
                  {profile?.role === 'superadmin' ? 'Super Admin' : 
                   profile?.role === 'admin' ? 'Manager' : 
                   profile?.role === 'driver' ? 'Livreur Pro' : 'Client Gold'}
                </span>
                <span className="text-xs font-black tracking-tighter leading-none">{profile?.name?.split(' ')[0]}</span>
              </div>
              
              <div className="relative group">
                <button 
                  onClick={() => navigate('/settings')}
                  className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-slate-800 border border-white/10 shadow-lg overflow-hidden flex items-center justify-center shrink-0 hover:border-orange-500 transition-all cursor-pointer group"
                >
                  <User className="h-5 w-5 text-slate-400 group-hover:text-white transition-all" />
                </button>
              </div>

              <button
                onClick={() => logout().then(() => navigate('/'))}
                className="flex w-10 h-10 sm:w-11 sm:h-11 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-xl sm:rounded-2xl transition-all items-center justify-center border border-red-500/20"
                title="Déconnexion"
              >
                <LogOut className="h-5 w-5" />
              </button>

              <button 
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="xl:hidden w-10 h-10 bg-orange-600 rounded-xl flex items-center justify-center shadow-sm"
              >
                {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="lg:hidden bg-orange-600 overflow-hidden"
          >
            <div className="p-6 flex flex-col gap-6">
              <div className="flex bg-white/10 p-1.5 rounded-xl border border-white/5">
                {languages.map(lang => (
                  <button
                    key={lang.code}
                    onClick={() => {
                      setLanguage(lang.code);
                      setIsMenuOpen(false);
                    }}
                    className={cn(
                      "flex-1 py-3 rounded-lg text-xs font-black transition-all uppercase tracking-[0.2em]",
                      language === lang.code ? "bg-white text-orange-600 shadow-xl" : "text-white/60"
                    )}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
              <div className="flex flex-col gap-2">
                {navItems(() => setIsMenuOpen(false))}
              </div>
              <button
                onClick={() => logout().then(() => navigate('/'))}
                className="mt-4 flex items-center justify-center gap-3 py-4 bg-white/10 rounded-2xl text-xs font-black uppercase tracking-widest text-white border border-white/5"
              >
                <LogOut className="h-5 w-5" />
                Déconnexion
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}

