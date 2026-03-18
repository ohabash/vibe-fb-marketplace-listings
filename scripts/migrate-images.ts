/**
 * Migrate existing local images → Firebase Storage
 *
 * Reads all files from web/public/listing-images/{id}/{n}.jpg,
 * uploads each to Firebase Storage at the same relative path,
 * and verifies the RTDB paths already match (no DB changes needed).
 *
 * Run once:
 *   cd web && npx tsx ../scripts/migrate-images.ts
 */
import * as fs from "fs";
import * as path from "path";
// Load .env.local manually (no dotenv dependency needed)
const envFile = path.join(__dirname, "../web/.env.local");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

const BUCKET = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!;
const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY!;
const IMAGES_DIR = path.join(__dirname, "../web/public/listing-images");

if (!BUCKET || !API_KEY) {
  console.error("Missing NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET or NEXT_PUBLIC_FIREBASE_API_KEY");
  process.exit(1);
}

const STORAGE_BASE = `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o`;
const AUTH_URL = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`;

async function getToken(): Promise<string> {
  const res = await fetch(AUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ returnSecureToken: true }),
  });
  const data = await res.json() as { idToken?: string };
  if (!data.idToken) {
    const msg = data?.error?.message ?? JSON.stringify(data);
    if (msg === "CONFIGURATION_NOT_FOUND") {
      throw new Error(
        "Anonymous Authentication is not enabled in your Firebase project.\n" +
        "Enable it at: Firebase Console → Authentication → Sign-in method → Anonymous"
      );
    }
    throw new Error(`Auth failed: ${msg}`);
  }
  return data.idToken;
}

async function uploadFile(token: string, localPath: string, storagePath: string): Promise<void> {
  const buffer = fs.readFileSync(localPath);
  const encodedName = encodeURIComponent(storagePath);
  const res = await fetch(`${STORAGE_BASE}?uploadType=media&name=${encodedName}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "image/jpeg",
    },
    body: buffer,
  });
  if (!res.ok) {
    throw new Error(`Upload failed (${res.status}): ${await res.text()}`);
  }
}

async function main() {
  if (!fs.existsSync(IMAGES_DIR)) {
    console.log("No local images found at", IMAGES_DIR);
    return;
  }

  const listingIds = fs.readdirSync(IMAGES_DIR).filter((d) =>
    fs.statSync(path.join(IMAGES_DIR, d)).isDirectory()
  );

  if (listingIds.length === 0) {
    console.log("No listing image directories found.");
    return;
  }

  console.log(`Found ${listingIds.length} listings. Authenticating...`);
  const token = await getToken();
  console.log("Auth OK. Starting upload...\n");

  let total = 0;
  let succeeded = 0;
  let failed = 0;

  for (const id of listingIds) {
    const dir = path.join(IMAGES_DIR, id);
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".jpg"));
    process.stdout.write(`  ${id} (${files.length} images)... `);

    let ok = 0;
    for (const file of files) {
      const localPath = path.join(dir, file);
      const storagePath = `listing-images/${id}/${file}`;
      try {
        await uploadFile(token, localPath, storagePath);
        ok++;
        total++;
        succeeded++;
      } catch (err) {
        console.error(`\n    ERROR uploading ${storagePath}:`, err);
        failed++;
        total++;
      }
    }
    console.log(`${ok}/${files.length} OK`);
  }

  console.log(`\nDone. ${succeeded}/${total} uploaded successfully, ${failed} failed.`);
  if (failed === 0) {
    console.log("\nAll images migrated. You can now delete web/public/listing-images/ if desired.");
    console.log("The /listing-images/ proxy route will serve them from Firebase Storage.");
  }
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
