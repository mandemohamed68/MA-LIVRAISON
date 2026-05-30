import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Info, AlertTriangle, CheckCircle } from 'lucide-react';
import { api } from '../services/apiService';
import { useAuth } from '../context/AuthContext';
import { AppAnnouncement } from '../types';
import { cn } from '../lib/utils';

export default function AnnouncementBanner({ userRole }: { userRole?: string }) {
  const { profile } = useAuth();
  const [announcements, setAnnouncements] = useState<AppAnnouncement[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const activeRole = userRole || profile?.role;

  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        const docs = await api.announcements.list().catch(() => []);
        if (!Array.isArray(docs)) return;

        const nowMs = Date.now();
        const filtered = docs.filter((a: AppAnnouncement) => {
          let isValidDate = true;
          if (a.activeUntil) {
            try {
              isValidDate = new Date(a.activeUntil).getTime() >= nowMs;
            } catch (e) {
              isValidDate = true; // Fallback to include if parse fails
            }
          }
          const isTargetRole = a.targetRole === 'all' || (activeRole && a.targetRole === activeRole);
          return isValidDate && isTargetRole;
        });
        
        filtered.sort((a: AppAnnouncement, b: AppAnnouncement) => b.createdAt.localeCompare(a.createdAt));
        setAnnouncements(filtered);
      } catch (err) {
        console.error("Local announcements fetch failed", err);
      }
    };

    fetchAnnouncements();
    const interval = setInterval(fetchAnnouncements, 8000); // Poll every 8s

    return () => clearInterval(interval);
  }, [activeRole]);

  const current = announcements[currentIndex];

  const handleDismiss = () => {
    // Local dismiss for the session
    setAnnouncements(prev => prev.filter((_, i) => i !== currentIndex));
    if (currentIndex >= announcements.length - 1) {
      setCurrentIndex(0);
    }
  };

  if (announcements.length === 0) return null;

  const getIcon = (type: string) => {
    switch (type) {
      case 'warning': return <AlertTriangle className="w-5 h-5" />;
      case 'success': return <CheckCircle className="w-5 h-5" />;
      default: return <Info className="w-5 h-5" />;
    }
  };

  const getColors = (type: string) => {
    switch (type) {
      case 'warning': return "bg-orange-500 text-white";
      case 'success': return "bg-emerald-500 text-white";
      default: return "bg-slate-950 text-white";
    }
  };

  return (
    <AnimatePresence>
      {current && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className={cn("w-full relative z-50 overflow-hidden", getColors(current.type))}
        >
          <div className="container mx-auto px-4 py-3 flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className="shrink-0 mt-0.5">
                {getIcon(current.type)}
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest opacity-70 leading-none mb-1">
                  {current.title}
                </p>
                <p className="text-sm font-bold tracking-tight">
                  {current.message}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 shrink-0 mt-0.5">
              {announcements.length > 1 && (
                <span className="text-[9px] font-black px-2 py-1 bg-white/20 rounded-full">
                  {currentIndex + 1}/{announcements.length}
                </span>
              )}
              <button 
                onClick={handleDismiss}
                className="p-1 hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
