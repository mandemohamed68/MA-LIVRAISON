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
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { UserProfile, UserRole } from '../types';
import { AppLanguage, translations } from '../lib/translations';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isMasterAdmin: boolean;
  language: AppLanguage;
  setLanguage: (lang: AppLanguage) => void;
  t: (key: keyof typeof translations.fr, params?: Record<string, any>) => string;
  login: () => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  registerWithEmail: (email: string, pass: string, name: string, role: UserRole) => Promise<void>;
  loginWithPhone: (phone: string, recaptchaContainerId: string) => Promise<ConfirmationResult>;
  logout: () => Promise<void>;
  updateRole: (role: UserRole) => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ADMIN_EMAIL = 'mandemohamed68@gmail.com'; // User from metadata

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState<AppLanguage>('fr');

  const isMasterAdmin = user?.email === ADMIN_EMAIL;

  const t = (key: keyof typeof translations.fr, params?: Record<string, any>) => {
    let text = translations[language][key] || translations.fr[key] || key;
    if (params) {
      Object.keys(params).forEach(p => {
        text = (text as string).replace(`\${${p}}`, params[p]);
      });
    }
    return text;
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const data = userDoc.data() as UserProfile;
            // Don't FORCE role anymore, but ensure first-time admins get the role
            setProfile(data);
          } else {
            // Default role assignment
            const role: UserRole = user.email === ADMIN_EMAIL ? 'superadmin' : 'client';
            const newProfile: UserProfile = {
              userId: user.uid,
              name: user.email === ADMIN_EMAIL ? 'mohamed mande' : (user.displayName || 'Utilisateur'),
              email: user.email || '',
              role: role,
              createdAt: new Date().toISOString(),
            };
            await setDoc(doc(db, 'users', user.uid), newProfile);
            setProfile(newProfile);
          }
        } catch (err) {
          console.error("AuthContext fetch/create Error:", err);
          setProfile(null);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const loginWithEmail = async (email: string, pass: string) => {
    await signInWithEmailAndPassword(auth, email, pass);
  };

  const registerWithEmail = async (email: string, pass: string, name: string, role: UserRole) => {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    const newProfile: UserProfile = {
      userId: cred.user.uid,
      name,
      email,
      role,
      createdAt: new Date().toISOString(),
    };
    await setDoc(doc(db, 'users', cred.user.uid), newProfile);
    setProfile(newProfile);
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
      user, profile, loading, isMasterAdmin, language, setLanguage, t, 
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
