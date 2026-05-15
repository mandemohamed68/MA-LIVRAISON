import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import dotenv from "dotenv";

import mysql from "mysql2/promise";

dotenv.config();

/**
 * SERVEUR EXPRESS DE PRODUCTION - MODE SQL
 * ---------------------------------------
 * Remplace Firestore par MariaDB/MySQL pour les données (Utilisateurs, Livraisons).
 */

async function startServer() {
  const app = express();
  // Utilisation du port 3005 pour éviter conflit avec Metabase sur 3000
  const PORT = process.env.PORT || 3005;

  app.use(express.json());

  // Configuration de la base de données SQL
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'livra_user',
    password: process.env.DB_PASS || 'password',
    database: process.env.DB_NAME || 'livra_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  // Test de connexion SQL au démarrage
  try {
    const conn = await pool.getConnection();
    console.log("✅ Connecté avec succès à la base de données SQL.");
    conn.release();
  } catch (err: any) {
    console.error("❌ Erreur critique de connexion SQL :", err.message);
  }

  // Permettre les requêtes CORS
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    if (req.method === 'OPTIONS') {
        res.header('Access-Control-Allow-Methods', 'PUT, POST, PATCH, DELETE, GET');
        return res.status(200).json({});
    }
    next();
  });

  // ==========================================
  // 1. GESTION DES UTILISATEURS (Remplace Firestore 'users')
  // ==========================================

  app.get("/api/users", async (req, res) => {
    try {
      const [rows] = await pool.query('SELECT * FROM users ORDER BY createdAt DESC');
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/users/:id", async (req, res) => {
    try {
      const updates = req.body;
      const keys = Object.keys(updates);
      if (keys.length === 0) return res.json({ success: true });

      const setClause = keys.map(k => `${k} = ?`).join(', ');
      const values = keys.map(k => updates[k]);
      values.push(req.params.id);

      await pool.query(`UPDATE users SET ${setClause} WHERE userId = ?`, values);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/users/:id", async (req, res) => {
    try {
      const [rows]: any = await pool.query('SELECT * FROM users WHERE userId = ?', [req.params.id]);
      if (rows.length === 0) return res.status(404).json({ error: "User not found" });
      res.json(rows[0]);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/users", async (req, res) => {
    try {
      const { userId, name, email, role, phone, avatarUrl, accountStatus } = req.body;
      const query = `
        INSERT INTO users (userId, name, email, role, phone, avatarUrl, accountStatus, updatedAt) 
        VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE 
        name = VALUES(name), email = VALUES(email), role = VALUES(role), 
        phone = VALUES(phone), avatarUrl = VALUES(avatarUrl), 
        accountStatus = VALUES(accountStatus), updatedAt = NOW()
      `;
      await pool.query(query, [userId, name, email, role, phone || null, avatarUrl || null, accountStatus || 'active']);
      res.json({ success: true, message: "User profile synchronized" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // 2. GESTION DES LIVRAISONS (Remplace Firestore 'deliveries')
  // ==========================================

  app.get("/api/deliveries", async (req, res) => {
    try {
      const { clientId, driverId, status } = req.query;
      let q = 'SELECT * FROM deliveries WHERE 1=1';
      let params = [];
      
      if (clientId) { q += ' AND clientId = ?'; params.push(clientId); }
      if (driverId) { q += ' AND driverId = ?'; params.push(driverId); }
      if (status) { q += ' AND status = ?'; params.push(status); }
      
      q += ' ORDER BY createdAt DESC LIMIT 100';

      const [rows] = await pool.query(q, params);
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/deliveries/:id", async (req, res) => {
    try {
      const [rows]: any = await pool.query('SELECT * FROM deliveries WHERE id = ?', [req.params.id]);
      if (rows.length === 0) return res.status(404).json({ error: "Delivery not found" });
      res.json(rows[0]);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/deliveries", async (req, res) => {
    try {
      const data = req.body;
      const query = `
        INSERT INTO deliveries 
        (id, clientId, driverId, status, fromAddress, toAddress, fromLat, fromLng, toLat, toLng, cost, packageSize, description, pickupTime, contactName, contactPhone, paymentStatus, createdAt, updatedAt) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `;
      await pool.query(query, [
        data.id, data.clientId, data.driverId || null, data.status || 'pending', 
        data.fromAddress, data.toAddress, data.fromLat, data.fromLng, data.toLat, data.toLng,
        data.cost, data.packageSize, data.description, data.pickupTime, data.contactName, data.contactPhone,
        data.paymentStatus || 'pending'
      ]);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/deliveries/:id", async (req, res) => {
    try {
      const updates = req.body;
      const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ');
      const values = [...Object.values(updates), req.params.id];
      
      const query = `UPDATE deliveries SET ${fields}, updatedAt = NOW() WHERE id = ?`;
      await pool.query(query, values);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/deliveries/:id", async (req, res) => {
    try {
      await pool.query('DELETE FROM deliveries WHERE id = ?', [req.params.id]);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // 3. GESTION DES MESSAGES (CHAT)
  // ==========================================

  app.get("/api/deliveries/:id/messages", async (req, res) => {
    try {
      const [rows] = await pool.query('SELECT * FROM messages WHERE deliveryId = ? ORDER BY createdAt ASC', [req.params.id]);
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/deliveries/:id/messages", async (req, res) => {
    try {
      const { senderId, text, isAdmin } = req.body;
      await pool.query('INSERT INTO messages (deliveryId, senderId, text, isAdmin) VALUES (?, ?, ?, ?)', 
        [req.params.id, senderId, text, isAdmin || false]);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // 3.B GESTION DES OFFRES (BIDS)
  // ==========================================

  app.get("/api/deliveries/:id/bids", async (req, res) => {
    try {
      const [rows] = await pool.query('SELECT * FROM bids WHERE deliveryId = ? ORDER BY price ASC', [req.params.id]);
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/deliveries/:id/bids", async (req, res) => {
    try {
      const { driverId, driverName, price, timeEstimateMins } = req.body;
      await pool.query('INSERT INTO bids (deliveryId, driverId, driverName, price, timeEstimateMins) VALUES (?, ?, ?, ?, ?)', 
        [req.params.id, driverId, driverName, price, timeEstimateMins]);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // 4. GESTION DES NOTIFICATIONS
  // ==========================================

  app.get("/api/notifications/:userId", async (req, res) => {
    try {
      const [rows] = await pool.query('SELECT * FROM notifications WHERE userId = ? ORDER BY createdAt DESC LIMIT 50', [req.params.userId]);
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/notifications/:id/read", async (req, res) => {
    try {
      await pool.query('UPDATE notifications SET isRead = TRUE WHERE id = ?', [req.params.id]);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // 5. INTÉGRATION SAPPAY (Conservée)
  // ==========================================
  const SAPPAY_BASE_PUBLIC = "https://api.prod.sappay.net/api/public";
  const SAPPAY_BASE_CHECKOUT = "https://api.prod.sappay.net/api/checkout";

  // Normalisation du numéro : Format international (226XXXXXXXX)
  const normalizePhoneNumber = (phone: string) => {
    let clean = phone.replace(/\D/g, "");
    // Si c'est 8 chiffres (Burkina sans préfixe), on ajoute 226
    if (clean.length === 8) return `226${clean}`;
    // Si c'est déjà 11 chiffres commençant par 226, on garde tel quel
    // Sinon on laisse l'utilisateur gérer l'erreur API si le format est invalide
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
      const errorBody = await response.text();
      console.error("Sappay Auth API Error Body:", errorBody);
      // Inclure les 4 premiers caractères du client_id pour vérification visuelle dans les logs
      const cidPrefix = clientId ? clientId.substring(0, 4) : "NONE";
      throw new Error(`Sappay Authentication Failed for Client ${cidPrefix}... : ${response.status} ${response.statusText}. Check your credentials in Secrets.`);
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
      console.error("Sappay Init Error:", error);
      res.status(500).json({ 
        error: "Failed to initialize Sappay payment", 
        message: error.message || "Unknown error" 
      });
    }
  });

  app.post("/api/payment/sappay/get-otp", async (req, res) => {
    try {
      const { customer_msisdn, invoice_id, payment_processor_id, access_token } = req.body;
      const normalizedPhone = normalizePhoneNumber(customer_msisdn);
      
      const response = await fetch(`${SAPPAY_BASE_CHECKOUT}/get-otp/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${access_token}`
        },
        body: JSON.stringify({
          customer_msisdn: normalizedPhone,
          invoice_id,
          payment_processor_id
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        return res.status(response.status).json(data);
      }
      res.json(data);
    } catch (error: any) {
      console.error("Sappay Get OTP Error:", error);
      res.status(500).json({ 
        error: "Failed to get OTP",
        message: error.message || "Unknown error"
      });
    }
  });

  app.post("/api/payment/sappay/perform", async (req, res) => {
    try {
      const { invoice_id, payment_processor_id, customer_msisdn, otp, access_token, trans_id } = req.body;
      const normalizedPhone = normalizePhoneNumber(customer_msisdn);
      
      const body: any = {
        invoice_id,
        payment_processor_id,
        customer_msisdn: normalizedPhone,
        otp: otp.toString()
      };
      if (trans_id) body.trans_id = trans_id;

      const response = await fetch(`${SAPPAY_BASE_CHECKOUT}/perform/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${access_token}`
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      if (!response.ok) {
        return res.status(response.status).json(data);
      }
      res.json(data);
    } catch (error: any) {
      console.error("Sappay Perform Error:", error);
      res.status(500).json({ 
        error: "Failed to perform payment",
        message: error.message || "Unknown error"
      });
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

  // ==========================================
  // API CONFIG / SETTINGS
  // ==========================================
  app.get("/api/settings/app_config", (req, res) => {
    // Current hardcoded or fetch from DB if we move settings to DB later
    // For now, return a default config if not found
    res.json({
        appName: "LIVRA EXPRESS",
        currency: "FCFA",
        supportPhone: "+22600000000",
        maintenanceMode: false,
        mode: "production",
        updatedAt: new Date().toISOString()
    });
  });

  app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
