import path from "path";
import dotenv from "dotenv";

// Initialisation robuste de dotenv avant tout import de module de base de données
dotenv.config();
dotenv.config({ path: path.join(process.cwd(), ".env") });
try {
  dotenv.config({ path: path.join(__dirname, ".env") });
  dotenv.config({ path: path.join(__dirname, "..", ".env") });
  dotenv.config({ path: path.join(__dirname, "..", "..", ".env") });
} catch (e) {
  // Ignored
}

import initMariaDB from './mariadb.js';
import initSQLiteDB from './sqlite.js';

const useMariaDB = process.env.DB_HOST !== undefined;

let db: any;

if (useMariaDB) {
  db = initMariaDB();
} else {
  db = initSQLiteDB();
}

export default db;

