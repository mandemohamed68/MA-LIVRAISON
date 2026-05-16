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
  const PORT = 3000;

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

  // --- MIDDLEWARE AUTH ---
  const authenticate = (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "No token provided" });
    const token = authHeader.split(" ")[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      req.user = decoded;
      next();
    } catch (err) {
      res.status(401).json({ error: "Invalid token" });
    }
  };

  // --- AUTH ENDPOINTS ---
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

  app.patch("/api/profile", authenticate, (req: any, res) => {
    const updates = req.body;
    const fields = Object.keys(updates).filter(k => k !== 'userId' && k !== 'id' && k !== 'password');
    if (fields.length === 0) return res.json({ status: "no changes" });

    const setClause = fields.map(f => `${f} = ?`).join(", ");
    const values = fields.map(f => typeof updates[f] === 'object' ? JSON.stringify(updates[f]) : updates[f]);
    
    try {
      const stmt = db.prepare(`UPDATE users SET ${setClause} WHERE userId = ?`);
      stmt.run(...values, req.user.userId);
      res.json({ status: "ok" });
    } catch (err) {
      res.status(500).json({ error: "Update failed" });
    }
  });

  // --- DELIVERY ENDPOINTS ---
  app.post("/api/deliveries", authenticate, (req: any, res) => {
    const d = req.body;
    const id = uuidv4();
    try {
      const stmt = db.prepare(`
        INSERT INTO deliveries (id, clientId, clientName, origin, destination, cost, status, pickupCode, deliveryCode)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        id, req.user.userId, d.clientName, 
        JSON.stringify(d.from), JSON.stringify(d.to), 
        d.cost, "pending", 
        Math.random().toString(36).substr(2, 6).toUpperCase(),
        Math.random().toString(36).substr(2, 6).toUpperCase()
      );
      res.json({ id });
    } catch (err) {
      res.status(500).json({ error: "Creation failed" });
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
      d.origin = JSON.parse(d.origin);
      d.destination = JSON.parse(d.destination);
      if (d.rejectedBy) d.rejectedBy = JSON.parse(d.rejectedBy);
    });
    res.json(deliveries);
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

  // --- CONFIG / SECTORS ---
  app.get("/api/config/:key", (req, res) => {
    const row = db.prepare("SELECT value FROM config WHERE key = ?").get(req.params.key) as any;
    res.json(row ? JSON.parse(row.value) : {});
  });

  app.get("/api/sectors", (req, res) => {
    res.json(db.prepare("SELECT * FROM sectors WHERE isActive = 1").all());
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

