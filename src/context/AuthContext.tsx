import React, { createContext, useContext, useEffect, useState } from 'react';
import { UserProfile, UserRole, AppConfig } from '../types';
import { AppLanguage, translations } from '../lib/translations';
import { api } from '../services/apiService';

interface AuthContextType {
  user: { userId: string; email: string; role: string; name: string } | null;
  profile: UserProfile | null;
  loading: boolean;
  isAuthReady: boolean;
  isMasterAdmin: boolean;
  language: AppLanguage;
  setLanguage: (lang: AppLanguage) => void;
  appConfig: AppConfig | null;
  refreshAppConfig: () => Promise<void>;
  t: (key: keyof typeof translations.fr, params?: Record<string, any>) => string;
  login: (email: string, pass: string) => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  registerWithEmail: (email: string, pass: string, name: string, role: UserRole, extra?: Partial<UserProfile>) => Promise<void>;
  loginWithPhone: (phoneNumber: string) => Promise<any>;
  logout: () => Promise<void>;
  updateRole: (role: UserRole) => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const ADMIN_EMAILS = ['mandemohamed68@gmail.com', 'mandemohamed6868@gmail.com'];

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<{ userId: string; email: string; role: string; name: string } | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  // Use localStorage to cache appConfig to avoid Hammering API on boot
  const [appConfig, setAppConfig] = useState<AppConfig | null>(() => {
    try {
      const cached = localStorage.getItem('app_config');
      return cached ? JSON.parse(cached) : null;
    } catch (e) {
      console.warn("Failed to parse cached app_config", e);
      return null;
    }
  });

  const [loading, setLoading] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [language, setLanguage] = useState<AppLanguage>('fr');

  const isMasterAdmin = user?.email ? ADMIN_EMAILS.includes(user.email) : false;

  const refreshAppConfig = async () => {
    try {
      const config = await api.config.get('app_config');
      if (config) {
        setAppConfig(config);
        localStorage.setItem('app_config', JSON.stringify(config));
      }
    } catch (e) {
      console.warn("Could not refresh app config", e);
    }
  };

  const t = (key: keyof typeof translations.fr, params?: Record<string, any>) => {
    let text = translations[language][key] || translations.fr[key] || key;
    if (params) {
      Object.keys(params).forEach(p => {
        text = (text as string).replace(`\${${p}}`, params[p]);
      });
    }
    return text;
  };

  const refreshProfile = async () => {
    try {
      const p = await api.profile.get();
      setProfile(p);
      if (p) {
        setUser({ userId: p.userId, email: p.email, role: p.role, name: p.name });
      }
    } catch (e) {
      console.warn("Could not refresh profile", e);
    }
  };

  // Initial Load
  useEffect(() => {
    const init = async () => {
      // Fallback timer to prevent getting stuck in LoadingScreen
      const fallbackTimer = setTimeout(() => {
        setIsAuthReady(true);
      }, 5000);

      const token = localStorage.getItem('auth_token');
      
      try {
        // Load config from cache first, then refresh in background
        const [configRes, profileRes] = await Promise.allSettled([
          api.config.get('app_config').catch(() => null),
          token ? api.profile.get().catch(() => null) : Promise.reject('No token')
        ]);

        if (configRes.status === 'fulfilled' && configRes.value) {
          setAppConfig(configRes.value);
          localStorage.setItem('app_config', JSON.stringify(configRes.value));
        }

        if (profileRes.status === 'fulfilled' && profileRes.value) {
          setProfile(profileRes.value);
          setUser({ 
            userId: profileRes.value.userId, 
            email: profileRes.value.email, 
            role: profileRes.value.role,
            name: profileRes.value.name
          });
        } else {
          if (token) {
            localStorage.removeItem('auth_token');
          }
        }
      } catch (e) {
        console.error("Auth initialization failed", e);
      } finally {
        clearTimeout(fallbackTimer);
        setIsAuthReady(true);
      }
    };
    init();
  }, []);

  const loginWithEmail = async (email: string, pass: string) => {
    setLoading(true);
    try {
      const res = await api.auth.login({ email, password: pass });
      localStorage.setItem('auth_token', res.token);
      setUser(res.user);
      setProfile(res.user); // Initial profile match user object from server
      setLoading(false);
    } catch (err) {
      setLoading(false);
      throw err;
    }
  };

  const login = loginWithEmail; // Alias for compatibility

  const registerWithEmail = async (email: string, pass: string, name: string, role: UserRole, extra?: Partial<UserProfile>) => {
    setLoading(true);
    try {
      const res = await api.auth.register({ email, password: pass, name, role, ...extra });
      localStorage.setItem('auth_token', res.token);
      setUser(res.user);
      setProfile(res.user);
      setLoading(false);
    } catch (err) {
      setLoading(false);
      throw err;
    }
  };

  const logout = async () => {
    localStorage.removeItem('auth_token');
    setUser(null);
    setProfile(null);
    window.location.href = '/';
  };

  const loginWithPhone = async (phone: string) => {
    console.warn("Phone login is not fully implemented in current version", phone);
    return Promise.reject("Authentification par téléphone non implémentée.");
  };

  const updateRole = async (role: UserRole) => {
    try {
      await api.profile.update({ role });
      await refreshProfile();
    } catch (e) {
      console.error("Failed to update role", e);
      alert("Erreur lors de la mise à jour du rôle.");
    }
  };

  const updateProfile = async (data: Partial<UserProfile>) => {
    try {
      await api.profile.update(data);
      await refreshProfile();
    } catch (e) {
      console.error("Failed to update profile", e);
      alert("Erreur lors de la mise à jour du profil.");
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, profile, loading, isAuthReady, isMasterAdmin, language, setLanguage, t, 
      appConfig, refreshAppConfig,
      login, loginWithEmail, registerWithEmail, loginWithPhone,
      logout, updateRole, updateProfile, refreshProfile
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
