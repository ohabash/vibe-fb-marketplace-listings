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

  let listing;
  try {
    listing = await scrapeUrl(url, { skipImageUpload: true });
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

  // Preserve images, inferred fields, and dateAdded from any prior scrape
  const existingSnap = await get(ref(db, `listings/${listing.id}`));
  if (existingSnap.exists()) {
    const existing = existingSnap.val();
    if (existing.inferred) listing.inferred = { ...listing.inferred, ...existing.inferred };
    if (existing.images?.length) listing.images = existing.images;
    listing.dateAdded = existing.dateAdded ?? Date.now(); // backfill if missing
  } else {
    listing.dateAdded = Date.now();
  }

  await set(ref(db, `listings/${listing.id}`), listing);

  return NextResponse.json({ ok: true, listing });
}
