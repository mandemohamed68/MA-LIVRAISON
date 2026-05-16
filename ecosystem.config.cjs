module.exports = {
  apps: [
    {
      name: "app-livraison", // Nom de l'application dans PM2
      script: "dist/server.cjs", // Point d'entrée de notre serveur compilé en CJS
      env: {
        NODE_ENV: "production",
        PORT: 3000 // Vous pouvez changer le port ici si nécessaire
      },
      instances: 1, // Changez en "max" si vous voulez un cluster selon vos CPU
      autorestart: true,
      watch: false, // Pas de watch en production
      max_memory_restart: "1G"
    }
  ]
};
