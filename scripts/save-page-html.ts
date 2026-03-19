/**
 * Saves a scraped FB Marketplace listing page HTML to a reference file.
 * Used to inspect available data fields for scraper development.
 *
 *   npx tsx scripts/save-page-html.ts <listing-url>
 *
 * Output: scripts/scraped.page.example.html
 */
import path from "path";
import fs from "fs";
import { chromium } from "playwright";

const SESSION_DIR = path.resolve(__dirname, "../fb_session");
const OUT = path.resolve(__dirname, "scraped.page.example.html");

const url = process.argv[2];
if (!url) {
  console.error("Usage: npx tsx scripts/save-page-html.ts <listing-url>");
  process.exit(1);
}

async function main() {
  console.log("Launching browser with fb_session/ ...");
  const ctx = await chromium.launchPersistentContext(SESSION_DIR, {
    headless: true,
    args: ["--no-sandbox"],
  });

  const page = await ctx.newPage();

  console.log(`Navigating to: ${url}`);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

  // Poll until listing data appears (same logic as scraper)
  let html = "";
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    html = await page.content();
    if (html.includes('"listing_photos"') || html.includes('"listing_price":{"amount":')) break;
    await page.waitForTimeout(1000);
    process.stdout.write(".");
  }
  process.stdout.write("\n");

  await ctx.close();

  fs.writeFileSync(OUT, html, "utf8");
  console.log(`✓ Saved ${(html.length / 1024).toFixed(0)} KB → ${OUT}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
