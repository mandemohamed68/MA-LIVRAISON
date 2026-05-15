import React from 'react';
import { motion } from 'motion/react';
import { Truck } from 'lucide-react';

export const LoadingScreen: React.FC = () => {
  const [progress, setProgress] = React.useState(0);
  const [message, setMessage] = React.useState("Initialisation...");

  React.useEffect(() => {
    const intervals = [
      { p: 15, m: "Connexion sécurisée..." },
      { p: 40, m: "Synchronisation Firebase..." },
      { p: 65, m: "Chargement de votre profil..." },
      { p: 85, m: "Configuration du tableau de bord..." },
      { p: 100, m: "Prêt !" }
    ];

    let current = 0;
    const interval = setInterval(() => {
      if (current < intervals.length) {
        setProgress(intervals[current].p);
        setMessage(intervals[current].m);
        current++;
      } else {
        clearInterval(interval);
      }
    }, 400);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 z-[9999] bg-white flex flex-col items-center justify-center p-8 overflow-hidden font-sans">
      <div className="relative w-full max-w-xs flex flex-col items-center">
        {/* Animated Truck Container */}
        <div className="relative w-full h-40 flex items-center justify-center overflow-hidden border-b-2 border-slate-100 mb-8">
          <motion.div
             animate={{ 
               x: [-120, 320],
               y: [0, -1, 0, -0.5, 0] 
             }}
             transition={{ 
               x: { repeat: Infinity, duration: 2.5, ease: "linear" },
               y: { repeat: Infinity, duration: 0.3, ease: "easeInOut" }
             }}
             className="text-orange-600 relative z-10"
          >
            <Truck size={72} strokeWidth={1.5} className="drop-shadow-xl" />
            <motion.div 
              animate={{ opacity: [0, 0.5, 0], scale: [0.5, 1.5], x: [-10, -30], y: [0, -10] }}
              transition={{ repeat: Infinity, duration: 0.8 }}
              className="absolute -left-2 bottom-2 w-3 h-3 bg-slate-400/30 rounded-full blur-sm"
            />
          </motion.div>
          
          {/* Background Elements */}
          <div className="absolute inset-0 flex items-end justify-center pointer-events-none opacity-20">
             <div className="w-full flex justify-around px-4">
                {[1, 2, 3].map(i => (
                  <motion.div 
                    key={i}
                    animate={{ x: [400, -400] }}
                    transition={{ repeat: Infinity, duration: 3 / i, ease: "linear" }}
                    className="w-16 h-1 bg-slate-200 rounded-full"
                  />
                ))}
             </div>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center w-full"
        >
          <h2 className="text-slate-900 font-black italic text-4xl tracking-tighter mb-1 select-none">
            Livra <span className="text-orange-600">EXPRESS</span>
          </h2>
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.4em] mb-8">{message}</p>
          
          {/* Progress Bar */}
          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mb-2">
            <motion.div 
              animate={{ width: `${progress}%` }}
              transition={{ type: "spring", stiffness: 50 }}
              className="h-full bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.4)]"
            />
          </div>
          <div className="flex justify-between items-center px-1">
             <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest leading-none">Status: OK</span>
             <span className="text-[9px] font-black text-orange-500 font-mono leading-none">{progress}%</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
