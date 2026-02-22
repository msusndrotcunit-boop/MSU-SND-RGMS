import { CapacitorConfig } from '@capacitor/cli';
declare const process: any;

const config: CapacitorConfig = {
  appId: 'com.msusnd.rotc.grading',
  appName: 'ROTC Grading System',
  webDir: 'dist',
  server: {
    androidScheme: 'http',
    url: process.env.MOBILE_SERVER_URL || process.env.CAPACITOR_SERVER_URL || 'http://localhost:5173'
  },
  android: {
    allowMixedContent: true
  }
};

export default config;
