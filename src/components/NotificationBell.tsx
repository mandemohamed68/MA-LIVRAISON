import React, { useState, useEffect } from 'react';
import { Bell, Info, Package, CheckCircle, Truck, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/apiService';
import { AppNotification } from '../types';

interface NotificationBellProps {
  lightMode?: boolean;
}

export default function NotificationBell({ lightMode = false }: NotificationBellProps) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [hasUnread, setHasUnread] = useState(false);

  useEffect(() => {
    if (!user) return;

    const fetchNotifs = async () => {
      try {
        let list = await api.notifications.list() || [];
        if (!Array.isArray(list)) list = [];
        const sorted = list.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setNotifications(sorted);
        setHasUnread(sorted.some((n: any) => !n.isRead));
      } catch (err) {
        console.error("Fetch notifications failed locally", err instanceof Error ? err.message : err);
      }
    };

    fetchNotifs();
    const interval = setInterval(fetchNotifs, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, [user]);

  const markAllAsRead = async () => {
    if (!user) return;
    try {
      const unread = notifications.filter(n => !n.isRead);
      await Promise.all(unread.map(n => api.notifications.markAsRead(n.id)));
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setHasUnread(false);
    } catch (e) {
      console.error(e);
    }
  };

  const deleteNotification = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.notifications.delete(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await api.notifications.markAsRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
      setHasUnread(notifications.some(n => n.id !== id && !n.isRead));
    } catch (e) {
      console.error(e);
    }
  };


  const getIcon = (type: string) => {
    switch (type) {
      case 'success': return CheckCircle;
      case 'warning': return Info;
      default: return Bell;
    }
  };

  return (
    <div className="relative">
      <button 
        onClick={() => { setIsOpen(!isOpen); if (!isOpen) markAllAsRead(); }}
        className={cn(
          "relative w-10 md:w-12 h-10 md:h-12 rounded-2xl flex items-center justify-center transition-all cursor-pointer pointer-events-auto border",
          lightMode 
            ? "bg-white border-slate-200 text-slate-800 hover:bg-slate-50 shadow-sm"
            : "bg-white/10 border-white/10 text-white hover:bg-white/20"
        )}
      >
        <Bell className={cn("w-5 md:w-6 h-5 md:h-6", lightMode ? "text-slate-800" : "text-white")} />
        {notifications.filter(n => !n.isRead).length > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 bg-red-500 border-2 border-white rounded-full flex items-center justify-center text-[9px] font-black text-white shadow-lg shadow-red-500/20">
            {notifications.filter(n => !n.isRead).length}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-[9998]" onClick={() => setIsOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.9 }}
              className="fixed sm:absolute top-20 right-4 sm:right-0 sm:top-full mt-2 w-[calc(100vw-2rem)] sm:w-80 bg-white rounded-[32px] shadow-2xl border border-slate-100 z-[9999] overflow-hidden"
            >
              <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Notifications</h3>
                <span className="text-[9px] font-black text-orange-500 bg-orange-50 px-2 py-1 rounded-lg">LIVE</span>
              </div>
              <div className="max-h-[350px] overflow-y-auto custom-scrollbar">
                {notifications.length > 0 ? (
                  notifications.map(n => {
                    const Icon = getIcon(n.type);
                    return (
                      <div 
                        key={n.id} 
                        onClick={() => markAsRead(n.id)}
                        className={cn(
                          "p-5 border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer group relative",
                          !n.isRead && "bg-blue-50/30 font-bold"
                        )}
                      >
                        <div className="flex gap-3">
                          <div className={cn(
                            "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform",
                            n.type === 'success' ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-600'
                          )}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="flex-1">
                            <p className="text-[10px] font-black text-slate-900 leading-tight mb-1 uppercase tracking-tight">{n.title}</p>
                            <p className="text-[10px] font-medium text-slate-500 leading-snug mb-1">{n.message}</p>
                            <p className="text-[8px] font-bold text-slate-300 uppercase tracking-widest">
                              {new Date(n.createdAt).toLocaleDateString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                          <button 
                            onClick={(e) => deleteNotification(n.id, e)}
                            className="text-slate-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-1"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                        {!n.isRead && (
                          <div className="absolute top-5 right-5 w-2 h-2 bg-blue-500 rounded-full" />
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="p-10 text-center text-slate-300">
                    <Bell className="w-12 h-12 mx-auto mb-4 opacity-10" />
                    <p className="text-[10px] font-black uppercase tracking-[0.2em]">Silence radio</p>
                  </div>
                )}
              </div>
              {notifications.length > 0 && (
                <div className="p-4 bg-slate-50 text-center">
                  <button 
                    onClick={markAllAsRead}
                    className="text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-orange-500 transition-colors"
                  >
                    Tout marquer comme lu
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
