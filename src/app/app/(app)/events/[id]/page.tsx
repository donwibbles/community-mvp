"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

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
  starts_at: string; // ISO
  ends_at: string;   // ISO
  capacity: number;
};

export default function EventDetail() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [event, setEvent] = useState<EventRow | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [myShiftIds, setMyShiftIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string>("");

  async function loadAll() {
    setErr("");
    // Event
    const { data: ev } = await supabase
      .from("events")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    setEvent((ev as any) || null);

    // My shift RSVPs
    const { data: u } = await supabase.auth.getUser();
    if (u.user?.id) {
      const { data: ss } = await supabase
        .from("shift_signups")
        .select("shift_id")
        .eq("user_id", u.user.id);
      setMyShiftIds(new Set(((ss as any) ?? []).map((r: any) => r.shift_id)));
    } else {
      setMyShiftIds(new Set());
    }

    // Shifts
    const { data: sh } = await supabase
      .from("event_shifts")
      .select("*")
      .eq("event_id", id)
      .order("starts_at");
    setShifts((sh as any) ?? []);
  }

  useEffect(() => {
    loadAll();
  }, [id]);

  async function rsvpShift(shiftId: string) {
    setSaving(true);
    setErr("");
    // Try capacity-aware RPC first
    const { data: res, error } = await supabase.rpc("rsvp_shift_simple", { p_shift_id: shiftId });
    if (error) {
      // Fallback: plain upsert
      await supabase.from("shift_signups").upsert({ shift_id: shiftId });
      await loadAll();
      setSaving(false);
      return;
    }
    if (res === "full") setErr("This shift is full.");
    if (res === "ok") await loadAll();
    setSaving(false);
  }

  async function cancelShift(shiftId: string) {
    setSaving(true);
    setErr("");
    await supabase.from("shift_signups").upsert({ shift_id: shiftId, status: "cancelled" });
    await loadAll();
    setSaving(false);
  }

  if (!event) return <div style={{ padding: 16 }}>Loading…</div>;

  return (
    <div style={{ padding: 16, display: "grid", gap: 14, maxWidth: 760 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <h1 style={{ margin: 0 }}>{event.title}</h1>
          <div style={{ color: "#666" }}>
            {new Date(event.starts_at).toLocaleString()} – {new Date(event.ends_at).toLocaleString()}
          </div>
          {event.location && <div>{event.location}</div>}
        </div>
        <a href={`/app/events/${id}/edit`} style={{ textDecoration: "underline" }}>Edit</a>
      </div>

      {event.description && (
        <p style={{ whiteSpace: "pre-wrap" }}>{event.description}</p>
      )}

      <h2>Shifts</h2>
      {shifts.length === 0 && <div style={{ color: "#666" }}>No shifts yet.</div>}

      <div style={{ display: "grid", gap: 10 }}>
        {shifts.map((s) => {
          const mine = myShiftIds.has(s.id);
          return (
            <div
              key={s.id}
              style={{
                border: "1px solid #eee",
                borderRadius: 8,
                padding: 10,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ fontWeight: 600 }}>
                  {new Date(s.starts_at).toLocaleString()} – {new Date(s.ends_at).toLocaleString()}
                </div>
                <div style={{ fontSize: 12, color: "#666" }}>
                  Capacity: {s.capacity === 0 ? "Unlimited" : s.capacity}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {!mine ? (
                  <button
                    onClick={() => rsvpShift(s.id)}
                    disabled={saving}
                    style={{
                      background: "black",
                      color: "white",
                      borderRadius: 8,
                      padding: "6px 10px",
                    }}
                  >
                    {saving ? "…" : "RSVP Going"}
                  </button>
                ) : (
                  <button
                    onClick={() => cancelShift(s.id)}
                    disabled={saving}
                    style={{
                      background: "#f5f5f5",
                      border: "1px solid #ddd",
                      borderRadius: 8,
                      padding: "6px 10px",
                    }}
                  >
                    {saving ? "…" : "Cancel"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {err && <div style={{ color: "crimson" }}>{err}</div>}
    </div>
  );
}
