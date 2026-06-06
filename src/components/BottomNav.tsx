import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Home, Package, User, Wallet, ShieldCheck } from 'lucide-react';
import { cn } from '../lib/utils';
import { api } from '../services/apiService';

export default function BottomNav() {
  const { profile, isMasterAdmin } = useAuth();
  const location = useLocation();
  const [availCount, setAvailCount] = useState<number>(0);

  useEffect(() => {
    if (!profile || profile.role !== 'driver') return;

    const fetchCount = async () => {
      try {
        const jobs = await api.deliveries.list();
        const pending = jobs.filter((j: any) => j.status === 'pending');
        const filtered = pending.filter((j: any) => !j.rejectedBy?.includes(profile.userId));
        setAvailCount(filtered.length);
      } catch (e) {
        // quiet fail
      }
    };

    fetchCount();
    const interval = setInterval(fetchCount, 15000); // refresh every 15s
    return () => clearInterval(interval);
  }, [profile]);

  if (!profile) return null;
  if (location.pathname.startsWith('/admin')) return null;

  const isDriver = profile.role === 'driver';
  const isAdmin = profile.role === 'admin' || profile.role === 'superadmin';

  const navItems = isDriver ? [
    { to: '/driver', icon: Home, label: 'ACCUEIL', match: '/driver', exact: true },
    { to: '/driver?tab=history', icon: Package, label: 'COURSES', match: '/driver?tab=history' },
    { to: '/driver?tab=profile', icon: User, label: 'PROFIL', match: '/driver?tab=profile' },
  ] : isAdmin ? [
    { to: '/admin', icon: Home, label: 'ADMIN', match: '/admin', exact: true },
    { to: '/settings', icon: User, label: 'PROFIL', match: '/settings' },
  ] : [
    { to: '/client', icon: Home, label: 'ACCUEIL', match: '/client', exact: true },
    { to: '/client/history', icon: Package, label: 'COURSES', match: '/client/history' },
    { to: '/settings', icon: User, label: 'PROFIL', match: '/settings' },
  ];

  if (isMasterAdmin && !isAdmin) {
    navItems.push({ to: '/admin', icon: ShieldCheck, label: 'ADMIN', match: '/admin', exact: true });
  }

  return (
    <div className="fixed bottom-0 left-0 w-full bg-white border-t border-slate-200 px-2 flex xl:hidden justify-around items-center z-[100] pb-[env(safe-area-inset-bottom)]">
      {navItems.map((item, i) => {
        const fullPath = location.pathname + location.search;
        const isActive = item.exact 
          ? (location.pathname === item.match && !location.search)
          : fullPath.includes(item.match);

        return (
          <Link
            key={i}
            to={item.to}
            className={cn(
              "flex flex-col items-center justify-center w-20 py-3 transition-all duration-300",
              isActive ? "text-[#5542F6]" : "text-slate-400 hover:text-slate-600"
            )}
          >
            <div className="relative">
              <item.icon className={cn("w-6 h-6 mb-1", isActive ? "stroke-[2.5px] text-[#5542F6]" : "stroke-2")} />
              {item.label === 'ACCUEIL' && isDriver && availCount > 0 && (
                <span className="absolute -top-1.5 -right-2 bg-orange-600 text-white font-black text-[8px] h-4 min-w-[16px] px-1 flex items-center justify-center rounded-full select-none animate-pulse shadow-md border border-white">
                  {availCount}
                </span>
              )}
            </div>
            <span className={cn("text-[9px] font-black tracking-[0.1em]", isActive ? "text-[#5542F6]" : "text-slate-400")}>
              {item.label}
            </span>
          </Link>
        );
      })}
    </div>
  );
}


