import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { cn } from './lib/utils';
import { ShieldCheck, ShieldAlert } from 'lucide-react';
import ErrorBoundary from './components/ErrorBoundary';

import Navbar from './components/Navbar';
import NotificationToast from './components/NotificationToast';
import BottomNav from './components/BottomNav';
import LoadingScreen from './components/LoadingScreen';
import AnnouncementBanner from './components/AnnouncementBanner';
import TermsAgreementModal from './components/TermsAgreementModal';

import { motion, AnimatePresence } from 'framer-motion';

// Eagerly loaded views for immediate page navigation and smoothness on Web & Mobile (No chunck delay)
import LandingView from './views/LandingView';
import ClientDashboard from './views/ClientDashboard';
import CreateDelivery from './views/CreateDelivery';
import DriverDashboard from './views/DriverDashboard';
import AdminDashboard from './views/AdminDashboard';
import DeliveryTracking from './views/DeliveryTracking';
import DeliveryHistory from './views/DeliveryHistory';
import Settings from './views/Settings';

const ProtectedRoute: React.FC<{ children: React.ReactNode; allowedRoles?: string[] }> = ({ children, allowedRoles }) => {
  const { user, profile, isMasterAdmin } = useAuth();

  if (!user) return <Navigate to="/" replace />;
  
  if (allowedRoles && !isMasterAdmin && profile && !allowedRoles.includes(profile.role)) {
    const defaultPath = profile.role === 'admin' ? '/admin' : profile.role === 'driver' ? '/driver' : '/client';
    return <Navigate to={defaultPath} replace />;
  }

  return <>{children}</>;
};

const PageWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.28, ease: "easeInOut" }}
      className="flex-1 flex flex-col relative w-full h-full"
    >
      {children}
    </motion.div>
  );
};

function AppRoutes() {
  const { user, profile, isMasterAdmin, appConfig, isAuthReady, updateProfile } = useAuth();
  const location = useLocation();

  if (!isAuthReady) {
    return <LoadingScreen />;
  }

  const isAdmin = isMasterAdmin || profile?.role === 'admin' || profile?.role === 'superadmin';
  const isAdminView = location.pathname.startsWith('/admin') && isAdmin;

  // Maintenance Mode Check
  if (appConfig?.isMaintenanceMode && !isAdmin && location.pathname !== '/') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-8 text-center">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-24 h-24 bg-orange-500/10 text-orange-500 rounded-[40px] flex items-center justify-center mb-8 border border-orange-500/20 shadow-[0_0_50px_rgba(249,115,22,0.1)]"
        >
          <ShieldCheck className="w-12 h-12" />
        </motion.div>
        <motion.div
           initial={{ y: 20, opacity: 0 }}
           animate={{ y: 0, opacity: 1 }}
           transition={{ delay: 0.1 }}
        >
          <h1 className="text-3xl font-black text-white uppercase tracking-tighter mb-4 italic">Maintenance <span className="text-orange-500">en cours</span></h1>
          <p className="text-slate-400 font-bold text-sm max-w-sm leading-relaxed mb-8">
            {appConfig.maintenanceMessage || "Nous effectuons actuellement une mise à jour cruciale de PANCHO EXPRESS pour améliorer votre expérience. Nous serons de retour dans quelques instants."}
          </p>
          <div className="px-6 py-2 bg-white/5 rounded-full text-[10px] font-black text-slate-500 uppercase tracking-widest border border-white/5 italic">
            Équipe Technique PANCHO EXPRESS
          </div>
        </motion.div>
      </div>
    );
  }

  // Suspended Account Check
  const isSuspended = profile?.accountStatus === 'suspended' && !isAdmin;
  if (isSuspended && location.pathname !== '/') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-8 text-center">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-24 h-24 bg-red-500/10 text-red-500 rounded-[40px] flex items-center justify-center mb-8 border border-red-500/20 shadow-[0_0_50px_rgba(239,68,68,0.1)]"
        >
          <ShieldAlert className="w-12 h-12" />
        </motion.div>
        <motion.div
           initial={{ y: 20, opacity: 0 }}
           animate={{ y: 0, opacity: 1 }}
           transition={{ delay: 0.1 }}
        >
          <h1 className="text-3xl font-black text-white uppercase tracking-tighter mb-4 italic">Compte <span className="text-red-500">suspendu</span></h1>
          <p className="text-slate-400 font-bold text-sm max-w-sm leading-relaxed mb-8">
            Votre compte a été temporairement suspendu par l'administration de PANCHO EXPRESS pour non-respect des règles ou suite à des signalements répétés. Veuillez contacter notre service clientèle pour plus d'informations.
          </p>
          <button 
            onClick={() => { localStorage.removeItem('auth_token'); window.location.href = '/' }} 
            className="px-6 py-3 bg-white text-slate-950 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-colors active:scale-95 duration-150 inline-block"
          >
            Se déconnecter
          </button>
        </motion.div>
      </div>
    );
  }

  const isFullBleedView = location.pathname === '/client/new' || location.pathname === '/driver' || location.pathname.startsWith('/delivery/') || isAdminView;
  const isCreateView = location.pathname === '/client/new';

  // Redirect authenticated user from landing page
  if (location.pathname === '/' && user && profile?.role) {
    const defaultPath = (profile.role === 'superadmin' || profile.role === 'admin') ? '/admin' : 
                        profile.role === 'client' ? '/client' : '/driver';
    return <Navigate to={defaultPath} replace />;
  }

  const isDev = import.meta.env.DEV || (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'));

  return (
    <div className={cn(
      "min-h-screen font-sans text-slate-900 flex flex-col selection:bg-primary/20 bg-gradient-to-br from-[#f8fafc] via-[#f1f5f9] to-[#fef3c7]/30 relative overflow-x-hidden",
      (isAdminView || isFullBleedView) && "h-screen lg:h-[100dvh] overflow-hidden"
    )}>
      {/* Dynamic Premium Grid Background & Glow Effects (Option 1) */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a0a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a0a_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none z-0"></div>
      
      {/* Ambient Radial Light Spheres */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-br from-orange-500/10 to-transparent rounded-full blur-[130px] pointer-events-none z-0" />
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-gradient-to-tr from-amber-500/10 to-transparent rounded-full blur-[130px] pointer-events-none z-0" />
      
      {/* Giant faint overlay watermark of PANCHO EXPRESS Logo (Option 1) */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] opacity-[0.035] pointer-events-none z-0 select-none">
        <img src="/logo-pancho.png" alt="" className="w-full h-full object-contain filter select-none" />
      </div>

      <AnnouncementBanner />
      <Navbar />
      <NotificationToast />
      
      {/* Terms and Conditions Enforcement */}
      {user && profile && !profile.termsAcceptedAt && (profile.role === 'client' || profile.role === 'driver') && (
        <TermsAgreementModal 
          role={profile.role} 
          onAccept={() => updateProfile({ termsAcceptedAt: new Date().toISOString() })} 
        />
      )}

      <main className={cn(
        "flex-1 flex flex-col relative w-full",
        isAdminView && "h-full min-h-0",
        !isFullBleedView && "container mx-auto px-4 py-8 md:py-12",
        !isAdminView && "pb-[calc(4.5rem+env(safe-area-inset-bottom))] xl:pb-0"
      )}>
        <Suspense fallback={
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        }>
          <AnimatePresence mode="wait" initial={false}>
            <Routes location={location} key={location.pathname}>
              <Route path="/login" element={<Navigate to="/" replace />} />
              <Route path="/" element={<PageWrapper><LandingView /></PageWrapper>} />
                
                {/* Client Routes */}
                <Route path="/client" element={
                  <ProtectedRoute allowedRoles={['client', 'driver', 'admin', 'superadmin']}>
                    <PageWrapper><ClientDashboard /></PageWrapper>
                  </ProtectedRoute>
                } />
                <Route path="/client/new" element={
                  <ProtectedRoute allowedRoles={['client', 'driver', 'admin', 'superadmin']}>
                    <PageWrapper><CreateDelivery /></PageWrapper>
                  </ProtectedRoute>
                } />
                <Route path="/client/history" element={
                  <ProtectedRoute allowedRoles={['client', 'driver', 'admin', 'superadmin']}>
                    <PageWrapper><DeliveryHistory /></PageWrapper>
                  </ProtectedRoute>
                } />
      
                {/* Driver Routes */}
                <Route path="/driver" element={
                  <ProtectedRoute allowedRoles={['driver', 'admin', 'superadmin']}>
                    <PageWrapper><DriverDashboard /></PageWrapper>
                  </ProtectedRoute>
                } />
                <Route path="/driver/history" element={
                  <ProtectedRoute allowedRoles={['driver', 'admin', 'superadmin']}>
                    <PageWrapper><DeliveryHistory /></PageWrapper>
                  </ProtectedRoute>
                } />
      
                {/* Admin Routes */}
                <Route path="/admin" element={
                  <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
                    <PageWrapper><AdminDashboard /></PageWrapper>
                  </ProtectedRoute>
                } />
      
                {/* Shared Routes */}
                <Route path="/delivery/:deliveryId" element={
                  <ProtectedRoute>
                    <PageWrapper><DeliveryTracking /></PageWrapper>
                  </ProtectedRoute>
                } />
                <Route path="/settings" element={
                  <ProtectedRoute>
                    <PageWrapper><Settings /></PageWrapper>
                  </ProtectedRoute>
                } />
                  <Route path="/tracking/:deliveryId" element={<Navigate replace to="/client" />} />
            </Routes>
          </AnimatePresence>
        </Suspense>
      </main>
      <BottomNav />
    </div>
  );
}

export default function App() {
  const [quotaError, setQuotaError] = React.useState(false);

  React.useEffect(() => {
    const handleQuotaError = () => {
      setQuotaError(true);
    };
    window.addEventListener('firestore-quota-error', handleQuotaError as EventListener);
    return () => window.removeEventListener('firestore-quota-error', handleQuotaError as EventListener);
  }, []);

  return (
    <AuthProvider>
      <Router>
        {quotaError && (
          <div className="fixed top-0 left-0 right-0 z-[100] bg-red-600 text-white p-3 text-center text-sm font-medium shadow-lg">
            Service temporairement indisponible (Quota atteint). Veuillez réessayer plus tard.
          </div>
        )}
        <ErrorBoundary>
          <AppRoutes />
        </ErrorBoundary>
      </Router>
    </AuthProvider>
  );
}
