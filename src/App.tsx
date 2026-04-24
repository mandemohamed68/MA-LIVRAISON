import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { cn } from './lib/utils';
import LandingView from './views/LandingView';
import ClientDashboard from './views/ClientDashboard';
import CreateDelivery from './views/CreateDelivery';
import DriverDashboard from './views/DriverDashboard';
import AdminDashboard from './views/AdminDashboard';
import DeliveryTracking from './views/DeliveryTracking';
import DeliveryHistory from './views/DeliveryHistory';
import DriverActiveDelivery from './views/DriverActiveDelivery';
import Settings from './views/Settings';
import Navbar from './components/Navbar';

const ProtectedRoute: React.FC<{ children: React.ReactNode; allowedRoles?: string[] }> = ({ children, allowedRoles }) => {
  const { user, profile, loading, isMasterAdmin } = useAuth();

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-[#fcfcfd]">
      <div className="relative w-20 h-20">
        <div className="absolute inset-0 border-4 border-orange-500/20 rounded-2xl rotate-45" />
        <div className="absolute inset-0 border-4 border-t-orange-500 rounded-2xl rotate-45 animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-2 h-2 bg-orange-600 rounded-full animate-ping" />
        </div>
      </div>
      <p className="mt-8 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 animate-pulse">Initialisation Sécurisée</p>
    </div>
  );
  if (!user) return <Navigate to="/login" />;
  
  if (allowedRoles && !isMasterAdmin && profile && !allowedRoles.includes(profile.role)) {
    return <Navigate to="/" />;
  }

  return <>{children}</>;
};

function AppRoutes() {
  const { profile, isMasterAdmin } = useAuth();
  const location = useLocation();

  const isAdminView = location.pathname.startsWith('/admin') && (isMasterAdmin || profile?.role === 'admin' || profile?.role === 'superadmin');

  return (
    <div className={cn(
      "min-h-screen bg-[#fcfcfd] font-sans selection:bg-orange-500/10 selection:text-orange-600",
      isAdminView && "h-screen overflow-hidden flex flex-col"
    )}>
      <Navbar />
      <main className={cn(
        "transition-all duration-300 flex-1 flex flex-col",
        isAdminView ? "h-full w-full" : "container mx-auto px-4 py-8 md:py-12"
      )}>
        <Routes>
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
          <Route path="/driver/active" element={
            <ProtectedRoute allowedRoles={['driver', 'admin', 'superadmin']}>
              <DriverActiveDelivery />
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
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}
