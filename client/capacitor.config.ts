import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.msusnd.rotc.grading',
  appName: 'ROTC Grading System',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    url: process.env.MOBILE_SERVER_URL || process.env.CAPACITOR_SERVER_URL
  },
  android: {
    allowMixedContent: true
  }
};

export default config;
