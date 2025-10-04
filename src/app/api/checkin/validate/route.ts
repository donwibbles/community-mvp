import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token") || "";
  if (!token) return NextResponse.json({ valid: false });

  // token exists and not expired/used
  const { data, error } = await supabase
    .from("shift_checkin_tokens")
    .select("shift_id, expires_at, used_at")
    .eq("token", token)
    .maybeSingle();

  if (error || !data) return NextResponse.json({ valid: false });

  const now = Date.now();
  const expired = new Date(data.expires_at).getTime() < now;
  const used = !!data.used_at;

  if (expired || used) return NextResponse.json({ valid: false });

  return NextResponse.json({ valid: true, shift_id: data.shift_id });
}
