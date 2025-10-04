import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE!
  );
}

// DELETE /api/admin/invites/:email  → set status='revoked'
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { email: string } }
) {
  const email = decodeURIComponent(params.email).toLowerCase();
  const db = svc();
  const { error } = await db
    .from("invites")
    .update({ status: "revoked" })
    .eq("email", email);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
