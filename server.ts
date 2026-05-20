import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import dotenv from "dotenv";
import db from "./backend/db";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-for-dev";

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

  app.use(express.json());

  // Permettre les requêtes CORS depuis l'application mobile (Capacitor) vers l'API Express
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    if (req.method === 'OPTIONS') {
        res.header('Access-Control-Allow-Methods', 'PUT, POST, PATCH, DELETE, GET');
        return res.status(200).json({});
    }
    next();
  });

  // --- UTILS ---
  function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
  }

  // --- MIDDLEWARE AUTH ---
  const authenticate = (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "No token provided" });
    const token = authHeader.split(" ")[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      const user = db.prepare("SELECT role, name, email FROM users WHERE userId = ?").get(decoded.userId) as any;
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

  // --- AUTH ENDPOINTS ---
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.post("/api/auth/register", async (req, res) => {
    const { name, email, password, role } = req.body;
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const userId = uuidv4();
      const stmt = db.prepare("INSERT INTO users (id, userId, name, email, password, role) VALUES (?, ?, ?, ?, ?, ?)");
      stmt.run(userId, userId, name, email, hashedPassword, role || "client");
      
      const token = jwt.sign({ userId, email, role }, JWT_SECRET);
      res.json({ token, user: { userId, name, email, role } });
    } catch (error: any) {
      if (error.message.includes("UNIQUE")) {
        return res.status(400).json({ error: "Email already exists" });
      }
      res.status(500).json({ error: "Registration failed" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    try {
      const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as any;
      if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      const token = jwt.sign({ userId: user.userId, email: user.email, role: user.role }, JWT_SECRET);
      res.json({ token, user: { userId: user.userId, name: user.name, email: user.email, role: user.role } });
    } catch (error) {
      res.status(500).json({ error: "Login failed" });
    }
  });

  // --- USER ENDPOINTS ---
  app.get("/api/profile", authenticate, (req: any, res) => {
    const user = db.prepare("SELECT * FROM users WHERE userId = ?").get(req.user.userId) as any;
    if (!user) return res.status(404).json({ error: "User not found" });
    delete user.password;
    if (user.currentLocation) user.currentLocation = JSON.parse(user.currentLocation);
    res.json(user);
  });

  app.get("/api/users/:id", authenticate, (req: any, res) => {
    try {
      const user = db.prepare("SELECT * FROM users WHERE userId = ?").get(req.params.id) as any;
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      delete user.password;
      if (user.currentLocation) {
        try { user.currentLocation = JSON.parse(user.currentLocation); } catch { }
      }
      res.json(user);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  app.patch("/api/profile", authenticate, (req: any, res) => {
    const updates = req.body;
    let fields = Object.keys(updates).filter(k => k !== 'userId' && k !== 'id' && k !== 'password');
    
    // Dynamic schema validation to filter out any fields that are not actual database columns
    try {
      const dbColumns = db.prepare("PRAGMA table_info(users)").all() as any[];
      const validColumns = new Set(dbColumns.map(c => c.name));
      fields = fields.filter(f => validColumns.has(f));
    } catch (schemaErr) {
      console.warn("Failed to retrieve users schema during validation:", schemaErr);
    }

    if (fields.length === 0) return res.json({ status: "no changes" });

    const setClause = fields.map(f => `${f} = ?`).join(", ");
    const values = fields.map(f => typeof updates[f] === 'object' ? JSON.stringify(updates[f]) : updates[f]);
    
    try {
      const stmt = db.prepare(`UPDATE users SET ${setClause} WHERE userId = ?`);
      stmt.run(...values, req.user.userId);
      res.json({ status: "ok" });
    } catch (err: any) {
      console.error("Profile update DB error:", err);
      res.status(500).json({ error: "Update failed", details: err?.message || err?.toString() });
    }
  });

  // --- DELIVERY ENDPOINTS ---
  app.post("/api/deliveries", authenticate, (req: any, res) => {
    const d = req.body;
    const id = uuidv4();
    
    try {
      // Get commission config
      const commRow = db.prepare("SELECT value FROM config WHERE key = 'commissions'").get() as any;
      const comm = commRow ? JSON.parse(commRow.value) : { minDeliveryCost: 500, tarifKm: 150, fraisFixes: 500 };

      let calculatedCost = d.cost;
      if (!calculatedCost && d.from && d.to) {
        const dist = calculateDistance(d.from.lat, d.from.lng, d.to.lat, d.to.lng);
        calculatedCost = Math.max(comm.minDeliveryCost, comm.fraisFixes + (dist * comm.tarifKm));
        calculatedCost = Math.round(calculatedCost / 100) * 100; // Round to nearest 100
      }

      const stmt = db.prepare(`
        INSERT INTO deliveries (id, clientId, clientName, origin, destination, cost, status, pickupCode, deliveryCode)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        id, req.user.userId, d.clientName, 
        JSON.stringify(d.from), JSON.stringify(d.to), 
        calculatedCost || 1000, "pending", 
        Math.random().toString(36).substr(2, 6).toUpperCase(),
        Math.random().toString(36).substr(2, 6).toUpperCase()
      );
      res.json({ id, cost: calculatedCost });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: "Creation failed", details: err?.message || err?.toString() });
    }
  });

  app.post("/api/notifications", authenticate, (req: any, res) => {
    const { userId, title, message, type, link } = req.body;
    const id = uuidv4();
    try {
      db.prepare("INSERT INTO notifications (id, userId, title, message, type, link) VALUES (?, ?, ?, ?, ?, ?)")
        .run(id, userId, title, message, type || 'info', link || null);
      res.json({ id });
    } catch (err) {
      res.status(500).json({ error: "Failed to create notification" });
    }
  });

  app.get("/api/deliveries", authenticate, (req: any, res) => {
    const { role, userId } = req.user;
    let query = "SELECT * FROM deliveries";
    const params: any[] = [];

    if (role === 'client') {
      query += " WHERE clientId = ?";
      params.push(userId);
    } else if (role === 'driver') {
      query += " WHERE (status = 'pending' OR driverId = ?)";
      params.push(userId);
    } else if (role !== 'admin') {
      return res.status(403).json({ error: "Access denied" });
    }

    query += " ORDER BY createdAt DESC LIMIT 100";
    const deliveries = db.prepare(query).all(...params) as any[];
    deliveries.forEach(d => {
      try { if (typeof d.origin === 'string') d.origin = JSON.parse(d.origin); } catch(e){}
      try { if (typeof d.destination === 'string') d.destination = JSON.parse(d.destination); } catch(e){}
      d.from = d.origin || {};
      d.to = d.destination || {};
      try { if (typeof d.rejectedBy === 'string') d.rejectedBy = JSON.parse(d.rejectedBy); } catch(e){}
    });
    res.json(deliveries);
  });

  app.get("/api/deliveries/:id", authenticate, (req: any, res) => {
    try {
      const d = db.prepare("SELECT * FROM deliveries WHERE id = ?").get(req.params.id) as any;
      if (!d) {
        return res.status(404).json({ error: "Delivery not found" });
      }
      try { if (typeof d.origin === 'string') d.origin = JSON.parse(d.origin); } catch(e){}
      try { if (typeof d.destination === 'string') d.destination = JSON.parse(d.destination); } catch(e){}
      d.from = d.origin || {};
      d.to = d.destination || {};
      try { if (typeof d.rejectedBy === 'string') d.rejectedBy = JSON.parse(d.rejectedBy); } catch(e){}
      res.json(d);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch delivery details" });
    }
  });

  app.patch("/api/deliveries/:id", authenticate, (req: any, res) => {
    const { id } = req.params;
    const updates = req.body;
    const fields = Object.keys(updates).filter(k => k !== 'id' && k !== 'clientId');
    
    if (fields.length === 0) return res.json({ status: "no changes" });

    const setClause = fields.map(f => `${f} = ?`).join(", ");
    const values = fields.map(f => typeof updates[f] === 'object' ? JSON.stringify(updates[f]) : updates[f]);
    
    try {
      const stmt = db.prepare(`UPDATE deliveries SET ${setClause}, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`);
      stmt.run(...values, id);
      res.json({ status: "ok" });
    } catch (err) {
      res.status(500).json({ error: "Update failed" });
    }
  });

  app.delete("/api/deliveries/:id", authenticate, (req: any, res) => {
    const { id } = req.params;
    try {
      db.prepare("DELETE FROM deliveries WHERE id = ?").run(id);
      db.prepare("DELETE FROM messages WHERE deliveryId = ?").run(id);
      res.json({ status: "ok" });
    } catch (err) {
      res.status(500).json({ error: "Delete failed" });
    }
  });

  // --- MESSAGES ENDPOINTS ---
  app.post("/api/deliveries/:id/messages", authenticate, (req: any, res) => {
    const { id: deliveryId } = req.params;
    const { text, senderName, senderRole } = req.body;
    const id = uuidv4();
    try {
      const stmt = db.prepare("INSERT INTO messages (id, deliveryId, text, senderId, senderName, senderRole) VALUES (?, ?, ?, ?, ?, ?)");
      stmt.run(id, deliveryId, text, req.user.userId, senderName, senderRole);
      res.json({ id });
    } catch (err) {
      res.status(500).json({ error: "Message failed" });
    }
  });

  app.get("/api/deliveries/:id/messages", authenticate, (req: any, res) => {
    const { id: deliveryId } = req.params;
    const messages = db.prepare("SELECT * FROM messages WHERE deliveryId = ? ORDER BY createdAt ASC").all(deliveryId);
    res.json(messages);
  });

  // --- NOTIFICATIONS ---
  app.get("/api/notifications", authenticate, (req: any, res) => {
    const notifications = db.prepare("SELECT * FROM notifications WHERE userId = ? ORDER BY createdAt DESC LIMIT 50").all(req.user.userId);
    res.json(notifications);
  });

  app.get("/api/drivers/status", (req, res) => {
    try {
      const available = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'driver' AND status = 'online' AND accountStatus = 'active'").get() as any;
      const busy = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'driver' AND status = 'busy' AND accountStatus = 'active'").get() as any;
      res.json({ available: available.count, busy: busy.count });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch driver status" });
    }
  });

  // --- CONFIG / SECTORS ---
  app.get("/api/config/:key", (req, res) => {
    const row = db.prepare("SELECT value FROM config WHERE key = ?").get(req.params.key) as any;
    res.json(row ? JSON.parse(row.value) : {});
  });

  app.get("/api/sectors", (req, res) => {
    res.json(db.prepare("SELECT * FROM sectors WHERE isActive = 1").all());
  });

  app.post("/api/sectors", authenticate, (req: any, res) => {
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ error: "Access denied" });
    }
    const { name, city, isActive } = req.body;
    const id = uuidv4();
    try {
      db.prepare("INSERT INTO sectors (id, name, city, isActive) VALUES (?, ?, ?, ?)")
        .run(id, name, city || 'Ouagadougou', isActive === false ? 0 : 1);
      res.json({ id, name, city });
    } catch (err) {
      res.status(500).json({ error: "Failed to create sector" });
    }
  });

  app.delete("/api/sectors/:id", authenticate, (req: any, res) => {
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ error: "Access denied" });
    }
    try {
      db.prepare("DELETE FROM sectors WHERE id = ?").run(req.params.id);
      res.json({ status: "ok" });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete sector" });
    }
  });

  app.get("/api/announcements", (req, res) => {
    res.json(db.prepare("SELECT * FROM announcements ORDER BY createdAt DESC").all());
  });

  app.post("/api/announcements", authenticate, (req: any, res) => {
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ error: "Access denied" });
    }
    const { title, message, type, targetRole, activeUntil } = req.body;
    const id = uuidv4();
    try {
      db.prepare("INSERT INTO announcements (id, title, message, type, targetRole, activeUntil) VALUES (?, ?, ?, ?, ?, ?)")
        .run(id, title, message, type || 'info', targetRole || 'all', activeUntil || null);
      res.json({ id, title });
    } catch (err) {
      res.status(500).json({ error: "Failed to create announcement" });
    }
  });

  app.delete("/api/announcements/:id", authenticate, (req: any, res) => {
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ error: "Access denied" });
    }
    try {
      db.prepare("DELETE FROM announcements WHERE id = ?").run(req.params.id);
      res.json({ status: "ok" });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete announcement" });
    }
  });

  // SAPPAY API Integration
  const SAPPAY_BASE_PUBLIC = "https://api.prod.sappay.net/api/public";
  const SAPPAY_BASE_CHECKOUT = "https://api.prod.sappay.net/api/checkout";

  // Normalisation du numéro : Format international (226XXXXXXXX)
  const normalizePhoneNumber = (phone: string) => {
    let clean = phone.replace(/\D/g, "");
    // Si c'est 8 chiffres (Burkina sans préfixe), on ajoute 226
    if (clean.length === 8) return `226${clean}`;
    return clean;
  };

  // Scanner d'objet recursif pour trouver l'ID de facture (invoice_id, id, etc.)
  const findInvoiceId = (obj: any): string | null => {
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
        username: username,
        password: password,
      }),
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
        }),
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
    } catch (error: any) {
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
        }),
      });
      const data = await response.json();
      res.status(response.status).json(data);
    } catch (error: any) {
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
        }),
      });
      const data = await response.json();
      res.status(response.status).json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // --- ADMIN ENDPOINTS ---
  app.get("/api/admin/users", authenticate, (req: any, res) => {
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ error: "Access denied" });
    }
    const users = db.prepare("SELECT * FROM users").all() as any[];
    users.forEach(u => delete u.password);
    res.json(users);
  });

  app.patch("/api/admin/users/:userId", authenticate, (req: any, res) => {
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ error: "Access denied" });
    }
    const { userId } = req.params;
    const updates = req.body;
    const fields = Object.keys(updates).filter(k => k !== 'userId' && k !== 'id' && k !== 'password');
    if (fields.length === 0) return res.json({ status: "no changes" });

    const setClause = fields.map(f => `${f} = ?`).join(", ");
    const values = fields.map(f => typeof updates[f] === 'object' ? JSON.stringify(updates[f]) : updates[f]);
    
    try {
      const stmt = db.prepare(`UPDATE users SET ${setClause} WHERE userId = ?`);
      stmt.run(...values, userId);
      res.json({ status: "ok" });
    } catch (err) {
      res.status(500).json({ error: "Update failed" });
    }
  });

  app.patch("/api/admin/users/:userId/role", authenticate, (req: any, res) => {
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ error: "Access denied" });
    }
    const { userId } = req.params;
    const { role } = req.body;
    try {
      db.prepare("UPDATE users SET role = ? WHERE userId = ?").run(role, userId);
      res.json({ status: "ok" });
    } catch (err) {
      res.status(500).json({ error: "Failed to update role" });
    }
  });

  app.delete("/api/admin/users/:userId", authenticate, (req: any, res) => {
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ error: "Superadmin only" });
    }
    const { userId } = req.params;
    try {
      db.prepare("DELETE FROM users WHERE userId = ?").run(userId);
      res.json({ status: "ok" });
    } catch (err) {
      res.status(500).json({ error: "Delete failed" });
    }
  });

  app.post("/api/admin/users", authenticate, async (req: any, res) => {
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ error: "Admin only" });
    }
    const { name, email, password, role, ...rest } = req.body;
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const userId = uuidv4();
      const fields = ['id', 'userId', 'name', 'email', 'password', 'role', ...Object.keys(rest)];
      const placeholders = fields.map(() => '?').join(', ');
      const values = [userId, userId, name, email, hashedPassword, role, ...Object.values(rest).map(v => typeof v === 'object' ? JSON.stringify(v) : v)];
      
      const stmt = db.prepare(`INSERT INTO users (${fields.join(', ')}) VALUES (${placeholders})`);
      stmt.run(...values);
      res.json({ userId, name, email, role });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/reset", authenticate, (req: any, res) => {
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ error: "Superadmin only" });
    }
    try {
      db.prepare("DELETE FROM deliveries").run();
      db.prepare("DELETE FROM messages").run();
      db.prepare("DELETE FROM notifications").run();
      db.prepare("DELETE FROM users WHERE role NOT IN ('admin', 'superadmin')").run();
      res.json({ status: "ok" });
    } catch (err) {
      res.status(500).json({ error: "Reset failed" });
    }
  });

  app.post("/api/admin/seed", authenticate, (req: any, res) => {
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ error: "Admin only" });
    }
    try {
      // Seed a client and a driver if they don't exist
      const clientId = 'client_test_seed';
      const driverId = 'driver_test_seed';
      
      db.prepare("INSERT OR IGNORE INTO users (id, userId, name, email, role, accountStatus) VALUES (?, ?, ?, ?, ?, ?)")
        .run(clientId, clientId, 'Client Test', 'client_test@example.com', 'client', 'active');
      
      db.prepare("INSERT OR IGNORE INTO users (id, userId, name, email, role, accountStatus, status, vehicleType) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .run(driverId, driverId, 'Livreur Test', 'driver_test@example.com', 'driver', 'active', 'online', 'Moto');

      // Seed some deliveries
      const d1Id = uuidv4();
      db.prepare(`
        INSERT INTO deliveries (id, clientId, clientName, origin, destination, cost, status, pickupCode, deliveryCode)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(d1Id, clientId, 'Client Test', JSON.stringify({ address: 'Marché Rood Woko', lat: 12.368, lng: -1.530 }), JSON.stringify({ address: 'ZAD', lat: 12.345, lng: -1.500 }), 1500, 'pending', '1A2B3C', 'X9Y8Z7');

      res.json({ status: "ok" });
    } catch (err) {
      res.status(500).json({ error: "Seed failed" });
    }
  });

  app.post("/api/config/:key", authenticate, (req: any, res) => {
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ error: "Access denied" });
    }
    const { key } = req.params;
    const value = JSON.stringify(req.body);
    try {
      db.prepare("INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)").run(key, value);
      res.json({ status: "ok" });
    } catch (err) {
      res.status(500).json({ error: "Failed to update config" });
    }
  });

  // Initial Seeding
  const seedConfig = () => {
    const hasConfig = db.prepare("SELECT key FROM config WHERE key = 'app_config'").get();
    if (!hasConfig) {
      db.prepare("INSERT INTO config (key, value) VALUES (?, ?)").run('app_config', JSON.stringify({
        mode: 'prod',
        isMaintenanceMode: false,
        updatedAt: new Date().toISOString()
      }));
    }
    
    const hasCommissions = db.prepare("SELECT key FROM config WHERE key = 'commissions'").get();
    if (!hasCommissions) {
      db.prepare("INSERT INTO config (key, value) VALUES (?, ?)").run('commissions', JSON.stringify({
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
      const existingAdmin = db.prepare("SELECT * FROM users WHERE email = ?").get(adminEmail);
      if (!existingAdmin) {
        console.log("Seeding default super-admin...");
        const hashedPassword = await bcrypt.hash(adminPass, 10);
        const userId = uuidv4();
        db.prepare("INSERT INTO users (id, userId, name, email, password, role, accountStatus) VALUES (?, ?, ?, ?, ?, ?, ?)")
          .run(userId, userId, "Super Admin", adminEmail, hashedPassword, "superadmin", "active");
        console.log("Default super-admin created successfully.");
      }
    } catch (err) {
      console.error("Failed to seed admin:", err);
    }
  };

  seedAdmin();

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.patch("/api/notifications/:id/read", authenticate, (req: any, res) => {
    try {
      db.prepare("UPDATE notifications SET isRead = 1 WHERE id = ? AND userId = ?").run(req.params.id, req.user.userId);
      res.json({ status: "ok" });
    } catch (err) {
      res.status(500).json({ error: "Update notification failed" });
    }
  });

  app.delete("/api/notifications/:id", authenticate, (req: any, res) => {
    try {
      db.prepare("DELETE FROM notifications WHERE id = ? AND userId = ?").run(req.params.id, req.user.userId);
      res.json({ status: "ok" });
    } catch (err) {
      res.status(500).json({ error: "Delete notification failed" });
    }
  });

  // Bids API
  app.get("/api/deliveries/:id/bids", authenticate, (req: any, res) => {
    try {
      const bids = db.prepare("SELECT * FROM bids WHERE deliveryId = ?").all(req.params.id);
      res.json(bids);
    } catch (err) {
      res.status(500).json({ error: "Fetch bids failed" });
    }
  });

  app.post("/api/deliveries/:id/bids", authenticate, (req: any, res) => {
    const { id } = req.params;
    const { price, proposedTime, reason } = req.body;
    try {
      const bidId = `${id}_${req.user.userId}`;
      db.prepare(`
        INSERT OR REPLACE INTO bids (id, deliveryId, driverId, driverName, price, proposedTime, reason, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).run(bidId, id, req.user.userId, req.user.name, price, proposedTime, reason);
      res.json({ status: "ok", id: bidId });
    } catch (err) {
      res.status(500).json({ error: "Place bid failed" });
    }
  });

  app.post("/api/deliveries/:id/tracking", authenticate, (req: any, res) => {
    const { id } = req.params;
    const { lat, lng } = req.body;
    try {
      const trackingId = uuidv4();
      db.prepare(`
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

