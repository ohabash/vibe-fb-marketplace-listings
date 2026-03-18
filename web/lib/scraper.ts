/**
 * Server-only scraping logic for Facebook Marketplace listings.
 *
 * Uses Playwright (headless Chromium) with a persistent FB session.
 * Exports a single public function: scrapeUrl(url)
 *
 * Images are uploaded to Firebase Storage at listing-images/{id}/N.jpg
 * and served via the /listing-images/[...path] proxy route.
 */
import "server-only";
import { chromium } from "playwright";
import type { Listing } from "@/types/listing";
import { ensureSession, saveSessionToFirebase, SESSION_DIR } from "./playwright-session";
import { uploadToStorage } from "./firebase-storage";

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function extractIdFromUrl(url: string): string {
  const match = url.match(/\/item\/(\d+)/);
  return match ? match[1] : String(Date.now());
}

function find1(pattern: RegExp, text: string): string {
  const m = text.match(pattern);
  return m ? m[1] : "";
}

/** Unescape FB's JSON string encoding (\/, \n, \", \uXXXX). */
function unescape(s: string): string {
  return s
    .replace(/\\\//g, "/")
    .replace(/\\n/g, "\n")
    .replace(/\\"/g, '"')
    .replace(/\\u[\dA-Fa-f]{4}/g, (m) =>
      String.fromCharCode(parseInt(m.slice(2), 16))
    );
}

/**
 * Download FB carousel images and upload to Firebase Storage.
 * Returns /listing-images/{id}/{n}.jpg paths.
 * Throws on failure — no fallback to FB CDN URLs (they expire and break the UI).
 */
async function uploadImages(id: string, remoteUrls: string[]): Promise<string[]> {
  const results: string[] = [];
  for (let i = 0; i < remoteUrls.length; i++) {
    const storagePath = `listing-images/${id}/${i}.jpg`;
    console.log(`[scraper] Uploading image ${i + 1}/${remoteUrls.length} → ${storagePath}`);
    const res = await fetch(remoteUrls[i]);
    if (!res.ok) {
      throw new Error(
        `[scraper] Failed to download image ${i} from FB CDN (HTTP ${res.status}). URL: ${remoteUrls[i].slice(0, 80)}...`
      );
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    await uploadToStorage(buffer, storagePath); // throws with detailed message on failure
    results.push(`/listing-images/${id}/${i}.jpg`);
  }
  return results;
}

/**
 * Extract all listing data from raw page HTML.
 * FB embeds the full listing JSON in <script> tags with escaped slashes (\/).
 */
function parseHTML(html: string): Partial<Listing> {
  const priceIdx = html.indexOf('"listing_price":{"amount":');
  if (priceIdx === -1) return {};

  // Wide window around the price anchor covers all listing fields
  const chunk = html.slice(Math.max(0, priceIdx - 100000), priceIdx + 30000);

  const title = unescape(find1(/"marketplace_listing_title":"((?:[^"\\]|\\.)*)"/, chunk));
  const priceAmount = find1(/"listing_price":\{"amount":"([^"]+)"/, chunk);
  const priceCurrency = find1(/"listing_price":\{[^}]*"currency":"([^"]+)"/, chunk);

  const descMatch = chunk.match(/"redacted_description":\{"text":"([\s\S]*?)"(?:,|\})/);
  const description = descMatch ? unescape(descMatch[1]) : "";

  const category = find1(/"marketplace_listing_category":\{"slug":"([^"]+)"/, chunk);

  const unitDetails = [
    ...chunk.matchAll(
      /"display_label":"([^"]+)","icon_name":"(?:building|bedrooms|washing|car)[^"]*"/g
    ),
  ].map((m) => unescape(m[1]));

  const city = find1(/"city":"([^"]+)"/, chunk);
  const state = find1(/"state":"([^"]+)"/, chunk);
  const postalCode = find1(/"postal_code":"([^"]+)"/, chunk);
  const country = find1(/"country_alpha_two":"([^"]+)"/, chunk) || "MX";
  const lat = find1(/"latitude":([\d.\-]+)/, chunk);
  const lng = find1(/"longitude":([\d.\-]+)/, chunk);

  const availability = find1(/"display_label":"([^"]+)","icon_name":"clock"/, chunk);
  const creationTime = find1(/"creation_time":(\d{10})/, html);
  const postedAt = creationTime
    ? new Date(parseInt(creationTime) * 1000).toISOString()
    : "";

  const listingType = find1(/"__isMarketplace(\w+Listing)"/, chunk);
  const isShipping = /"is_shipping_offered":true/.test(chunk);
  const postId = find1(/"post_id":"(\d+)"/, chunk);

  const sellerName = find1(/"actors":\[\{"__typename":"User","name":"([^"]+)"/, chunk);
  const sellerId = find1(
    /"actors":\[\{"__typename":"User","name":"[^"]+","id":"(\d+)"/,
    chunk
  );

  // Target listing_photos array — avoids profile photos and related thumbnails.
  // Confirmed FB structure: "listing_photos":[{"__typename":"Photo","image":{"height":N,"width":N,"uri":"..."}}]
  let images: string[] = [];
  const photosStart = html.indexOf('"listing_photos"');
  if (photosStart !== -1) {
    const photosChunk = html.slice(photosStart, photosStart + 25000);
    const rawImgs = [
      ...photosChunk.matchAll(/"image":\{"height":\d+,"width":\d+,"uri":"(https:[^"]+)"/g),
    ];
    images = [...new Set(rawImgs.map((m) => unescape(m[1])))];
  }
  if (images.length === 0) {
    const rawImgs = [
      ...html.matchAll(
        /"image":\{"height":\d+,"width":\d+,"uri":"(https:[^"]*?t39\.30808-6[^"]*?)"/g
      ),
    ];
    images = [...new Set(rawImgs.map((m) => unescape(m[1])))];
  }

  return {
    title,
    price: {
      amount: priceAmount ? parseFloat(priceAmount) : null,
      currency: priceCurrency || "USD",
    },
    description,
    condition: "",
    category,
    unit_details: unitDetails,
    location: {
      city,
      state,
      postal_code: postalCode,
      country,
      coordinates: {
        latitude: lat ? parseFloat(lat) : null,
        longitude: lng ? parseFloat(lng) : null,
      },
    },
    availability: unescape(availability),
    posted_at: postedAt,
    listing_type: listingType ? `Marketplace${listingType}` : "",
    is_shipping_offered: isShipping,
    post_id: postId,
    seller: {
      name: sellerName,
      id: sellerId,
      profile_url: sellerId
        ? `https://www.facebook.com/profile.php?id=${sellerId}`
        : "",
    },
    images,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Scrape a Facebook Marketplace listing URL.
 *
 * Restores the FB session from FB_SESSION_B64 on first call.
 * Throws if the session is expired or the page data cannot be extracted.
 *
 * NOTE: inferred fields are NOT preserved here — the caller (rescrape route)
 * reads the existing inferred data from Firebase and merges it.
 */
export async function scrapeUrl(url: string): Promise<Listing> {
  console.log(`[scraper] Starting scrape: ${url}`);
  await ensureSession();

  const id = extractIdFromUrl(url);
  const listing: Listing = {
    id,
    title: "",
    price: { amount: null, currency: "USD" },
    description: "",
    condition: "",
    category: "",
    unit_details: [],
    location: {
      city: "", state: "", postal_code: "", country: "",
      coordinates: { latitude: null, longitude: null },
    },
    availability: "",
    posted_at: "",
    listing_type: "",
    is_shipping_offered: false,
    post_id: "",
    seller: { name: "", id: "", profile_url: "" },
    images: [],
    url: `https://www.facebook.com/marketplace/item/${id}/`,
    inferred: { pet_friendly: "unknown", has_view: 1, neighborhood: 1 },
  };

  // Strip FB_SESSION_B64 from the browser's env — it's ~5MB and causes E2BIG
  // when Playwright passes process.env to the Chromium child process.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { FB_SESSION_B64: _stripped, ...browserEnv } = process.env;
  const ctx = await chromium.launchPersistentContext(SESSION_DIR, {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    env: browserEnv as Record<string, string>,
  });

  let loginJustPerformed = false;

  try {
    const page = await ctx.newPage();

    // Verify FB session is still valid
    console.log("[scraper] Checking Facebook session validity...");
    await page.goto("https://www.facebook.com/", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await page.waitForTimeout(2000);

    const hasLoginForm = await page
      .locator('input[name="email"]')
      .isVisible()
      .catch(() => false);

    if (hasLoginForm) {
      const email = process.env.FB_EMAIL;
      const password = process.env.FB_PASSWORD;

      if (!email || !password) {
        throw new Error(
          "[scraper] Facebook session expired and FB_EMAIL/FB_PASSWORD are not set — " +
          "cannot auto re-login. Set these env vars in your environment or re-encode " +
          "the session manually. See docs/fb-session.md."
        );
      }

      console.log("[scraper] Session expired — attempting re-login with FB_EMAIL...");

      console.log(`[scraper] Pre-login URL: ${page.url()}`);
      console.log(`[scraper] Pre-login title: ${await page.title()}`);

      await page.fill('input[name="email"]', email);
      await page.fill('input[name="pass"]', password);
      // Press Enter — more reliable than clicking the submit button (selector varies by FB version)
      await page.keyboard.press("Enter");

      // Wait for FB to redirect away from the login page (up to 15s)
      try {
        await page.waitForURL(
          (u) => !u.pathname.startsWith("/login"),
          { timeout: 15000 }
        );
      } catch {
        // URL didn't change — fall through to explicit login-form check below
      }

      const postLoginUrl = page.url();
      const postLoginTitle = await page.title();
      console.log(`[scraper] Post-login URL: ${postLoginUrl}`);
      console.log(`[scraper] Post-login title: ${postLoginTitle}`);

      const loginFailed = await page
        .locator('input[name="email"]')
        .isVisible()
        .catch(() => false);

      console.log(`[scraper] Login form still visible: ${loginFailed}`);

      // Log a snippet of the page HTML to help diagnose security challenges
      const bodySnippet = await page.evaluate(() =>
        document.body?.innerText?.slice(0, 500) ?? ""
      ).catch(() => "");
      console.log(`[scraper] Page text snippet: ${bodySnippet}`);

      if (loginFailed) {
        throw new Error(
          `[scraper] Facebook re-login failed — login form still visible after submit. ` +
          `Post-login URL: ${postLoginUrl} | Title: "${postLoginTitle}". ` +
          `Possible causes: wrong FB_EMAIL/FB_PASSWORD, account locked, or Facebook is ` +
          `showing a security challenge. Check Railway deploy logs for page text snippet.`
        );
      }

      console.log("[scraper] Re-login successful");
      loginJustPerformed = true;
    } else {
      console.log("[scraper] Session valid — proceeding to listing");
    }

    // Navigate to the listing and wait for data to appear
    console.log(`[scraper] Navigating to listing: ${url}`);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

    let html = "";
    const start = Date.now();
    const deadline = start + 20000;
    while (Date.now() < deadline) {
      html = await page.content();
      if (
        html.includes('"listing_photos"') ||
        html.includes('"listing_price":{"amount":')
      )
        break;
      await page.waitForTimeout(1000);
    }
    console.log(`[scraper] Page data found after ${Date.now() - start}ms`);

    const parsed = parseHTML(html);
    if (parsed.title) {
      Object.assign(listing, parsed);
      console.log(`[scraper] Parsed: "${parsed.title}" (${parsed.images?.length ?? 0} images)`);
    } else {
      console.warn("[scraper] WARNING: Could not extract listing data from page HTML");
    }
  } finally {
    await ctx.close();
  }

  // Save refreshed session to Firebase after browser is fully closed
  if (loginJustPerformed) {
    try {
      await saveSessionToFirebase();
      console.log("[scraper] Session saved to Firebase — will survive container restart");
    } catch (err) {
      // Non-fatal — scrape already succeeded, just log the failure
      console.error(
        "[scraper] Warning: re-login succeeded but failed to save session to Firebase:", err
      );
      console.error(
        "[scraper] The session is valid for this process lifetime but will NOT survive a restart."
      );
    }
  }

  if (listing.images.length > 0) {
    console.log(`[scraper] Uploading ${listing.images.length} images to Firebase Storage...`);
    listing.images = await uploadImages(listing.id, listing.images);
  }

  console.log(`[scraper] Scrape complete: ${listing.id}`);
  return listing;
}
