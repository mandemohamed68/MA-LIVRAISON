import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/apiService';
import { ChatMessage, UserProfile } from '../types';
import { Send, User, Shield, MessageSquare, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';

interface ChatProps {
  deliveryId: string;
  currentUser: UserProfile;
  isOpen: boolean;
  onClose: () => void;
}

export const Chat: React.FC<ChatProps> = ({ deliveryId, currentUser, isOpen, onClose }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!deliveryId || !isOpen) return;

    const fetchMessages = async () => {
      try {
        const msgs = await api.deliveries.messages.list(deliveryId);
        setMessages(msgs);
        setIsLoading(false);
        
        // Auto scroll to bottom
        setTimeout(() => {
          if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
          }
        }, 100);
      } catch (error) {
        console.error("Error fetching messages:", error);
      }
    };

    fetchMessages();
    const interval = setInterval(fetchMessages, 3000); // Poll every 3 seconds for chat

    return () => clearInterval(interval);
  }, [deliveryId, isOpen]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const text = newMessage.trim();
    setNewMessage('');

    try {
      const now = new Date().toISOString();
      await api.deliveries.messages.send(deliveryId, {
        text,
        senderId: currentUser.userId,
        senderName: currentUser.name,
        senderRole: currentUser.role === 'admin' || currentUser.role === 'superadmin' ? 'admin' : currentUser.role,
        createdAt: now
      });
      
      // Update delivery locally if needed, but the server handles lastMessageAt
      await api.deliveries.update(deliveryId, {
        lastMessageAt: now,
        updatedAt: now
      }).catch(() => {});
      
      // Refresh messages immediately for better UX
      const msgs = await api.deliveries.messages.list(deliveryId);
      setMessages(msgs);
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0, y: 100, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 100, scale: 0.95 }}
          className="fixed bottom-24 right-4 z-[1000] w-[calc(100%-2rem)] sm:w-96 h-[500px] bg-white rounded-[32px] shadow-2xl border border-slate-100 flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="bg-indigo-600 p-4 flex items-center justify-between text-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                <MessageSquare className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-black italic text-sm tracking-tight leading-tight">CHAT DIRECT.</h3>
                <p className="text-[10px] font-bold text-indigo-200 uppercase tracking-widest">Livraison #{deliveryId.slice(-6)}</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages Cabinet */}
          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50"
          >
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="w-6 h-6 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full opacity-30 text-center px-8">
                <MessageSquare className="w-12 h-12 mb-3" />
                <p className="text-xs font-bold uppercase tracking-widest">Commencez la discussion</p>
                <p className="text-[10px] mt-1 italic">Client, Livreur et Support sont ici.</p>
              </div>
            ) : (
              messages.map((msg) => {
                const isMe = msg.senderId === currentUser.userId;
                return (
                  <div 
                    key={msg.id}
                    className={cn(
                      "flex flex-col max-w-[85%]",
                      isMe ? "ml-auto items-end" : "mr-auto items-start"
                    )}
                  >
                    {!isMe && (
                      <div className="flex items-center gap-1.5 mb-1 px-2">
                        <span className="text-[10px] font-black uppercase tracking-tight text-slate-500">
                          {msg.senderName}
                        </span>
                        <span className={cn(
                          "text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full border",
                          msg.senderRole === 'admin' ? "bg-amber-50 text-amber-600 border-amber-100" :
                          msg.senderRole === 'driver' ? "bg-indigo-50 text-indigo-600 border-indigo-100" :
                          "bg-emerald-50 text-emerald-600 border-emerald-100"
                        )}>
                          {msg.senderRole === 'admin' ? 'Support' : msg.senderRole}
                        </span>
                      </div>
                    )}
                    <div className={cn(
                      "px-4 py-3 rounded-[20px] text-sm font-medium shadow-sm",
                      isMe 
                        ? "bg-indigo-600 text-white rounded-br-none" 
                        : "bg-white text-slate-800 border border-slate-100 rounded-bl-none"
                    )}>
                      {msg.text}
                    </div>
                    <span className="text-[8px] font-bold text-slate-400 mt-1 uppercase">
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          {/* Input Box */}
          <form 
            onSubmit={handleSend}
            className="p-4 bg-white border-t border-slate-100 flex items-center gap-3"
          >
            <input 
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Votre message..."
              className="flex-1 bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm font-semibold placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none"
            />
            <button 
              type="submit"
              disabled={!newMessage.trim()}
              className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center hover:bg-indigo-700 disabled:opacity-50 disabled:grayscale transition-all shadow-lg shadow-indigo-200"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
