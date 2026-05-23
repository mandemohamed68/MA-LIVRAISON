import React from 'react';
import { motion } from 'motion/react';
import { Truck } from 'lucide-react';

export const LoadingScreen: React.FC = () => {
  const [message, setMessage] = React.useState("Initialisation...");

  React.useEffect(() => {
    const messages = [
      "Connexion au serveur local...",
      "Chargement de votre profil...",
      "Configuration du tableau de bord...",
      "Préparation de vos livraisons..."
    ];
    let i = 0;
    const interval = setInterval(() => {
      setMessage(messages[i % messages.length]);
      i++;
    }, 1500);
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
               x: { repeat: Infinity, duration: 2, ease: "linear" },
               y: { repeat: Infinity, duration: 0.3, ease: "easeInOut" }
             }}
             className="text-orange-600 relative z-10"
          >
            <Truck size={72} strokeWidth={1.5} className="drop-shadow-xl" />
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
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center w-full"
        >
          <h2 className="text-slate-900 font-black italic text-4xl tracking-tighter mb-1 select-none">
            PANCHO <span className="text-orange-600">EXPRESS</span>
          </h2>
          <motion.p 
            key={message}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-slate-400 text-[10px] font-black uppercase tracking-[0.4em] h-4"
          >
            {message}
          </motion.p>
          
          <div className="mt-8 flex justify-center gap-2">
            {[0, 1, 2].map(i => (
              <motion.div
                key={i}
                animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
                transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.2 }}
                className="w-2 h-2 bg-orange-500 rounded-full"
              />
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
};
