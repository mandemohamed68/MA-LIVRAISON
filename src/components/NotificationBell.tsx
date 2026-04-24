import React, { useState, useEffect } from 'react';
import { Bell, Info, Package, CheckCircle, Truck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface Notification {
  id: string;
  title: string;
  desc: string;
  type: 'info' | 'success' | 'warning';
  icon: any;
  time: string;
}

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([
    { id: '1', title: 'Bienvenue !', desc: 'Prêt pour votre première livraison ?', type: 'info', icon: Bell, time: 'À l\'instant' },
  ]);
  const [hasNew, setHasNew] = useState(true);

  // Simulation of incoming notifications
  useEffect(() => {
    const timer = setTimeout(() => {
      const newNotif: Notification = {
        id: Date.now().toString(),
        title: 'Promotion Ouaga',
        desc: '-10% sur votre prochaine course avec le code FASO10',
        type: 'success',
        icon: Package,
        time: 'Il y a 5 min'
      };
      setNotifications(prev => [newNotif, ...prev]);
      setHasNew(true);
    }, 15000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="relative">
      <button 
        onClick={() => { setIsOpen(!isOpen); setHasNew(false); }}
        className="relative w-12 h-12 bg-white/10 hover:bg-white/20 rounded-2xl flex items-center justify-center transition-all"
      >
        <Bell className="w-6 h-6 text-white" />
        {hasNew && (
          <span className="absolute top-3 right-3 w-3 h-3 bg-red-500 border-2 border-orange-500 rounded-full animate-bounce" />
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.9 }}
              className="absolute right-0 mt-4 w-80 bg-white rounded-[32px] shadow-2xl border border-slate-100 z-50 overflow-hidden"
            >
              <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Notifications</h3>
                <span className="text-[10px] font-black text-orange-500 bg-orange-50 px-2 py-1 rounded-lg">LIVE</span>
              </div>
              <div className="max-h-[400px] overflow-y-auto">
                {notifications.length > 0 ? (
                  notifications.map(n => (
                    <div key={n.id} className="p-6 border-b border-slate-50 hover:bg-slate-50/50 transition-colors cursor-pointer group">
                      <div className="flex gap-4">
                        <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                          <n.icon className="w-5 h-5 text-orange-600" />
                        </div>
                        <div>
                          <p className="text-[11px] font-black text-slate-900 leading-none mb-1">{n.title}</p>
                          <p className="text-[10px] font-medium text-slate-400 leading-relaxed mb-1">{n.desc}</p>
                          <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest">{n.time}</p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-10 text-center opacity-30 text-xs font-bold uppercase tracking-widest">
                    Aucune alerte
                  </div>
                )}
              </div>
              <div className="p-4 bg-slate-50 text-center">
                <button className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-orange-500 transition-colors">Tout marquer comme lu</button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
