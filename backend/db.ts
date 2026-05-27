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

