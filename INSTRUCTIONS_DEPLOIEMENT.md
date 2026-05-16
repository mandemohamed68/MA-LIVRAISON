# Guide de Déploiement Local - Livra Express

Ce guide explique comment déployer l'application Livra Express sur un serveur local Debian 12 sans dépendre de Firebase.

## Prérequis

- Un serveur avec **Debian 12**
- **Node.js 18+** installé
- **npm** ou **yarn**
- **SQLite3** ou un moteur SQL compatible
- Un serveur web (Nginx recommandé pour le reverse proxy)

## Étape 1 : Préparation de l'environnement

1. Installez Node.js :
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

2. Clonez votre projet et installez les dépendances :
   ```bash
   cd /var/www/livra-express
   npm install
   ```

## Étape 2 : Configuration

1. Copiez le fichier `.env.example` vers `.env` :
   ```bash
   cp .env.example .env
   ```
2. Modifiez le fichier `.env` pour définir vos secrets :
   - `JWT_SECRET` : Une clé forte pour la sécurité des sessions.
   - `DATABASE_URL` : Chemin vers votre fichier `local.db` (par défaut la racine).
   - `SAPPAY_*` : Vos identifiants de paiement Sappay.

## Étape 3 : Initialisation de la Base de Données

Le serveur initialise automatiquement le fichier `local.db` au premier lancement. Pour importer des données manuellement, vous pouvez utiliser le fichier `schema.sql.example`.

```bash
sqlite3 local.db < schema.sql.example
```

## Étape 4 : Compilation et Lancement

1. Build de l'application :
   ```bash
   npm run build
   ```

2. Lancement du serveur :
   ```bash
   npm start
   ```

## Étape 5 : Configuration Nginx (Reverse Proxy)

Créez un fichier de configuration `/etc/nginx/sites-available/livra` :

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

Activez le site et redémarrez Nginx :
```bash
sudo ln -s /etc/nginx/sites-available/livra /etc/nginx/sites-enabled/
sudo systemctl restart nginx
```

## Notes sur l'authentification local

L'application utilise désormais un système JWT local. Les utilisateurs doivent se créer un compte via l'interface. Pour le premier administrateur, vous devrez probablement modifier manuellement le rôle dans la base de données :

```sql
UPDATE users SET role = 'admin' WHERE email = 'votre-email@admin.com';
```
