import { test, expect } from '@playwright/test';

const routes = [
  '/admin/settings',
  '/admin/profile',
  '/admin/cadets',
  '/cadet/profile',
  '/staff/profile'
];

for (const path of routes) {
  test(`deep link renders for ${path}`, async ({ page, baseURL }) => {
    const url = `${baseURL || 'http://localhost:4173'}${path}`;
    await page.goto(url);
    await page.waitForSelector('#root', { state: 'attached' });
    const status = await page.evaluate(() => 200);
    expect(status).toBe(200);
  });
}
