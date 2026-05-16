#!/bin/bash
echo "🚀 Démarrage du processus de déploiement..."

# ======= Option 1 : Préserver vos modifications locales =======
# Sauvegarde des modifications locales non commitées
git stash
# Récupération du dernier code depuis la branche main
git pull origin main
# Restitution des modifications locales
git stash pop

# ======= Option 2 : Forcer une copie exacte du dépôt =======
# Si jamais la méthode ci-dessus crée des conflits et que vous voulez forcer
# la version du serveur à être identique à Github, décommentez ceci :
# git reset --hard origin/main
# git pull origin main

echo "📦 Installation des dépendances..."
npm install

echo "🏗️ Construction (build) de l'application..."
npm run build

echo "🔄 Redémarrage des processus PM2..."
pm2 restart all

echo "✅ Déploiement terminé avec succès !"
