"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Role = "admin" | "moderator" | "user";

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
  capacity: number; // 0 = unlimited
};

type CountRow = { shift_id: string; going_count: number };
type Skill = { id: string; name: string; category: string };

type RosterItem = {
  user_id: string;
  name: string;
  email: string;
  status: string; // going | cancelled | attended | no_show
  checked_in_at: string | null;
  skill_badges?: string[];
};

export default function EventDetail() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  // core data
  const [event, setEvent] = useState<EventRow | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [myShiftIds, setMyShiftIds] = useState<Set<string>>(new Set());

  // ui + errors
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  // admin: create shift
  const [sStart, setSStart] = useState("");
  const [sEnd, setSEnd] = useState("");
  const [sCap, setSCap] = useState<number>(0);

  // roster drawer
  const [rosterShiftId, setRosterShiftId] = useState<string | null>(null);
  const [roster, setRoster] = useState<RosterItem[]>([]);
  const [qrUrl, setQrUrl] = useState<string>("");

  // skills & required skills & filtering
  const [allSkills, setAllSkills] = useState<Skill[]>([]);
  const [requiredSkillIds, setRequiredSkillIds] = useState<Set<string>>(new Set());
  const [filterSkillId, setFilterSkillId] = useState<string>("");

  // -------------------- load helpers --------------------

  async function loadAll() {
    setErr("");

    // event
    const { data: ev } = await supabase.from("events").select("*").eq("id", id).maybeSingle();
    setEvent((ev as any) ?? null);

    // role + my signups
    const { data: u } = await supabase.auth.getUser();
    if (u.user?.id) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", u.user.id)
        .maybeSingle();
      setRole(((prof as any)?.role ?? "user") as Role);

      const { data: ss } = await supabase
        .from("shift_signups")
        .select("shift_id")
        .eq("user_id", u.user.id)
        .eq("status", "going");
      setMyShiftIds(new Set(((ss as any[]) ?? []).map((r: any) => r.shift_id)));
    } else {
      setRole(null);
      setMyShiftIds(new Set());
    }

    // shifts
    const { data: sh } = await supabase
      .from("event_shifts")
      .select("*")
      .eq("event_id", id)
      .order("starts_at");
    const list = (sh as any as Shift[]) ?? [];
    setShifts(list);

    // counts
    if (list.length) {
      const { data: sc } = await supabase
        .from("shift_counts")
        .select("*")
        .in("shift_id", list.map((s) => s.id));
      const map: Record<string, number> = {};
      ((sc as any[]) ?? []).forEach((r: CountRow) => (map[r.shift_id] = r.going_count));
      setCounts(map);
    } else {
      setCounts({});
    }
  }

  useEffect(() => {
    loadAll();
  }, [id]);

  // load skills once
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("skills").select("*").order("name");
      setAllSkills((data as any[]) ?? []);
    })();
  }, []);

  // -------------------- actions --------------------

  async function rsvpShift(shiftId: string) {
    setSaving(true);
    setErr("");

    // capacity check
    const going = counts[shiftId] ?? 0;
    const s = shifts.find((x) => x.id === shiftId);
    const cap = s?.capacity ?? 0;
    const full = cap !== 0 && going >= cap;

    const { data: u } = await supabase.auth.getUser();
    if (!u.user?.id) {
      setErr("Please log in.");
      setSaving(false);
      return;
    }

    if (full) {
      // join waitlist
      const { error } = await supabase
        .from("shift_waitlist")
        .upsert({ shift_id: shiftId, user_id: u.user.id });
      if (error) setErr(error.message);
      else setErr("Shift is full. You’ve been added to the waitlist.");
      setSaving(false);
      return;
    }

    // include user_id so roster can join to profiles
    await supabase
      .from("shift_signups")
      .upsert({ shift_id: shiftId, user_id: u.user.id, status: "going" });
    await loadAll();
    setSaving(false);
  }

  async function cancelShift(shiftId: string) {
    setSaving(true);
    setErr("");
    const { data: u } = await supabase.auth.getUser();
    if (!u.user?.id) {
      setSaving(false);
      return;
    }
    await supabase
      .from("shift_signups")
      .upsert({ shift_id: shiftId, user_id: u.user.id, status: "cancelled" });
    await loadAll();
    setSaving(false);
  }

  async function createShift() {
    if (role !== "admin") return;
    if (!sStart || !sEnd) {
      setErr("Start and End required");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("event_shifts").insert({
      event_id: id,
      starts_at: new Date(sStart).toISOString(),
      ends_at: new Date(sEnd).toISOString(),
      capacity: Number.isFinite(Number(sCap)) ? Number(sCap) : 0,
    });
    if (error) setErr(error.message);
    setSStart("");
    setSEnd("");
    setSCap(0);
    await loadAll();
    setSaving(false);
  }

  async function markAttendance(shiftId: string, userId: string, attended: boolean) {
    if (role !== "admin" && role !== "moderator") return;
    setSaving(true);
    await supabase
      .from("shift_signups")
      .update({
        status: attended ? "attended" : "no_show",
        checked_in_at: attended ? new Date().toISOString() : null,
        checkin_method: attended ? "manual" : null,
      })
      .eq("shift_id", shiftId)
      .eq("user_id", userId);
    await openRoster(shiftId);
    setSaving(false);
  }

  // roster open + required skills load
  async function openRoster(shiftId: string) {
    setRosterShiftId(shiftId);
    setQrUrl("");
    const res = await fetch(`/api/shifts/${shiftId}/roster`, { cache: "no-store" });
    const data = await res.json();
    setRoster((data?.roster ?? []) as RosterItem[]);
    const { data: reqs } = await supabase
      .from("shift_required_skills")
      .select("skill_id")
      .eq("shift_id", shiftId);
    setRequiredSkillIds(new Set(((reqs as any[]) ?? []).map((r) => r.skill_id)));
  }

  function exportCsv(shiftId: string) {
    window.location.href = `/api/shifts/${shiftId}/export`;
  }

  async function toggleRequiredSkill(shiftId: string, skillId: string) {
    if (role !== "admin") return;
    const next = new Set(requiredSkillIds);
    if (next.has(skillId)) {
      next.delete(skillId);
      await supabase
        .from("shift_required_skills")
        .delete()
        .eq("shift_id", shiftId)
        .eq("skill_id", skillId);
    } else {
      next.add(skillId);
      await supabase
        .from("shift_required_skills")
        .upsert({ shift_id: shiftId, skill_id: skillId });
    }
    setRequiredSkillIds(next);
  }

  async function showQr(shiftId: string) {
    const r = await fetch(`/api/shifts/${shiftId}/issue-checkin-token`, { method: "POST" });
    const data = await r.json();
    if (data?.url) setQrUrl(data.url);
  }

  function icsLink(s: Shift) {
    const title = encodeURIComponent(event?.title ?? "Community Shift");
    const details = encodeURIComponent(event?.description ?? "");
    const location = encodeURIComponent(event?.location ?? "");
    const start = new Date(s.starts_at)
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}Z$/, "Z");
    const end = new Date(s.ends_at)
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}Z$/, "Z");
    const ics = `BEGIN:VCALENDAR
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
            const capLabel = s.capacity === 0 ? "∞" : s.capacity;
            const full = s.capacity !== 0 && going >= s.capacity;

            return (
              <div
                key={s.id}
                style={{
                  border: "1px solid #eee",
                  borderRadius: 8,
                  padding: 10,
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>
                    {start} – {end}
                  </div>
                  <div style={{ fontSize: 12, color: full ? "#b91c1c" : "#666" }}>
                    Going: {going} / {capLabel} {full && "(Full)"}
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
              <input
                type="datetime-local"
                value={sStart}
                onChange={(e) => setSStart(e.target.value)}
                style={{ border: "1px solid #ddd", borderRadius: 8, padding: "8px 10px" }}
              />
              <input
                type="datetime-local"
                value={sEnd}
                onChange={(e) => setSEnd(e.target.value)}
                style={{ border: "1px solid #ddd", borderRadius: 8, padding: "8px 10px" }}
              />
              <input
                type="number"
                min={0}
                value={sCap}
                onChange={(e) => setSCap(Number(e.target.value))}
                placeholder="Capacity (0 = unlimited)"
                style={{ width: 220, border: "1px solid #ddd", borderRadius: 8, padding: "8px 10px" }}
              />
              <button
                onClick={createShift}
                disabled={saving}
                style={{ background: "black", color: "white", borderRadius: 8, padding: "8px 12px" }}
              >
                {saving ? "…" : "Save shift"}
              </button>
            </div>
          </div>
        )}

        {err && <div style={{ color: "crimson", marginTop: 8 }}>{err}</div>}
      </div>

      {/* Roster drawer */}
      {rosterShiftId && (
        <div
          style={{
            position: "fixed",
            right: 16,
            top: 16,
            bottom: 16,
            width: 420,
            background: "#fff",
            border: "1px solid #eee",
            borderRadius: 12,
            padding: 12,
            overflow: "auto",
            boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <h3 style={{ margin: 0 }}>Roster</h3>
            <div style={{ display: "flex", gap: 8 }}>
              {role === "admin" && (
                <button
                  onClick={() => showQr(rosterShiftId)}
                  style={{ fontSize: 12, border: "1px solid #ddd", borderRadius: 8, padding: "6px 10px" }}
                >
                  Show QR
                </button>
              )}
              <button
                onClick={() => exportCsv(rosterShiftId)}
                style={{ fontSize: 12, border: "1px solid #ddd", borderRadius: 8, padding: "6px 10px" }}
              >
                Export CSV
              </button>
              <button onClick={() => setRosterShiftId(null)} style={{ fontSize: 12 }}>
                Close
              </button>
            </div>
          </div>

          {qrUrl && (
            <div style={{ marginTop: 10, textAlign: "center" }}>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(qrUrl)}`}
                alt="Check-in QR"
                style={{ borderRadius: 8, border: "1px solid #eee" }}
              />
              <div style={{ fontSize: 12, color: "#666", marginTop: 6, wordBreak: "break-all" }}>{qrUrl}</div>
            </div>
          )}

          <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}>
            <label style={{ fontSize: 12, color: "#666" }}>Filter by skill:</label>
            <select
              value={filterSkillId}
              onChange={(e) => setFilterSkillId(e.target.value)}
              style={{ border: "1px solid #ddd", borderRadius: 8, padding: "6px 8px" }}
            >
              <option value="">All</option>
              {allSkills.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {role === "admin" && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Required skills for this shift:</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {allSkills.map((s) => (
                  <label
                    key={s.id}
                    style={{
                      border: "1px solid "#eee",
                      borderRadius: 999,
                      padding: "4px 8px",
                      fontSize: 12,
                      display: "flex",
                      gap: 6,
                      alignItems: "center",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={requiredSkillIds.has(s.id)}
                      onChange={() => toggleRequiredSkill(rosterShiftId!, s.id)}
                    />
                    {s.name}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
            {roster.length === 0 && <div style={{ color: "#666" }}>No signups yet.</div>}
            {roster
              .filter((r) => {
                if (!filterSkillId) return true;
                return r.skill_badges?.includes(allSkills.find((s) => s.id === filterSkillId)?.name || "_none_");
              })
              .map((r) => (
                <div
                  key={r.user_id}
                  style={{
                    border: "1px solid #eee",
                    borderRadius: 8,
                    padding: 8,
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    gap: 8,
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>{r.name}</div>
                    <div style={{ fontSize: 12, color: "#666" }}>{r.email}</div>

                    {r.skill_badges?.length ? (
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                        {r.skill_badges.map((b) => (
                          <span
                            key={b}
                            style={{
                              fontSize: 11,
                              border: "1px solid #eee",
                              borderRadius: 999,
                              padding: "2px 6px",
                              background: "#f8fafc",
                            }}
                          >
                            {b}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: "#888", marginTop: 6 }}>No skills listed</div>
                    )}

                    <div style={{ fontSize: 12, marginTop: 6 }}>
                      Status: <strong>{r.status}</strong>
                      {r.checked_in_at && <> • Checked in: {new Date(r.checked_in_at).toLocaleString()}</>}
                    </div>
                  </div>

                  {(role === "admin" || role === "moderator") && (
                    <div style={{ display: "grid", gap: 6 }}>
                      <button
                        onClick={() => markAttendance(rosterShiftId!, r.user_id, true)}
                        style={{ border: "1px solid #ddd", borderRadius: 8, padding: "4px 8px" }}
                      >
                        Mark attended
                      </button>
                      <button
                        onClick={() => markAttendance(rosterShiftId!, r.user_id, false)}
                        style={{ border: "1px solid #ddd", borderRadius: 8, padding: "4px 8px" }}
                      >
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

/* This empty export ensures TS treats this file as a module in case
   something in your toolchain trips over it. It is harmless. */
export {};
