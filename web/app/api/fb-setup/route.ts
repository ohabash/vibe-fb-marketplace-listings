/**
 * Interactive FB session setup — run this when Railway's session expires.
 *
 * Step 1:  POST /api/fb-setup  {"start": true}
 *          → logs into FB from Railway, returns {"status":"needs_code"} if FB sends a code
 *          → returns {"status":"success"} if login worked without a code
 *
 * Step 2 (if needs_code):  POST /api/fb-setup  {"code": "123456"}
 *          → submits the verification code FB emailed/texted you
 *          → returns {"status":"success"} and saves session to Firebase RTDB
 */
export const dynamic = "force-dynamic";

import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { chromium, BrowserContext, Page } from "playwright";
import { SESSION_DIR, saveSessionToFirebase } from "@/lib/playwright-session";
import fs from "fs";

// Module-level state — persists between requests in Railway's persistent container
let activeCtx: BrowserContext | null = null;
let activePage: Page | null = null;

async function closeActive() {
  try { await activeCtx?.close(); } catch { /* ignore */ }
  activeCtx = null;
  activePage = null;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  // ── Step 1: start login ──────────────────────────────────────────────────
  if (body.start) {
    console.log("[fb-setup] Starting fresh FB login from Railway...");
    await closeActive();

    // Clear stale session so we always do a fresh login
    if (fs.existsSync(SESSION_DIR)) {
      fs.rmSync(SESSION_DIR, { recursive: true, force: true });
      console.log("[fb-setup] Cleared stale session dir");
    }

    const { FB_SESSION_B64: _s, ...browserEnv } = process.env;
    void _s;
    activeCtx = await chromium.launchPersistentContext(SESSION_DIR, {
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      env: browserEnv as Record<string, string>,
    });
    activePage = await activeCtx.newPage();

    const email = process.env.FB_EMAIL;
    const password = process.env.FB_PASSWORD;
    if (!email || !password) {
      await closeActive();
      return NextResponse.json({ error: "FB_EMAIL or FB_PASSWORD not set" }, { status: 500 });
    }

    await activePage.goto("https://www.facebook.com/login/", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    console.log(`[fb-setup] Login page loaded: ${activePage.url()}`);

    await activePage.fill('input[name="email"]', email);
    await activePage.fill('input[name="pass"]', password);
    await activePage.keyboard.press("Enter");

    try {
      await activePage.waitForURL(
        (u) => !u.pathname.startsWith("/login"),
        { timeout: 15000 }
      );
    } catch { /* fall through */ }

    const url = activePage.url();
    const title = await activePage.title();
    console.log(`[fb-setup] Post-login URL: ${url}`);

    if (url.includes("two_step_verification")) {
      const bodyText = await activePage.evaluate(() =>
        document.body?.innerText?.slice(0, 600) ?? ""
      ).catch(() => "");
      console.log(`[fb-setup] Verification page text:\n${bodyText}`);

      // Try to switch to email verification by clicking "Try Another Way"
      const tryAnotherWay = activePage.locator('a:has-text("Try Another Way"), a:has-text("otra forma"), a:has-text("otra manera"), span:has-text("Try Another Way")').first();
      const exists = await tryAnotherWay.isVisible().catch(() => false);
      if (exists) {
        console.log("[fb-setup] Clicking 'Try Another Way' to switch to email code...");
        await tryAnotherWay.click();
        await activePage.waitForTimeout(2000);
        const afterText = await activePage.evaluate(() =>
          document.body?.innerText?.slice(0, 600) ?? ""
        ).catch(() => "");
        console.log(`[fb-setup] After 'Try Another Way':\n${afterText}`);
      }

      return NextResponse.json({
        status: "needs_code",
        message: "FB requires device verification. Check your email, SMS, or Facebook app for a code or approval request. Submit code via POST {\"code\": \"XXXXXX\"} or approve via app then POST {\"approved\": true}",
        pageText: bodyText,
        url,
        title,
      });
    }

    if (url.includes("/login")) {
      await closeActive();
      return NextResponse.json({
        status: "error",
        message: "Login failed — still on login page. Check FB_EMAIL/FB_PASSWORD.",
        url,
        title,
      });
    }

    // Logged in without needing a code
    console.log("[fb-setup] Logged in without device verification — saving session...");
    await closeActive();
    await saveSessionToFirebase();
    return NextResponse.json({ status: "success", message: "Session saved to Firebase. Scraping should work now." });
  }

  // ── Step 2a: user approved via FB app (no code needed) ──────────────────
  if (body.approved) {
    if (!activePage || !activeCtx) {
      return NextResponse.json({ error: "No active login session. Call {\"start\": true} first." }, { status: 400 });
    }
    console.log("[fb-setup] Checking if FB app approval resolved the session...");
    const url = activePage.url();
    const stillBlocked = url.includes("two_step") || url.includes("/login");
    if (stillBlocked) {
      // Try clicking "Continue" or "Approve" button on the verification page
      await activePage.locator('button:has-text("Continue"), button:has-text("Approve"), button:has-text("Continuar")').first().click().catch(() => {});
      await activePage.waitForTimeout(3000);
    }
    const postUrl = activePage.url();
    console.log(`[fb-setup] Post-approval URL: ${postUrl}`);
    if (postUrl.includes("two_step") || postUrl.includes("/login")) {
      return NextResponse.json({ status: "still_waiting", message: "Session still blocked. Try approving in the FB app or submit a code.", url: postUrl });
    }
    await closeActive();
    await saveSessionToFirebase();
    return NextResponse.json({ status: "success", message: "Session saved to Firebase. Scraping should work now." });
  }

  // ── Step 2b: submit verification code ────────────────────────────────────
  if (body.code) {
    if (!activePage || !activeCtx) {
      return NextResponse.json(
        { error: "No active login session. Call {\"start\": true} first." },
        { status: 400 }
      );
    }

    const code = String(body.code).trim();
    console.log(`[fb-setup] Submitting verification code: ${code}`);

    // Try common code input selectors FB uses
    const filled = await activePage.fill('input[type="text"]', code)
      .then(() => true)
      .catch(() =>
        activePage!.fill('input[name="approvals_code"]', code)
          .then(() => true)
          .catch(() => false)
      );

    if (!filled) {
      const pageText = await activePage.evaluate(() =>
        document.body?.innerText?.slice(0, 500) ?? ""
      ).catch(() => "");
      return NextResponse.json({
        status: "error",
        message: "Could not find code input field on the page.",
        pageText,
      });
    }

    await activePage.keyboard.press("Enter");

    try {
      await activePage.waitForURL(
        (u) => !u.pathname.includes("two_step") && !u.pathname.startsWith("/login"),
        { timeout: 15000 }
      );
    } catch { /* fall through */ }

    const url = activePage.url();
    const title = await activePage.title();
    console.log(`[fb-setup] Post-code URL: ${url}`);

    if (url.includes("two_step") || url.includes("/login")) {
      return NextResponse.json({
        status: "error",
        message: "Code rejected or another challenge appeared.",
        url,
        title,
      });
    }

    console.log("[fb-setup] Verification complete — saving session to Firebase...");
    await closeActive();
    await saveSessionToFirebase();
    return NextResponse.json({
      status: "success",
      message: "Session saved to Firebase. Scraping should work now.",
    });
  }

  return NextResponse.json(
    { error: "Invalid request. Send {\"start\": true} or {\"code\": \"XXXXXX\"}" },
    { status: 400 }
  );
}
