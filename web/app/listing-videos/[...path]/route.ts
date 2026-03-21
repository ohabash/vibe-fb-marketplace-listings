export const dynamic = "force-dynamic";

/**
 * Proxy handler for /listing-videos/**
 *
 * Serves videos from Firebase Storage with range request support
 * so browsers can seek within video files.
 */
import { NextRequest, NextResponse } from "next/server";

const BUCKET = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!;
const STORAGE_BASE = `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o`;

export async function GET(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const storagePath = `listing-videos/${params.path.join("/")}`;
  const encodedPath = encodeURIComponent(storagePath);
  const url = `${STORAGE_BASE}/${encodedPath}?alt=media`;

  const headers: HeadersInit = {};
  const range = req.headers.get("range");
  if (range) headers["Range"] = range;

  try {
    const upstream = await fetch(url, { headers });

    if (!upstream.ok && upstream.status !== 206) {
      return new NextResponse(null, { status: 404 });
    }

    const contentType = upstream.headers.get("content-type") ?? "video/mp4";
    const contentLength = upstream.headers.get("content-length");
    const contentRange = upstream.headers.get("content-range");

    const resHeaders: Record<string, string> = {
      "Content-Type": contentType,
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=31536000, immutable",
    };
    if (contentLength) resHeaders["Content-Length"] = contentLength;
    if (contentRange) resHeaders["Content-Range"] = contentRange;

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: resHeaders,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[listing-videos proxy] ${message}`);
    return new NextResponse(null, { status: 404 });
  }
}
