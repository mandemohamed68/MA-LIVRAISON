import mysql2 from 'mysql2';
// @ts-ignore
import SyncMysql from 'sync-mysql';

function cleanEnvVal(val: string | undefined, defaultVal = ''): string {
  if (!val) return defaultVal;
  let s = val.trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.substring(1, s.length - 1);
  }
  return s;
}

export default function initMariaDB() {
  const host = cleanEnvVal(process.env.DB_HOST, '127.0.0.1');
  const user = cleanEnvVal(process.env.DB_USER, 'root');
  const database = cleanEnvVal(process.env.DB_NAME, 'pancho_express_db');
  const rawPort = cleanEnvVal(process.env.DB_PORT, '3306');
  const port = parseInt(rawPort) || 3306;

  const passwordRaw = process.env.DB_PASSWORD || process.env.DB_PASS || '';

  // Buildez une liste unique de candidats de mots de passe à tester
  const candidates: string[] = [];
  
  // 1. Password brut
  candidates.push(passwordRaw);

  // 2. Password nettoyé (sans guillemets externes si présents)
  const cleaned = cleanEnvVal(passwordRaw);
  if (!candidates.includes(cleaned)) {
    candidates.push(cleaned);
  }

  // 3. Password avec double guillemets explicites (ex: "mm@27071986@")
  const withDoubleQuotes = `"${cleaned}"`;
  if (!candidates.includes(withDoubleQuotes)) {
    candidates.push(withDoubleQuotes);
  }

  // 4. Password avec simple guillemets explicites (ex: 'mm@27071986@')
  const withSingleQuotes = `'${cleaned}'`;
  if (!candidates.includes(withSingleQuotes)) {
    candidates.push(withSingleQuotes);
  }

  console.log(`MariaDB: Tentative de connexion (host=${host}, port=${port}, user=${user}, database=${database}). ${candidates.length} variantes de mot de passe à tester.`);

  let connection: any = null;
  let lastError: any = null;

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    try {
      const conn = new SyncMysql({
        host,
        user,
        password: candidate,
        database,
        port,
        multipleStatements: true,
        charset: 'utf8mb4'
      });
      // Test de la connexion avec une requête simple
      conn.query("SELECT 1");
      connection = conn;
      
      // Ensure database itself is utf8mb4
      try {
        conn.query(`ALTER DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
      } catch (e) {}

      console.log(`MariaDB: Connexion réussie à la tentative ${i + 1}/${candidates.length} (Longueur MDP utilisée: ${candidate.length}) !`);
      break;
    } catch (err: any) {
      console.warn(`MariaDB: Tentative ${i + 1}/${candidates.length} échouée avec mot de passe de longueur ${candidate.length}: ${err.message}`);
      lastError = err;
    }
  }

  if (!connection) {
    console.error("MariaDB: Toutes les tentatives de connexion ont échoué.");
    throw lastError || new Error("Impossible de se connecter à MariaDB avec les configurations de mot de passe fournies.");
  }

  // MIGRATION: Auto-add withdrawalPhone column if missing
  try {
    // Force character set for existing tables
    const tablesToFix = ['users', 'deliveries', 'notifications', 'announcements', 'sectors', 'bids', 'withdrawals', 'config', 'tracking', 'messages', 'promo_codes', 'promo_usages', 'historique_gains'];
    for (const t of tablesToFix) {
      try { connection.query(`ALTER TABLE \`${t}\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`); } catch(e) {}
    }

    connection.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS withdrawalPhone varchar(50) DEFAULT NULL AFTER phone");
    connection.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS rib varchar(255) DEFAULT NULL AFTER withdrawalPhone");
    connection.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS idCardFront text DEFAULT NULL AFTER rib");
    connection.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS idCardBack text DEFAULT NULL AFTER idCardFront");
    connection.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS guarantorName varchar(255) DEFAULT NULL AFTER idCardBack");
    connection.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS guarantorPhone varchar(50) DEFAULT NULL AFTER guarantorName");
    connection.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS guarantorCniUrl text DEFAULT NULL AFTER guarantorPhone");
    connection.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS criminalRecordUrl text DEFAULT NULL AFTER guarantorCniUrl");
    connection.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS verificationStatus varchar(50) DEFAULT 'unverified'");
    connection.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS totalWithdrawn double DEFAULT 0 AFTER earnings");
    try { connection.query("ALTER TABLE users MODIFY COLUMN identityCardUrl LONGTEXT"); } catch(e){}
    try { connection.query("ALTER TABLE users MODIFY COLUMN criminalRecordUrl LONGTEXT"); } catch(e){}
    try { connection.query("ALTER TABLE users MODIFY COLUMN guarantorCniUrl LONGTEXT"); } catch(e){}
    try { connection.query("ALTER TABLE users MODIFY COLUMN idCardFront LONGTEXT"); } catch(e){}
    try { connection.query("ALTER TABLE users MODIFY COLUMN idCardBack LONGTEXT"); } catch(e){}
    connection.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS termsAcceptedAt datetime DEFAULT NULL");
    connection.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS driverType varchar(50) DEFAULT 'freelance'");
    
    // Ensure announcements table has all required columns
    connection.query(`
      CREATE TABLE IF NOT EXISTS announcements (
        id varchar(255) PRIMARY KEY,
        title varchar(255) NOT NULL,
        message text NOT NULL,
        type varchar(50) DEFAULT 'info',
        targetRole varchar(50) DEFAULT 'all',
        activeUntil datetime DEFAULT NULL,
        image_url LONGTEXT,
        createdAt datetime DEFAULT CURRENT_TIMESTAMP,
        updatedAt datetime DEFAULT CURRENT_TIMESTAMP
      ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);
    
    // Update existing announcements table columns if they were created with old schema
    try { connection.query("ALTER TABLE announcements ADD COLUMN IF NOT EXISTS type varchar(50) DEFAULT 'info'"); } catch(e){}
    try { connection.query("ALTER TABLE announcements ADD COLUMN IF NOT EXISTS targetRole varchar(50) DEFAULT 'all'"); } catch(e){}
    try { connection.query("ALTER TABLE announcements ADD COLUMN IF NOT EXISTS activeUntil datetime DEFAULT NULL"); } catch(e){}
    try { connection.query("ALTER TABLE announcements ADD COLUMN IF NOT EXISTS is_active tinyint(1) DEFAULT 1"); } catch(e){}
    try { connection.query("ALTER TABLE announcements ADD COLUMN IF NOT EXISTS image_url LONGTEXT DEFAULT NULL"); } catch(e){}
    
    connection.query("ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS withdrawalInfo text DEFAULT NULL");
    
    // Add missing columns to deliveries table
    try { connection.query("ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS lastMessageAt datetime DEFAULT NULL"); } catch(e){
      console.error("Failed to add lastMessageAt to deliveries:", e.message);
    }
    
    // Create sectors table if it doesn't exist
    connection.query(`
      CREATE TABLE IF NOT EXISTS sectors (
        id varchar(255) PRIMARY KEY,
        name varchar(255) NOT NULL,
        city varchar(255) NOT NULL,
        isActive tinyint(1) DEFAULT 1,
        is_active tinyint(1) DEFAULT 1,
        image_url LONGTEXT DEFAULT NULL,
        createdAt datetime DEFAULT CURRENT_TIMESTAMP,
        updatedAt datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);
    
    // Update existing sectors table
    try { connection.query("ALTER TABLE sectors ADD COLUMN IF NOT EXISTS isActive tinyint(1) DEFAULT 1"); } catch(e){}
    try { connection.query("ALTER TABLE sectors ADD COLUMN IF NOT EXISTS is_active tinyint(1) DEFAULT 1"); } catch(e){}
    try { connection.query("ALTER TABLE sectors ADD COLUMN IF NOT EXISTS image_url LONGTEXT DEFAULT NULL"); } catch(e){}
    try { connection.query("ALTER TABLE sectors ADD COLUMN IF NOT EXISTS updatedAt datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"); } catch(e){}

    // Create bids table if it doesn't exist
    connection.query(`
      CREATE TABLE IF NOT EXISTS bids (
        id varchar(255) PRIMARY KEY,
        deliveryId varchar(255) NOT NULL,
        driverId varchar(255) NOT NULL,
        driverName varchar(255) DEFAULT NULL,
        price double NOT NULL,
        proposedTime int DEFAULT NULL,
        reason text DEFAULT NULL,
        status varchar(50) DEFAULT 'pending',
        attempts int DEFAULT 1,
        createdAt datetime DEFAULT CURRENT_TIMESTAMP,
        updatedAt datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);

    // Create tracking table if it doesn't exist
    connection.query(`
      CREATE TABLE IF NOT EXISTS tracking (
        id varchar(255) PRIMARY KEY,
        deliveryId varchar(255) NOT NULL,
        lat double NOT NULL,
        lng double NOT NULL,
        timestamp datetime DEFAULT CURRENT_TIMESTAMP
      ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);
    
    console.log("MariaDB: Vérification/Ajout des colonnes de profil et système réussie.");
  } catch (err: any) {
    console.warn("Migration MariaDB (profil) ignorée ou échouée:", err.message);
  }

  return {
    engine: 'MariaDB',
    config: {
      host,
      database
    },
    prepare: (sql: string) => {
      // Ignore SQLite pragmas or translate them
      if (sql.trim().toUpperCase().startsWith('PRAGMA')) {
         const pragmaMatch = sql.trim().match(/PRAGMA table_info\((.*?)\)/i);
         if (pragmaMatch && pragmaMatch[1]) {
           const tableName = pragmaMatch[1];
           return {
             get: () => ({}),
             all: () => {
               try {
                 const cols = connection.query(`SHOW COLUMNS FROM ${tableName}`);
                 return cols.map((c: any) => ({ name: c.Field }));
               } catch (e) {
                 return [];
               }
             },
             run: () => ({ changes: 0 })
           };
         }
         return { get: () => ({}), all: () => ([]), run: () => ({ changes: 0 }) };
      }
      
      const execute = (args: any[]) => {
         let formattedSql = sql;
         // SQLite to MariaDB translations
         formattedSql = formattedSql.replace(/INSERT\s+OR\s+IGNORE\s+INTO/i, 'INSERT IGNORE INTO');
         formattedSql = formattedSql.replace(/INSERT\s+OR\s+REPLACE\s+INTO/i, 'REPLACE INTO');

         // better-sqlite3 boolean param logic
         const processedArgs = args.map(arg => typeof arg === 'boolean' ? (arg ? 1 : 0) : arg);
         
         if (processedArgs && processedArgs.length > 0) {
            formattedSql = mysql2.format(formattedSql, processedArgs);
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
