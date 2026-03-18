/**
 * Proxy handler for /listing-images/**
 *
 * Intercepts all requests to /listing-images/{id}/{n}.jpg and serves
 * the file from Firebase Storage. This replaces direct static-file serving
 * from public/listing-images/ — no DB path changes needed.
 */
import { NextRequest, NextResponse } from "next/server";
import { fetchFromStorage } from "@/lib/firebase-storage";

export async function GET(
  _req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const storagePath = `listing-images/${params.path.join("/")}`;

  try {
    const { buffer, contentType } = await fetchFromStorage(storagePath);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[listing-images proxy] ${message}`);
    return new NextResponse(null, { status: 404 });
  }
}
