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

    // Global Config Listener (Shared)
    const unsubConfig = onSnapshot(doc(db, 'settings', 'app_config'), (snap) => {
      if (snap.exists()) {
        setAppConfig(snap.data() as AppConfig);
      }
      configReady = true;
      checkReady();
    }, (error) => {
      console.warn("Config listener failed (quota), using defaults:", error.message);
      setAppConfig({ mode: 'test', updatedAt: new Date().toISOString() });
      configReady = true;
      checkReady();
    });

    // Auth State Listener
    let unsubProfile: (() => void) | null = null;
    let unsubNotifications: (() => void) | null = null;

    // Safety timeout to prevent getting stuck on splash screen
    const safetyTimeout = setTimeout(() => {
      console.warn("Safety timeout triggered: forcing auth ready state");
      configReady = true;
      authHandled = true;
      setIsAuthReady(true);
    }, 4500); // 4.5s matches the LoadingScreen's approx timeline

    const unsubAuth = onAuthStateChanged(auth, async (authUser) => {
      setUser(authUser);
      
      // Cleanup previous user listeners
      if (unsubProfile) { unsubProfile(); unsubProfile = null; }
      if (unsubNotifications) { unsubNotifications(); unsubNotifications = null; }

      if (authUser) {
        try {
          // Profile setup...
          const userRef = doc(db, 'users', authUser.uid);
          const userDoc = await getDoc(userRef).catch(err => {
            console.error("Quota error or other on getDoc:", err);
            return null;
          });
          
          if (userDoc && !userDoc.exists()) {
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
            await setDoc(userRef, newProfile).catch(e => console.error("Error creating profile:", e));
            setProfile(newProfile);
          } else if (userDoc) {
            setProfile(userDoc.data() as UserProfile);
          } else {
            // Quota reached or other failure, but we have authUser
            // Fallback for Master Admin if Firestore is failing
            if (authUser.email && ADMIN_EMAILS.includes(authUser.email)) {
              console.log("Firestore failing, but user is known admin. Setting fallback admin profile.");
              setProfile({
                userId: authUser.uid,
                name: 'Administrateur (Mode Dégradé)',
                email: authUser.email,
                role: 'superadmin',
                accountStatus: 'active',
                createdAt: new Date().toISOString()
              });
            }
          }

          unsubProfile = onSnapshot(userRef, (snap) => {
            if (snap.exists()) {
              setProfile(snap.data() as UserProfile);
            }
          }, (error) => {
            console.warn("Profile listener error (likely quota):", error.message);
          });

          // Notifications Listener (Centralized)
          const q = query(
            collection(db, 'notifications'),
            where('userId', '==', authUser.uid),
            orderBy('createdAt', 'desc'),
            limit(50)
          );

          unsubNotifications = onSnapshot(q, (snapshot) => {
            const notifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppNotification));
            setNotifications(notifs);
          }, (err) => console.warn("Notifications listener error (likely quota):", err.message));
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
      unsubConfig();
      unsubAuth();
      if (unsubProfile) unsubProfile();
      if (unsubNotifications) unsubNotifications();
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

  const logout = () => signOut(auth);

  const updateRole = async (role: UserRole) => {
    if (!user) return;
    await setDoc(doc(db, 'users', user.uid), { role }, { merge: true });
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
