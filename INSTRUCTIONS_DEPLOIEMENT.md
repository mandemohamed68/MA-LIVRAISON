# Instructions de Déploiement

## 1. Comment Lancer l'Application en Local

Pour exécuter cette plateforme sur votre propre machine (par exemple sur votre ordinateur à Ouagadougou) :

1. Assurez-vous d'avoir installé **Node.js** (https://nodejs.org).
2. Ouvrez un terminal dans le dossier du projet.
3. Exécutez la commande pour installer les dépendances :
   ```bash
   npm install
   ```
4. Lancez le serveur de développement local :
   ```bash
   npm run dev
   ```
5. L'application sera accessible sur `http://localhost:3000` (ou un autre port indiqué dans le terminal).

## 2. Comment Générer l'APK pour Android

L'application a été configurée avec **Capacitor** pour être exportée sous forme d'application mobile native (APK). 
Le dossier `android/` contient déjà le projet prêt à l'emploi.

Voici les étapes pour générer l'APK :

1. Assurez-vous d'avoir installé **Android Studio** sur votre machine.
2. Compilez les fichiers de l'application web pour la production :
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
5. Dans Android Studio, patientez pendant que Gradle termine la synchronisation.
6. Allez dans le menu en haut : **Build > Build Bundle(s) / APK(s) > Build APK(s)**
7. Une petite notification apparaîtra en bas à droite lorsque l'APK sera prêt. Cliquez sur "locate" pour accéder au fichier `.apk` généré.

## Bon à savoir (Réalités du Burkina Faso)
- Les moyens de paiements populaires (Orange Money, Moov Money, Coris, Sank) ont été intégrés à l'interface d'acceptation des devis.
- Les zones d'activités pour les livreurs supportent maintenant les localités et secteurs (Ex: "Ouagadougou, Secteur 1").
- Assurez-vous d'avoir une excellente connectivité lors de la génération de l'APK (Android Studio peut télécharger des dépendances volumineuses la première fois).
