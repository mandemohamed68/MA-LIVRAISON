const fs = require('fs');

const restores = [
  { file: 'src/components/NotificationToast.tsx', line: 2, content: "import { collection, query, where, onSnapshot, orderBy, limit, updateDoc, doc } from 'firebase/firestore';" },
  { file: 'src/components/NotificationToast.tsx', line: 3, content: "import { db } from '../lib/firebase';" },
  { file: 'src/components/Navbar.tsx', line: 9, content: "import { db } from '../lib/firebase';" },
  { file: 'src/components/Navbar.tsx', line: 10, content: "import { doc, onSnapshot } from 'firebase/firestore';" },
  { file: 'src/components/NotificationBell.tsx', line: 6, content: "import { collection, query, where, orderBy, onSnapshot, deleteDoc, doc, updateDoc, writeBatch } from 'firebase/firestore';" },
  { file: 'src/components/NotificationBell.tsx', line: 7, content: "import { db } from '../lib/firebase';" },
  { file: 'src/components/AnnouncementBanner.tsx', line: 4, content: "import { collection, query, where, onSnapshot } from 'firebase/firestore';" },
  { file: 'src/components/AnnouncementBanner.tsx', line: 5, content: "import { db } from '../lib/firebase';" },
  { file: 'src/lib/notificationService.ts', line: 1, content: "import { collection, addDoc } from 'firebase/firestore';" },
  { file: 'src/lib/notificationService.ts', line: 2, content: "import { db } from './firebase';" },
  { file: 'src/views/DeliveryTracking.tsx', line: 3, content: "import { db } from '../lib/firebase';" },
  { file: 'src/views/DeliveryTracking.tsx', line: 5, content: "import { doc, onSnapshot, updateDoc, collection, deleteDoc } from 'firebase/firestore';" },
  { file: 'src/views/AdminDashboard.tsx', line: 2, content: "import { db } from '../lib/firebase';" },
  { file: 'src/views/AdminDashboard.tsx', line: 3, content: "import { collection, onSnapshot, query, orderBy, doc, updateDoc, setDoc, deleteDoc, getDocs, addDoc, writeBatch, Timestamp, serverTimestamp } from 'firebase/firestore';" },
  { file: 'src/views/AdminDashboard.tsx', line: 5, content: "import { initializeApp, deleteApp } from 'firebase/app';" },
  { file: 'src/views/AdminDashboard.tsx', line: 6, content: "import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';" },
  { file: 'src/views/AdminDashboard.tsx', line: 7, content: "import firebaseConfig from '../../firebase-applet-config.json';" },
  { file: 'src/views/ClientDashboard.tsx', line: 2, content: "import { db } from '../lib/firebase';" },
  { file: 'src/views/ClientDashboard.tsx', line: 3, content: "import { collection, query, where, onSnapshot, orderBy, updateDoc, doc } from 'firebase/firestore';" },
  { file: 'src/views/DeliveryHistory.tsx', line: 2, content: "import { collection, query, where, orderBy, onSnapshot, doc, deleteDoc } from 'firebase/firestore';" },
  { file: 'src/views/DeliveryHistory.tsx', line: 3, content: "import { db } from '../lib/firebase';" },
  { file: 'src/views/DriverDashboard.tsx', line: 3, content: "import { db } from '../lib/firebase';" },
  { file: 'src/views/DriverDashboard.tsx', line: 4, content: "import { collection, query, where, onSnapshot, doc, updateDoc, setDoc, getDoc, orderBy } from 'firebase/firestore';" },
];

restores.forEach(r => {
  if (!fs.existsSync(r.file)) return;
  const lines = fs.readFileSync(r.file, 'utf8').split('\n');
  lines[r.line - 1] = r.content;
  fs.writeFileSync(r.file, lines.join('\n'));
});

// For multi-line imports that were clobbered:
const filesToRegex = [
  'src/components/Chat.tsx',
  'src/views/CreateDelivery.tsx',
  'src/context/AuthContext.tsx'
];

filesToRegex.forEach(file => {
  if (!fs.existsSync(file)) return;
  let text = fs.readFileSync(file, 'utf8');
  text = text.replace(/from\s+['"](?:\.\.\/)+lib\/firebase['"]/g, match => {
     if (text.indexOf(match) === text.lastIndexOf(match)) {
       return match; // If there's only one, don't change. But there are multiple. We'll manually fix multi lines below
     }
     return match;
  });
});
