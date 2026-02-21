**Goal**
- Ensure deep links and hard refreshes on client-side routes load the SPA instead of 404.

**Root Causes**
- Static Site CDN serves 404 for client-side routes without rewrite rules.
- Backend may not include built client files, so index.html/assets are missing.
- API calls from static domain hit /api on the CDN instead of the backend.

**Fixes**
- Backend serves SPA with fallback:
  - Build client on backend deploy.
  - Django catch-all serves index.html for non-API/static/upload/admin paths.
- Static Site rewrite:
  - Add rewrite rule Source: /* Destination: /index.html in Render Dashboard.
- Client API base:
  - Set VITE_API_URL to backend domain in client/.env.production.
  - Use VITE_API_URL for SSE.

**Verification**
- Backend: /api/health returns 200.
- Deep links load on backend domain after deploy.
- Static Site deep links load after the rewrite rule is added.
- Run tests:
  - npm run test:deeplinks
  - npm run test:e2e

**Maintenance**
- Keep render.yaml backend build steps building the client and collecting static.
- Ensure static site rewrite rules remain configured in the Render Dashboard.
