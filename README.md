# Budget

Personal finance tracker: NestJS + Prisma backend (`backend/`), Angular frontend (`frontend/`), Postgres in Docker.

## Local development

```bash
docker compose up -d                          # Postgres
cd backend && cp .env.example .env && npm install && npx prisma migrate deploy && npm run start:dev
cd frontend && npm install && npm start       # http://localhost:4200
```

`ng serve` proxies `/api` to `http://localhost:3000` (`frontend/proxy.conf.json`), so the frontend always calls the API on its own origin.

## Using the app on an iPhone

The backend serves the production Angular build itself, so the app and the API share one origin. The iPhone reaches the Mac privately over [Tailscale](https://tailscale.com); nothing is exposed to the public internet. The app is a PWA, so it can be added to the home screen and opens full-screen.

### Start the app on the Mac

```bash
npm run serve:phone
```

This builds the frontend and backend, applies pending database migrations and starts the backend in production mode. The app is then at `http://localhost:3000` (API at `/api/v1`, Swagger at `/api/docs`). Re-run it after pulling changes; the installed app picks up the new version the next time it is opened.

### One-time setup (manual)

1. Install Tailscale on the Mac and on the iPhone, and sign in to the same account on both.
2. In the [Tailscale admin console](https://login.tailscale.com/admin/dns), enable **MagicDNS** and **HTTPS Certificates**.
3. On the Mac, run:

   ```bash
   tailscale serve --bg 3000
   ```

   This publishes the app at `https://<mac-name>.<tailnet>.ts.net` with a valid certificate, visible only to devices in your tailnet. `tailscale serve status` shows the exact URL; `tailscale serve reset` stops it. The setting survives restarts.
4. On the iPhone, open that `https://….ts.net` URL in Safari, then tap **Share → Add to Home Screen**.

### Keep it reachable

- The Mac has to be awake: run `caffeinate -s` in a terminal while you want access, or turn off sleep in System Settings → Energy.
- Postgres has to be running: `docker compose up -d`.
- `npm run serve:phone` has to be running.

### Notes

- The service worker caches only the app shell (HTML, JS, CSS, icons). API responses are never cached, so the app needs the Mac to be reachable to show any data.
- `FRONTEND_URL` (CORS) only matters when the frontend runs on a different origin; the same-origin setup doesn't need it.
