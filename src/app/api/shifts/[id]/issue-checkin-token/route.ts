import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const shiftId = params.id;

  // token valid for 6 hours
  const expires = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();

  const { data: me } = await supabase.auth.getUser();
  const userId = me.user?.id;
  if (!userId) return NextResponse.json({ error: "Not authed" }, { status: 401 });

  // MUST be admin
  const { data: p } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  if ((p as any)?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await supabase
    .from("shift_checkin_tokens")
    .insert({ shift_id: shiftId, created_by: userId, expires_at: expires })
    .select("token, expires_at")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const url = `${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/checkin?token=${data?.token}`;
  return NextResponse.json({ token: data?.token, expires_at: data?.expires_at, url });
}
