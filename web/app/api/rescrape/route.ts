export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { ref, set, get } from "firebase/database";
import { db } from "@/lib/firebase";
import { scrapeUrl } from "@/lib/scraper";

// Scraping a FB listing takes 10-40s depending on page load speed
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { url } = await req.json();
  if (!url) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  // Check existing record first so we know whether to upload images
  const urlId = url.match(/\/item\/(\d+)/)?.[1];
  const existingSnap = urlId ? await get(ref(db, `listings/${urlId}`)) : null;
  const existing = existingSnap?.exists() ? existingSnap.val() : null;
  const hasExistingImages = existing?.images?.length > 0;

  let listing;
  try {
    listing = await scrapeUrl(url, { skipImageUpload: hasExistingImages });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Scrape failed" },
      { status: 500 }
    );
  }

  if (!listing.title) {
    return NextResponse.json(
      { error: "Could not extract listing data from page" },
      { status: 422 }
    );
  }

  // Preserve images and inferred fields from prior scrape
  if (existing) {
    if (existing.inferred) listing.inferred = { ...listing.inferred, ...existing.inferred };
    if (hasExistingImages) listing.images = existing.images;
    listing.dateAdded = existing.dateAdded ?? Date.now();
  } else {
    listing.dateAdded = Date.now();
  }

  await set(ref(db, `listings/${listing.id}`), listing);

  return NextResponse.json({ ok: true, listing });
}
