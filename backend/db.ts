const useMariaDB = process.env.DB_HOST !== undefined;

let db: any;

if (useMariaDB) {
  db = require('./mariadb').default;
} else {
  db = require('./sqlite').default;
}

export default db;

