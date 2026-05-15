import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  User,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, onSnapshot, query, collection, where, orderBy, limit } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { api } from '../lib/api';
import { UserProfile, UserRole, AppConfig, AppNotification } from '../types';
import { AppLanguage, translations } from '../lib/translations';
import { handleFirestoreError, OperationType } from '../lib/firestoreUtils';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean; // For operation states (buttons, forms)
  isAuthReady: boolean; // For initial boot/splash screen
  isMasterAdmin: boolean;
  language: AppLanguage;
  setLanguage: (lang: AppLanguage) => void;
  appConfig: AppConfig | null;
  notifications: AppNotification[];
  t: (key: keyof typeof translations.fr, params?: Record<string, any>) => string;
  login: () => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  registerWithEmail: (email: string, pass: string, name: string, role: UserRole, extra?: Partial<UserProfile>) => Promise<void>;
  loginWithPhone: (phone: string, recaptchaContainerId: string) => Promise<ConfirmationResult>;
  logout: () => Promise<void>;
  updateRole: (role: UserRole) => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const ADMIN_EMAILS = ['mandemohamed68@gmail.com', 'mandemohamed6868@gmail.com'];

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [language, setLanguage] = useState<AppLanguage>('fr');

  const isMasterAdmin = user?.email ? ADMIN_EMAILS.includes(user.email) : false;

  const t = (key: keyof typeof translations.fr, params?: Record<string, any>) => {
    let text = translations[language][key] || translations.fr[key] || key;
    if (params) {
      Object.keys(params).forEach(p => {
        text = (text as string).replace(`\${${p}}`, params[p]);
      });
    }
    return text;
  };

  // 1. Initial Listeners Setup
  useEffect(() => {
    let configReady = false;
    let authHandled = false;

    const checkReady = () => {
      // If we are already ready, don't do anything
      setIsAuthReady(prev => {
        if (prev) return true;
        if (configReady && authHandled) return true;
        return false;
      });
    };

    // Global Config Listener (SQL)
    const fetchConfig = async () => {
      try {
        const config = await api.getInitialConfig();
        setAppConfig(config);
      } catch (error: any) {
        console.warn("Config fetch failed:", error.message);
        setAppConfig({ mode: 'test', updatedAt: new Date().toISOString() });
      } finally {
        configReady = true;
        checkReady();
      }
    };
    fetchConfig();

    // Auth State Listener
    let notifsInterval: any = null;

    // Safety timeout to prevent getting stuck on splash screen
    const safetyTimeout = setTimeout(() => {
      console.warn("Safety timeout triggered: forcing auth ready state");
      configReady = true;
      authHandled = true;
      setIsAuthReady(true);
    }, 4500); 

    const unsubAuth = onAuthStateChanged(auth, async (authUser) => {
      setUser(authUser);
      
      if (notifsInterval) clearInterval(notifsInterval);

      if (authUser) {
        try {
          // PROFILE SETUP (SQL LOCAL)
          let localProfile: UserProfile | null = null;
          try {
            localProfile = await api.getUser(authUser.uid);
          } catch (e) {
            console.log("SQL Profile not found, checking fallback or creating...");
          }
          
          if (!localProfile) {
            const isAdm = authUser.email ? ADMIN_EMAILS.includes(authUser.email) : false;
            const role: UserRole = isAdm ? 'superadmin' : 'client';
            localProfile = {
              userId: authUser.uid,
              name: isAdm ? 'Administrateur' : (authUser.displayName || 'Utilisateur'),
              email: authUser.email || '',
              role: role,
              accountStatus: 'active',
              createdAt: new Date().toISOString(),
            };
            await api.syncUser(localProfile).catch(e => console.error("Error creating profile in SQL:", e));
          }
          
          setProfile(localProfile);

          // Notifications Polling (SQL)
          const fetchNotifs = async () => {
            try {
              const data = await api.getNotifications(authUser.uid);
              setNotifications(data);
            } catch (err: any) {
              console.warn("Notifications fetch error:", err.message);
            }
          };
          fetchNotifs();
          notifsInterval = setInterval(fetchNotifs, 15000); // 15s poll
        } catch (authError) {
          console.error("Error in auth session setup:", authError);
        }
      } else {
        setProfile(null);
        setNotifications([]);
      }
      authHandled = true;
      checkReady();
    });

    return () => {
      clearTimeout(safetyTimeout);
      unsubAuth();
      if (notifsInterval) clearInterval(notifsInterval);
    };
  }, []);

  const login = async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      setLoading(false);
    } catch (err) {
      setLoading(false);
      throw err;
    }
  };

  const loginWithEmail = async (email: string, pass: string) => {
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      setLoading(false);
    } catch (err) {
      setLoading(false);
      throw err;
    }
  };

  const registerWithEmail = async (email: string, pass: string, name: string, role: UserRole, extra?: Partial<UserProfile>) => {
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      const newProfile: UserProfile = {
        userId: cred.user.uid,
        name,
        email,
        role,
        createdAt: new Date().toISOString(),
        accountStatus: role === 'driver' ? 'pending_approval' : 'active',
        ...extra
      };
      await api.syncUser(newProfile);
      setProfile(newProfile);
      setLoading(false);
    } catch (err) {
      setLoading(false);
      throw err;
    }
  };

  const loginWithPhone = async (phone: string, recaptchaContainerId: string) => {
    const verifier = new RecaptchaVerifier(auth, recaptchaContainerId, {
      size: 'invisible'
    });
    return await signInWithPhoneNumber(auth, phone, verifier);
  };

  const logout = () => signOut(auth);

  const updateRole = async (role: UserRole) => {
    if (!user || !profile) return;
    const updated = { ...profile, role };
    await api.syncUser(updated);
    setProfile(updated);
  };

  const updateProfile = async (data: Partial<UserProfile>) => {
    if (!user || !profile) return;
    const updated = { ...profile, ...data };
    await api.syncUser(updated);
    setProfile(updated);
  };

  return (
    <AuthContext.Provider value={{ 
      user, profile, loading, isAuthReady, isMasterAdmin, language, setLanguage, t, 
      appConfig, notifications,
      login, loginWithEmail, registerWithEmail, loginWithPhone,
      logout, updateRole, updateProfile 
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
