import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

export default function initSQLiteDB() {
  const dbPath = process.env.DATABASE_URL || path.join(process.cwd(), 'local.db');
  let db: any;
  let isCorrupted = false;

  const registerCompatCollations = (d: any) => {
    try {
      const compare = (a: string, b: string) => {
        if (a < b) return -1;
        if (a > b) return 1;
        return 0;
      };
      d.collation('utf8mb4_unicode_ci', compare);
      d.collation('utf8mb4_general_ci', compare);
    } catch (e) {
      console.warn("Failed to register compatibility collations:", e);
    }
  };

// Attempt to open and run a health check
try {
  db = new Database(dbPath);
  registerCompatCollations(db);
  
  // Integrity check
  const integrity = db.prepare("PRAGMA integrity_check").get() as any;
  if (integrity && integrity.integrity_check !== 'ok' && integrity['integrity_check'] !== 'ok') {
    isCorrupted = true;
  }

  if (!isCorrupted) {
    // Quick probe to ensure tables operate
    try {
      db.prepare("SELECT 1 FROM deliveries LIMIT 1").get();
    } catch (err: any) {
      if (err.message && (err.message.includes('_users_old') || err.message.includes('malformed') || err.message.includes('corrupt') || err.message.includes('disk image'))) {
        isCorrupted = true;
      }
    }
  }
} catch (err: any) {
  console.error("Early database load failure:", err);
  isCorrupted = true;
}

if (isCorrupted) {
  console.warn("Database structure is corrupted or malformed. Auto-rebuilding a fresh local.db...");
  if (db) {
    try {
      db.close();
    } catch {}
  }
  try {
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
  } catch (fsErr) {
    console.error("Failed to delete corrupted local.db:", fsErr);
  }
  // Open fresh database
  db = new Database(dbPath);
  registerCompatCollations(db);
}

// Initialize schema under safety checks
try {
  db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    userId TEXT UNIQUE,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT, -- For local auth
    role TEXT CHECK(role IN ('client', 'driver', 'admin', 'superadmin')) NOT NULL,
    status TEXT DEFAULT 'online',
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
    withdrawalInfo TEXT,
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
    attempts INTEGER DEFAULT 1,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(deliveryId) REFERENCES deliveries(id),
    FOREIGN KEY(driverId) REFERENCES users(userId)
  );
`);
} catch (err) {
  console.error("Critical error during database schema creation:", err);
}

// Migrate bids table for attempts column
try {
  db.exec("ALTER TABLE bids ADD COLUMN attempts INTEGER DEFAULT 1");
  console.log("Migration: Added column attempts to bids table");
} catch (err) {}

// MIGRATION: Added columns to deliveries table
const colsToAdd = [
  { name: 'vehicleType', type: 'TEXT' },
  { name: 'senderPhone', type: 'TEXT' },
  { name: 'recipientPhone', type: 'TEXT' },
  { name: 'packageDetails', type: 'TEXT' },
  { name: 'baseCost', type: 'REAL' },
  { name: 'clientProposedPrice', type: 'REAL' },
  { name: 'isUrgent', type: 'INTEGER DEFAULT 0' },
  { name: 'urgentFee', type: 'REAL DEFAULT 0' },
  { name: 'boostAmount', type: 'REAL DEFAULT 0' },
  { name: 'lastMessageAt', type: 'TEXT' },
  { name: 'cancelReason', type: 'TEXT' }
];

const withdrawCols = [
  { name: 'withdrawalInfo', type: 'TEXT' }
];

const userCols = [
  { name: 'rib', type: 'TEXT' },
  { name: 'guarantorName', type: 'TEXT' },
  { name: 'guarantorPhone', type: 'TEXT' },
  { name: 'identityCardUrl', type: 'TEXT' },
  { name: 'identityCardBackUrl', type: 'TEXT' },
  { name: 'criminalRecordUrl', type: 'TEXT' },
  { name: 'verificationStatus', type: 'TEXT' }
];

colsToAdd.forEach(col => {
  try {
    db.exec(`ALTER TABLE deliveries ADD COLUMN ${col.name} ${col.type}`);
  } catch (err) {}
});

withdrawCols.forEach(col => {
  try {
    db.exec(`ALTER TABLE withdrawals ADD COLUMN ${col.name} ${col.type}`);
  } catch (err) {}
});

userCols.forEach(col => {
  try {
    db.exec(`ALTER TABLE users ADD COLUMN ${col.name} ${col.type}`);
  } catch (err) {}
});

// MIGRATION: Upgrade the check constraint on 'role' in 'users' table to support 'superadmin'
try {
  const tableInfo = db.prepare("SELECT sql FROM sqlite_schema WHERE type='table' AND name='users'").get() as { sql: string } | undefined;
  if (tableInfo && tableInfo.sql && !tableInfo.sql.includes('superadmin')) {
    console.log("Migration: Upgrading 'users' table check constraint to support 'superadmin'...");
    
    // Disable foreign keys temporarily and turn on legacy_alter_table to prevent ref corruption
    db.exec("PRAGMA foreign_keys=OFF;");
    db.exec("PRAGMA legacy_alter_table=ON;");
    
    db.transaction(() => {
      // Rename existing table
      db.exec("ALTER TABLE users RENAME TO _users_old;");
      
      // Create new table with updated constraints
      db.exec(`
        CREATE TABLE users (
          id TEXT PRIMARY KEY,
          userId TEXT UNIQUE,
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password TEXT,
          role TEXT CHECK(role IN ('client', 'driver', 'admin', 'superadmin')) NOT NULL,
          status TEXT DEFAULT 'online',
          accountStatus TEXT DEFAULT 'active',
          isVerified INTEGER DEFAULT 0,
          city TEXT,
          neighborhood TEXT,
          verificationStatus TEXT DEFAULT 'pending',
          guarantorName TEXT,
          guarantorPhone TEXT,
          identityCardUrl TEXT,
          criminalRecordUrl TEXT,
          currentLocation TEXT,
          balance REAL DEFAULT 0,
          earnings REAL DEFAULT 0,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
      
      const pragmaOld = db.prepare("PRAGMA table_info(_users_old)").all() as Array<{ name: string }>;
      const pragmaNew = db.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
      
      const oldColNames = new Set(pragmaOld.map(c => c.name));
      const newColNames = pragmaNew.map(c => c.name);
      
      const commonCols = newColNames.filter(c => oldColNames.has(c)).join(', ');
      
      db.exec(`INSERT INTO users (${commonCols}) SELECT ${commonCols} FROM _users_old;`);
      
      // Drop old table
      db.exec("DROP TABLE _users_old;");
    })();
    
    db.exec("PRAGMA legacy_alter_table=OFF;");
    db.exec("PRAGMA foreign_keys=ON;");
    console.log("Migration: 'users' table check constraint upgraded successfully.");
  }
} catch (migrationError: any) {
  console.error("Migration to support superadmin failed:", migrationError);
}

// MIGRATIONS: Add columns if they do not exist
function addColumnIfNotExists(tableName: string, columnName: string, columnDef: string) {
  try {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef}`);
    console.log(`Migration: Added ${columnName} to ${tableName}`);
  } catch (e: any) {
    if (!e.message.includes('duplicate column name')) {
      console.warn(`Migration notice for ${tableName}.${columnName}: ${e.message}`);
    }
  }
}

addColumnIfNotExists('users', 'accountStatus', "TEXT DEFAULT 'active'");
addColumnIfNotExists('users', 'verificationStatus', "TEXT DEFAULT 'pending'");
addColumnIfNotExists('users', 'isVerified', "INTEGER DEFAULT 0");
addColumnIfNotExists('users', 'phone', "TEXT");
addColumnIfNotExists('users', 'vehicleType', "TEXT");
addColumnIfNotExists('users', 'licensePlate', "TEXT");
addColumnIfNotExists('users', 'identityCardBackUrl', "TEXT");
addColumnIfNotExists('users', 'idCardFront', "TEXT");
addColumnIfNotExists('users', 'idCardBack', "TEXT");
addColumnIfNotExists('users', 'guarantorCniUrl', "TEXT");
addColumnIfNotExists('users', 'walletBalance', "REAL DEFAULT 0");
addColumnIfNotExists('users', 'driverType', "TEXT");
addColumnIfNotExists('users', 'parentCompanyId', "TEXT");
addColumnIfNotExists('users', 'withdrawalRequested', "INTEGER DEFAULT 0");
addColumnIfNotExists('users', 'withdrawalAmount', "REAL DEFAULT 0");
addColumnIfNotExists('users', 'withdrawalMethod', "TEXT");
addColumnIfNotExists('users', 'withdrawalPhone', "TEXT");
addColumnIfNotExists('users', 'rib', "TEXT");
addColumnIfNotExists('users', 'idCardFront', "TEXT");
addColumnIfNotExists('users', 'idCardBack', "TEXT");
addColumnIfNotExists('users', 'guarantorName', "TEXT");
addColumnIfNotExists('users', 'guarantorPhone', "TEXT");
addColumnIfNotExists('users', 'guarantorCniUrl', "TEXT");
addColumnIfNotExists('users', 'totalWithdrawn', "REAL DEFAULT 0");
addColumnIfNotExists('users', 'withdrawalRequestedAt', "TEXT");
addColumnIfNotExists('users', 'updatedAt', "TEXT");
addColumnIfNotExists('users', 'termsAcceptedAt', "TEXT");
addColumnIfNotExists('users', 'sectors', "TEXT");
addColumnIfNotExists('users', 'favoriteAddresses', "TEXT");
addColumnIfNotExists('users', 'performanceScore', "REAL DEFAULT 100");
addColumnIfNotExists('users', 'cancellationRate', "REAL DEFAULT 0");
addColumnIfNotExists('users', 'totalEarnings', "REAL DEFAULT 0");
addColumnIfNotExists('users', 'dailyGoal', "REAL DEFAULT 0");
addColumnIfNotExists('users', 'photoURL', "TEXT");
addColumnIfNotExists('users', 'address', "TEXT");

addColumnIfNotExists('bids', 'attempts', "INTEGER DEFAULT 1");

// Create historique_gains table
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS historique_gains (
      id TEXT PRIMARY KEY,
      driverId TEXT NOT NULL,
      type TEXT NOT NULL, -- course, retrait
      amount REAL NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(driverId) REFERENCES users(userId)
    );
  `);
  console.log("Database: Created table historique_gains if not exists");
} catch (err) {
  console.error("Failed to create table historique_gains", err);
}

// Create promo_codes and promo_usages tables
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS promo_codes (
      code TEXT PRIMARY KEY,
      type TEXT NOT NULL, -- percentage, fixed
      value REAL NOT NULL,
      start_date TEXT, -- ISO Date string
      end_date TEXT,   -- ISO Date string
      max_uses INTEGER, -- maximum total usages (< 0 or NULL for unlimited)
      uses_count INTEGER DEFAULT 0,
      max_per_user INTEGER DEFAULT 1,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS promo_usages (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      userId TEXT NOT NULL,
      deliveryId TEXT,
      used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(code) REFERENCES promo_codes(code),
      FOREIGN KEY(userId) REFERENCES users(userId)
    );
  `);
  console.log("Database: Created promo tables if not exists");
} catch (err) {
  console.error("Failed to create promo tables:", err);
}


  (db as any).engine = 'SQLite (Local)';
  (db as any).config = {
    host: 'local',
    database: path.basename(dbPath)
  };
  return db;
}
