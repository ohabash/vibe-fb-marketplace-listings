/**
 * Manages the Facebook browser session for Playwright.
 *
 * Session loading priority (first available wins):
 *   1. Firebase RTDB /meta/fb_session_b64 — updated automatically after re-login
 *   2. FB_SESSION_B64 env var — bootstrap fallback (set once on initial deploy)
 *
 * After a credential-based re-login, saveSessionToFirebase() encodes the
 * refreshed session and writes it to Firebase so it survives container restarts.
 *
 * See docs/fb-session.md for setup instructions.
 */
import "server-only";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { execSync } from "child_process";
import { ref, get, set } from "firebase/database";
import { db } from "./firebase";

/** Absolute path where the Playwright persistent context lives at runtime. */
export const SESSION_DIR = path.join(os.tmpdir(), "fb_session");

let restored = false;

/** Decode a base64 tar.gz string into SESSION_DIR. */
function decodeSession(b64: string): void {
  const tmpTar = path.join(os.tmpdir(), "fb_session.tar.gz");
  fs.writeFileSync(tmpTar, Buffer.from(b64, "base64"));
  // Minimal env — the full process.env can include FB_SESSION_B64 (~5MB)
  // which would cause E2BIG when passed to the child process.
  execSync(`tar xzf "${tmpTar}" -C "${os.tmpdir()}"`, {
    stdio: "pipe",
    env: { PATH: process.env.PATH ?? "/usr/bin:/bin" } as unknown as NodeJS.ProcessEnv,
  });
  fs.unlinkSync(tmpTar);
}

/**
 * Ensures a valid FB session exists at SESSION_DIR before a Playwright launch.
 * Safe to call multiple times — skips if already restored this process lifetime.
 */
export async function ensureSession(): Promise<void> {
  if (restored || fs.existsSync(path.join(SESSION_DIR, "Default"))) {
    restored = true;
    return;
  }

  let b64: string | null = null;

  // 1. Try Firebase RTDB (populated after a successful auto re-login)
  try {
    const snap = await get(ref(db, "meta/fb_session_b64"));
    if (snap.exists()) {
      console.log("[session] Loading session from Firebase RTDB");
      b64 = snap.val() as string;
    }
  } catch (err) {
    console.warn("[session] Could not read session from Firebase — will try env var fallback:", err);
  }

  // 2. Fall back to bootstrap env var
  if (!b64) {
    b64 = process.env.FB_SESSION_B64 ?? null;
    if (b64) {
      console.log("[session] Loading session from FB_SESSION_B64 env var");
    }
  }

  if (!b64) {
    throw new Error(
      "[session] No FB session available.\n" +
      "  - Set FB_SESSION_B64 env var (see docs/fb-session.md), OR\n" +
      "  - Ensure /meta/fb_session_b64 exists in Firebase RTDB."
    );
  }

  decodeSession(b64);
  restored = true;
  console.log("[session] Session restored to", SESSION_DIR);
}

/**
 * Encodes the current SESSION_DIR and writes it to Firebase RTDB.
 * Call this after a successful re-login, once the browser is fully closed.
 * The browser must be closed first — Chromium holds locks on the directory while running.
 */
export async function saveSessionToFirebase(): Promise<void> {
  const tmpTar = path.join(os.tmpdir(), "fb_session_new.tar.gz");

  execSync(
    `tar czf "${tmpTar}" \
      --exclude="fb_session/Default/Cache" \
      --exclude="fb_session/Default/Code Cache" \
      --exclude="fb_session/Default/GPUCache" \
      --exclude="fb_session/Default/DawnWebGPUCache" \
      --exclude="fb_session/Default/DawnGraphiteCache" \
      fb_session`,
    {
      cwd: os.tmpdir(),
      stdio: "pipe",
      env: { PATH: process.env.PATH ?? "/usr/bin:/bin" } as unknown as NodeJS.ProcessEnv,
    }
  );

  const b64 = fs.readFileSync(tmpTar).toString("base64");
  fs.unlinkSync(tmpTar);

  await set(ref(db, "meta/fb_session_b64"), b64);
  console.log("[session] Refreshed session saved to Firebase RTDB (/meta/fb_session_b64)");
}
