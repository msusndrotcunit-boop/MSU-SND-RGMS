const axios = require('axios');

const domains = (process.env.BASE_URLS || '').split(',').map(s => s.trim()).filter(Boolean);
const candidates = domains.length ? domains : [
  process.env.BASE_URL || 'http://localhost:4173',
  'https://msu-snd-rgms-2.onrender.com',
  'https://msu-snd-rgms-1.onrender.com'
];

const paths = [
  '/admin/settings',
  '/admin/profile',
  '/admin/cadets',
  '/cadet/profile',
  '/staff/profile'
];

async function check() {
  let failed = 0;
  for (const d of candidates) {
    for (const p of paths) {
      const url = `${String(d).replace(/\/+$/, '')}${p}`;
      try {
        const res = await axios.get(url, { validateStatus: () => true });
        const ok = res.status < 400;
        const tag = ok ? 'OK' : `FAIL ${res.status}`;
        console.log(`${tag} ${url}`);
        if (!ok) failed++;
      } catch (e) {
        console.log(`ERR ${url}`);
        failed++;
      }
    }
  }
  if (failed > 0) {
    process.exit(1);
  }
}

check();
