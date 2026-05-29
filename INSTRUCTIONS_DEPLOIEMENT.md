# Guide de Déploiement Complet (Débutant) - PANCHO EXPRESS sur Debian 12

Ce guide vous accompagne pas à pas pour installer l'application **PANCHO EXPRESS** sur votre propre serveur Debian 12, en utilisant **GitHub** pour récupérer le code et en configurant le serveur pour fonctionner sur le port **3000**.

## 1. Préparation du Serveur Debian 12

Connectez-vous à votre serveur via SSH puis mettez à jour le système :

```bash
sudo apt update && sudo apt upgrade -y
```

### Installation des outils nécessaires
Installez **Git**, **Curl**, et **SQLite3** :
```bash
sudo apt install git curl sqlite3 -y
```

### Installation de Node.js (Version 18+)
Nous utilisons Node.js pour faire tourner le serveur :
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
```
Vérifiez l'installation : `node -v` (doit afficher v18.x.x).

---

## 2. Récupération du Code depuis GitHub

Allez dans le dossier où vous voulez installer l'application (généralement `/var/www/`) :

```bash
sudo mkdir -p /var/www/pancho-express
sudo chown $USER:$USER /var/www/pancho-express
cd /var/www/pancho-express
```

Clonez votre dépôt GitHub (remplacez par votre URL) :
```bash
git clone https://github.com/VOTRE_NOM/VOTRE_PROJET.git .
```

---

## 3. Installation et Configuration

### Installation des dépendances
```bash
npm install
```

### Configuration des variables d'environnement
Créez le fichier `.env` à partir de l'exemple :
```bash
cp .env.example .env
nano .env
```
Dans l'éditeur `nano`, modifiez les valeurs suivantes :
- `PORT=3000` (Vérifiez qu'il est bien à 3000)
- `JWT_SECRET` : Inventez une phrase très longue et aléatoire.
- `SAPPAY_CLIENT_ID`, etc. : Remplissez avec vos clés Sappay.

Quittez et sauvegardez avec `CTRL+X`, puis `Y`, puis `Entrée`.

---

## 4. Préparation de la Base de Données

Initialisez la base de données SQLite locale avec le schéma fourni :
```bash
sqlite3 local.db < schema.sql.example
```

---

## 5. Compilation et Premier Lancement

Compilez l'application (le code TypeScript vers JavaScript) :
```bash
npm run build
```

Lancez l'application pour tester :
```bash
npm start
```
Si vous voyez "Server running on http://localhost:3000", tout fonctionne ! Appuyez sur `CTRL+C` pour arrêter le test.

---

## 6. Maintenance Automatique (PM2)

Pour que l'application ne s'arrête pas si vous fermez votre session SSH, utilisez **PM2** :

```bash
sudo npm install -g pm2
pm2 start dist/server.cjs --name "pancho-express"
pm2 save
pm2 startup
```

---

## 7. Configuration Nginx (Reverse Proxy)

Pour accéder à votre application via `http://votre-domaine.com` (port 80) au lieu de `:3000` :

1. Installez Nginx :
   ```bash
   sudo apt install nginx -y
   ```

2. Créez la configuration :
   ```bash
   sudo nano /etc/nginx/sites-available/pancho-express
   ```

3. Collez ce contenu :
   ```nginx
   server {
       listen 80;
       server_name votre-domaine.com; # Remplacez par votre IP ou domaine

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

4. Activez et redémarrez :
   ```bash
   sudo ln -s /etc/nginx/sites-available/pancho-express /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

---

## 8. Note Importante : Administrateur

Une fois l'application lancée, créez votre compte via l'interface du site. Ensuite, pour devenir administrateur, connectez-vous à la base de données sur le serveur pour changer votre rôle :

```bash
sqlite3 local.db
sqlite> UPDATE users SET role = 'admin' WHERE email = 'votre-email@exemple.com';
sqlite> .quit
```

Félicitations ! Votre application est maintenant déployée en local.
