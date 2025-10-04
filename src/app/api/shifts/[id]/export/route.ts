import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const shiftId = params.id;

  const { data, error } = await supabase
    .from("shift_signups")
    .select("user_id, status, checked_in_at, profiles:profiles!inner(display_name, email)")
    .eq("shift_id", shiftId)
    .order("status", { ascending: false });

  if (error) return NextResponse.json(error.message, { status: 500 });

  const rows = (data ?? []).map((r: any) => ({
    Name: r.profiles?.display_name || r.profiles?.email || "",
    Email: r.profiles?.email || "",
    Status: r.status,
    "Checked In At": r.checked_in_at ?? "",
  }));

  const header = Object.keys(rows[0] ?? { Name: "", Email: "", Status: "", "Checked In At": "" });
  const csv = [
    header.join(","),
    ...rows.map((r) => header.map((h) => String((r as any)[h]).replace(/"/g, '""')).map((v) => `"${v}"`).join(",")),
  ].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="shift-${shiftId}-roster.csv"`,
    },
  });
}
