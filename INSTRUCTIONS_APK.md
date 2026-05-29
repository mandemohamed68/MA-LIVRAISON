# Guide de Génération de l'APK pour PANCHO EXPRESS

Ce projet est configuré avec **Capacitor** pour permettre la génération d'une application Android native (APK).

## Pré-requis
1. **Node.js** installé sur votre machine.
2. **Android Studio** installé et configuré.
3. Le SDK Android (API 30+) installé via le SDK Manager d'Android Studio.

## Étapes pour générer l'APK

### 1. Préparation du code web
Depuis le terminal à la racine du projet, exécutez la commande suivante pour compiler l'application React et synchroniser les fichiers avec le projet Android :
```bash
npm run build:android
```

### 2. Ouverture dans Android Studio
Une fois la synchronisation terminée, ouvrez le dossier `android` du projet avec Android Studio :
```bash
npx cap open android
```
*(Ou ouvrez manuellement le dossier `android` depuis Android Studio)*.

### 3. Génération de l'APK (Debug ou Release)
Dans Android Studio :
- Attendez que Gradle termine sa synchronisation.
- Allez dans le menu **Build** > **Build Bundle(s) / APK(s)** > **Build APK(s)**.
- Une notification apparaîtra en bas à droite une fois l'APK généré. Cliquez sur **locate** pour trouver le fichier `app-debug.apk`.

### 4. Génération pour la Production (Signé)
Pour publier l'application ou l'envoyer à des clients :
- Allez dans **Build** > **Generate Signed Bundle / APK...**
- Suivez les étapes pour créer une clé de signature (`keystore`).
- Sélectionnez le mode **release**.

## Notes importantes
- L'ID de l'application est `com.pancho.express`.
- Les permissions de géolocalisation et de caméra ont été ajoutées dans le fichier `AndroidManifest.xml`.
- Assurez-vous d'avoir configuré les clés API Google Maps dans `AndroidManifest.xml` si vous utilisez des cartes natives (actuellement le projet utilise Leaflet qui fonctionne via le Webview).
