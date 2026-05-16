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
import { doc, getDoc, setDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { UserProfile, UserRole, AppConfig } from '../types';
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
      if (configReady && authHandled) {
        setIsAuthReady(true);
      }
    };

    // Global Config Listener
    const unsubConfig = onSnapshot(doc(db, 'settings', 'app_config'), (snap) => {
      if (snap.exists()) {
        setAppConfig(snap.data() as AppConfig);
      }
      configReady = true;
      checkReady();
    }, (error) => {
      configReady = true; // Set to true BEFORE calling handleFirestoreError
      checkReady();
      try {
        handleFirestoreError(error, OperationType.GET, 'settings/app_config');
      } catch (e) {
        console.warn("Firestore error during config boot:", e);
      }
    });

    const fallbackConfigTimer = setTimeout(() => {
      if (!configReady) {
        configReady = true;
        checkReady();
      }
    }, 2500);

    // Auth State Listener
    let unsubProfile: (() => void) | null = null;
    const unsubAuth = onAuthStateChanged(auth, async (authUser) => {
      setUser(authUser);
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = null;
      }

      const finalizeAuth = () => {
        authHandled = true;
        checkReady();
      };

      if (authUser) {
        // First check if user exists, if not create it
        const userRef = doc(db, 'users', authUser.uid);
        try {
          const userDoc = await getDoc(userRef);
          
          if (!userDoc.exists()) {
            const isAdm = authUser.email ? ADMIN_EMAILS.includes(authUser.email) : false;
            const role: UserRole = isAdm ? 'superadmin' : 'client';
            const newProfile: UserProfile = {
              userId: authUser.uid,
              name: isAdm ? 'Administrateur' : (authUser.displayName || 'Utilisateur'),
              email: authUser.email || '',
              role: role,
              accountStatus: 'active',
              createdAt: new Date().toISOString(),
            };
            await setDoc(userRef, newProfile);
            setProfile(newProfile);
          }

          // Setup real-time listener for profile
          unsubProfile = onSnapshot(userRef, (snap) => {
            if (snap.exists()) {
              setProfile(snap.data() as UserProfile);
            }
          }, (error) => {
            try {
              handleFirestoreError(error, OperationType.GET, `users/${authUser.uid}`);
            } catch (e) {
              console.warn("Firestore error on user profile:", e);
            }
          });
        } catch (error) {
          console.error("Error fetching user document during auth state change", error);
        }
      } else {
        setProfile(null);
      }
      finalizeAuth();
    });

    return () => {
      clearTimeout(fallbackConfigTimer);
      unsubConfig();
      unsubAuth();
      if (unsubProfile) unsubProfile();
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
      await setDoc(doc(db, 'users', cred.user.uid), newProfile);
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

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error("SignOut failed, forcing redirect", e);
      window.location.href = '/';
    }
  };

  const updateRole = async (role: UserRole) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'users', user.uid), { role }, { merge: true });
    } catch (e) {
      console.warn("Could not update role in Firestore, updating locally only", e);
    }
    setProfile(prev => prev ? { ...prev, role } : null);
  };

  const updateProfile = async (data: Partial<UserProfile>) => {
    if (!user) return;
    await setDoc(doc(db, 'users', user.uid), data, { merge: true });
    setProfile(prev => prev ? { ...prev, ...data } : null);
  };

  return (
    <AuthContext.Provider value={{ 
      user, profile, loading, isAuthReady, isMasterAdmin, language, setLanguage, t, 
      appConfig,
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
