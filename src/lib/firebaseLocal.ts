// Mock Firebase SDK communicating with local SQLite backend
const API_URL = '/api';

function getToken() {
  return localStorage.getItem('local_auth_token');
}

async function fetchDb(path: string, options: any = {}) {
  const token = getToken();
  const headers: any = {
    'Content-Type': 'application/json'
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// Emulate Firebase concepts
export const db = { name: 'mock-db' };
export const auth = { currentUser: null as any };

export const collection = (db: any, name: string) => ({ type: 'collection', name });
export const doc = (dbOrCol: any, arg1: string, arg2?: string) => {
  if (dbOrCol === db) return { type: 'doc', collection: arg1, id: arg2 };
  if (dbOrCol.type === 'collection') return { type: 'doc', collection: dbOrCol.name, id: arg1 };
  if (typeof arg1 === 'string' && typeof arg2 === 'string') return { type: 'doc', collection: arg1, id: arg2 };
  return { type: 'doc', collection: arg1, id: 'temp' };
};

export const query = (col: any, ...args: any[]) => ({ ...col, filters: args });
export const where = (field: string, op: string, val: any) => ({ type: 'where', field, op, val });
export const orderBy = (field: string, dir: string = 'asc') => ({ type: 'orderBy', field, dir });
export const limit = (n: number) => ({ type: 'limit', n });

export const getDoc = async (docRef: any) => {
  try {
    const data = await fetchDb(`/db/${docRef.collection}/${docRef.id}`);
    return { id: docRef.id, exists: () => true, data: () => data };
  } catch {
    return { id: docRef.id, exists: () => false, data: () => null };
  }
};

export const getDocs = async (queryStruct: any) => {
  const collectionName = queryStruct.type === 'collection' ? queryStruct.name : queryStruct.name;
  let data = await fetchDb(`/db/${collectionName}`);
  
  if (queryStruct.filters) {
    for (const filter of queryStruct.filters) {
      if (filter.type === 'where') {
        data = data.filter((d: any) => {
          if (filter.op === '==') return d[filter.field] === filter.val;
          if (filter.op === 'in') return filter.val.includes(d[filter.field]);
          if (filter.op === '!=') return d[filter.field] !== filter.val;
          if (filter.op === 'not-in') return !filter.val.includes(d[filter.field]);
          if (filter.op === 'array-contains') return d[filter.field]?.includes(filter.val);
          if (filter.op === '>') return d[filter.field] > filter.val;
          if (filter.op === '<') return d[filter.field] < filter.val;
          if (filter.op === '>=') return d[filter.field] >= filter.val;
          if (filter.op === '<=') return d[filter.field] <= filter.val;
          return true;
        });
      } else if (filter.type === 'orderBy') {
        data = data.sort((a: any, b: any) => {
          const valA = a[filter.field];
          const valB = b[filter.field];
          if (valA < valB) return filter.dir === 'asc' ? -1 : 1;
          if (valA > valB) return filter.dir === 'asc' ? 1 : -1;
          return 0;
        });
      } else if (filter.type === 'limit') {
        data = data.slice(0, filter.n);
      }
    }
  }

  return {
    empty: data.length === 0,
    docs: data.map((d: any) => ({ id: d.id, data: () => d, exists: () => true })),
    size: data.length
  };
};

export const addDoc = async (colRef: any, data: any) => {
  const result = await fetchDb(`/db/${colRef.name}`, {
    method: 'POST',
    body: JSON.stringify({ ...data, createdAt: new Date().toISOString() })
  });
  return { id: result.id };
};

export const setDoc = async (docRef: any, data: any, options?: { merge?: boolean }) => {
  if (options && options.merge) {
    return fetchDb(`/db/${docRef.collection}/${docRef.id}`, { method: 'PATCH', body: JSON.stringify(data) });
  } else {
    return fetchDb(`/db/${docRef.collection}/${docRef.id}`, { method: 'POST', body: JSON.stringify(data) });
  }
};

export const updateDoc = async (docRef: any, data: any) => {
  return setDoc(docRef, data, { merge: true });
};

export const deleteDoc = async (docRef: any) => {
  return fetchDb(`/db/${docRef.collection}/${docRef.id}`, { method: 'DELETE' });
};

export const onSnapshot = (queryStruct: any, onNext: any, onError: any) => {
  let stopped = false;
  let lastDataString = "";

  const poll = async () => {
    if (stopped) return;
    try {
      const isDoc = queryStruct.type === 'doc';
      let resultObj: any;
      if (isDoc) {
        resultObj = await getDoc(queryStruct);
      } else {
        resultObj = await getDocs(queryStruct);
      }
      
      const currentDataString = isDoc ? 
        JSON.stringify(resultObj.data()) : 
        JSON.stringify(resultObj.docs.map((d: any) => d.data()));
      
      if (currentDataString !== lastDataString) {
        lastDataString = currentDataString;
        onNext(resultObj);
      }
    } catch (e) {
      if (onError) onError(e);
    }
    setTimeout(poll, 3000);
  };
  
  poll();
  return () => { stopped = true; };
};

export const writeBatch = () => {
  const ops: Array<() => Promise<any>> = [];
  return {
    set: (docRef: any, data: any) => { ops.push(() => setDoc(docRef, data)); return this; },
    update: (docRef: any, data: any) => { ops.push(() => updateDoc(docRef, data)); return this; },
    delete: (docRef: any) => { ops.push(() => deleteDoc(docRef)); return this; },
    commit: async () => {
      for (const op of ops) {
         await op();
      }
    }
  };
};

export const serverTimestamp = () => new Date().toISOString();
export const Timestamp = {
  fromDate: (d: Date) => d.toISOString(),
  now: () => new Date().toISOString()
};

// --- AUTH --- //
export const getAuth = () => auth;

export const onAuthStateChanged = (_auth: any, callback: any) => {
  fetchDb('/auth/me').then((u) => {
     auth.currentUser = { uid: u.uid, email: u.email, displayName: u.email.split('@')[0] };
     callback(auth.currentUser);
  }).catch(() => {
     callback(null);
  });
  return () => {};
};

export const signInWithPopup = async (_auth: any, _provider: any) => {
   // Generic mock popup that simply signs them in with a specific email
   const email = prompt("Enter your email (mock Auth):", "user@livra.app");
   if (!email) throw new Error("Popup closed");
   return signInWithEmailAndPassword(_auth, email, "default123");
};
export const GoogleAuthProvider = class {};

export const createUserWithEmailAndPassword = async (_auth: any, email: string, pass: string) => {
  const result = await fetchDb('/auth/login', { method: 'POST', body: JSON.stringify({ email, password: pass }) });
  localStorage.setItem('local_auth_token', result.token);
  auth.currentUser = { uid: result.user.uid, email: result.user.email, displayName: result.user.email.split('@')[0] };
  return { user: auth.currentUser };
};

export const signInWithEmailAndPassword = async (_auth: any, email: string, pass: string) => {
  return createUserWithEmailAndPassword(_auth, email, pass);
};

export const signOut = async (_auth: any) => {
  localStorage.removeItem('local_auth_token');
  auth.currentUser = null;
};

// Fallback empty classes
export class RecaptchaVerifier { constructor() {} verify() {} }
export const signInWithPhoneNumber = async () => ({ confirm: async () => ({ user: auth.currentUser }) });
export type User = { uid: string, email: string, displayName?: string };
export type ConfirmationResult = any;

export const initializeApp = (config: any) => ({ name: '[DEFAULT]' });
export const deleteApp = async (app: any) => {};
