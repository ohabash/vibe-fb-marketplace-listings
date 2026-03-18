/**
 * Server-only Firebase Storage helper.
 *
 * Uses the Firebase Storage REST API directly (no SDK dependency).
 * Authentication is via anonymous sign-in (Identity Toolkit REST API),
 * with the token cached in-memory and refreshed when it nears expiry.
 *
 * Storage rules must allow authenticated reads/writes:
 *   allow read, write: if request.auth != null;
 *   (Firebase default — no changes needed unless you've customized them)
 */
import "server-only";

const BUCKET = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!;
const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY!;

const STORAGE_BASE = `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o`;
const AUTH_URL = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`;

// In-memory token cache (valid for process lifetime, refreshed 1 min before expiry)
let cachedToken: string | null = null;
let tokenExpiry = 0;

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const res = await fetch(AUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ returnSecureToken: true }),
  });

  if (!res.ok) {
    throw new Error(
      `[storage] Anonymous auth failed (${res.status}): ${await res.text()}`
    );
  }

  const data = await res.json();
  if (!data.idToken) {
    throw new Error(`[storage] Auth response missing idToken: ${JSON.stringify(data)}`);
  }

  cachedToken = data.idToken as string;
  tokenExpiry = Date.now() + (parseInt(data.expiresIn, 10) - 60) * 1000;
  return cachedToken;
}

/**
 * Upload a buffer to Firebase Storage.
 * @param buffer    File bytes
 * @param storagePath  e.g. "listing-images/123456/0.jpg"
 * @returns storagePath (unchanged) — caller is responsible for building the URL
 */
export async function uploadToStorage(
  buffer: Buffer,
  storagePath: string,
  contentType = "image/jpeg"
): Promise<void> {
  const token = await getToken();
  const encodedName = encodeURIComponent(storagePath);

  const res = await fetch(
    `${STORAGE_BASE}?uploadType=media&name=${encodedName}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": contentType,
      },
      body: buffer as unknown as BodyInit,
    }
  );

  if (!res.ok) {
    throw new Error(
      `[storage] Upload failed for "${storagePath}" (${res.status}): ${await res.text()}`
    );
  }
}

/**
 * Fetch a file from Firebase Storage and return its bytes.
 * Reads are public (no auth required) — storage rules allow read: if true.
 */
export async function fetchFromStorage(
  storagePath: string
): Promise<{ buffer: ArrayBuffer; contentType: string }> {
  const encodedPath = encodeURIComponent(storagePath);
  const res = await fetch(`${STORAGE_BASE}/${encodedPath}?alt=media`);

  if (!res.ok) {
    throw new Error(
      `[storage] Fetch failed for "${storagePath}" (${res.status}): ${await res.text()}`
    );
  }

  const buffer = await res.arrayBuffer();
  const contentType = res.headers.get("content-type") ?? "image/jpeg";
  return { buffer, contentType };
}
