# Facebook Session Management

Playwright needs a logged-in Facebook browser session to scrape Marketplace listings.
The session is stored as a base64-encoded tar.gz in the `FB_SESSION_B64` env var.

## How it works

On first scrape request, `web/lib/playwright-session.ts` decodes `FB_SESSION_B64`
to `/tmp/fb_session/` and reuses it for the lifetime of the process.

## Encoding the session (initial setup or refresh)

1. Log into Facebook locally using the standalone scraper:
   ```bash
   cd /path/to/project
   npx tsx scrape.ts <any-fb-marketplace-url>
   # A browser window opens → log in → press Enter
   ```

2. Encode the session (excluding browser caches to keep it small):
   ```bash
   tar czf - \
     --exclude='fb_session/Default/Cache' \
     --exclude='fb_session/Default/Code Cache' \
     --exclude='fb_session/Default/GPUCache' \
     --exclude='fb_session/Default/DawnWebGPUCache' \
     --exclude='fb_session/Default/DawnGraphiteCache' \
     fb_session | base64 | tr -d '\n'
   ```

3. Copy the output and set it as `FB_SESSION_B64`:
   - **Local dev**: paste into `web/.env.local`
   - **Railway**: paste into the Railway dashboard env vars

## Auto re-login (recommended for production)

Set `FB_EMAIL` and `FB_PASSWORD` env vars and the app will re-login automatically
when the session expires — no manual intervention needed.

```
FB_EMAIL=your@email.com
FB_PASSWORD=yourpassword
```

When re-login succeeds the refreshed session is written to Firebase RTDB
(`/meta/fb_session_b64`) so it survives container restarts. The console will log:

```
[scraper] Session expired — attempting re-login with FB_EMAIL...
[scraper] Re-login successful
[scraper] Session saved to Firebase — will survive container restart
```

If `FB_EMAIL`/`FB_PASSWORD` are not set and the session expires, scraping will
return a clear error message explaining exactly what to do.

## Manual refresh (fallback)

Facebook sessions typically last weeks to months. Signs of expiry without auto re-login:
- Scraping returns error containing "FB_EMAIL/FB_PASSWORD are not set"
- The app logs show a login form was detected

To refresh manually: repeat the encoding steps above with a fresh login.

## Security

`FB_SESSION_B64` grants full access to your Facebook account.
Never commit it to git. It is already excluded via `.gitignore`.
