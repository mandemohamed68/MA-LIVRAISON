import React, { useState, useEffect } from 'react';
import { Bell, Info, Package, CheckCircle, Truck, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { AppNotification } from '../types';

export default function NotificationBell() {
  const { profile, notifications } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);

  useEffect(() => {
    if (!Array.isArray(notifications)) {
      setHasUnread(false);
      return;
    }
    setHasUnread(notifications.some(n => !n.isRead));
  }, [notifications]);

  const markAllAsRead = async () => {
    if (!profile || !Array.isArray(notifications)) return;
    try {
      const unread = notifications.filter(n => !n.isRead);
      await Promise.all(unread.map(n => api.markNotificationRead(Number(n.id))));
    } catch (e) {
      console.error("Error marking all read:", e);
    }
  };

  const deleteNotification = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    // In our simplified SQL version, we might not have a delete endpoint yet or we just hide it
    console.log("Delete notification requested for id:", id);
  };

  const markAsRead = async (id: string | number) => {
    try {
      await api.markNotificationRead(Number(id));
    } catch (e) {
      console.error("Error marking read:", e);
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
        className="relative w-10 md:w-12 h-10 md:h-12 bg-white/10 hover:bg-white/20 rounded-2xl flex items-center justify-center transition-all"
      >
        <Bell className="w-5 md:w-6 h-5 md:h-6 text-white" />
        {hasUnread && (
          <span className="absolute top-2 md:top-3 right-2 md:right-3 w-3 h-3 bg-red-500 border-2 border-[#1E293B] rounded-full animate-pulse" />
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
              className="absolute right-0 mt-4 w-72 md:w-80 bg-white rounded-[32px] shadow-2xl border border-slate-100 z-50 overflow-hidden"
            >
              <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Notifications</h3>
                <span className="text-[9px] font-black text-orange-500 bg-orange-50 px-2 py-1 rounded-lg">LIVE</span>
              </div>
              <div className="max-h-[350px] overflow-y-auto custom-scrollbar">
                {Array.isArray(notifications) && notifications.length > 0 ? (
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
