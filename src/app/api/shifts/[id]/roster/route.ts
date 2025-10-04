import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const shiftId = params.id;

  const { data, error } = await supabase
    .from("shift_signups")
    .select("user_id, status, checked_in_at, profiles:profiles!inner(id, display_name, email)")
    .eq("shift_id", shiftId)
    .order("status", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const roster = (data ?? []).map((r: any) => ({
    user_id: r.user_id,
    status: r.status,
    checked_in_at: r.checked_in_at,
    name: r.profiles?.display_name || r.profiles?.email,
    email: r.profiles?.email || "",
  }));

  return NextResponse.json({ roster });
}
