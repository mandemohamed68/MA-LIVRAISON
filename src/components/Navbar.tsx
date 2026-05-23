import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { User, LogOut, Package, ShieldCheck, MapPin, CheckCircle, Menu, X, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import NotificationBell from './NotificationBell';
import { cn } from '../lib/utils';
import { AppLanguage } from '../lib/translations';
import { api } from '../services/apiService';
import { AppConfig } from '../types';
import Logo from './Logo';
import logoImg from '../assets/logo.png';

export default function Navbar() {
  const { user, profile, logout, language, setLanguage, t, isMasterAdmin, updateRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);
  const [logoUrl, setLogoUrl] = useState(logoImg);
  const [logoError, setLogoError] = useState(false);

  const handleRoleChangeInNavbar = async (role: any) => {
    try {
      await updateRole(role);
      if (role === 'client') navigate('/client');
      else if (role === 'driver') navigate('/driver');
      else navigate('/admin');
    } catch (e) {
      console.error("Error switching role:", e);
    }
  };

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const config = await api.config.get('app_config').catch(() => null);
        if (config) setAppConfig(config);
      } catch (err) {
        console.warn("Local config fetch failed in navbar");
      }
    };
    fetchConfig();
    const interval = setInterval(fetchConfig, 30000); // Only poll every 30s
    return () => clearInterval(interval);
  }, []);

  const isAdminView = location.pathname.startsWith('/admin') && (isMasterAdmin || profile?.role === 'admin' || profile?.role === 'superadmin');
  const isCreateView = location.pathname === '/client/new';

  if (!user) return null;

  const languages: { code: AppLanguage | 'en', label: string, flag: string }[] = [
    { code: 'fr', label: 'Français', flag: '🇫🇷' },
    { code: 'en', label: 'English', flag: '🇬🇧' }
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
    <nav className="bg-primary text-white sticky top-0 z-50 shadow-md border-b border-white/5 pt-[env(safe-area-inset-top)]">
      {/* Test Mode Banner */}
      <AnimatePresence>
        {appConfig?.mode === 'test' && (
          <motion.div 
            initial={{ height: 0 }} 
            animate={{ height: 'auto' }} 
            className="bg-amber-400 text-amber-950 text-[10px] font-black uppercase tracking-[0.3em] flex items-center justify-center h-8"
          >
            <ShieldCheck className="w-3 h-3 mr-2" />
            Environnement de Test Actif • PANCHO EXPRESS
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mini Bar for Master Admin role testing */}
      {isMasterAdmin && (
        <div className="bg-black/20 border-b border-white/5 text-orange-200 text-[10px] font-bold uppercase tracking-wider py-1.5 px-6 flex flex-wrap items-center justify-center gap-3">
          <span className="text-[9px] font-black tracking-widest text-orange-300">Tester Rôle :</span>
          <div className="flex gap-2">
            {[
              { id: 'client', label: 'Client' },
              { id: 'driver', label: 'Livreur' },
              { id: 'admin', label: 'Admin' }
            ].map(r => (
              <button
                key={r.id}
                onClick={() => handleRoleChangeInNavbar(r.id)}
                className={cn(
                  "px-2.5 py-1 rounded-md text-[9px] font-black tracking-wider transition-all cursor-pointer",
                  profile?.role === r.id 
                    ? "bg-orange-500 text-white shadow-md" 
                    : "text-white/60 hover:text-white hover:bg-white/10"
                )}
              >
                {r.label.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="w-full">
        <div className={cn(
          "mx-auto flex justify-between items-center transition-all duration-300",
          isCreateView ? "h-14 px-10 max-w-[1900px]" : "h-16 container px-6",
          isAdminView && "h-16 px-10 max-w-[1900px]"
        )}>
          <Link to="/" className="flex items-center gap-3 group shrink-0">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center bg-white shadow-xl shadow-orange-950/20 group-hover:scale-110 transition-all duration-500 overflow-hidden border-2 border-white/50 p-1 shrink-0">
              {!logoError ? (
                 <img src={logoUrl} alt="PANCHO Logo" onError={() => setLogoError(true)} className="w-full h-full object-contain" />
              ) : (
                 <Logo className="w-full h-full text-orange-600" />
              )}
            </div>
            <div className="hidden sm:flex flex-col justify-center">
              <div className="flex items-baseline space-x-0.5">
                <span className="text-xl sm:text-2xl font-black tracking-tighter uppercase leading-none italic text-white">PANCHO</span>
                <span className="text-xl sm:text-2xl font-black tracking-tighter uppercase leading-none italic text-orange-200">EXPRESS</span>
              </div>
              <span className="text-[8px] sm:text-[9px] font-black tracking-[0.45em] text-white/50 uppercase mt-1">Plateforme Logistique</span>
            </div>
          </Link>

          <div className="flex items-center gap-2 sm:gap-6">
            <div className="hidden xl:flex items-center gap-1 p-1 bg-white/10 rounded-xl border border-white/20">
              {navItems()}
            </div>
            
            <div className="flex items-center gap-2 sm:gap-4 lg:pl-6 lg:border-l lg:border-white/20">
              <div className="hidden md:flex bg-white/10 p-1 rounded-xl border border-white/20">
                {languages.map(lang => (
                  <button
                    key={lang.code}
                    onClick={() => setLanguage(lang.code)}
                    className={cn(
                      "px-2 py-1 rounded-lg text-[9px] font-black transition-all uppercase tracking-widest",
                      language === lang.code ? "bg-white text-primary shadow-lg" : "text-white/70 hover:text-white"
                    )}
                  >
                    {lang.code.toUpperCase()}
                  </button>
                ))}
              </div>

              <NotificationBell />
              
              <div className="hidden md:flex flex-col items-end">
                <span className="text-[7px] font-black uppercase tracking-[0.2em] text-white/70 leading-none mb-1">
                  {profile?.role === 'superadmin' ? 'Super Admin' : 
                   profile?.role === 'admin' ? 'Manager' : 
                   profile?.role === 'driver' ? 'Livreur Pro' : 'Client Gold'}
                </span>
                <span className="text-xs font-black tracking-tighter leading-none">{profile?.name?.split(' ')[0]}</span>
              </div>
              
              <div className="relative group shrink-0">
                <button 
                  onClick={() => navigate('/settings')}
                  className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-white/10 border border-white/20 shadow-lg overflow-hidden flex items-center justify-center shrink-0 hover:bg-white hover:text-primary transition-all cursor-pointer group"
                >
                  <User className="h-4 w-4 text-white group-hover:text-primary transition-all" />
                </button>
              </div>

              <button
                onClick={() => logout().then(() => navigate('/'))}
                className="flex w-8 h-8 sm:w-10 sm:h-10 shrink-0 bg-white/10 hover:bg-red-500 text-white hover:text-white rounded-lg sm:rounded-xl transition-all items-center justify-center border border-white/20"
                title="Déconnexion"
              >
                <LogOut className="h-4 w-4" />
              </button>

              <button 
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="xl:hidden w-8 h-8 sm:w-10 sm:h-10 shrink-0 bg-white/10 rounded-lg sm:rounded-xl flex items-center justify-center shadow-sm border border-white/20"
              >
                {isMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
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
            className="xl:hidden bg-primary-dark overflow-hidden"
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
                      language === lang.code ? "bg-white text-primary shadow-xl" : "text-white/60"
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
                className="mt-4 flex items-center justify-center gap-3 py-4 bg-white/10 rounded-2xl text-xs font-black uppercase tracking-widest text-white border border-white/5 hover:bg-red-500 transition-colors"
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

