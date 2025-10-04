import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const shiftId = params.id;

  // signups + profiles
  const { data: signups, error: e1 } = await supabase
    .from("shift_signups")
    .select("user_id, status, checked_in_at")
    .eq("shift_id", shiftId);

  if (e1) {
    return NextResponse.json({ error: e1.message }, { status: 500 });
  }
  const userIds = Array.from(
    new Set((signups ?? []).map((s: any) => s.user_id).filter(Boolean))
  );
  const { data: profiles, error: e2 } = await supabase
    .from("profiles")
    .select("id, display_name, email")
    .in("id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]);

  if (e2) {
    return NextResponse.json({ error: e2.message }, { status: 500 });
  }
  const pmap = new Map(profiles?.map((p: any) => [p.id, p]) ?? []);

  // CSV
  const header = ["Name", "Email", "Status", "Checked In At"];
  const rows = (signups ?? []).map((s: any) => {
    const p = pmap.get(s.user_id);
    return [
      (p?.display_name || p?.email || "").replaceAll(",", " "),
      (p?.email || "").replaceAll(",", " "),
      s.status,
      s.checked_in_at ? new Date(s.checked_in_at).toISOString() : "",
    ].join(",");
  });

  const csv = [header.join(","), ...rows].join("\n");
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="shift-${shiftId}-roster.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
