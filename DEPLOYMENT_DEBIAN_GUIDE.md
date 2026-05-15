# Guide de déploiement Livra EXPRESS sur Debian 12 (MariaDB + Node.js)

Ce guide explique comment migrer l'application d'un backend Firebase vers un backend auto-hébergé sur votre serveur Debian 12 avec MariaDB.

## 1. Préparation du serveur Debian 12

### Mise à jour du système
```bash
sudo apt update && sudo apt upgrade -y
```

### Installation de Node.js (Version LTS)
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### Installation de MariaDB
```bash
sudo apt install -y mariadb-server
sudo mysql_secure_installation
```

## 2. Configuration de la base de données

Connectez-vous à MariaDB :
```bash
sudo mysql -u root -p
```

Exécutez le script contenu dans `MARIADB_SCHEMA.sql` (ou importez-le) :
```sql
SOURCE /chemin/vers/votre/projet/MARIADB_SCHEMA.sql;
```

Créez un utilisateur spécifique pour l'application :
```sql
CREATE USER 'livra_user'@'localhost' IDENTIFIED BY 'votre_mot_de_passe_robuste';
GRANT ALL PRIVILEGES ON livra_express.* TO 'livra_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

## 3. Adaptation du Backend (Full-Stack)

Pour utiliser MariaDB à la place de Firebase, vous devez :

1.  **Transformer l'application en Full-Stack (Express + Vite)** :
    *   Créez un fichier `server.ts` à la racine.
    *   Installez les dépendances : `npm install express mysql2 dotenv`
2.  **Créer une couche API** :
    *   Remplacez les appels `onSnapshot`, `addDoc`, etc., par des appels à votre propre API (`/api/deliveries`, etc.).
3.  **Gérer l'Authentification** :
    *   Vous pouvez continuer à utiliser Firebase Auth pour la connexion (gratuit et illimité pour Google/Email) et stocker les profils utilisateurs dans MariaDB après la connexion SSH/OAuth.

## 4. Script de Migration (Firebase vers SQL)

Pour transférer vos données actuelles, vous pouvez utiliser un script Node.js temporaire qui :
1. Lit les collections Firestore.
2. Insère les données dans MariaDB en respectant les types.

```javascript
// Exemple simplifié de script de migration (migration.js)
const admin = require('firebase-admin');
const mysql = require('mysql2/promise');

async function migrate() {
  const dbSql = await mysql.createConnection({
    host: 'localhost', user: 'livra_user', password: '...', database: 'livra_express'
  });

  // Initialisation Firebase Admin avec votre clé de service
  // ...

  const usersSnap = await admin.firestore().collection('users').get();
  for (const doc of usersSnap.docs) {
    const u = doc.data();
    await dbSql.execute(
      'INSERT INTO users (userId, name, email, role, createdAt) VALUES (?, ?, ?, ?, ?)',
      [doc.id, u.name, u.email, u.role, u.createdAt]
    );
  }
  console.log('Migration terminée !');
}
```

## 5. Déploiement avec PM2

Installez PM2 pour gérer le processus en arrière-plan :
```bash
sudo npm install -g pm2
pm2 start dist/server.cjs --name "livra-app"
pm2 save
pm2 startup
```

## 6. Configuration de Nginx (Reverse Proxy)

Installez Nginx pour servir l'application sur le port 80/443 :
```bash
sudo apt install -y nginx
```

Configurez un site dans `/etc/nginx/sites-available/livra-express` :
```nginx
server {
    listen 80;
    server_name votre-domaine.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Activez le site et relancez Nginx :
```bash
sudo ln -s /etc/nginx/sites-available/livra-express /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```
