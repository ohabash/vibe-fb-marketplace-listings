import { chromium } from "playwright";
import * as fs from "fs";
import * as https from "https";
import * as path from "path";

const SESSION_PATH = path.resolve("./fb_session");
const LISTINGS_PATH = path.resolve("./listings.json");
const IMAGES_DIR = path.resolve("./web/public/listing-images");
const DEBUG = process.argv.includes("--debug");

interface Listing {
  id: string;
  title: string;
  price: { amount: number | null; currency: string; text?: string };
  description: string;
  condition: string;
  category: string;
  unit_details: string[];
  location: {
    city: string;
    state: string;
    postal_code: string;
    country: string;
    coordinates: { latitude: number | null; longitude: number | null };
  };
  availability: string;
  posted_at: string;
  listing_type: string;
  is_shipping_offered: boolean;
  post_id: string;
  seller: { name: string; id: string; profile_url: string };
  images: string[];
  url: string;
  inferred: {
    pet_friendly: "unknown" | boolean;
    has_view: 1 | 2 | 3;
    neighborhood: 1 | 2 | 3;
  };
}

function extractIdFromUrl(url: string): string {
  const match = url.match(/\/item\/(\d+)/);
  return match ? match[1] : String(Date.now());
}

function find1(pattern: RegExp, text: string): string {
  const m = text.match(pattern);
  return m ? m[1] : "";
}

function unescape(s: string): string {
  return s
    .replace(/\\\//g, "/")
    .replace(/\\n/g, "\n")
    .replace(/\\"/g, '"')
    .replace(/\\u[\dA-Fa-f]{4}/g, (m) =>
      String.fromCharCode(parseInt(m.slice(2), 16))
    );
}

// Download a single image URL to a local file path.
function downloadImage(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (res) => {
      res.pipe(file);
      file.on("finish", () => { file.close(); resolve(); });
      file.on("error", (err) => { fs.unlink(dest, () => {}); reject(err); });
    }).on("error", (err) => { fs.unlink(dest, () => {}); reject(err); });
  });
}

// Download carousel images locally and return the local public paths.
// Falls back to the original remote URL for any image that fails to download.
async function localizeImages(id: string, remoteUrls: string[]): Promise<string[]> {
  const dir = path.join(IMAGES_DIR, id);
  fs.mkdirSync(dir, { recursive: true });

  const results: string[] = [];
  for (let i = 0; i < remoteUrls.length; i++) {
    const dest = path.join(dir, `${i}.jpg`);
    try {
      await downloadImage(remoteUrls[i], dest);
      results.push(`/listing-images/${id}/${i}.jpg`);
      console.log(`  Downloaded image ${i + 1}/${remoteUrls.length}`);
    } catch (err) {
      console.warn(`  Failed to download image ${i}: ${err}`);
      results.push(remoteUrls[i]);
    }
  }
  return results;
}

// Extract all listing data from the page HTML using regex.
// FB embeds the full listing JSON in the page source with escaped slashes (\/).
function parseHTML(html: string): Partial<Listing> {
  // Primary anchor: listing_price — this is always adjacent to all listing data
  const priceIdx = html.indexOf('"listing_price":');
  if (priceIdx === -1) return {};
  // Wide window: 100K before anchor (covers listing_photos, actors, description)
  // and 30K after (covers geo, category, etc.)
  const chunk = html.slice(Math.max(0, priceIdx - 100000), priceIdx + 30000);

  const title = unescape(find1(/"marketplace_listing_title":"((?:[^"\\]|\\.)*)"/, chunk));
  // Extract price directly from the anchor to avoid picking up an earlier USD-normalized field
  const priceAnchorChunk = html.slice(priceIdx, priceIdx + 200);
  const priceAmount = find1(/"listing_price":\{[^}]*"amount":"([^"]+)"/, priceAnchorChunk);
  const priceCurrency = find1(/"listing_price":\{[^}]*"currency":"([^"]+)"/, priceAnchorChunk);
  const priceText = find1(/"formatted_price":\{"text":"([^"]+)"/, priceAnchorChunk);

  // Description — stop at the closing " that is not escaped
  const descMatch = chunk.match(/"redacted_description":\{"text":"([\s\S]*?)"(?:,|\})/);
  const description = descMatch ? unescape(descMatch[1]) : "";

  const category = find1(/"marketplace_listing_category":\{"slug":"([^"]+)"/, chunk);

  const unitDetails = [...chunk.matchAll(
    /"display_label":"([^"]+)","icon_name":"(?:building|bedrooms|washing|car)[^"]*"/g
  )].map(m => unescape(m[1]));

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

  // Seller — look for actors array near listing
  const sellerName = find1(/"actors":\[\{"__typename":"User","name":"([^"]+)"/, chunk);
  const sellerId = find1(/"actors":\[\{"__typename":"User","name":"[^"]+","id":"(\d+)"/, chunk);

  // Images — target the listing_photos array specifically.
  // Confirmed structure from page HTML:
  //   "listing_photos":[{"__typename":"Photo","accessibility_caption":"...",
  //     "image":{"height":960,"width":720,"uri":"https:\/\/..."},"id":"..."},...]
  // This avoids profile photos, related listing thumbnails, and other page imagery.
  let images: string[] = [];
  const photosStart = html.indexOf('"listing_photos"');
  if (photosStart !== -1) {
    const photosChunk = html.slice(photosStart, photosStart + 25000);
    const rawImgs = [...photosChunk.matchAll(
      /"image":\{"height":\d+,"width":\d+,"uri":"(https:[^"]+)"/g
    )];
    images = [...new Set(rawImgs.map(m => unescape(m[1])))];
  }
  // Fallback: broader search for the same image node pattern
  if (images.length === 0) {
    const rawImgs = [...html.matchAll(
      /"image":\{"height":\d+,"width":\d+,"uri":"(https:[^"]*?t39\.30808-6[^"]*?)"/g
    )];
    images = [...new Set(rawImgs.map(m => unescape(m[1])))];
  }

  return {
    title,
    price: {
      amount: priceAmount ? parseFloat(priceAmount) : null,
      currency: priceCurrency || "MXN",
      text: priceText || undefined,
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

async function scrape(url: string): Promise<Listing> {
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

  const ctx = await chromium.launchPersistentContext(SESSION_PATH, {
    headless: false,
  });

  const page = await ctx.newPage();

  // Check login
  console.log("Checking login status...");
  await page.goto("https://www.facebook.com/", {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  await page.waitForTimeout(2000);

  const hasLoginForm = await page
    .locator('input[name="email"]')
    .isVisible()
    .catch(() => false);
  const hasUserMenu = await page
    .locator('div[aria-label*="Account"]')
    .isVisible()
    .catch(() => false);

  if (hasLoginForm || !hasUserMenu) {
    console.log("\n>>> Log into Facebook in the browser, then press Enter here...");
    await new Promise<void>((resolve) => {
      process.stdin.resume();
      process.stdin.once("data", () => {
        process.stdin.pause();
        resolve();
      });
    });
  }

  console.log("Navigating to listing...");
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

  // Poll page content until listing data appears (up to 20s)
  let html = "";
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    html = await page.content();
    if (html.includes('"listing_photos"') || html.includes('"listing_price":{"amount":')) break;
    await page.waitForTimeout(1000);
  }

  if (DEBUG) {
    fs.writeFileSync("debug_page.html", html);
    console.log("Saved debug_page.html");
  }

  const parsed = parseHTML(html);

  if (parsed.title) {
    Object.assign(listing, parsed);
    console.log(`Parsed: ${listing.title} (${listing.images.length} images)`);
  } else {
    console.warn("Could not extract listing data from HTML.");
  }

  await ctx.close();
  return listing;
}

async function saveListing(listing: Listing) {
  if (!listing.title) {
    console.warn("Skipping save — no data was extracted.");
    return;
  }

  // Download carousel images to web/public/listing-images/{id}/
  if (listing.images.length > 0) {
    console.log(`Downloading ${listing.images.length} images locally...`);
    listing.images = await localizeImages(listing.id, listing.images);
  }

  const listings: Listing[] = fs.existsSync(LISTINGS_PATH)
    ? JSON.parse(fs.readFileSync(LISTINGS_PATH, "utf-8"))
    : [];

  const idx = listings.findIndex((l) => l.id === listing.id);
  if (idx >= 0) {
    // Preserve user-set inferred fields on rescrape
    listing.inferred = {
      ...listing.inferred,
      ...listings[idx].inferred,
    };
    listings[idx] = listing;
  } else {
    listings.push(listing);
  }

  fs.writeFileSync(LISTINGS_PATH, JSON.stringify(listings, null, 2));
  console.log(`Saved listing ${listing.id}: ${listing.title}`);
}

async function main() {
  const url = process.argv.find(
    (a) => a.startsWith("http") || a.includes("facebook.com")
  );
  if (!url) {
    console.error("Usage: npm run scrape <facebook-marketplace-url>");
    process.exit(1);
  }

  const listing = await scrape(url);
  await saveListing(listing);
  console.log(JSON.stringify(listing, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
