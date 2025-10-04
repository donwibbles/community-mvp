import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const { data, error } = await supabase
    .from("shift_checkin_tokens")
    .select("token, shift_id, expires_at")
    .eq("token", token)
    .maybeSingle();

  if (error || !data) return NextResponse.json({ valid: false, error: "Invalid token" }, { status: 404 });

  const expired = new Date(data.expires_at).getTime() < Date.now();
  return NextResponse.json({ valid: !expired, shift_id: data.shift_id, expires_at: data.expires_at });
}
