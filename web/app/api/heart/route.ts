export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { ref, set } from "firebase/database";
import { db } from "@/lib/firebase";

export async function POST(req: NextRequest) {
  const { id, field = "hearted", hearted } = await req.json();

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const safeField = field === "hearted2" ? "hearted2" : "hearted";
  await set(ref(db, `listings/${id}/${safeField}`), hearted ?? false);
  return NextResponse.json({ ok: true });
}
