import Database from 'better-sqlite3';
import path from 'path';

const dbPath = process.env.DATABASE_URL || path.join(process.cwd(), 'local.db');
const db = new Database(dbPath);

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    userId TEXT UNIQUE,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT, -- For local auth
    role TEXT CHECK(role IN ('client', 'driver', 'admin', 'superadmin')) NOT NULL,
    status TEXT DEFAULT 'offline',
    accountStatus TEXT DEFAULT 'active', -- active, rejected, suspended
    isVerified INTEGER DEFAULT 0,
    city TEXT,
    neighborhood TEXT,
    verificationStatus TEXT DEFAULT 'pending',
    guarantorName TEXT,
    guarantorPhone TEXT,
    identityCardUrl TEXT,
    criminalRecordUrl TEXT,
    currentLocation TEXT, -- JSON string
    balance REAL DEFAULT 0,
    earnings REAL DEFAULT 0,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS deliveries (
    id TEXT PRIMARY KEY,
    clientId TEXT NOT NULL,
    clientName TEXT,
    driverId TEXT,
    driverName TEXT,
    origin TEXT NOT NULL, -- JSON string {lat, lng, address}
    destination TEXT NOT NULL, -- JSON string {lat, lng, address}
    cost REAL NOT NULL,
    status TEXT CHECK(status IN ('pending', 'accepted', 'picked_up', 'delivered', 'cancelled')) DEFAULT 'pending',
    paymentStatus TEXT DEFAULT 'pending',
    paymentMethod TEXT,
    paymentReference TEXT,
    isPaid INTEGER DEFAULT 0, -- Boolean
    paidToDriver INTEGER DEFAULT 0, -- Boolean
    pickupCode TEXT,
    deliveryCode TEXT,
    rejectedBy TEXT, -- JSON array
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(clientId) REFERENCES users(userId),
    FOREIGN KEY(driverId) REFERENCES users(userId)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    deliveryId TEXT NOT NULL,
    text TEXT NOT NULL,
    senderId TEXT NOT NULL,
    senderName TEXT,
    senderRole TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(deliveryId) REFERENCES deliveries(id),
    FOREIGN KEY(senderId) REFERENCES users(userId)
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info',
    link TEXT,
    isRead INTEGER DEFAULT 0,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(userId) REFERENCES users(userId)
  );

  CREATE TABLE IF NOT EXISTS announcements (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info',
    targetRole TEXT DEFAULT 'all',
    activeUntil DATETIME,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sectors (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    city TEXT NOT NULL,
    isActive INTEGER DEFAULT 1,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL -- JSON string
  );

  CREATE TABLE IF NOT EXISTS withdrawals (
    id TEXT PRIMARY KEY,
    driverId TEXT NOT NULL,
    driverName TEXT,
    amount REAL NOT NULL,
    status TEXT DEFAULT 'pending',
    method TEXT,
    phone TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    processedAt DATETIME,
    FOREIGN KEY(driverId) REFERENCES users(userId)
  );

  CREATE TABLE IF NOT EXISTS tracking (
    id TEXT PRIMARY KEY,
    deliveryId TEXT NOT NULL,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(deliveryId) REFERENCES deliveries(id)
  );

  CREATE TABLE IF NOT EXISTS bids (
    id TEXT PRIMARY KEY,
    deliveryId TEXT NOT NULL,
    driverId TEXT NOT NULL,
    driverName TEXT,
    price REAL NOT NULL,
    proposedTime INTEGER,
    reason TEXT,
    status TEXT DEFAULT 'pending', -- pending, accepted, rejected
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(deliveryId) REFERENCES deliveries(id),
    FOREIGN KEY(driverId) REFERENCES users(userId)
  );
`);

export default db;
