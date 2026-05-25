import React, { useEffect, useState } from 'react';
import { api } from '../services/apiService';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X, CheckCircle, Info, AlertTriangle, ExternalLink } from 'lucide-react';
import { AppNotification } from '../types';
import { useNavigate } from 'react-router-dom';

export default function NotificationToast() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const timeouts = notifications.map(notif => 
      setTimeout(() => markAsRead(notif.id), 3000)
    );
    return () => timeouts.forEach(clearTimeout);
  }, [notifications]);

  useEffect(() => {
    if (!user) return;

    const fetchNotifs = async () => {
      try {
        let list = await api.notifications.list() || [];
        if (!Array.isArray(list)) list = [];
        const unread = list
          .filter((n: any) => !n.isRead)
          .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 3);
        setNotifications(unread);
      } catch (err) {
        console.error("Fetch notifications failed locally", err instanceof Error ? err.message : err);
      }
    };

    fetchNotifs();
    const interval = setInterval(fetchNotifs, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, [user]);

  const markAsRead = async (id: string) => {
    try {
      await api.notifications.markAsRead(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  const handleAction = (notif: AppNotification) => {
    markAsRead(notif.id);
    if (notif.link) {
      navigate(notif.link);
    }
  };

  return (
    <div className="fixed top-24 right-4 z-[9999] flex flex-col gap-3 w-full max-w-[340px] pointer-events-none">
      <AnimatePresence>
        {notifications.map((notif, index) => (
          <motion.div
            key={notif.id}
            initial={{ opacity: 0, x: 100, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8, x: 50 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350, delay: index * 0.1 }}
            className="pointer-events-auto bg-white/95 backdrop-blur-xl rounded-2xl shadow-[0_15px_40px_rgba(0,0,0,0.12)] border border-slate-100 p-4 flex gap-4 items-start relative group overflow-hidden"
          >
            {/* Status Line */}
            <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${
              notif.type === 'success' ? 'bg-emerald-500' : 
              notif.type === 'warning' ? 'bg-orange-500' : 
              notif.type === 'error' ? 'bg-rose-500' : 'bg-indigo-500'
            }`} />

            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              notif.type === 'success' ? 'bg-emerald-50 text-emerald-600' : 
              notif.type === 'warning' ? 'bg-orange-50 text-orange-600' : 
              notif.type === 'error' ? 'bg-rose-50 text-rose-600' : 'bg-indigo-50 text-indigo-600'
            }`}>
              {notif.type === 'success' ? <CheckCircle className="w-5 h-5" /> : 
               notif.type === 'warning' ? <AlertTriangle className="w-5 h-5" /> : 
               <Bell className="w-5 h-5" />}
            </div>

            <div className="flex-1 min-w-0 pr-4">
              <h4 className="text-sm font-black text-slate-900 leading-tight truncate">{notif.title}</h4>
              <p className="text-xs font-semibold text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">{notif.message}</p>
              
              <div className="flex items-center gap-3 mt-2">
                <button 
                  onClick={() => handleAction(notif)}
                  className="text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1"
                >
                  {notif.link ? 'Voir Détails' : 'Compris'}
                  {notif.link && <ExternalLink className="w-3 h-3" />}
                </button>
                <button 
                   onClick={() => markAsRead(notif.id)}
                   className="text-[10px] font-black uppercase tracking-widest text-slate-300 hover:text-slate-500 transition-colors"
                >
                  Ignorer
                </button>
              </div>
            </div>

            <button 
               onClick={() => markAsRead(notif.id)}
               className="absolute top-2 right-2 w-6 h-6 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 hover:text-slate-500 opacity-0 group-hover:opacity-100 transition-all active:scale-90"
            >
              <X className="w-3 h-3" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
