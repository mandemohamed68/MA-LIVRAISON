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
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(deliveryId) REFERENCES deliveries(id),
    FOREIGN KEY(driverId) REFERENCES users(userId)
  );
`);
} catch (err) {
  console.error("Critical error during database schema creation:", err);
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
  { name: "boostAmount", type: "REAL DEFAULT 0" }
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
      const user = db_default.prepare("SELECT role, name, email FROM users WHERE userId = ?").get(decoded.userId);
      if (!user) {
        return res.status(401).json({ error: "User not found or role mismatch" });
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
      const token = import_jsonwebtoken.default.sign({ userId, email, role }, JWT_SECRET);
      res.json({ token, user: { userId, name, email, role } });
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
      const token = import_jsonwebtoken.default.sign({ userId: user.userId, email: user.email, role: user.role }, JWT_SECRET);
      res.json({ token, user: { userId: user.userId, name: user.name, email: user.email, role: user.role } });
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
  app.patch("/api/profile", authenticate, (req, res) => {
    const updates = req.body;
    let fields = Object.keys(updates).filter((k) => k !== "userId" && k !== "id" && k !== "password");
    try {
      const dbColumns = db_default.prepare("PRAGMA table_info(users)").all();
      const validColumns = new Set(dbColumns.map((c) => c.name));
      fields = fields.filter((f) => validColumns.has(f));
    } catch (schemaErr) {
      console.warn("Failed to retrieve users schema during validation:", schemaErr);
    }
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
  app.post("/api/notifications", authenticate, (req, res) => {
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
      res.json({ status: "ok" });
    } catch (err) {
      res.status(500).json({ error: "Update failed" });
    }
  });
  app.delete("/api/deliveries/:id", authenticate, (req, res) => {
    const { id } = req.params;
    try {
      db_default.prepare("DELETE FROM deliveries WHERE id = ?").run(id);
      db_default.prepare("DELETE FROM messages WHERE deliveryId = ?").run(id);
      res.json({ status: "ok" });
    } catch (err) {
      res.status(500).json({ error: "Delete failed" });
    }
  });
  app.post("/api/deliveries/:id/messages", authenticate, (req, res) => {
    const { id: deliveryId } = req.params;
    const { text, senderName, senderRole } = req.body;
    const id = (0, import_uuid.v4)();
    try {
      const stmt = db_default.prepare("INSERT INTO messages (id, deliveryId, text, senderId, senderName, senderRole) VALUES (?, ?, ?, ?, ?, ?)");
      stmt.run(id, deliveryId, text, req.user.userId, senderName, senderRole);
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
  app.get("/api/notifications", authenticate, (req, res) => {
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
  app.get("/api/config/:key", (req, res) => {
    const row = db_default.prepare("SELECT value FROM config WHERE key = ?").get(req.params.key);
    res.json(row ? JSON.parse(row.value) : {});
  });
  app.get("/api/sectors", (req, res) => {
    res.json(db_default.prepare("SELECT * FROM sectors WHERE isActive = 1").all());
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
            email: email || "client@livra.app",
            country: 1
          },
          amount: amount.toString(),
          note: note || `Livraison LIVRA #${Math.random().toString(36).substr(2, 5)}`
        })
      });
      const responseData = await invoiceResponse.json();
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
      const { customer_msisdn, invoice_id, payment_processor_id, access_token } = req.body;
      const response = await fetch(`${SAPPAY_BASE_CHECKOUT}/get-otp/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${access_token}`
        },
        body: JSON.stringify({
          customer_msisdn: normalizePhoneNumber(customer_msisdn),
          invoice_id,
          payment_processor_id
        })
      });
      const data = await response.json();
      res.status(response.status).json(data);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app.post("/api/payment/sappay/perform", async (req, res) => {
    try {
      const { invoice_id, payment_processor_id, customer_msisdn, otp, access_token, trans_id } = req.body;
      const response = await fetch(`${SAPPAY_BASE_CHECKOUT}/perform/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${access_token}`
        },
        body: JSON.stringify({
          invoice_id,
          payment_processor_id,
          customer_msisdn: normalizePhoneNumber(customer_msisdn),
          otp: otp.toString(),
          trans_id
        })
      });
      const data = await response.json();
      res.status(response.status).json(data);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app.get("/api/backoffice/users", authenticate, (req, res) => {
    if (req.user.role !== "admin" && req.user.role !== "superadmin") {
      console.warn(`[API ACCESS DENIED] User ${req.user.email} (ID: ${req.user.userId}) attempted to GET /api/backoffice/users, but role is: '${req.user.role}'`);
      return res.status(403).json({ error: `Access denied. Your role is '${req.user.role}' but 'admin' or 'superadmin' is required.` });
    }
    const users = db_default.prepare("SELECT * FROM users").all();
    users.forEach((u) => delete u.password);
    res.json(users);
  });
  app.patch("/api/backoffice/users/:userId", authenticate, (req, res) => {
    if (req.user.role !== "admin" && req.user.role !== "superadmin") {
      console.warn(`[API ACCESS DENIED] User ${req.user.email} (ID: ${req.user.userId}) attempted to PATCH /api/backoffice/users/${req.params.userId}, but role is: '${req.user.role}'`);
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
  app.patch("/api/backoffice/users/:userId/role", authenticate, (req, res) => {
    if (req.user.role !== "admin" && req.user.role !== "superadmin") {
      console.warn(`[API ACCESS DENIED] User ${req.user.email} (ID: ${req.user.userId}) attempted to PATCH role /api/backoffice/users/${req.params.userId}/role, but role is: '${req.user.role}'`);
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
  app.delete("/api/backoffice/users/:userId", authenticate, (req, res) => {
    if (req.user.role !== "superadmin") {
      console.warn(`[API ACCESS DENIED] User ${req.user.email} (ID: ${req.user.userId}) attempted to DELETE user /api/backoffice/users/${req.params.userId}, but role is: '${req.user.role}'`);
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
  app.post("/api/backoffice/users", authenticate, async (req, res) => {
    if (req.user.role !== "admin" && req.user.role !== "superadmin") {
      console.warn(`[API ACCESS DENIED] User ${req.user.email} (ID: ${req.user.userId}) attempted to POST /api/backoffice/users, but role is: '${req.user.role}'`);
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
  app.post("/api/backoffice/reset", authenticate, (req, res) => {
    if (req.user.role !== "superadmin") {
      return res.status(403).json({ error: "Superadmin only" });
    }
    try {
      db_default.prepare("DELETE FROM deliveries").run();
      db_default.prepare("DELETE FROM messages").run();
      db_default.prepare("DELETE FROM notifications").run();
      db_default.prepare("DELETE FROM users WHERE role NOT IN ('admin', 'superadmin')").run();
      res.json({ status: "ok" });
    } catch (err) {
      res.status(500).json({ error: "Reset failed" });
    }
  });
  app.post("/api/backoffice/seed", authenticate, (req, res) => {
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
  app.post("/api/config/:key", authenticate, (req, res) => {
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
  app.patch("/api/notifications/:id/read", authenticate, (req, res) => {
    try {
      db_default.prepare("UPDATE notifications SET isRead = 1 WHERE id = ? AND userId = ?").run(req.params.id, req.user.userId);
      res.json({ status: "ok" });
    } catch (err) {
      res.status(500).json({ error: "Update notification failed" });
    }
  });
  app.delete("/api/notifications/:id", authenticate, (req, res) => {
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
    try {
      const bidId = `${id}_${req.user.userId}`;
      db_default.prepare(`
        INSERT OR REPLACE INTO bids (id, deliveryId, driverId, driverName, price, proposedTime, reason, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).run(bidId, id, req.user.userId, req.user.name, price, actualTime, reason);
      res.json({ status: "ok", id: bidId });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Place bid failed" });
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
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
