# First Deploy to Railway

## What you need
- A [Railway](https://railway.app) account
- Railway CLI: `npm i -g @railway/cli`
- This repo pushed to GitHub

---

## Step 1 — Create the Railway project

1. Go to [railway.app/new](https://railway.app/new)
2. Choose **Deploy from GitHub repo**
3. Select this repository
4. Railway will auto-detect `railway.toml` and use the Dockerfile

---

## Step 2 — Sync environment variables

```bash
railway login
railway link          # select your project + environment
bash scripts/sync-env-to-railway.sh
```

This pushes all variables from `web/.env.local` to Railway.
`FB_SESSION_B64` is intentionally skipped — it lives in Firebase RTDB.

**Variables that get synced:**

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase client config |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase client config |
| `NEXT_PUBLIC_FIREBASE_DATABASE_URL` | Realtime Database URL |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Image storage |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase client config |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase client config |
| `FB_EMAIL` | Facebook login for auto re-login |
| `FB_PASSWORD` | Facebook login for auto re-login |

---

## Step 3 — Deploy

Railway auto-deploys on every push to `master`. To trigger manually:

```bash
railway up
```

Watch the build log in the Railway dashboard — the Docker build takes ~3-5 minutes on first deploy (downloading Chromium deps).

---

## Step 4 — Verify

Once deployed, open the Railway-provided URL and check:
- Listings load from Firebase RTDB ✓
- Images load (served via `/listing-images/` proxy → Firebase Storage) ✓
- Add a listing via "Add listing" → scraper should run and save to Firebase ✓

---

## Auto-deploy on push

Already configured via `railway.toml`. Push to `master` → Railway rebuilds and redeploys automatically.

---

## No volume needed

Images are stored in Firebase Storage and served via the `/listing-images/` proxy route. No Railway persistent volume is required.

---

## FB session on Railway

The scraper loads the FB session from Firebase RTDB (`/meta/fb_session_b64`) on first use — no `FB_SESSION_B64` env var needed on Railway.

If the session expires, `FB_EMAIL` + `FB_PASSWORD` trigger an automatic re-login and the new session is saved back to Firebase RTDB.

See `docs/fb-session.md` for details.

---

## Updating env vars later

Edit `web/.env.local`, then re-run:
```bash
bash scripts/sync-env-to-railway.sh
```
