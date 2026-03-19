/**
 * Opens a headed browser on the local fb_session/ so you can log in to Facebook.
 * When you're done, press Enter in this terminal to save and close.
 *
 * After this script exits, run:
 *   npx tsx scripts/push-session.ts
 */
import path from "path";
import { chromium } from "playwright";
import readline from "readline";

const SESSION_DIR = path.resolve(__dirname, "../fb_session");

async function main() {
  console.log("Opening headed browser with fb_session/ ...");
  const ctx = await chromium.launchPersistentContext(SESSION_DIR, {
    headless: false,
    args: ["--no-sandbox"],
  });

  const page = await ctx.newPage();
  await page.goto("https://www.facebook.com/marketplace/");

  console.log("\nLog in to Facebook in the browser window.");
  console.log("When done (marketplace loads), press Enter here to close and save.\n");

  await new Promise<void>((resolve) => {
    const rl = readline.createInterface({ input: process.stdin });
    rl.once("line", () => { rl.close(); resolve(); });
  });

  await ctx.close();
  console.log("\n✓ Browser closed. Session saved to fb_session/");
  console.log("Now run: npx tsx scripts/push-session.ts");
}

main().catch((e) => { console.error(e); process.exit(1); });
