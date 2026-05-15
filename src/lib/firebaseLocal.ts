let currentToken = typeof localStorage !== 'undefined' ? localStorage.getItem('local_auth_token') : null;

const fetchDb = async (path: string, options: RequestInit = {}) => {
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(currentToken ? { 'Authorization': `Bearer ${currentToken}` } : {}),
      ...options.headers
    }
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export const db = { name: 'mock-db' };

export const collection = (dbOrCol: any, ...pathSegments: string[]) => {
  const basePath = dbOrCol && (dbOrCol.type === 'collection' || dbOrCol.type === 'doc') ? dbOrCol.name || dbOrCol.collection + '/' + dbOrCol.id : '';
  const fullPath = [basePath, ...pathSegments].filter(Boolean).join('/');
  return { type: 'collection', name: fullPath };
};

export const doc = (dbOrCol: any, ...pathSegments: string[]) => {
  const basePath = dbOrCol && (dbOrCol.type === 'collection' || dbOrCol.type === 'doc') ? dbOrCol.name || dbOrCol.collection + '/' + dbOrCol.id : '';
  const fullPath = [basePath, ...pathSegments].filter(Boolean).join('/');
  const segments = fullPath.split('/');
  const id = segments.pop() || 'temp';
  const collectionName = segments.join('/');
  return { type: 'doc', collection: collectionName, id };
};

export const getDoc = async (docRef: any) => {
  try {
    const data = await fetchDb(`/db/${docRef.collection}/${docRef.id}`);
    return { id: docRef.id, exists: () => true, data: () => data };
  } catch {
    return { id: docRef.id, exists: () => false, data: () => null };
  }
};

export const getDocs = async (colRef: any) => {
  const data = await fetchDb(`/db/${colRef.name}`);
  return {
    empty: data.length === 0,
    docs: data.map((d: any) => ({ id: d.id, data: () => d, exists: () => true })),
    size: data.length,
    forEach(cb: any) { this.docs.forEach(cb); }
  };
};

export const setDoc = async (docRef: any, data: any, options?: any) => {
  if (options?.merge) {
    return fetchDb(`/db/${docRef.collection}/${docRef.id}`, { method: 'PATCH', body: JSON.stringify(data) });
  }
  return fetchDb(`/db/${docRef.collection}/${docRef.id}`, { method: 'POST', body: JSON.stringify(data) });
};

export const addDoc = async (colRef: any, data: any) => {
  const res = await fetchDb(`/db/${colRef.name}`, { method: 'POST', body: JSON.stringify(data) });
  return { id: res.id };
};

export const updateDoc = async (docRef: any, data: any) => {
  return fetchDb(`/db/${docRef.collection}/${docRef.id}`, { method: 'PATCH', body: JSON.stringify(data) });
};

export const deleteDoc = async (docRef: any) => {
  return fetchDb(`/db/${docRef.collection}/${docRef.id}`, { method: 'DELETE' });
};

export const query = (colRef: any, ...args: any[]) => colRef;
export const where = (field: string, op: string, val: any) => ({ type: 'where', field, op, val });
export const orderBy = (field: string, dir: string) => ({ type: 'orderBy', field, dir });
export const limit = (n: number) => ({ type: 'limit', n });

export const onSnapshot = (ref: any, onNext: any, onError?: any) => {
  let stopped = false;
  const poll = async () => {
    if (stopped) return;
    try {
      if (ref.type === 'doc') {
        const docSnap = await getDoc(ref);
        onNext(docSnap);
      } else {
        const qSnap = await getDocs(ref);
        onNext(qSnap);
      }
    } catch (e) {
      if (onError) onError(e);
    }
    setTimeout(poll, 3000);
  };
  poll();
  return () => { stopped = true; };
};

export const writeBatch = (dbOrDb?: any) => {
  const ops: Array<() => Promise<any>> = [];
  return {
    set: (docRef: any, data: any) => { ops.push(() => setDoc(docRef, data)); return this; },
    update: (docRef: any, data: any) => { ops.push(() => updateDoc(docRef, data)); return this; },
    delete: (docRef: any) => { ops.push(() => deleteDoc(docRef)); return this; },
    commit: async () => {
      for (const op of ops) await op();
    }
  };
};

export const serverTimestamp = () => new Date().toISOString();
export class Timestamp {
  seconds: number;
  nanoseconds: number;
  constructor(seconds: number, nanoseconds: number) {
    this.seconds = seconds;
    this.nanoseconds = nanoseconds;
  }
  toDate() { return new Date(this.seconds * 1000); }
  static fromDate(d: Date) { return new Timestamp(Math.floor(d.getTime() / 1000), 0); }
  static now() { return Timestamp.fromDate(new Date()); }
}

export const auth = {
  currentUser: null as any,
};

export const getAuth = (app?: any) => auth;
export const getFirestore = (app?: any, dbId?: string) => db;

export const onAuthStateChanged = (_auth: any, callback: any) => {
  if (currentToken) {
    fetchDb('/auth/me').then(user => {
      auth.currentUser = user;
      callback(user);
    }).catch(() => {
      auth.currentUser = null;
      callback(null);
    });
  } else {
    setTimeout(() => callback(null), 100);
  }
  return () => {};
};

export const signInWithPopup = async () => {
  throw new Error("Use email/password locally");
};

export const GoogleAuthProvider = class {};

export const signInWithEmailAndPassword = async (_auth: any, email: string, pass: string) => {
   const res = await fetchDb('/auth/login', { method: 'POST', body: JSON.stringify({ email, password: pass }) });
   currentToken = res.token;
   localStorage.setItem('local_auth_token', res.token);
   auth.currentUser = res.user;
   return { user: res.user };
};

export const createUserWithEmailAndPassword = async (_auth: any, email: string, pass: string) => {
   const res = await fetchDb('/auth/register', { method: 'POST', body: JSON.stringify({ email, password: pass }) });
   currentToken = res.token;
   localStorage.setItem('local_auth_token', res.token);
   auth.currentUser = res.user;
   return { user: res.user };
};

export const signOut = async () => {
  currentToken = null;
  localStorage.removeItem('local_auth_token');
  auth.currentUser = null;
};

export class RecaptchaVerifier { constructor(...args: any[]) {} verify() {} }
export const signInWithPhoneNumber = async (...args: any[]) => ({ confirm: async () => ({ user: auth.currentUser }) });
export type User = { uid: string, email: string, displayName?: string };
export type ConfirmationResult = any;

export const initializeApp = (config: any, name?: string) => ({ name: name || '[DEFAULT]' });
export const deleteApp = async (app: any) => {};
