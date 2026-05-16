import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Home, Package, User, Wallet } from 'lucide-react';
import { cn } from '../lib/utils';

export default function BottomNav() {
  const { profile, isMasterAdmin } = useAuth();
  const location = useLocation();

  if (!profile) return null;
  if (location.pathname.startsWith('/admin') && profile.role !== 'admin' && profile.role !== 'superadmin' && !isMasterAdmin) return null;

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
            <item.icon className={cn("w-6 h-6 mb-1", isActive ? "stroke-[2.5px] text-[#5542F6]" : "stroke-2")} />
            <span className={cn("text-[9px] font-black tracking-[0.1em]", isActive ? "text-[#5542F6]" : "text-slate-400")}>
              {item.label}
            </span>
          </Link>
        );
      })}
    </div>
  );
}


