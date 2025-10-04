"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

// Make this route fully dynamic (no prerender)
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default function CheckinPage() {
  const q = useSearchParams();
  const token = q.get("token") || "";
  const [valid, setValid] = useState<boolean | null>(null);
  const [shiftId, setShiftId] = useState<string>("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!token) {
      setValid(false);
      setMsg("Missing check-in token.");
      return;
    }
    (async () => {
      try {
        const r = await fetch(`/api/checkin/validate?token=${encodeURIComponent(token)}`, {
          cache: "no-store",
        });
        const data = await r.json();
        if (!data.valid) {
          setValid(false);
          setMsg("This check-in code is invalid or expired.");
          return;
        }
        setValid(true);
        setShiftId(data.shift_id);
      } catch {
        setValid(false);
        setMsg("Unable to validate check-in code.");
      }
    })();
  }, [token]);

  async function checkIn() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      window.location.href = "/login";
      return;
    }
    const { error } = await supabase
      .from("shift_signups")
      .upsert({ shift_id: shiftId, status: "attended" });
    if (error) setMsg(error.message);
    else setMsg("✅ Checked in! Thank you for volunteering.");
  }

  if (valid === null) return <div style={{ padding: 16 }}>Validating…</div>;
  if (valid === false) return <div style={{ padding: 16 }}>{msg}</div>;

  return (
    <div style={{ padding: 16 }}>
      <h1>Shift check-in</h1>
      <p>Please tap the button below to check in.</p>
      <button
        onClick={checkIn}
        style={{ background: "black", color: "white", borderRadius: 8, padding: "10px 14px" }}
      >
        Check me in
      </button>
      {msg && <p style={{ marginTop: 10 }}>{msg}</p>}
    </div>
  );
}
