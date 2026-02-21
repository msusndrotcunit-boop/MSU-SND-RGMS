import { defineConfig } from '@playwright/test';

const base = process.env.BASE_URL || 'http://localhost:5173';

export default defineConfig({
  use: {
    baseURL: base,
    trace: 'on-first-retry'
  },
  webServer: {
    command: 'npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: true
  },
  reporter: [['list']]
});
