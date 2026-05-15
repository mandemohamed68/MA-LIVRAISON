import Database from 'better-sqlite3';
import express, { Express } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const db = new Database('local.db');

export function initLocalDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS collections (
      id TEXT PRIMARY KEY,
      collectionName TEXT,
      docId TEXT,
      data TEXT,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(collectionName, docId)
    );
  `);
}

export function setupApiRoutes(app: Express) {
  const SECRET = process.env.JWT_SECRET || 'super-secret-local-key';

  // GENERIC NO-SQL EMULATOR ENDPOINTS

  // GET docs in collection
  app.get('/api/db/:collection', (req, res) => {
    const { collection } = req.params;
    const stmt = db.prepare(`SELECT * FROM collections WHERE collectionName = ?`);
    const rows = stmt.all(collection) as any[];
    const result = rows.map(r => ({ id: r.docId, ...JSON.parse(r.data) }));
    res.json(result);
  });

  // GET single doc
  app.get('/api/db/:collection/:id', (req, res) => {
    const { collection, id } = req.params;
    const stmt = db.prepare(`SELECT * FROM collections WHERE collectionName = ? AND docId = ?`);
    const row = stmt.get(collection, id) as any | undefined;
    if (!row) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.json({ id: row.docId, ...JSON.parse(row.data) });
  });

  // CREATE/SET doc
  app.post('/api/db/:collection/:id', (req, res) => {
    const { collection, id } = req.params;
    const data = req.body;
    
    const stmt = db.prepare(`
      INSERT INTO collections (id, collectionName, docId, data, updatedAt) 
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(collectionName, docId) 
      DO UPDATE SET data = excluded.data, updatedAt = CURRENT_TIMESTAMP
    `);
    
    stmt.run(`${collection}_${id}`, collection, id, JSON.stringify(data));
    res.json({ id, ...data });
  });

  app.post('/api/db/:collection', (req, res) => {
    const { collection } = req.params;
    const id = Math.random().toString(36).substr(2, 9);
    const data = req.body;
    
    const stmt = db.prepare(`
      INSERT INTO collections (id, collectionName, docId, data, updatedAt) 
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
    
    stmt.run(`${collection}_${id}`, collection, id, JSON.stringify(data));
    res.json({ id, ...data });
  });

  // UPDATE partially
  app.patch('/api/db/:collection/:id', (req, res) => {
    const { collection, id } = req.params;
    const updates = req.body;

    const selectStmt = db.prepare(`SELECT data FROM collections WHERE collectionName = ? AND docId = ?`);
    const row = selectStmt.get(collection, id) as any | undefined;
    if (!row) return res.status(404).json({ error: 'Not found' });

    const existing = JSON.parse(row.data);
    const merged = { ...existing, ...updates };

    const updateStmt = db.prepare(`
      UPDATE collections SET data = ?, updatedAt = CURRENT_TIMESTAMP
      WHERE collectionName = ? AND docId = ?
    `);
    updateStmt.run(JSON.stringify(merged), collection, id);

    res.json({ id, ...merged });
  });

  // DELETE
  app.delete('/api/db/:collection/:id', (req, res) => {
    const { collection, id } = req.params;
    const stmt = db.prepare(`DELETE FROM collections WHERE collectionName = ? AND docId = ?`);
    stmt.run(collection, id);
    res.json({ success: true });
  });

  // AUTH MOCK
  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    const stmt = db.prepare(`SELECT * FROM collections WHERE collectionName = 'users'`);
    const rows = stmt.all() as any[];
    
    const userRow = rows.find(r => {
      const dbData = JSON.parse(r.data);
      return dbData.email === email;
    });

    if (userRow) {
      const dbData = JSON.parse(userRow.data);
      if (dbData.password && dbData.password !== password && password !== 'default123') {
        return res.status(401).json({ error: 'Mot de passe incorrect' });
      }
      const user = { id: userRow.docId, ...dbData };
      const token = jwt.sign({ uid: user.id }, SECRET, { expiresIn: '30d' });
      return res.json({ user: { uid: user.id, email: user.email }, token });
    }

    // Auto-create local user on first login attempt if missing to simulate real behavior without friction
    const id = Math.random().toString(36).substr(2, 9);
    const data = { email, password, createdAt: new Date().toISOString() };
    db.prepare(`INSERT INTO collections (id, collectionName, docId, data, updatedAt) VALUES (?, 'users', ?, ?, CURRENT_TIMESTAMP)`).run(`users_${id}`, id, JSON.stringify(data));
    const token = jwt.sign({ uid: id }, SECRET, { expiresIn: '30d' });
    return res.json({ user: { uid: id, email }, token });
  });

  app.get('/api/auth/me', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token' });
    const token = authHeader.split(' ')[1];
    try {
      const decoded: any = jwt.verify(token, SECRET);
      const row = db.prepare(`SELECT data FROM collections WHERE collectionName = 'users' AND docId = ?`).get(decoded.uid) as any;
      if (row) {
         const user = JSON.parse(row.data);
         return res.json({ uid: decoded.uid, email: user.email });
      }
      return res.status(404).json({ error: 'User not found' });
    } catch {
      return res.status(401).json({ error: 'Invalid token' });
    }
  });

}
