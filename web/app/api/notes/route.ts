export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { ref, set } from "firebase/database";
import { db } from "@/lib/firebase";

export async function POST(req: NextRequest) {
  const { id, notes } = await req.json();

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  await set(ref(db, `listings/${id}/notes`), notes ?? "");
  return NextResponse.json({ ok: true });
}
