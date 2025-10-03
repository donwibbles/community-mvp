import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();
  if (!email) return NextResponse.json({ error: "missing email" }, { status: 400 });

  const svc = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE! // admin perms only on the server
  );

  // Only allow if email is in invites and still pending
  const { data: invite, error: inviteErr } = await svc
    .from("invites")
    .select("*")
    .eq("email", email)
    .eq("status", "pending")
    .maybeSingle();

  if (inviteErr) {
    return NextResponse.json({ error: inviteErr.message }, { status: 500 });
  }
  if (!invite) {
    return NextResponse.json({ error: "This email is not invited" }, { status: 403 });
  }

  // Generate a magic link (admin API)
  const { data, error } = await svc.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/`
    }
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
