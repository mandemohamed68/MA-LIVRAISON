import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.malivraison.app',
  appName: 'PANCHO LIVRAISON',
  webDir: 'dist',
  server: {
    androidScheme: 'http',
    cleartext: true
  }
};

export default config;
