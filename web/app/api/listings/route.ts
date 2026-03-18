import { NextRequest, NextResponse } from "next/server";
import { ref, set, remove } from "firebase/database";
import { db } from "@/lib/firebase";

export async function PATCH(req: NextRequest) {
  const { id, inferred } = await req.json();
  if (!id || !inferred) {
    return NextResponse.json({ error: "Missing id or inferred" }, { status: 400 });
  }

  // Deep-path set per key — no read-before-write, won't stomp sibling inferred fields
  await Promise.all(
    Object.entries(inferred).map(([key, val]) =>
      set(ref(db, `listings/${id}/inferred/${key}`), val)
    )
  );

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  await remove(ref(db, `listings/${id}`));
  return NextResponse.json({ ok: true });
}
