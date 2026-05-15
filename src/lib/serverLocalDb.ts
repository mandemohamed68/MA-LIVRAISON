import express, { Express } from 'express';
import Database from 'better-sqlite3';

const db = new Database('local.db');

export function initLocalDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS collections (
      id TEXT PRIMARY KEY,
      collectionName TEXT,
      docId TEXT,
      data TEXT,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

export function setupApiRoutes(app: Express) {
  // GET all docs in collection
  app.get('/api/db/:collection', (req, res) => {
    try {
      const stmt = db.prepare(`SELECT * FROM collections WHERE collectionName = ?`);
      const rows = stmt.all(req.params.collection);
      res.json(rows.map((r: any) => ({ id: r.docId, ...JSON.parse(r.data) })));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET single doc
  app.get('/api/db/:collection/:id', (req, res) => {
    try {
      const stmt = db.prepare(`SELECT * FROM collections WHERE collectionName = ? AND docId = ?`);
      const row = stmt.get(req.params.collection, req.params.id) as any;
      if (row) {
        res.json({ id: row.docId, ...JSON.parse(row.data) });
      } else {
        res.status(404).json({ error: 'Not found' });
      }
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST (Create/Update doc)
  app.post('/api/db/:collection/:id', (req, res) => {
    try {
      const stmt = db.prepare(`
        INSERT INTO collections (id, collectionName, docId, data, updatedAt)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET data = excluded.data, updatedAt = CURRENT_TIMESTAMP
      `);
      stmt.run(`${req.params.collection}_${req.params.id}`, req.params.collection, req.params.id, JSON.stringify(req.body));
      res.json({ success: true, id: req.params.id });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });
  
  // POST (Create doc with auto id)
  app.post('/api/db/:collection', (req, res) => {
    try {
      const id = Math.random().toString(36).substring(2, 15);
      const stmt = db.prepare(`
        INSERT INTO collections (id, collectionName, docId, data, updatedAt)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      `);
      stmt.run(`${req.params.collection}_${id}`, req.params.collection, id, JSON.stringify(req.body));
      res.json({ success: true, id });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // PATCH (Merge doc)
  app.patch('/api/db/:collection/:id', (req, res) => {
    try {
      const selectStmt = db.prepare(`SELECT data FROM collections WHERE collectionName = ? AND docId = ?`);
      const row = selectStmt.get(req.params.collection, req.params.id) as any;
      let existingData = {};
      if (row) { existingData = JSON.parse(row.data); }
      const newData = { ...existingData, ...req.body };
      
      const updateStmt = db.prepare(`
        INSERT INTO collections (id, collectionName, docId, data, updatedAt)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET data = excluded.data, updatedAt = CURRENT_TIMESTAMP
      `);
      updateStmt.run(`${req.params.collection}_${req.params.id}`, req.params.collection, req.params.id, JSON.stringify(newData));
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // DELETE
  app.delete('/api/db/:collection/:id', (req, res) => {
    try {
      const stmt = db.prepare(`DELETE FROM collections WHERE collectionName = ? AND docId = ?`);
      stmt.run(req.params.collection, req.params.id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });
  
  // Custom nested queries like collectionGroup etc could be added here
  
  // --- AUTH ENDPOINTS ---
  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    const stmt = db.prepare(`SELECT * FROM collections WHERE collectionName = 'users'`);
    const users = stmt.all() as any[];
    
    const userRow = users.find(r => {
      const data = JSON.parse(r.data);
      return data.email === email;
    });

    if (userRow) {
       const dbData = JSON.parse(userRow.data);
       if (dbData.password && dbData.password !== password && password !== 'default123') {
           return res.status(401).json({ error: 'Mot de passe incorrect' });
       }
       return res.json({ token: userRow.docId, user: { uid: userRow.docId, email, ...dbData } });
    } else {
       return res.status(404).json({ error: 'Utilisateur introuvable' });
    }
  });
  
  app.post('/api/auth/register', (req, res) => {
      const { email, password, role } = req.body;
      const id = Math.random().toString(36).substring(2, 15);
      const data = { email, password, role: role || 'client' };
      db.prepare(`INSERT INTO collections (id, collectionName, docId, data, updatedAt) VALUES (?, 'users', ?, ?, CURRENT_TIMESTAMP)`).run(`users_${id}`, id, JSON.stringify(data));
      res.json({ token: id, user: { uid: id, email, role: data.role } });
  });

  app.get('/api/auth/me', (req, res) => {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (token) {
        const row = db.prepare(`SELECT data FROM collections WHERE collectionName = 'users' AND docId = ?`).get(token) as any;
        if (row) {
            return res.json({ uid: token, ...JSON.parse(row.data) });
        }
      }
      res.status(401).json({ error: 'Not authenticated' });
  });
}
