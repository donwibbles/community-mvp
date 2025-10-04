"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Role = "admin" | "user";
type EventRow = {
  id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  location: string | null;
};

type Shift = {
  id: string;
  event_id: string;
  starts_at: string;
  ends_at: string;
  capacity: number;
};

export default function EventDetail() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [event, setEvent] = useState<EventRow | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [myShiftIds, setMyShiftIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string>("");

  // admin shift form
  const [sStart, setSStart] = useState("");
  const [sEnd, setSEnd] = useState("");
  const [sCap, setSCap] = useState<number>(0);

  async function loadAll() {
    setErr("");
    const { data: ev } = await supabase.from("events").select("*").eq("id", id).maybeSingle();
    setEvent((ev as any) || null);

    // role
    const { data: u } = await supabase.auth.getUser();
    if (u.user?.id) {
      const { data: prof } = await supabase.from("profiles").select("role").eq("id", u.user.id).maybeSingle();
      setRole(((prof as any)?.role ?? "user") as Role);
      // my shift signups
      const { data: ss } = await supabase.from("shift_signups").select("shift_id").eq("user_id", u.user.id);
      setMyShiftIds(new Set(((ss as any) ?? []).map((r: any) => r.shift_id)));
    } else {
      setRole(null);
      setMyShiftIds(new Set());
    }

    // shifts
    const { data: sh } = await supabase.from("event_shifts").select("*").eq("event_id", id).order("starts_at");
    setShifts((sh as any) ?? []);
  }

  useEffect(() => { loadAll(); }, [id]);

  async function rsvpShift(shiftId: string) {
    setSaving(true);
    setErr("");
    // try RPC first
    const { data: res, error } = await supabase.rpc("rsvp_shift_simple", { p_shift_id: shiftId });
    if (error) {
      // fallback: plain upsert (no capacity check)
      await supabase.from("shift_signups").upsert({ shift_id: shiftId });
      await loadAll();
      setSaving(false);
      return;
    }
    if (res === "full") {
      setErr("This shift is full.");
    } else if (res === "ok") {
      await loadAll();
    } else if (res === "not_authed") {
      setErr("Please log in.");
    } else if (res === "no_shift") {
      setErr("This shift no longer exists.");
    }
    setSaving(false);
  }

  async function cancelShift(shiftId: string) {
    setSaving(true);
    setErr("");
    await supabase.from("shift_signups").upsert({ shift_id: shiftId, status: "cancelled" });
    await loadAll();
    setSaving(false);
  }

  async function createShift() {
    if (role !== "admin") return;
    if (!sStart || !sEnd) { setErr("Start and End required"); return; }
    setSaving(true);
    const { error } = await supabase.from("event_shifts").insert({
      event_id: id,
      starts_at: new Date(sStart).toISOString(),
      ends_at: new Date(sEnd).toISOString(),
      capacity: Number.isFinite(Number(sCap)) ? Number(sCap) : 0,
    });
    if (error) setErr(error.message);
    setSStart(""); setSEnd(""); setSCap(0);
    await loadAll();
    setSaving(false);
  }

  if (!event) return <div style={{ padding: 16 }}>Loading…</div>;

  return (
    <div style={{ padding: 16, display: "grid", gap: 14, maxWidth: 760 }}>
      <div>
        <h1 style={{ margin: 0 }}>{event.title}</h1>
        <div style={{ color: "#666" }}>
          {new Date(event.starts_at).toLocaleString()} – {new Date(event.ends_at).toLocaleString()}
        </div>
        {event.location && <div>{event.location}</div>}
        {event.description && <p style={{ whiteSpace: "pre-wrap" }}>{event.description}</p>}
      </div>

      {/* Shifts */}
      <div>
        <h2 style={{ marginTop: 12 }}>Shifts</h2>

        {shifts.length === 0 && <div style={{ color: "#666" }}>No shifts yet.</div>}

        <div style={{ display: "grid", gap: 10 }}>
          {shifts.map((s) => {
            const mine = myShiftIds.has(s.id);
            const start = new Date(s.starts_at).toLocaleString();
            const end = new Date(s.ends_at).toLocaleString();
            return (
              <div key={s.id} style={{ border: "1px solid #eee", borderRadius: 8, padding: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{start} – {end}</div>
                  <div style={{ fontSize: 12, color: "#666" }}>
                    Capacity: {s.capacity === 0 ? "Unlimited" : s.capacity}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {!mine ? (
                    <button
                      onClick={() => rsvpShift(s.id)}
                      disabled={saving}
                      style={{ background: "black", color: "white", borderRadius: 8, padding: "6px 10px" }}
                    >
                      {saving ? "…" : "RSVP Going"}
                    </button>
                  ) : (
                    <button
                      onClick={() => cancelShift(s.id)}
                      disabled={saving}
                      style={{ background: "#f5f5f5", border: "1px solid #ddd", borderRadius: 8, padding: "6px 10px" }}
                    >
                      {saving ? "…" : "Cancel"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Admin: create shift */}
        {role === "admin" && (
          <div style={{ marginTop: 16, display: "grid", gap: 8, borderTop: "1px solid #eee", paddingTop: 12 }}>
            <h3 style={{ margin: 0 }}>Add shift</h3>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input type="datetime-local" value={sStart} onChange={e => setSStart(e.target.value)}
                style={{ border: "1px solid #ddd", borderRadius: 8, padding: "8px 10px" }} />
              <input type="datetime-local" value={sEnd} onChange={e => setSEnd(e.target.value)}
                style={{ border: "1px solid #ddd", borderRadius: 8, padding: "8px 10px" }} />
              <input type="number" min={0} value={sCap} onChange={e => setSCap(Number(e.target.value))}
                placeholder="Capacity (0 = unlimited)"
                style={{ width: 200, border: "1px solid #ddd", borderRadius: 8, padding: "8px 10px" }} />
              <button onClick={createShift} disabled={saving}
                style={{ background: "black", color: "white", borderRadius: 8, padding: "8px 12px" }}>
                {saving ? "…" : "Save shift"}
              </button>
            </div>
          </div>
        )}

        {err && <div style={{ color: "crimson", marginTop: 8 }}>{err}</div>}
      </div>
    </div>
  );
}
