# Étapes de Déploiement (Web & Mobile)

Voici les instructions détaillées pour déployer l'application web et générer l'APK Android.

## 1. Déploiement de l'Application Web

### Option A : Déploiement via AI Studio (Recommandé)
1. Cliquez sur le menu "Deploy" ou les paramètres en haut à droite.
2. Sélectionnez "Deploy to Cloud Run" (ou Share) pour héberger l'application et la rendre accessible publiquement.
3. Le système gérera automatiquement la création de l'image, le routage et le déploiement final.
4. Une URL publique vous sera fournie une fois le déploiement terminé.

### Option B : Déploiement Manuel sur un serveur (ex: VPS, Heroku, Render)
Puisque le projet dispose d'un backend Express personnalisé (`server.ts`), voici les étapes :
1. Clonez/téléchargez le code source sur votre serveur.
2. Configurez vos variables d'environnement (`.env`).
3. Installez les dépendances :
   ```bash
   npm install
   ```
4. Générez les fichiers de production (compilation Vite + Serveur) :
   ```bash
   npm run build
   ```
5. Démarrez le serveur en production :
   ```bash
   npm run start
   ```

---

## 2. Génération de l'APK Android (via Capacitor)

L'application est synchronisée avec **Capacitor** pour être packagée en tant qu'application Android. La génération de l'APK nécessite Android Studio et doit donc être réalisée sur une machine locale de développement.

### Prérequis (Sur votre machine locale)
- Java Development Kit (JDK 17+)
- Android Studio avec le SDK Android installé
- Node.js installé

### Étapes de génération :
1. **Exporter le projet depuis AI Studio** : Cliquez sur le menu "Settings" ou le bouton d'export, et téléchargez le projet sous forme d'archive ZIP (ou un export GitHub).
2. **Décompresser et préparer** : Ouvrez un terminal dans le dossier extrait de votre machine.
3. **Installer les dépendances** :
   ```bash
   npm install
   ```
4. **Construire les assets web** :
   ```bash
   npm run build
   ```
5. **Synchroniser avec Capacitor** (Copie les fichiers web dans le dossier de l'application Android) :
   ```bash
   npx cap sync android
   ```
6. **Lancer Android Studio** :
   ```bash
   npx cap open android
   ```
7. **Créer l'APK dans Android Studio** :
   - Attendez que Gradle termine la synchronisation et l'indexation.
   - Dans le menu tout en haut, cliquez sur : **Build** > **Build Bundle(s) / APK(s)** > **Build APK(s)**.
   - Si vous prévoyez de publier sur le Google Play Store, utilisez plutôt **Generate Signed Bundle / APK** (nécessite un Keystore).
   - Une fois la compilation terminée, Android Studio affichera une alerte. Cliquez sur **locate** (ou naviguez dans `android/app/build/outputs/apk/debug/`) pour récupérer votre fichier `.apk`.
