import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { supabase } from "@/lib/supabase";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const shiftId = params.id;

  // 1) generate one-time token (short)
  const token = randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 8).toISOString(); // 8h

  // 2) store
  const { error } = await supabase
    .from("shift_checkin_tokens")
    .insert({ shift_id: shiftId, token, expires_at: expiresAt, used_at: null });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 3) build public URL
  const base =
    process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL;
  if (!base) {
    return NextResponse.json(
      { error: "Missing NEXT_PUBLIC_APP_URL" },
      { status: 500 }
    );
  }
  const url = `${base}/checkin?token=${encodeURIComponent(token)}`;

  return NextResponse.json({ url });
}
