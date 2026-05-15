import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.malivraison.app',
  appName: 'LIVRA',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
