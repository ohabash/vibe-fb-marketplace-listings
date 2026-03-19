/**
 * Encodes the local fb_session/ directory and uploads it to Firebase RTDB.
 * Run this whenever your Railway session expires:
 *
 *   npx tsx scripts/push-session.ts
 */
import fs from "fs";
import os from "os";
import path from "path";
import { execSync } from "child_process";

// Load .env.local
const envPath = path.resolve(__dirname, "../web/.env.local");
for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
  const [k, ...rest] = line.split("=");
  if (k && rest.length && !process.env[k]) process.env[k] = rest.join("=").trim();
}

const SESSION_DIR = path.resolve(__dirname, "../fb_session");
const TMP_TAR = path.join(os.tmpdir(), "fb_session_push.tar.gz");

if (!fs.existsSync(SESSION_DIR)) {
  console.error("fb_session/ not found at:", SESSION_DIR);
  process.exit(1);
}

console.log("Encoding fb_session/ (excluding cache dirs)...");
execSync(
  `tar czf "${TMP_TAR}" \
    --exclude="fb_session/Default/Cache" \
    --exclude="fb_session/Default/Code Cache" \
    --exclude="fb_session/Default/GPUCache" \
    --exclude="fb_session/GrShaderCache" \
    --exclude="fb_session/ShaderCache" \
    fb_session`,
  { cwd: path.resolve(__dirname, ".."), stdio: "pipe" }
);

const b64 = fs.readFileSync(TMP_TAR).toString("base64");
fs.unlinkSync(TMP_TAR);
console.log(`Encoded size: ${(b64.length / 1024).toFixed(0)} KB`);

// Upload to Firebase RTDB via REST API
const dbUrl = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL!.replace(/\/$/, "");
const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY!;

async function main() {
  // Get anon token
  const tokenRes = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ returnSecureToken: true }) }
  );
  const { idToken } = await tokenRes.json() as { idToken: string };

  // Write to /meta/fb_session_b64
  const putRes = await fetch(`${dbUrl}/meta/fb_session_b64.json?auth=${idToken}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(b64),
  });

  if (!putRes.ok) {
    console.error("Firebase PUT failed:", await putRes.text());
    process.exit(1);
  }

  console.log("✓ Session uploaded to Firebase RTDB at /meta/fb_session_b64");
  console.log("Railway will use this session on the next scrape request.");
}

main().catch((e) => { console.error(e); process.exit(1); });
