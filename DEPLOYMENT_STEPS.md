# Étapes de Déploiement (Web & Mobile avec Base de données Locale)

Le système a été ré-architecturé pour ne plus dépendre de serveurs Firebase (contournement des limites de quotas). L'application comprend désormais son propre serveur backend avec une base SQLite (`local.db`).

## 1. Déploiement de l'Application (Serveur Central)

Le déploiement du serveur est impératif car il contient l'API et la base de données. L'application mobile se connectera ensuite à ce serveur.

### Déploiement sur un Réseau Local (Bureau, Entreprise)
Idéal pour commencer, vous pouvez utiliser un ordinateur au bureau comme "serveur".

1. **Exporter le projet depuis AI Studio** (via le menu des paramètres de l'éditeur en haut à droite > "Download as ZIP").
2. Connectez cet ordinateur au réseau (Wi-Fi ou câble). Identifiez son adresse IP locale (ex: `192.168.1.100`).
3. Installez Node.js.
4. Ouvrez un terminal dans le dossier du projet extrait :
   ```bash
   npm install
   ```
5. Compilez le projet :
   ```bash
   npm run build
   ```
6. Démarrez le serveur (il doit rester allumé en continu pour que le système fonctionne) :
   ```bash
   npm start
   ```

### Déploiement sur un Serveur Public (VPS)
Pour que vos coursiers accèdent au système de partout via la 4G/3G :

1. Prenez un serveur VPS (Linode, DigitalOcean, OVH etc.).
2. Poussez le code (via FTP ou Git).
3. Exécutez les mêmes commandes : `npm install`, puis `npm run build`, puis `npm start`.
4. (Recommandé) : Utilisez pm2 pour garder le serveur en ligne : `npm install -g pm2` puis `pm2 start dist/server.cjs`.

---

## 2. Génération de l'APK Android (via Capacitor)

L'application mobile a besoin d'être dirigée vers votre serveur (dont on a parlé dans la section 1).
Par défaut l'API communique sur `/api` en relatif. Si l'APK est installé sur un mobile, il y aura peut-être besoin d’éditer `capacitor.config.ts` ou votre code de requêtes API (ex: `src/lib/firebaseLocal.ts`) pour cibler l'URL absolue de votre serveur central au lieu de `/api` en statut relatif.

### Étapes de génération :
1. **Sur votre machine de développement**, préparez votre code en vous assurant que l'application pointe bien sur le bon domaine/IP.
2. **Installer les dépendances** :
   ```bash
   npm install
   ```
3. **Construire les assets web** :
   ```bash
   npm run build
   ```
4. **Synchroniser avec Capacitor** (Copie les fichiers web compilés vers Android) :
   ```bash
   npx cap sync android
   ```
5. **Lancer Android Studio** :
   ```bash
   npx cap open android
   ```
6. **Créer l'APK dans Android Studio** :
   - Attendez que Gradle termine la synchronisation et l'indexation.
   - Dans le menu : **Build** > **Build Bundle(s) / APK(s)** > **Build APK(s)**.
   - Une fois la compilation terminée, récupérez votre `.apk` via le bouton **locate** (ou dans `android/app/build/outputs/apk/debug/`).

> **Sauvegarde** : N'oubliez pas de sauvegarder régulièrement le fichier `local.db` du serveur pour éviter la perte de données !