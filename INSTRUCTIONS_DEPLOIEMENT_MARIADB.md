# Guide Détaillé de Déploiement : Debian 12 + MariaDB + Firebase Auth

Ce document rassemble **toutes les étapes pas à pas** pour un déploiement propre sur votre serveur **Debian 12**, en exposant l'App sur le port **3000**, en conservant **Firebase Auth** et en utilisant **MariaDB** pour les données locales. 

Tous les fichiers `.example` sont déjà inclus dans la racine de ce dossier, pour que vous n'ayez que des opérations de copie à faire !

---

## 1. Préparation du système Debian 12

Connectez-vous en SSH à votre serveur et mettez tout à jour :
```bash
sudo apt update && sudo apt upgrade -y
```

**Installez Node.js, Git et Nginx**
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs git nginx
```

---

## 2. Configuration de MariaDB (Étape critique)

Assurez-vous que MariaDB est installé :
```bash
sudo apt install -y mariadb-server
sudo systemctl start mariadb
sudo systemctl enable mariadb
```

Entrez dans le terminal de MariaDB :
```bash
sudo mariadb -u root -p
```
*(Appuyez sur Entrée s'il n'y a pas de mot de passe)*

Créez la base de données et l'utilisateur pour l'application :
```sql
CREATE DATABASE pancho_express_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'pancho_user'@'localhost' IDENTIFIED BY 'mot_de_passe_super_secret';
GRANT ALL PRIVILEGES ON pancho_express_db.* TO 'pancho_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

---

## 3. Clone depuis GitHub

Dirigez-vous dans le répertoire d'hébergement classique :
```bash
sudo mkdir -p /var/www/pancho-express
sudo chown -R $USER:$USER /var/www/pancho-express
cd /var/www/pancho-express

git clone https://github.com/VOTRE_NOM/VOTRE_PROJET.git .
```

---

## 4. Exploiter les fichiers ".example" et préparer l'App

Grâce aux fichiers `.example` fournis, la configuration est un jeu d'enfant.

### Créer le fichier .env
```bash
cp .env.mariadb.example .env
nano .env
```
👉 Changez le mot de passe MariaDB (`DB_PASS`) en `mot_de_passe_super_secret` (ou ce que vous avez rempli). Réinsérez ici vos clés `VITE_FIREBASE` puisqu'on conserve Firebase Auth et Sauvegardez !

### Déployer la base de données MariaDB
Le schéma complet avec les tables `users`, `deliveries`, etc. (ainsi que les partitions de données annuelles pour l'optimisation des performances) vous attend.
```bash
mariadb -u pancho_user -p pancho_express_db < MARIADB_SCHEMA_PARTITIONED.sql
```
*(Saisissez le mot de passe créé à l'étape 2)*

### Adapter le connecteur Backend !
Si vous souhaitez remplacer SQLite par MariaDB dans votre projet, assurez vous simplement de bien définir les variables d'environnement `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` et `DB_PORT` dans le fichier `.env`. Le code choisira automatiquement votre base de données locale MariaDB via le connecteur sync-mysql. 

Laissez `DATABASE_URL` tel quel (ou commentez-le) car, tant que `DB_HOST` est défini, l'application basculera sur MariaDB !

---

## 5. Construction (Build)

Installez toutes les dépendances du projet, ainsi que le connecteur `mysql2` indispensable pour Node.js.

```bash
npm install
npm install mysql2
npm run build
```

---

## 6. Lancement en tâche de fond avec PM2

On utilise le fichier `ecosystem.config.cjs.example` pour un démarrage ultra clean (spécifiant automatiquement le Port 3000 et le mode Production).

```bash
sudo npm install -g pm2
cp ecosystem.config.cjs.example ecosystem.config.cjs

pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

---

## 7. Configuration Nginx pour le web

On redirige les requêtes Web classiques (port 80) vers notre application (port 3000).

```bash
sudo nano /etc/nginx/sites-available/pancho-express
```

Collez :
```nginx
server {
    listen 80;
    server_name votre-domaine.com; # Remplacez par l'IP de votre serveur ou nom de domaine

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

On active et on relance :
```bash
sudo ln -s /etc/nginx/sites-available/pancho-express /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

✅ **Félicitations**, l'application tourne et est directement accessible sur le Web. Votre serveur Debian 12 interagit avec MariaDB et Firebase Auth !
