import { CapacitorConfig } from '@capacitor/cli';
declare const process: any;

const config: CapacitorConfig = {
  appId: 'com.msusnd.rotc.grading',
  appName: 'ROTC Grading System',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    url: process.env.MOBILE_SERVER_URL || process.env.CAPACITOR_SERVER_URL || 'https://msu-snd-rgms-jcsg.onrender.com'
  },
  android: {
    allowMixedContent: true
  }
};

export default config;
