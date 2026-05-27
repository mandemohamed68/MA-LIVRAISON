import mysql2 from 'mysql2';
// @ts-ignore
import SyncMysql from 'sync-mysql';

export default function initMariaDB() {
  console.log("Connecté à MariaDB via sync-mysql.");

  const connection = new SyncMysql({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'pancho_livraison_db',
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306,
    multipleStatements: true
  });

  // MIGRATION: Auto-add withdrawalPhone column if missing
  try {
    connection.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS withdrawalPhone varchar(50) DEFAULT NULL AFTER phone");
    connection.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS rib varchar(255) DEFAULT NULL AFTER withdrawalPhone");
    connection.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS idCardFront text DEFAULT NULL AFTER rib");
    connection.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS idCardBack text DEFAULT NULL AFTER idCardFront");
    connection.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS guarantorName varchar(255) DEFAULT NULL AFTER idCardBack");
    connection.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS guarantorPhone varchar(50) DEFAULT NULL AFTER guarantorName");
    connection.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS guarantorCniUrl text DEFAULT NULL AFTER guarantorPhone");
    console.log("MariaDB: Vérification/Ajout des colonnes de profil réussie.");
  } catch (err: any) {
    console.warn("Migration MariaDB (profil) ignorée ou échouée:", err.message);
  }

  return {
    prepare: (sql: string) => {
      // Ignore SQLite pragmas
      if (sql.trim().toUpperCase().startsWith('PRAGMA')) {
         return { get: () => ({}), all: () => ([]), run: () => ({ changes: 0 }) };
      }
      
      const execute = (args: any[]) => {
         let formattedSql = sql;
         // better-sqlite3 boolean param logic
         const processedArgs = args.map(arg => typeof arg === 'boolean' ? (arg ? 1 : 0) : arg);
         
         if (processedArgs && processedArgs.length > 0) {
            formattedSql = mysql2.format(sql, processedArgs);
         }
         try {
           const result = connection.query(formattedSql);
           return result;
         } catch(e: any) {
           console.error("MariaDB query error:", e.message, "\\nSQL:", formattedSql);
           throw e;
         }
      };

      return {
        get: (...args: any[]) => {
           const res = execute(args);
           if (Array.isArray(res) && res.length > 0) return res[0];
           return undefined;
        },
        all: (...args: any[]) => {
           const res = execute(args);
           if (Array.isArray(res)) return res;
           return [];
        },
        run: (...args: any[]) => {
           const res = execute(args);
           return {
             changes: res.affectedRows || 0,
             lastInsertRowid: res.insertId || 0
           };
        }
      }
    },
    exec: (sql: string) => {
       if (sql.trim().toUpperCase().startsWith('PRAGMA')) return;
       try {
         connection.query(sql);
       } catch (err: any) {
         console.warn("DB exec warning:", err.message);
       }
    },
    transaction: (cb: Function) => {
      return (...args: any[]) => {
        connection.query("START TRANSACTION");
        try {
          const res = cb(...args);
          connection.query("COMMIT");
          return res;
        } catch(e) {
          connection.query("ROLLBACK");
          throw e;
        }
      };
    },
    close: () => {
      if (connection.dispose) connection.dispose();
    }
  };
}
