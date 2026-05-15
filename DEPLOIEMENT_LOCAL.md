# Guide de Déploiement Local - Debian 12 + MariaDB

Ce guide documente la procédure pour migrer l'application **Livra Express** d'un environnement Cloud (Firebase/Vite) vers un serveur local sous **Debian 12**.

## 1. Préparation du Serveur Debian 12

### Mise à jour du système
```bash
sudo apt update && sudo apt upgrade -y
```

### Installation de MariaDB
```bash
sudo apt install mariadb-server -y
sudo mysql_secure_installation
```

### Installation de Node.js (via NVM de préférence)
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 20
```

### Installation d'un serveur Web (Nginx)
```bash
sudo apt install nginx -y
```

---

## 2. Configuration de la Base de Données

1. Connectez-vous à MariaDB :
   ```bash
   sudo mysql -u root -p
   ```
2. Exécutez le contenu du fichier `database_migration.sql` joint.
3. Créez un utilisateur spécifique pour l'application :
   ```sql
   CREATE USER 'livra_user'@'localhost' IDENTIFIED BY 'votre_mot_de_passe_robuste';
   GRANT ALL PRIVILEGES ON livra_db.* TO 'livra_user'@'localhost';
   FLUSH PRIVILEGES;
   ```

---

## 3. Migration du Code Source

1. Clonez votre projet sur le serveur (ou transférez les fichiers via SFTP/SCP).
2. Installez les dépendances :
   ```bash
   npm install
   ```
3. Créez un fichier `.env` à la racine pour les accès MariaDB :
   ```env
   DB_HOST=localhost
   DB_USER=livra_user
   DB_PASS=votre_mot_de_passe_robuste
   DB_NAME=livra_db
   PORT=3000
   NODE_ENV=production
   ```

---

## 4. Adaptation du Backend (server.ts)

Pour utiliser MariaDB à la place de Firestore, le fichier `server.ts` doit être modifié pour inclure une connexion via `mysql2`.

Exemple de connexion à ajouter :
```typescript
import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
});
```

Vous devrez ensuite transformer tous les appels `getDocs`, `addDoc`, `updateDoc` de Firestore en requêtes SQL `SELECT`, `INSERT`, `UPDATE`.

---

## 5. Build et Mise en Production

### Compiler l'application Frontend
```bash
npm run build
```

### Gestion du processus (PM2)
Il est fortement recommandé d'utiliser PM2 pour garder le serveur Node.js actif :
```bash
npm install -g pm2
pm2 start dist/server.cjs --name "livra-express"
pm2 save
pm2 startup
```

---

## 6. Accès Externe (Nginx Reverse Proxy)

Configurez Nginx pour rediriger le trafic du port 80 vers le port 3000 :
Créez `/etc/nginx/sites-available/livra` :
```nginx
server {
    listen 80;
    server_name votre_domaine_ou_ip;

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
Activez le site :
```bash
sudo ln -s /etc/nginx/sites-available/livra /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## Notes Importantes sur l'Authentification

Si vous migrez hors de Firebase entièrement, vous devrez également remplacer **Firebase Auth** par un système local (ex: Passport.js ou JWT avec Bcrypt pour hacher les mots de passe dans la table `users`).
