# Instructions de Déploiement Local Intégral (Sans quotas Firebase)

L'application a été mise à jour ! Elle ne dépend plus de Firestore (et de ses quotas éventuels) mais inclut un **serveur Node.js (Express)** couplé à une base de données **SQLite locale (`local.db`)**. Vos données résident désormais entièrement sur votre machine, sans blocage lié au cloud.

## 1. Comment Lancer l'Application en Local

Pour exécuter cette plateforme sur votre propre réseau (par exemple dans votre entreprise à Ouagadougou) :

1.  Assurez-vous d'avoir installé **Node.js** (version 18+ recommandée) depuis https://nodejs.org.
2.  Téléchargez (exportez) le projet sur votre machine (fichier ZIP) et extrayez-le.
3.  Ouvrez un terminal ou invite de commandes dans le dossier extrait.
4.  Exécutez la commande pour installer les dépendances (nécessaire à la première utilisation) :
    ```bash
    npm install
    ```
5.  Construisez l'application en mode production :
    ```bash
    npm run build
    ```
6.  Lancez le serveur d'application local :
    ```bash
    npm start
    ```
    *Note: Ce serveur va distribuer l'application web, héberger l'API locale, et exposer la base de données SQLite (`local.db`).*
7.  L'application sera accessible sur `http://localhost:3000`. Si vous souhaitez l'exposer à votre réseau local (téléphones, autres PC de votre bureau), remplacez `localhost` par l'adresse IP de votre machine (ex: `http://192.168.1.50:3000`).

## 2. Accès hors ligne et Base de données
- Tout votre historique (livraisons, devis, utilisateurs) sera sauvegardé dans le fichier **`local.db`** présent à la racine du projet. 
- Pensez à faire une sauvegarde régulière du fichier `local.db` (en le copiant sur une clé USB ou un disque dur externe).

## 3. Comment Générer l'APK Android (Application Mobile)

L'application Mobile (Android) a été configurée avec **Capacitor**. Le code pour l'application a aussi été mis à jour pour se connecter au serveur backend plutôt qu'à Firebase afin d'éviter les quotas.

> **IMPORTANT POUR LE MODE MOBILE :** 
> Puisqu'on ne dépend plus des serveurs centraux Firebase, votre téléphone Android aura besoin de communiquer avec votre ordinateur (serveur). Plus tard, si vous mettez ce système sur un serveur distant, vous pourrez changer l'adresse de connexion API.

Voici les étapes pour générer l'APK :

1. Téléchargez et installez **Android Studio**.
2. Dans le terminal du projet sur votre PC, assurez-vous que tout est compilé avec la commande :
   ```bash
   npm run build
   ```
3. Synchronisez les fichiers web compilés vers le projet Android :
   ```bash
   npx cap sync
   ```
4. Ouvrez le projet dans Android Studio :
   ```bash
   npx cap open android
   ```
5. Dans Android Studio, patientez pour la synchronisation Gradle (cela peut prendre du temps au Burkina Faso selon votre connexion, la première fois).
6. Allez dans le menu : **Build > Build Bundle(s) / APK(s) > Build APK(s)**.
7. Quand la notification s'affiche, cliquez sur **"locate"** pour obtenir votre fichier `.apk` que vous pouvez installer sur les téléphones des livreurs et clients.

## Bon à savoir (Réalités du Burkina Faso)
- Les notifications Web, le suivi des livreurs, l'acceptation de devis (avec les options Orange Money, Moov Money, Coris, Sank) fonctionnent désormais via votre serveur central SQLite. Cela permet une totale indépendance.
- Sauvegardez bien le projet de base et votre base de données `local.db`.