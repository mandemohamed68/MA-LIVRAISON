import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const useMariaDB = process.env.DB_HOST !== undefined;

let db: any;

if (useMariaDB) {
  db = require('./mariadb.ts').default;
} else {
  db = require('./sqlite.ts').default;
}

export default db;
