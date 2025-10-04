"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Role = "admin" | "user" | "moderator";
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
type CountRow = { shift_id: string; going_count: number };

export default function EventDetail() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [event, setEvent] = useState<EventRow | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [myShiftIds, setMyShiftIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  // Roster drawer
  const [rosterShiftId, setRosterShiftId] = useState<string | null>(null);
  const [roster, setRoster] = useState<Array<{ user_id: string; name: string; email: string; status: string; checked_in_at: string | null }>>([]);

  // admin shift form
  const [sStart, setSStart] = useState("");
  const [sEnd, setSEnd] = useState("");
  const [sCap, setSCap] = useState<number>(0);

  async function loadAll() {
    setErr("");
    const { data: ev } = await supabase.from("events").select("*").eq("id", id).maybeSingle();
    setEvent((ev as any) ?? null);

    // role + my signups
    const { data: u } = await supabase.auth.getUser();
    if (u.user?.id) {
      const { data: prof } = await supabase.from("profiles").select("role").eq("id", u.user.id).maybeSingle();
      setRole(((prof as any)?.role ?? "user") as Role);
      const { data: ss } = await supabase.from("shift_signups").select("shift_id").eq("user_id", u.user.id).eq("status","going");
      setMyShiftIds(new Set(((ss as any) ?? []).map((r: any) => r.shift_id)));
    } else {
      setRole(null);
      setMyShiftIds(new Set());
    }

    const { data: sh } = await supabase.from("event_shifts").select("*").eq("event_id", id).order("starts_at");
    const list = (sh as any as Shift[]) ?? [];
    setShifts(list);

    // counts
    const { data: sc } = await supabase.from("shift_counts").select("*").in("shift_id", list.map(s => s.id));
    const map: Record<string, number> = {};
    ((sc as any) ?? []).forEach((r: CountRow) => map[r.shift_id] = r.going_count);
    setCounts(map);
  }

  useEffect(() => { loadAll(); }, [id]);

  // ===== Actions =====

  async function rsvpShift(shiftId: string) {
    setSaving(true); setErr("");
    // if full, offer waitlist
    const go = counts[shiftId] ?? 0;
    const cap = shifts.find(s => s.id === shiftId)?.capacity ?? 0;
    const full = cap !== 0 && go >= cap;

    if (full) {
      // join waitlist
      const { data: u } = await supabase.auth.getUser();
      if (!u.user?.id) { setErr("Please log in."); setSaving(false); return; }
      const { error } = await supabase.from("shift_waitlist").upsert({ shift_id: shiftId, user_id: u.user.id });
      if (error) setErr(error.message);
      else setErr("Shift is full. You’ve been added to the waitlist.");
      setSaving(false);
      return;
    }

    // normal RSVP
    await supabase.from("shift_signups").upsert({ shift_id: shiftId, status: "going" });
    await loadAll();
    setSaving(false);
  }

  async function cancelShift(shiftId: string) {
    setSaving(true); setErr("");
    await supabase.from("shift_signups").upsert({ shift_id: shiftId, status: "cancelled" });
    await loadAll();
    setSaving(false);
  }

  async function markAttendance(shiftId: string, userId: string, attended: boolean) {
    if (role !== "admin" && role !== "moderator") return;
    setSaving(true);
    await supabase.from("shift_signups")
      .update({
        status: attended ? "attended" : "no_show",
        checked_in_at: attended ? new Date().toISOString() : null,
        checkin_method: attended ? "manual" : null
      })
      .eq("shift_id", shiftId)
      .eq("user_id", userId);
    await openRoster(shiftId);
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

  async function openRoster(shiftId: string) {
    setRosterShiftId(shiftId);
    const res = await fetch(`/api/shifts/${shiftId}/roster`);
    const data = await res.json();
    setRoster(data.roster ?? []);
  }

  function exportCsv(shiftId: string) {
    window.location.href = `/api/shifts/${shiftId}/export`;
  }

  function icsLink(s: Shift) {
    const title = encodeURIComponent(event?.title ?? "Community Shift");
    const details = encodeURIComponent(event?.description ?? "");
    const location = encodeURIComponent(event?.location ?? "");
    const start = new Date(s.starts_at).toISOString().replace(/[-:]/g,"").replace(/\.\d{3}Z$/,"Z");
    const end = new Date(s.ends_at).toISOString().replace(/[-:]/g,"").replace(/\.\d{3}Z$/,"Z");
    const ics =
`BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Community MVP//EN
BEGIN:VEVENT
UID:${s.id}
DTSTAMP:${start}
DTSTART:${start}
DTEND:${end}
SUMMARY:${title}
DESCRIPTION:${details}
LOCATION:${location}
END:VEVENT
END:VCALENDAR`;
    return "data:text/calendar;charset=utf-8," + encodeURIComponent(ics);
  }

  if (!event) return <div style={{ padding: 16 }}>Loading…</div>;

  return (
    <div style={{ padding: 16, display: "grid", gap: 14, maxWidth: 900 }}>
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
            const going = counts[s.id] ?? 0;
            const cap = s.capacity === 0 ? "∞" : s.capacity;
            const full = s.capacity !== 0 && going >= s.capacity;

            return (
              <div key={s.id} style={{ border: "1px solid #eee", borderRadius: 8, padding: 10, display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{start} – {end}</div>
                  <div style={{ fontSize: 12, color: full ? "#b91c1c" : "#666" }}>
                    Going: {going} / {cap} {full && "(Full)"}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <a href={icsLink(s)} download={`shift-${s.id}.ics`} style={{ fontSize: 12, textDecoration: "underline" }}>
                    Add to calendar
                  </a>

                  {!mine ? (
                    <button
                      onClick={() => rsvpShift(s.id)}
                      disabled={saving}
                      style={{ background: "black", color: "white", borderRadius: 8, padding: "6px 10px" }}
                    >
                      {full ? "Join waitlist" : "RSVP Going"}
                    </button>
                  ) : (
                    <button
                      onClick={() => cancelShift(s.id)}
                      disabled={saving}
                      style={{ background: "#f5f5f5", border: "1px solid #ddd", borderRadius: 8, padding: "6px 10px" }}
                    >
                      Cancel
                    </button>
                  )}

                  {(role === "admin" || role === "moderator") && (
                    <button
                      onClick={() => openRoster(s.id)}
                      style={{ border: "1px solid #ddd", borderRadius: 8, padding: "6px 10px" }}
                    >
                      Roster
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
                style={{ width: 220, border: "1px solid #ddd", borderRadius: 8, padding: "8px 10px" }} />
              <button onClick={createShift} disabled={saving}
                style={{ background: "black", color: "white", borderRadius: 8, padding: "8px 12px" }}>
                {saving ? "…" : "Save shift"}
              </button>
            </div>
          </div>
        )}

        {err && <div style={{ color: "crimson", marginTop: 8 }}>{err}</div>}
      </div>

      {/* Roster drawer */}
      {rosterShiftId && (
        <div style={{ position: "fixed", right: 16, top: 16, bottom: 16, width: 360, background: "#fff", border: "1px solid #eee", borderRadius: 12, padding: 12, overflow: "auto", boxShadow: "0 10px 30px rgba(0,0,0,0.08)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ margin: 0 }}>Roster</h3>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => exportCsv(rosterShiftId)} style={{ fontSize: 12, border: "1px solid #ddd", borderRadius: 8, padding: "6px 10px" }}>
                Export CSV
              </button>
              <button onClick={() => setRosterShiftId(null)} style={{ fontSize: 12 }}>
                Close
              </button>
            </div>
          </div>

          <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
            {roster.length === 0 && <div style={{ color: "#666" }}>No signups yet.</div>}
            {roster.map((r) => (
              <div key={r.user_id} style={{ border: "1px solid #eee", borderRadius: 8, padding: 8, display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{r.name}</div>
                  <div style={{ fontSize: 12, color: "#666" }}>{r.email}</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>
                    Status: <strong>{r.status}</strong>
                    {r.checked_in_at && <> • Checked in: {new Date(r.checked_in_at).toLocaleString()}</>}
                  </div>
                </div>
                {(role === "admin" || role === "moderator") && (
                  <div style={{ display: "grid", gap: 6 }}>
                    <button onClick={() => markAttendance(rosterShiftId!, r.user_id, true)} style={{ border: "1px solid #ddd", borderRadius: 8, padding: "4px 8px" }}>
                      Mark attended
                    </button>
                    <button onClick={() => markAttendance(rosterShiftId!, r.user_id, false)} style={{ border: "1px solid #ddd", borderRadius: 8, padding: "4px 8px" }}>
                      Mark no-show
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
