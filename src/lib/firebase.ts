// For Local DB / No-Quota deployment, we export a custom adapter in place of standard Firestore!
import firebaseConfig from '../../firebase-applet-config.json';
export {
  auth,
  db,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
  writeBatch,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  initializeApp,
  deleteApp
} from './firebaseLocal';

// Add type exports to satisfy TS
export type { User, ConfirmationResult } from './firebaseLocal';

// Dummy getFirestore Export
export const getFirestore = () => null;
