export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { ref, get, set } from "firebase/database";
import { db } from "@/lib/firebase";
import { uploadToStorage } from "@/lib/firebase-storage";

function extFromMime(mime: string): string {
  if (mime.includes("mp4")) return "mp4";
  if (mime.includes("webm")) return "webm";
  if (mime.includes("quicktime") || mime.includes("mov")) return "mov";
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("gif")) return "gif";
  return "jpg";
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const id = formData.get("id");
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Missing listing id" }, { status: 400 });
  }

  const files = formData.getAll("files") as File[];
  if (!files.length) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }

  // Read current images/videos from RTDB
  const listingRef = ref(db, `listings/${id}`);
  const snap = await get(listingRef);
  const listing = snap.val() as { images?: string[]; videos?: string[] } | null;
  if (!listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  const images: string[] = listing.images ?? [];
  const videos: string[] = listing.videos ?? [];

  const timestamp = Date.now();

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const mime = file.type || "image/jpeg";
    const isVideo = mime.startsWith("video/");
    const ext = extFromMime(mime);

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (isVideo) {
      const storagePath = `listing-videos/${id}/user-${timestamp}-${i}.${ext}`;
      await uploadToStorage(buffer, storagePath, mime);
      videos.push(`/listing-videos/${id}/user-${timestamp}-${i}.${ext}`);
    } else {
      const storagePath = `listing-images/${id}/user-${timestamp}-${i}.${ext}`;
      await uploadToStorage(buffer, storagePath, mime);
      images.push(`/listing-images/${id}/user-${timestamp}-${i}.${ext}`);
    }
  }

  // Write updated arrays back to RTDB
  await Promise.all([
    set(ref(db, `listings/${id}/images`), images),
    set(ref(db, `listings/${id}/videos`), videos),
  ]);

  return NextResponse.json({ images, videos });
}
