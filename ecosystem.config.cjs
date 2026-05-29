module.exports = {
  apps: [
    {
      name: "pancho-livraison", // Nom de l'application mis à jour pour correspondre à PANCHO LIVRAISON
      script: "dist/server.cjs", // Point d'entrée de notre serveur compilé en CJS
      env: {
        NODE_ENV: "production",
        PORT: 3000 // On utilise 3000 en production (port par défaut du conteneur)
      },
      instances: 1, // Changez en "max" si vous voulez un cluster selon vos CPU
      autorestart: true,
      watch: false, // Pas de watch en production
      max_memory_restart: "1G"
    }
  ]
};
