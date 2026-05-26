var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_cors = __toESM(require("cors"), 1);
var import_vite = require("vite");
var import_path2 = __toESM(require("path"), 1);
var import_dotenv = __toESM(require("dotenv"), 1);

// backend/db.ts
var import_better_sqlite3 = __toESM(require("better-sqlite3"), 1);
var import_path = __toESM(require("path"), 1);
var import_fs = __toESM(require("fs"), 1);
var dbPath = process.env.DATABASE_URL || import_path.default.join(process.cwd(), "local.db");
var db;
var isCorrupted = false;
try {
  db = new import_better_sqlite3.default(dbPath);
  const integrity = db.prepare("PRAGMA integrity_check").get();
  if (integrity && integrity.integrity_check !== "ok" && integrity["integrity_check"] !== "ok") {
    isCorrupted = true;
  }
  if (!isCorrupted) {
    try {
      db.prepare("SELECT 1 FROM deliveries LIMIT 1").get();
    } catch (err) {
      if (err.message && (err.message.includes("_users_old") || err.message.includes("malformed") || err.message.includes("corrupt") || err.message.includes("disk image"))) {
        isCorrupted = true;
      }
    }
  }
} catch (err) {
  console.error("Early database load failure:", err);
  isCorrupted = true;
}
if (isCorrupted) {
  console.warn("Database structure is corrupted or malformed. Auto-rebuilding a fresh local.db...");
  if (db) {
    try {
      db.close();
    } catch {
    }
  }
  try {
    if (import_fs.default.existsSync(dbPath)) {
      import_fs.default.unlinkSync(dbPath);
    }
  } catch (fsErr) {
    console.error("Failed to delete corrupted local.db:", fsErr);
  }
  db = new import_better_sqlite3.default(dbPath);
}
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
try {
  db.exec("ALTER TABLE bids ADD COLUMN attempts INTEGER DEFAULT 1");
  console.log("Migration: Added column attempts to bids table");
} catch (err) {
}
var colsToAdd = [
  { name: "vehicleType", type: "TEXT" },
  { name: "senderPhone", type: "TEXT" },
  { name: "recipientPhone", type: "TEXT" },
  { name: "packageDetails", type: "TEXT" },
  { name: "baseCost", type: "REAL" },
  { name: "clientProposedPrice", type: "REAL" },
  { name: "isUrgent", type: "INTEGER DEFAULT 0" },
  { name: "urgentFee", type: "REAL DEFAULT 0" },
  { name: "boostAmount", type: "REAL DEFAULT 0" },
  { name: "lastMessageAt", type: "TEXT" }
];
colsToAdd.forEach((col) => {
  try {
    db.exec(`ALTER TABLE deliveries ADD COLUMN ${col.name} ${col.type}`);
    console.log(`Migration: Added column ${col.name} to deliveries table`);
  } catch (err) {
    if (!err.message.includes("duplicate column name") && !err.message.includes("already exists")) {
      console.warn(`Migration notice for column ${col.name}:`, err.message);
    }
  }
});
try {
  const tableInfo = db.prepare("SELECT sql FROM sqlite_schema WHERE type='table' AND name='users'").get();
  if (tableInfo && tableInfo.sql && !tableInfo.sql.includes("superadmin")) {
    console.log("Migration: Upgrading 'users' table check constraint to support 'superadmin'...");
    db.exec("PRAGMA foreign_keys=OFF;");
    db.exec("PRAGMA legacy_alter_table=ON;");
    db.transaction(() => {
      db.exec("ALTER TABLE users RENAME TO _users_old;");
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
      const pragmaOld = db.prepare("PRAGMA table_info(_users_old)").all();
      const pragmaNew = db.prepare("PRAGMA table_info(users)").all();
      const oldColNames = new Set(pragmaOld.map((c) => c.name));
      const newColNames = pragmaNew.map((c) => c.name);
      const commonCols = newColNames.filter((c) => oldColNames.has(c)).join(", ");
      db.exec(`INSERT INTO users (${commonCols}) SELECT ${commonCols} FROM _users_old;`);
      db.exec("DROP TABLE _users_old;");
    })();
    db.exec("PRAGMA legacy_alter_table=OFF;");
    db.exec("PRAGMA foreign_keys=ON;");
    console.log("Migration: 'users' table check constraint upgraded successfully.");
  }
} catch (migrationError) {
  console.error("Migration to support superadmin failed:", migrationError);
}
function addColumnIfNotExists(tableName, columnName, columnDef) {
  try {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef}`);
    console.log(`Migration: Added ${columnName} to ${tableName}`);
  } catch (e) {
    if (!e.message.includes("duplicate column name")) {
      console.warn(`Migration notice for ${tableName}.${columnName}: ${e.message}`);
    }
  }
}
addColumnIfNotExists("users", "accountStatus", "TEXT DEFAULT 'active'");
addColumnIfNotExists("users", "verificationStatus", "TEXT DEFAULT 'pending'");
addColumnIfNotExists("users", "isVerified", "INTEGER DEFAULT 0");
addColumnIfNotExists("users", "phone", "TEXT");
addColumnIfNotExists("users", "vehicleType", "TEXT");
addColumnIfNotExists("users", "licensePlate", "TEXT");
addColumnIfNotExists("users", "identityCardBackUrl", "TEXT");
addColumnIfNotExists("users", "idCardFront", "TEXT");
addColumnIfNotExists("users", "idCardBack", "TEXT");
addColumnIfNotExists("users", "guarantorCniUrl", "TEXT");
addColumnIfNotExists("users", "walletBalance", "REAL DEFAULT 0");
addColumnIfNotExists("users", "driverType", "TEXT");
addColumnIfNotExists("users", "parentCompanyId", "TEXT");
addColumnIfNotExists("users", "withdrawalRequested", "INTEGER DEFAULT 0");
addColumnIfNotExists("users", "withdrawalAmount", "REAL DEFAULT 0");
addColumnIfNotExists("users", "withdrawalMethod", "TEXT");
addColumnIfNotExists("users", "withdrawalPhone", "TEXT");
addColumnIfNotExists("users", "totalWithdrawn", "REAL DEFAULT 0");
addColumnIfNotExists("users", "withdrawalRequestedAt", "TEXT");
addColumnIfNotExists("users", "updatedAt", "TEXT");
addColumnIfNotExists("users", "termsAcceptedAt", "TEXT");
addColumnIfNotExists("users", "sectors", "TEXT");
addColumnIfNotExists("users", "favoriteAddresses", "TEXT");
addColumnIfNotExists("users", "performanceScore", "REAL DEFAULT 100");
addColumnIfNotExists("users", "cancellationRate", "REAL DEFAULT 0");
addColumnIfNotExists("users", "totalEarnings", "REAL DEFAULT 0");
addColumnIfNotExists("users", "dailyGoal", "REAL DEFAULT 0");
addColumnIfNotExists("users", "photoURL", "TEXT");
addColumnIfNotExists("users", "address", "TEXT");
addColumnIfNotExists("bids", "attempts", "INTEGER DEFAULT 1");
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
var db_default = db;

// server.ts
var import_bcryptjs = __toESM(require("bcryptjs"), 1);
var import_jsonwebtoken = __toESM(require("jsonwebtoken"), 1);
var import_uuid = require("uuid");
import_dotenv.default.config();
var JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-for-dev";
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3e3;
  app.use((0, import_cors.default)());
  app.use(import_express.default.json({ limit: "50mb" }));
  app.use(import_express.default.urlencoded({ extended: true, limit: "50mb" }));
  function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
  const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "No token provided" });
    const token = authHeader.split(" ")[1];
    try {
      const decoded = import_jsonwebtoken.default.verify(token, JWT_SECRET);
      const user = db_default.prepare("SELECT role, name, email, accountStatus FROM users WHERE userId = ?").get(decoded.userId);
      if (!user) {
        return res.status(401).json({ error: "User not found or role mismatch" });
      }
      if (user.accountStatus === "suspended") {
        return res.status(403).json({ error: "Votre compte a \xE9t\xE9 suspendu par l'administrateur. Veuillez contacter le support." });
      }
      req.user = {
        ...decoded,
        role: user.role,
        name: user.name,
        email: user.email
      };
      next();
    } catch (err) {
      res.status(401).json({ error: "Invalid token" });
    }
  };
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
  });
  app.post("/api/auth/register", async (req, res) => {
    const { name, email, password, role } = req.body;
    try {
      const hashedPassword = await import_bcryptjs.default.hash(password, 10);
      const userId = (0, import_uuid.v4)();
      const stmt = db_default.prepare("INSERT INTO users (id, userId, name, email, password, role) VALUES (?, ?, ?, ?, ?, ?)");
      stmt.run(userId, userId, name, email, hashedPassword, role || "client");
      const allowedFields = [
        "city",
        "neighborhood",
        "address",
        "driverType",
        "phone",
        "idCardFront",
        "idCardBack",
        "status",
        "termsAcceptedAt",
        "vehicleType",
        "licensePlate",
        "sectors"
      ];
      const updates = [];
      const params = [];
      for (const field of allowedFields) {
        if (req.body[field] !== void 0) {
          updates.push(`${field} = ?`);
          params.push(req.body[field]);
        }
      }
      if (updates.length > 0) {
        params.push(userId);
        db_default.prepare(`UPDATE users SET ${updates.join(", ")} WHERE userId = ?`).run(...params);
      }
      const fullUser = db_default.prepare("SELECT * FROM users WHERE userId = ?").get(userId);
      delete fullUser.password;
      if (fullUser.currentLocation) {
        try {
          fullUser.currentLocation = JSON.parse(fullUser.currentLocation);
        } catch (e) {
        }
      }
      const token = import_jsonwebtoken.default.sign({ userId, email, role }, JWT_SECRET);
      res.json({ token, user: fullUser });
    } catch (error) {
      if (error.message.includes("UNIQUE")) {
        return res.status(400).json({ error: "Email already exists" });
      }
      res.status(500).json({ error: "Registration failed" });
    }
  });
  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    try {
      const user = db_default.prepare("SELECT * FROM users WHERE email = ?").get(email);
      if (!user || !await import_bcryptjs.default.compare(password, user.password)) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      if (user.accountStatus === "suspended") {
        return res.status(403).json({ error: "Votre compte a \xE9t\xE9 suspendu par l'administrateur. Veuillez contacter le support." });
      }
      delete user.password;
      const token = import_jsonwebtoken.default.sign({ userId: user.userId, email: user.email, role: user.role }, JWT_SECRET);
      res.json({ token, user });
    } catch (error) {
      res.status(500).json({ error: "Login failed" });
    }
  });
  app.get("/api/profile", authenticate, (req, res) => {
    const user = db_default.prepare("SELECT * FROM users WHERE userId = ?").get(req.user.userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    delete user.password;
    if (user.currentLocation) user.currentLocation = JSON.parse(user.currentLocation);
    res.json(user);
  });
  app.get("/api/users/:id", authenticate, (req, res) => {
    try {
      const user = db_default.prepare("SELECT * FROM users WHERE userId = ?").get(req.params.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      delete user.password;
      if (user.currentLocation) {
        try {
          user.currentLocation = JSON.parse(user.currentLocation);
        } catch {
        }
      }
      res.json(user);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });
  app.patch("/api/profile", authenticate, async (req, res) => {
    const updates = req.body;
    let fields = Object.keys(updates).filter((k) => k !== "userId" && k !== "id");
    try {
      const dbColumns = db_default.prepare("PRAGMA table_info(users)").all();
      const validColumns = new Set(dbColumns.map((c) => c.name));
      fields = fields.filter((f) => validColumns.has(f));
    } catch (schemaErr) {
      console.warn("Failed to retrieve users schema during validation:", schemaErr);
    }
    if (fields.length === 0) return res.json({ status: "no changes" });
    const setClause = fields.map((f) => `${f} = ?`).join(", ");
    const values = await Promise.all(fields.map(async (f) => {
      let val = updates[f];
      if (f === "password" && typeof val === "string" && val.trim() !== "") {
        return await import_bcryptjs.default.hash(val, 10);
      }
      if (typeof val === "boolean") return val ? 1 : 0;
      if (typeof val === "object" && val !== null) return JSON.stringify(val);
      return val;
    }));
    try {
      const stmt = db_default.prepare(`UPDATE users SET ${setClause} WHERE userId = ?`);
      stmt.run(...values, req.user.userId);
      res.json({ status: "ok" });
    } catch (err) {
      console.error("Profile update DB error:", err);
      res.status(500).json({ error: "Update failed", details: err?.message || err?.toString() });
    }
  });
  app.post("/api/deliveries", authenticate, (req, res) => {
    const d = req.body;
    const id = (0, import_uuid.v4)();
    try {
      const commRow = db_default.prepare("SELECT value FROM config WHERE key = 'commissions'").get();
      const comm = commRow ? JSON.parse(commRow.value) : { minDeliveryCost: 500, tarifKm: 150, fraisFixes: 500 };
      let calculatedCost = d.cost;
      if (!calculatedCost && d.from && d.to) {
        const dist = calculateDistance(d.from.lat, d.from.lng, d.to.lat, d.to.lng);
        calculatedCost = Math.max(comm.minDeliveryCost, comm.fraisFixes + dist * comm.tarifKm);
        calculatedCost = Math.round(calculatedCost / 100) * 100;
      }
      const stmt = db_default.prepare(`
        INSERT INTO deliveries (
          id, clientId, clientName, origin, destination, cost, status, pickupCode, deliveryCode,
          vehicleType, senderPhone, recipientPhone, packageDetails, baseCost, clientProposedPrice, isUrgent, urgentFee, boostAmount
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        id,
        req.user.userId,
        d.clientName || req.user.name || "",
        JSON.stringify(d.from || {}),
        JSON.stringify(d.to || {}),
        calculatedCost || 1e3,
        d.status || "pending",
        d.pickupCode || Math.random().toString(36).substr(2, 6).toUpperCase(),
        d.deliveryCode || Math.random().toString(36).substr(2, 6).toUpperCase(),
        d.vehicleType || "moto",
        d.senderPhone || "",
        d.recipientPhone || "",
        d.packageDetails ? JSON.stringify(d.packageDetails) : null,
        d.baseCost || d.estimatedCost || calculatedCost || 1e3,
        d.clientProposedPrice || d.cost || calculatedCost || 1e3,
        d.isUrgent ? 1 : 0,
        d.urgentFee || 0,
        d.boostAmount || 0
      );
      res.json({ id, cost: calculatedCost });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Creation failed", details: err?.message || err?.toString() });
    }
  });
  app.post("/api/app-notifications", authenticate, (req, res) => {
    const { userId, title, message, type, link } = req.body;
    const id = (0, import_uuid.v4)();
    try {
      db_default.prepare("INSERT INTO notifications (id, userId, title, message, type, link) VALUES (?, ?, ?, ?, ?, ?)").run(id, userId, title, message, type || "info", link || null);
      res.json({ id });
    } catch (err) {
      res.status(500).json({ error: "Failed to create notification" });
    }
  });
  app.get("/api/deliveries", authenticate, (req, res) => {
    const { role, userId } = req.user;
    let query = "SELECT * FROM deliveries";
    const params = [];
    if (role === "client") {
      query += " WHERE clientId = ?";
      params.push(userId);
    } else if (role === "driver") {
      query += " WHERE (status = 'pending' OR driverId = ?)";
      params.push(userId);
    } else if (role !== "admin" && role !== "superadmin") {
      return res.status(403).json({ error: "Access denied" });
    }
    query += " ORDER BY createdAt DESC LIMIT 100";
    const deliveries = db_default.prepare(query).all(...params);
    deliveries.forEach((d) => {
      try {
        if (typeof d.origin === "string") d.origin = JSON.parse(d.origin);
      } catch (e) {
      }
      try {
        if (typeof d.destination === "string") d.destination = JSON.parse(d.destination);
      } catch (e) {
      }
      d.from = d.origin || {};
      d.to = d.destination || {};
      try {
        if (typeof d.rejectedBy === "string") d.rejectedBy = JSON.parse(d.rejectedBy);
      } catch (e) {
      }
      try {
        if (typeof d.packageDetails === "string") d.packageDetails = JSON.parse(d.packageDetails);
      } catch (e) {
      }
      try {
        const bids = db_default.prepare("SELECT * FROM bids WHERE deliveryId = ?").all(d.id);
        d.bids = bids || [];
      } catch (e) {
        d.bids = [];
      }
    });
    res.json(deliveries);
  });
  app.get("/api/deliveries/:id", authenticate, (req, res) => {
    try {
      const d = db_default.prepare("SELECT * FROM deliveries WHERE id = ?").get(req.params.id);
      if (!d) {
        return res.status(404).json({ error: "Delivery not found" });
      }
      try {
        if (typeof d.origin === "string") d.origin = JSON.parse(d.origin);
      } catch (e) {
      }
      try {
        if (typeof d.destination === "string") d.destination = JSON.parse(d.destination);
      } catch (e) {
      }
      d.from = d.origin || {};
      d.to = d.destination || {};
      try {
        if (typeof d.rejectedBy === "string") d.rejectedBy = JSON.parse(d.rejectedBy);
      } catch (e) {
      }
      try {
        if (typeof d.packageDetails === "string") d.packageDetails = JSON.parse(d.packageDetails);
      } catch (e) {
      }
      try {
        const bids = db_default.prepare("SELECT * FROM bids WHERE deliveryId = ?").all(d.id);
        d.bids = bids || [];
      } catch (e) {
        d.bids = [];
      }
      res.json(d);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch delivery details" });
    }
  });
  app.patch("/api/deliveries/:id", authenticate, (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    const fields = Object.keys(updates).filter((k) => k !== "id" && k !== "clientId");
    if (fields.length === 0) return res.json({ status: "no changes" });
    const setClause = fields.map((f) => `${f} = ?`).join(", ");
    const values = fields.map((f) => {
      let val = updates[f];
      if (typeof val === "boolean") return val ? 1 : 0;
      if (typeof val === "object" && val !== null) return JSON.stringify(val);
      return val;
    });
    try {
      const stmt = db_default.prepare(`UPDATE deliveries SET ${setClause}, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`);
      stmt.run(...values, id);
      if (updates.status === "accepted" && updates.driverId) {
        db_default.prepare("UPDATE bids SET status = 'accepted', updatedAt = CURRENT_TIMESTAMP WHERE deliveryId = ? AND driverId = ?").run(id, updates.driverId);
        db_default.prepare("UPDATE bids SET status = 'rejected', updatedAt = CURRENT_TIMESTAMP WHERE deliveryId = ? AND driverId != ?").run(id, updates.driverId);
      }
      if (updates.status === "delivered") {
        try {
          const delivery = db_default.prepare("SELECT driverId, cost, clientProposedPrice FROM deliveries WHERE id = ?").get(id);
          if (delivery && delivery.driverId) {
            const finalCost = delivery.clientProposedPrice || delivery.cost || 0;
            const configRows = db_default.prepare("SELECT * FROM config").all();
            const commissionsRow = configRows.find((c) => c.key === "commissions");
            const commissionSettings = commissionsRow ? JSON.parse(commissionsRow.value) : { driverSharePercent: 85 };
            const driverShare = commissionSettings.driverSharePercent || 85;
            const driverAmt = Math.floor(finalCost * driverShare / 100);
            db_default.prepare(`
              INSERT INTO historique_gains (id, driverId, type, amount, createdAt)
              VALUES (?, ?, 'course', ?, CURRENT_TIMESTAMP)
            `).run((0, import_uuid.v4)(), delivery.driverId, driverAmt);
          }
        } catch (err) {
          console.error("Failed to log gain for completed delivery:", err);
        }
      }
      res.json({ status: "ok" });
    } catch (err) {
      res.status(500).json({ error: "Update failed" });
    }
  });
  app.delete("/api/deliveries/:id", authenticate, (req, res) => {
    const { id } = req.params;
    try {
      db_default.prepare("DELETE FROM tracking WHERE deliveryId = ?").run(id);
      db_default.prepare("DELETE FROM bids WHERE deliveryId = ?").run(id);
      db_default.prepare("DELETE FROM messages WHERE deliveryId = ?").run(id);
      db_default.prepare("DELETE FROM deliveries WHERE id = ?").run(id);
      res.json({ status: "ok" });
    } catch (err) {
      console.error("Delete failed:", err);
      res.status(500).json({ error: "Delete failed", details: err?.message });
    }
  });
  app.post("/api/deliveries/:id/messages", authenticate, (req, res) => {
    const { id: deliveryId } = req.params;
    const { text, senderName, senderRole } = req.body;
    const id = (0, import_uuid.v4)();
    try {
      const stmt = db_default.prepare("INSERT INTO messages (id, deliveryId, text, senderId, senderName, senderRole) VALUES (?, ?, ?, ?, ?, ?)");
      stmt.run(id, deliveryId, text, req.user.userId, senderName, senderRole);
      db_default.prepare("UPDATE deliveries SET lastMessageAt = CURRENT_TIMESTAMP WHERE id = ?").run(deliveryId);
      res.json({ id });
    } catch (err) {
      res.status(500).json({ error: "Message failed" });
    }
  });
  app.get("/api/deliveries/:id/messages", authenticate, (req, res) => {
    const { id: deliveryId } = req.params;
    const messages = db_default.prepare("SELECT * FROM messages WHERE deliveryId = ? ORDER BY createdAt ASC").all(deliveryId);
    res.json(messages);
  });
  app.get("/api/app-notifications", authenticate, (req, res) => {
    const notifications = db_default.prepare("SELECT * FROM notifications WHERE userId = ? ORDER BY createdAt DESC LIMIT 50").all(req.user.userId);
    res.json(notifications);
  });
  app.get("/api/drivers/status", (req, res) => {
    try {
      const available = db_default.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'driver' AND status = 'online' AND accountStatus = 'active'").get();
      const busy = db_default.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'driver' AND status = 'busy' AND accountStatus = 'active'").get();
      res.json({ available: available.count, busy: busy.count });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch driver status" });
    }
  });
  app.get("/api/system-preferences/:key", (req, res) => {
    const row = db_default.prepare("SELECT value FROM config WHERE key = ?").get(req.params.key);
    res.json(row ? JSON.parse(row.value) : {});
  });
  app.get("/api/sectors", (req, res) => {
    res.json(db_default.prepare("SELECT * FROM sectors WHERE isActive = 1").all());
  });
  app.post("/api/platform-billing/query", authenticate, (req, res) => {
    if (req.user.role !== "admin" && req.user.role !== "superadmin") {
      return res.status(403).json({ error: "Access denied" });
    }
    const { sql } = req.body;
    if (!sql) {
      return res.status(400).json({ error: "SQL query is required" });
    }
    try {
      const stmt = db_default.prepare(sql);
      const lowerSql = sql.trim().toLowerCase();
      if (lowerSql.startsWith("select") || lowerSql.startsWith("pragma") || lowerSql.startsWith("explain")) {
        const rows = stmt.all();
        res.json({ success: true, rows });
      } else {
        const result = stmt.run();
        res.json({ success: true, result });
      }
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });
  app.post("/api/sectors", authenticate, (req, res) => {
    if (req.user.role !== "admin" && req.user.role !== "superadmin") {
      return res.status(403).json({ error: "Access denied" });
    }
    const { name, city, isActive } = req.body;
    const id = (0, import_uuid.v4)();
    try {
      db_default.prepare("INSERT INTO sectors (id, name, city, isActive) VALUES (?, ?, ?, ?)").run(id, name, city || "Ouagadougou", isActive === false ? 0 : 1);
      res.json({ id, name, city });
    } catch (err) {
      res.status(500).json({ error: "Failed to create sector" });
    }
  });
  app.delete("/api/sectors/:id", authenticate, (req, res) => {
    if (req.user.role !== "admin" && req.user.role !== "superadmin") {
      return res.status(403).json({ error: "Access denied" });
    }
    try {
      db_default.prepare("DELETE FROM sectors WHERE id = ?").run(req.params.id);
      res.json({ status: "ok" });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete sector" });
    }
  });
  app.get("/api/announcements", (req, res) => {
    res.json(db_default.prepare("SELECT * FROM announcements ORDER BY createdAt DESC").all());
  });
  app.post("/api/announcements", authenticate, (req, res) => {
    if (req.user.role !== "admin" && req.user.role !== "superadmin") {
      return res.status(403).json({ error: "Access denied" });
    }
    const { title, message, type, targetRole, activeUntil } = req.body;
    const id = (0, import_uuid.v4)();
    try {
      db_default.prepare("INSERT INTO announcements (id, title, message, type, targetRole, activeUntil) VALUES (?, ?, ?, ?, ?, ?)").run(id, title, message, type || "info", targetRole || "all", activeUntil || null);
      res.json({ id, title });
    } catch (err) {
      res.status(500).json({ error: "Failed to create announcement" });
    }
  });
  app.delete("/api/announcements/:id", authenticate, (req, res) => {
    if (req.user.role !== "admin" && req.user.role !== "superadmin") {
      return res.status(403).json({ error: "Access denied" });
    }
    try {
      db_default.prepare("DELETE FROM announcements WHERE id = ?").run(req.params.id);
      res.json({ status: "ok" });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete announcement" });
    }
  });
  const SAPPAY_BASE_PUBLIC = "https://api.prod.sappay.net/api/public";
  const SAPPAY_BASE_CHECKOUT = "https://api.prod.sappay.net/api/checkout";
  const normalizePhoneNumberSappay = (phone, countryId = 1) => {
    let clean = phone.replace(/\D/g, "");
    if (countryId === 1) {
      if (clean.startsWith("00226")) {
        clean = clean.substring(5);
      } else if (clean.startsWith("226")) {
        clean = clean.substring(3);
      }
      if (clean.length > 8) {
        clean = clean.substring(clean.length - 8);
      }
    }
    return clean;
  };
  const normalizePhoneNumber = (phone) => {
    let clean = phone.replace(/\D/g, "");
    if (clean.length === 8) return `226${clean}`;
    return clean;
  };
  const findInvoiceId = (obj) => {
    if (!obj || typeof obj !== "object") return null;
    if (obj.invoice_id) return obj.invoice_id;
    if (obj.id && typeof obj.id === "string" && obj.id.length > 5) return obj.id;
    if (obj.reference) return obj.reference;
    if (obj.invoice_detail && obj.invoice_detail.invoice_id) return obj.invoice_detail.invoice_id;
    for (const key in obj) {
      const found = findInvoiceId(obj[key]);
      if (found) return found;
    }
    return null;
  };
  async function getSappayToken() {
    const clientId = process.env.SAPPAY_CLIENT_ID?.trim();
    const clientSecret = process.env.SAPPAY_CLIENT_SECRET?.trim();
    const username = process.env.SAPPAY_USERNAME?.trim();
    const password = process.env.SAPPAY_PASSWORD?.trim();
    if (!clientId || !clientSecret || !username || !password) {
      throw new Error("Missing or empty Sappay credentials in Secrets (ID, SECRET, USERNAME, or PASSWORD)");
    }
    const response = await fetch(`${SAPPAY_BASE_PUBLIC}/authentication/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({
        grant_type: "password",
        client_id: clientId,
        client_secret: clientSecret,
        username,
        password
      })
    });
    if (!response.ok) {
      throw new Error(`Sappay Authentication Failed: ${response.status}`);
    }
    const data = await response.json();
    return data.access_token;
  }
  app.post("/api/payment/sappay/init", async (req, res) => {
    try {
      const { amount, note, email } = req.body;
      const token = await getSappayToken();
      const invoiceResponse = await fetch(`${SAPPAY_BASE_PUBLIC}/invoice/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          type: "SIMPLE",
          customer: {
            email: email || "client@pancho.app",
            country: 1
          },
          amount: amount.toString(),
          note: note || `Livraison PANCHO #${Math.random().toString(36).substr(2, 5)}`
        })
      });
      let responseText = "";
      try {
        responseText = await invoiceResponse.text();
      } catch (e) {
        responseText = "Impossible de lire la r\xE9ponse.";
      }
      if (!invoiceResponse.ok) {
        throw new Error(`Sappay Invoice Creation Failed (${invoiceResponse.status}): ${responseText.substring(0, 500)}`);
      }
      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch (e) {
        throw new Error(`Sappay response was not valid JSON: ${responseText.substring(0, 500)}`);
      }
      const invoiceId = findInvoiceId(responseData);
      if (!invoiceId) {
        return res.status(400).json({ error: "Could not retrieve Invoice ID from Sappay", details: responseData });
      }
      res.json({
        invoice_id: invoiceId,
        access_token: token,
        status: responseData.status || "PENDING"
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app.post("/api/payment/sappay/get-otp", async (req, res) => {
    try {
      const { customer_msisdn, invoice_id, payment_processor_id } = req.body;
      const response = await fetch(`${SAPPAY_BASE_CHECKOUT}/get-otp/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          customer_msisdn: normalizePhoneNumberSappay(customer_msisdn),
          invoice_id,
          payment_processor_id
        })
      });
      let responseText = "";
      try {
        responseText = await response.text();
      } catch (e) {
        responseText = "Impossible de lire la r\xE9ponse.";
      }
      if (!response.ok) {
        return res.status(response.status).json({
          error: "Sappay OTP Error",
          details: responseText.substring(0, 500)
        });
      }
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        return res.status(500).json({ error: "Format de r\xE9ponse OTP invalide" });
      }
      res.status(response.status).json(data);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app.post("/api/payment/sappay/perform", async (req, res) => {
    try {
      const { invoice_id, payment_processor_id, customer_msisdn, otp, trans_id } = req.body;
      const payload = {
        invoice_id,
        payment_processor_id,
        customer_msisdn: normalizePhoneNumberSappay(customer_msisdn),
        otp: otp.toString()
      };
      if (trans_id) {
        payload.trans_id = trans_id;
      }
      const response = await fetch(`${SAPPAY_BASE_CHECKOUT}/perform/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      let responseText = "";
      try {
        responseText = await response.text();
      } catch (e) {
        responseText = "Impossible de lire la r\xE9ponse.";
      }
      if (!response.ok) {
        return res.status(response.status).json({
          error: "Sappay Perform Error",
          details: responseText.substring(0, 500)
        });
      }
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        return res.status(500).json({ error: "Format de r\xE9ponse perform invalide" });
      }
      res.status(response.status).json(data);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app.get("/api/platform-billing/users", authenticate, (req, res) => {
    if (req.user.role !== "admin" && req.user.role !== "superadmin") {
      console.warn(`[API ACCESS DENIED] User ${req.user.email} (ID: ${req.user.userId}) attempted to GET /api/platform-billing/users, but role is: '${req.user.role}'`);
      return res.status(403).json({ error: `Access denied. Your role is '${req.user.role}' but 'admin' or 'superadmin' is required.` });
    }
    const users = db_default.prepare("SELECT * FROM users").all();
    users.forEach((u) => {
      delete u.password;
      if (typeof u.currentLocation === "string" && u.currentLocation) {
        try {
          u.currentLocation = JSON.parse(u.currentLocation);
        } catch (e) {
          u.currentLocation = null;
        }
      }
    });
    res.json(users);
  });
  app.patch("/api/platform-billing/users/:userId", authenticate, (req, res) => {
    if (req.user.role !== "admin" && req.user.role !== "superadmin") {
      console.warn(`[API ACCESS DENIED] User ${req.user.email} (ID: ${req.user.userId}) attempted to PATCH /api/platform-billing/users/${req.params.userId}, but role is: '${req.user.role}'`);
      return res.status(403).json({ error: `Access denied. Your role is '${req.user.role}' but 'admin' or 'superadmin' is required.` });
    }
    const { userId } = req.params;
    const updates = req.body;
    const fields = Object.keys(updates).filter((k) => k !== "userId" && k !== "id" && k !== "password");
    if (fields.length === 0) return res.json({ status: "no changes" });
    const setClause = fields.map((f) => `${f} = ?`).join(", ");
    const values = fields.map((f) => {
      let val = updates[f];
      if (typeof val === "boolean") return val ? 1 : 0;
      if (typeof val === "object" && val !== null) return JSON.stringify(val);
      return val;
    });
    try {
      const stmt = db_default.prepare(`UPDATE users SET ${setClause} WHERE userId = ?`);
      stmt.run(...values, userId);
      res.json({ status: "ok" });
    } catch (err) {
      res.status(500).json({ error: "Update failed" });
    }
  });
  app.patch("/api/platform-billing/users/:userId/role", authenticate, (req, res) => {
    if (req.user.role !== "admin" && req.user.role !== "superadmin") {
      console.warn(`[API ACCESS DENIED] User ${req.user.email} (ID: ${req.user.userId}) attempted to PATCH role /api/platform-billing/users/${req.params.userId}/role, but role is: '${req.user.role}'`);
      return res.status(403).json({ error: `Access denied. Your role is '${req.user.role}' but 'admin' or 'superadmin' is required.` });
    }
    const { userId } = req.params;
    const { role } = req.body;
    try {
      db_default.prepare("UPDATE users SET role = ? WHERE userId = ?").run(role, userId);
      res.json({ status: "ok" });
    } catch (err) {
      res.status(500).json({ error: "Failed to update role" });
    }
  });
  app.delete("/api/platform-billing/users/:userId", authenticate, (req, res) => {
    if (req.user.role !== "superadmin") {
      console.warn(`[API ACCESS DENIED] User ${req.user.email} (ID: ${req.user.userId}) attempted to DELETE user /api/platform-billing/users/${req.params.userId}, but role is: '${req.user.role}'`);
      return res.status(403).json({ error: `Access denied. Superadmin role is required (your role is '${req.user.role}').` });
    }
    const { userId } = req.params;
    try {
      db_default.prepare("DELETE FROM users WHERE userId = ?").run(userId);
      res.json({ status: "ok" });
    } catch (err) {
      res.status(500).json({ error: "Delete failed" });
    }
  });
  app.post("/api/platform-billing/users", authenticate, async (req, res) => {
    if (req.user.role !== "admin" && req.user.role !== "superadmin") {
      console.warn(`[API ACCESS DENIED] User ${req.user.email} (ID: ${req.user.userId}) attempted to POST /api/platform-billing/users, but role is: '${req.user.role}'`);
      return res.status(403).json({ error: `Access denied. Your role is '${req.user.role}' but 'admin' or 'superadmin' is required.` });
    }
    const { name, email, password, role, ...rest } = req.body;
    try {
      const hashedPassword = await import_bcryptjs.default.hash(password, 10);
      const userId = (0, import_uuid.v4)();
      const fields = ["id", "userId", "name", "email", "password", "role", ...Object.keys(rest)];
      const placeholders = fields.map(() => "?").join(", ");
      const values = [userId, userId, name, email, hashedPassword, role, ...Object.values(rest).map((v) => typeof v === "object" ? JSON.stringify(v) : v)];
      const stmt = db_default.prepare(`INSERT INTO users (${fields.join(", ")}) VALUES (${placeholders})`);
      stmt.run(...values);
      res.json({ userId, name, email, role });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app.post("/api/platform-billing/reset", authenticate, (req, res) => {
    if (req.user.role !== "superadmin") {
      return res.status(403).json({ error: "Superadmin only" });
    }
    try {
      db_default.prepare("DELETE FROM tracking").run();
      db_default.prepare("DELETE FROM bids").run();
      db_default.prepare("DELETE FROM messages").run();
      db_default.prepare("DELETE FROM deliveries").run();
      db_default.prepare("DELETE FROM notifications").run();
      db_default.prepare("DELETE FROM withdrawals").run();
      db_default.prepare("DELETE FROM users WHERE role NOT IN ('admin', 'superadmin')").run();
      res.json({ status: "ok" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Reset failed", details: err?.message });
    }
  });
  app.post("/api/platform-billing/seed", authenticate, (req, res) => {
    if (req.user.role !== "admin" && req.user.role !== "superadmin") {
      return res.status(403).json({ error: "Admin only" });
    }
    try {
      const clientId = "client_test_seed";
      const driverId = "driver_test_seed";
      db_default.prepare("INSERT OR IGNORE INTO users (id, userId, name, email, role, accountStatus) VALUES (?, ?, ?, ?, ?, ?)").run(clientId, clientId, "Client Test", "client_test@example.com", "client", "active");
      db_default.prepare("INSERT OR IGNORE INTO users (id, userId, name, email, role, accountStatus, status, vehicleType) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(driverId, driverId, "Livreur Test", "driver_test@example.com", "driver", "active", "online", "Moto");
      const d1Id = (0, import_uuid.v4)();
      db_default.prepare(`
        INSERT INTO deliveries (id, clientId, clientName, origin, destination, cost, status, pickupCode, deliveryCode)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(d1Id, clientId, "Client Test", JSON.stringify({ address: "March\xE9 Rood Woko", lat: 12.368, lng: -1.53 }), JSON.stringify({ address: "ZAD", lat: 12.345, lng: -1.5 }), 1500, "pending", "1A2B3C", "X9Y8Z7");
      res.json({ status: "ok" });
    } catch (err) {
      res.status(500).json({ error: "Seed failed" });
    }
  });
  app.post("/api/system-preferences/:key", authenticate, (req, res) => {
    if (req.user.role !== "admin" && req.user.role !== "superadmin") {
      return res.status(403).json({ error: "Access denied" });
    }
    const { key } = req.params;
    const value = JSON.stringify(req.body);
    try {
      db_default.prepare("INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)").run(key, value);
      res.json({ status: "ok" });
    } catch (err) {
      res.status(500).json({ error: "Failed to update config" });
    }
  });
  const seedConfig = () => {
    const hasConfig = db_default.prepare("SELECT key FROM config WHERE key = 'app_config'").get();
    if (!hasConfig) {
      db_default.prepare("INSERT INTO config (key, value) VALUES (?, ?)").run("app_config", JSON.stringify({
        mode: "prod",
        isMaintenanceMode: false,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      }));
    }
    const hasCommissions = db_default.prepare("SELECT key FROM config WHERE key = 'commissions'").get();
    if (!hasCommissions) {
      db_default.prepare("INSERT INTO config (key, value) VALUES (?, ?)").run("commissions", JSON.stringify({
        platformFeePercent: 15,
        driverSharePercent: 85,
        minDeliveryCost: 500,
        tarifKm: 150,
        tarifPoids: 100,
        fraisFixes: 500
      }));
    }
  };
  seedConfig();
  const seedAdmin = async () => {
    const adminEmail = "mandemohamed68@gmail.com";
    const adminPass = "mm@27071986@";
    try {
      const existingAdmin = db_default.prepare("SELECT * FROM users WHERE email = ?").get(adminEmail);
      if (!existingAdmin) {
        console.log("Seeding default super-admin...");
        const hashedPassword = await import_bcryptjs.default.hash(adminPass, 10);
        const userId = (0, import_uuid.v4)();
        db_default.prepare("INSERT INTO users (id, userId, name, email, password, role, accountStatus) VALUES (?, ?, ?, ?, ?, ?, ?)").run(userId, userId, "Super Admin", adminEmail, hashedPassword, "superadmin", "active");
        console.log("Default super-admin created successfully.");
      }
    } catch (err) {
      console.error("Failed to seed admin:", err);
    }
  };
  seedAdmin();
  app.patch("/api/app-notifications/:id/read", authenticate, (req, res) => {
    try {
      db_default.prepare("UPDATE notifications SET isRead = 1 WHERE id = ? AND userId = ?").run(req.params.id, req.user.userId);
      res.json({ status: "ok" });
    } catch (err) {
      res.status(500).json({ error: "Update notification failed" });
    }
  });
  app.delete("/api/app-notifications/:id", authenticate, (req, res) => {
    try {
      db_default.prepare("DELETE FROM notifications WHERE id = ? AND userId = ?").run(req.params.id, req.user.userId);
      res.json({ status: "ok" });
    } catch (err) {
      res.status(500).json({ error: "Delete notification failed" });
    }
  });
  app.get("/api/deliveries/:id/bids", authenticate, (req, res) => {
    try {
      const bids = db_default.prepare("SELECT * FROM bids WHERE deliveryId = ?").all(req.params.id);
      bids.forEach((b) => {
        b.timeEstimateMins = b.proposedTime;
      });
      res.json(bids);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Fetch bids failed" });
    }
  });
  app.post("/api/deliveries/:id/bids", authenticate, (req, res) => {
    const { id } = req.params;
    const { price, proposedTime, timeEstimateMins, reason } = req.body;
    const actualTime = proposedTime !== void 0 ? proposedTime : timeEstimateMins;
    const bidId = `${id}_${req.user.userId}`;
    try {
      const existingBid = db_default.prepare("SELECT * FROM bids WHERE id = ?").get(bidId);
      let attempts = 1;
      if (existingBid) {
        attempts = (existingBid.attempts || 1) + 1;
        if (attempts > 2) {
          return res.status(400).json({ error: "Nombre maximum de tentatives de n\xE9gociation (2) atteint." });
        }
      }
      db_default.prepare(`
        INSERT OR REPLACE INTO bids (id, deliveryId, driverId, driverName, price, proposedTime, reason, status, attempts, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, CURRENT_TIMESTAMP)
      `).run(bidId, id, req.user.userId, req.user.name, price, actualTime, reason, attempts);
      const delivery = db_default.prepare("SELECT clientId FROM deliveries WHERE id = ?").get(id);
      if (delivery) {
        const message = `Le livreur ${req.user.name} propose un tarif de ${price} FCFA (Tentative ${attempts}/2).`;
        db_default.prepare("INSERT INTO notifications (id, userId, title, message, type) VALUES (?, ?, ?, ?, ?)").run((0, import_uuid.v4)(), delivery.clientId, "Nouvelle proposition", message, "warning");
      }
      res.json({ status: "ok", id: bidId, attempts });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Place bid failed" });
    }
  });
  app.post("/api/deliveries/:id/bids/:driverId/decline", authenticate, (req, res) => {
    const { id, driverId } = req.params;
    try {
      db_default.prepare("UPDATE bids SET status = 'rejected', updatedAt = CURRENT_TIMESTAMP WHERE deliveryId = ? AND driverId = ?").run(id, driverId);
      db_default.prepare("INSERT INTO notifications (id, userId, title, message, type) VALUES (?, ?, ?, ?, ?)").run((0, import_uuid.v4)(), driverId, "Proposition refus\xE9e", `Votre proposition de tarif pour la course #${id.slice(-6).toUpperCase()} a \xE9t\xE9 refus\xE9e. Vous pouvez soumettre une derni\xE8re proposition si applicable.`, "warning");
      res.json({ status: "ok" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to decline bid" });
    }
  });
  app.post("/api/courses/:id/accepter-proposition", authenticate, (req, res) => {
    const { id } = req.params;
    const { driverId, price } = req.body;
    if (!driverId) return res.status(400).json({ error: "L'identifiant du livreur (driverId) est requis" });
    try {
      const existingBid = db_default.prepare("SELECT * FROM bids WHERE deliveryId = ? AND driverId = ?").get(id, driverId);
      if (!existingBid) {
        return res.status(404).json({ error: "Proposition introuvable" });
      }
      const { driverName, price: bidPrice } = existingBid;
      const finalPrice = price || bidPrice;
      db_default.prepare(`
        UPDATE deliveries 
        SET status = 'accepted', driverId = ?, driverName = ?, cost = ?, updatedAt = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(driverId, driverName, finalPrice, id);
      db_default.prepare("UPDATE bids SET status = 'accepted', updatedAt = CURRENT_TIMESTAMP WHERE deliveryId = ? AND driverId = ?").run(id, driverId);
      db_default.prepare("UPDATE bids SET status = 'rejected', updatedAt = CURRENT_TIMESTAMP WHERE deliveryId = ? AND driverId != ?").run(id, driverId);
      db_default.prepare("INSERT INTO notifications (id, userId, title, message, type) VALUES (?, ?, ?, ?, ?)").run((0, import_uuid.v4)(), driverId, "Proposition accept\xE9e", `Le client a accept\xE9 votre proposition pour la course #${id.slice(-6).toUpperCase()}.`, "success");
      res.json({ message: "Proposition accept\xE9e avec succ\xE8s", price: finalPrice });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erreur lors de l'acceptation de la proposition" });
    }
  });
  app.post("/api/courses/:id/rejeter-proposition", authenticate, (req, res) => {
    const { id } = req.params;
    const { driverId } = req.body;
    if (!driverId) return res.status(400).json({ error: "L'identifiant du livreur (driverId) est requis" });
    try {
      db_default.prepare("UPDATE bids SET status = 'rejected', updatedAt = CURRENT_TIMESTAMP WHERE deliveryId = ? AND driverId = ?").run(id, driverId);
      db_default.prepare("INSERT INTO notifications (id, userId, title, message, type) VALUES (?, ?, ?, ?, ?)").run((0, import_uuid.v4)(), driverId, "Proposition refus\xE9e", `Votre proposition de tarif pour la course #${id.slice(-6).toUpperCase()} a \xE9t\xE9 refus\xE9e par le client. Vous pouvez soumettre une derni\xE8re offre si applicable.`, "warning");
      res.json({ message: "Proposition refus\xE9e" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erreur lors du rejet de la proposition" });
    }
  });
  app.post("/api/deliveries/:id/tracking", authenticate, (req, res) => {
    const { id } = req.params;
    const { lat, lng } = req.body;
    try {
      const trackingId = (0, import_uuid.v4)();
      db_default.prepare(`
        INSERT INTO tracking (id, deliveryId, lat, lng, timestamp)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).run(trackingId, id, lat, lng);
      res.json({ status: "ok", id: trackingId });
    } catch (err) {
      res.status(500).json({ error: "Tracking update failed" });
    }
  });
  app.post("/api/withdrawals", authenticate, (req, res) => {
    if (req.user.role !== "driver") return res.status(403).json({ error: "Drivers only" });
    const { amount, method, phone } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: "Invalid amount" });
    try {
      const driver = db_default.prepare("SELECT * FROM users WHERE userId = ?").get(req.user.userId);
      if (!driver) return res.status(404).json({ error: "Driver not found" });
      const configRows = db_default.prepare("SELECT * FROM config").all();
      const commissionsRow = configRows.find((c) => c.key === "commissions");
      const commissionSettings = commissionsRow ? JSON.parse(commissionsRow.value) : { driverSharePercent: 85 };
      const driverShare = commissionSettings.driverSharePercent || 85;
      const onlineDeliveries = db_default.prepare(`SELECT * FROM deliveries WHERE driverId = ? AND status = 'delivered' AND paymentMethod != 'cash'`).all(driver.userId);
      const totalEarnings = onlineDeliveries.reduce((acc, curr) => acc + (curr.clientProposedPrice || curr.cost || 0), 0) * driverShare / 100;
      const pendingWithdrawalsSum = db_default.prepare(`SELECT SUM(amount) as sum FROM withdrawals WHERE driverId = ? AND status = 'en_attente'`).get(driver.userId)?.sum || 0;
      const earnings = totalEarnings - (driver.totalWithdrawn || 0) - pendingWithdrawalsSum;
      if (amount > earnings) return res.status(400).json({ error: "Amount exceeds available balance" });
      const id = (0, import_uuid.v4)();
      db_default.prepare(`
        INSERT INTO withdrawals (id, driverId, driverName, amount, status, method, phone)
        VALUES (?, ?, ?, ?, 'en_attente', ?, ?)
      `).run(id, req.user.userId, req.user.name, amount, method, phone);
      db_default.prepare("INSERT INTO notifications (id, userId, title, message, type) VALUES (?, ?, ?, ?, ?)").run((0, import_uuid.v4)(), "admin", "Nouvelle demande de retrait", `${req.user.name} demande un retrait de ${amount} FCFA`, "info");
      res.json({ status: "ok", id });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Withdrawal request failed" });
    }
  });
  app.get("/api/withdrawals", authenticate, (req, res) => {
    try {
      const list = db_default.prepare("SELECT * FROM withdrawals WHERE driverId = ? ORDER BY createdAt DESC").all(req.user.userId);
      res.json(list);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch driver withdrawals" });
    }
  });
  app.get("/api/drivers/gains-history", authenticate, (req, res) => {
    try {
      const list = db_default.prepare("SELECT * FROM historique_gains WHERE driverId = ? ORDER BY createdAt DESC").all(req.user.userId);
      res.json(list);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch driver gains history" });
    }
  });
  app.get("/api/platform-billing/withdrawals", authenticate, (req, res) => {
    if (req.user.role !== "admin" && req.user.role !== "superadmin") {
      return res.status(403).json({ error: "Access denied" });
    }
    try {
      const withdrawals = db_default.prepare("SELECT * FROM withdrawals ORDER BY createdAt DESC").all();
      res.json(withdrawals);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch withdrawals" });
    }
  });
  app.post("/api/platform-billing/withdrawals/:id/valider", authenticate, (req, res) => {
    if (req.user.role !== "admin" && req.user.role !== "superadmin") {
      return res.status(403).json({ error: "Access denied" });
    }
    const { id } = req.params;
    try {
      const withdrawal = db_default.prepare("SELECT * FROM withdrawals WHERE id = ?").get(id);
      if (!withdrawal) return res.status(404).json({ error: "Withdrawal not found" });
      if (withdrawal.status === "valide") return res.status(400).json({ error: "Already validated" });
      const driver = db_default.prepare("SELECT * FROM users WHERE userId = ?").get(withdrawal.driverId);
      if (!driver) return res.status(404).json({ error: "Driver not found" });
      const configRows = db_default.prepare("SELECT * FROM config").all();
      const commissionsRow = configRows.find((c) => c.key === "commissions");
      const commissionSettings = commissionsRow ? JSON.parse(commissionsRow.value) : { driverSharePercent: 85 };
      const driverShare = commissionSettings.driverSharePercent || 85;
      const onlineDeliveries = db_default.prepare(`SELECT * FROM deliveries WHERE driverId = ? AND status = 'delivered' AND paymentMethod != 'cash'`).all(driver.userId);
      const totalEarnings = onlineDeliveries.reduce((acc, curr) => acc + (curr.clientProposedPrice || curr.cost || 0), 0) * driverShare / 100;
      const earnings = totalEarnings - (driver.totalWithdrawn || 0);
      const newBalance = earnings - withdrawal.amount;
      if (newBalance < 0) return res.status(400).json({ error: "Insufficient balance" });
      db_default.transaction(() => {
        db_default.prepare("UPDATE users SET earnings = ?, totalWithdrawn = COALESCE(totalWithdrawn, 0) + ? WHERE userId = ?").run(newBalance, withdrawal.amount, driver.userId);
        db_default.prepare("UPDATE withdrawals SET status = 'valide', processedAt = CURRENT_TIMESTAMP WHERE id = ?").run(id);
        db_default.prepare(`
          INSERT INTO historique_gains (id, driverId, type, amount, createdAt)
          VALUES (?, ?, 'retrait', ?, CURRENT_TIMESTAMP)
        `).run((0, import_uuid.v4)(), driver.userId, withdrawal.amount);
        const msg = `Retrait de ${withdrawal.amount} FCFA - valid\xE9`;
        db_default.prepare("INSERT INTO notifications (id, userId, title, message, type) VALUES (?, ?, ?, ?, ?)").run((0, import_uuid.v4)(), driver.userId, "Retrait valid\xE9", msg, "success");
      })();
      res.json({ status: "ok" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to validate withdrawal" });
    }
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path2.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path2.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
