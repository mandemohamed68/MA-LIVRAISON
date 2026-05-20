module.exports = {
  apps: [
    {
      name: "livra-express", // Nom de l'application mis à jour pour correspondre à l'existant
      script: "dist/server.cjs", // Point d'entrée de notre serveur compilé en CJS
      env: {
        NODE_ENV: "production",
        PORT: 3000
      },
      instances: 1, // Changez en "max" si vous voulez un cluster selon vos CPU
      autorestart: true,
      watch: false, // Pas de watch en production
      max_memory_restart: "1G"
    }
  ]
};
