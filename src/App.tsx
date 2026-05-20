import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { cn } from './lib/utils';
import { ShieldCheck } from 'lucide-react';
import ErrorBoundary from './components/ErrorBoundary';

import Navbar from './components/Navbar';
import NotificationToast from './components/NotificationToast';
import BottomNav from './components/BottomNav';
import { LoadingScreen } from './components/LoadingScreen';
import AnnouncementBanner from './components/AnnouncementBanner';

import { motion, AnimatePresence } from 'motion/react';

// Lazy loaded views
const LandingView = lazy(() => import('./views/LandingView'));
const ClientDashboard = lazy(() => import('./views/ClientDashboard'));
const CreateDelivery = lazy(() => import('./views/CreateDelivery'));
const DriverDashboard = lazy(() => import('./views/DriverDashboard'));
const AdminDashboard = lazy(() => import('./views/AdminDashboard'));
const DeliveryTracking = lazy(() => import('./views/DeliveryTracking'));
const DeliveryHistory = lazy(() => import('./views/DeliveryHistory'));
const Settings = lazy(() => import('./views/Settings'));

const ProtectedRoute: React.FC<{ children: React.ReactNode; allowedRoles?: string[] }> = ({ children, allowedRoles }) => {
  const { user, profile, isMasterAdmin } = useAuth();

  if (!user) return <Navigate to="/" replace />;
  
  if (allowedRoles && !isMasterAdmin && profile && !allowedRoles.includes(profile.role)) {
    const defaultPath = profile.role === 'admin' ? '/admin' : profile.role === 'driver' ? '/driver' : '/client';
    return <Navigate to={defaultPath} replace />;
  }

  return <>{children}</>;
};

function AppRoutes() {
  const { user, profile, isMasterAdmin, appConfig, isAuthReady } = useAuth();
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
            {appConfig.maintenanceMessage || "Nous effectuons actuellement une mise à jour cruciale de Livra EXPRESS pour améliorer votre expérience. Nous serons de retour dans quelques instants."}
          </p>
          <div className="px-6 py-2 bg-white/5 rounded-full text-[10px] font-black text-slate-500 uppercase tracking-widest border border-white/5 italic">
            Équipe Technique Livra EXPRESS
          </div>
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

  return (
    <div className={cn(
      "min-h-screen bg-slate-50 font-sans text-slate-900 flex flex-col selection:bg-primary/20",
      isAdminView && "lg:h-screen lg:overflow-hidden"
    )}>
      <AnnouncementBanner />
      <Navbar />
      <NotificationToast />
      <main className={cn(
        "flex-1 flex flex-col relative w-full",
        isAdminView && "h-full min-h-0",
        !isFullBleedView && "container mx-auto px-4 py-8 md:py-12",
        "pb-[calc(6rem+env(safe-area-inset-bottom))] xl:pb-0" // Extra padding for BottomNav
      )}>
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className={cn("flex-1 flex flex-col", isAdminView && "min-h-0")}
          >
            <Suspense fallback={
              <div className="fixed top-0 left-0 right-0 z-[100] h-1 overflow-hidden bg-indigo-100">
                <motion.div 
                  initial={{ x: '-100%' }}
                  animate={{ x: '100%' }}
                  transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                  className="h-full w-1/3 bg-indigo-600 shadow-[0_0_10px_rgba(79,70,229,0.5)]"
                />
              </div>
            }>
              <Routes location={location}>
                <Route path="/login" element={<Navigate to="/" replace />} />
                <Route path="/" element={<LandingView />} />
              
              {/* Client Routes */}
              <Route path="/client" element={
                <ProtectedRoute allowedRoles={['client', 'driver', 'admin', 'superadmin']}>
                  <ClientDashboard />
                </ProtectedRoute>
              } />
              <Route path="/client/new" element={
                <ProtectedRoute allowedRoles={['client', 'driver', 'admin', 'superadmin']}>
                  <CreateDelivery />
                </ProtectedRoute>
              } />
              <Route path="/client/history" element={
                <ProtectedRoute allowedRoles={['client', 'driver', 'admin', 'superadmin']}>
                  <DeliveryHistory />
                </ProtectedRoute>
              } />
    
              {/* Driver Routes */}
              <Route path="/driver" element={
                <ProtectedRoute allowedRoles={['driver', 'admin', 'superadmin']}>
                  <DriverDashboard />
                </ProtectedRoute>
              } />
              <Route path="/driver/history" element={
                <ProtectedRoute allowedRoles={['driver', 'admin', 'superadmin']}>
                  <DeliveryHistory />
                </ProtectedRoute>
              } />
    
              {/* Admin Routes */}
              <Route path="/admin" element={
                <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
                  <AdminDashboard />
                </ProtectedRoute>
              } />
    
              {/* Shared Routes */}
              <Route path="/delivery/:deliveryId" element={
                <ProtectedRoute>
                  <DeliveryTracking />
                </ProtectedRoute>
              } />
              <Route path="/settings" element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              } />
                <Route path="/tracking/:deliveryId" element={<Navigate replace to="/client" />} />
              </Routes>
            </Suspense>
          </motion.div>
        </AnimatePresence>
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
