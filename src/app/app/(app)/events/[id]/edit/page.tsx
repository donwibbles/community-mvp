"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type EventRow = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
};

type Shift = {
  id: string;
  starts_at: string; // ISO
  ends_at: string;   // ISO
  capacity: number;
};

function toLocalInputValue(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  // datetime-local expects "YYYY-MM-DDTHH:MM"
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

export default function EditEventPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [event, setEvent] = useState<EventRow | null>(null);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [location, setLocation] = useState("");

  const [shifts, setShifts] = useState<Shift[]>([]);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  // add-shift form
  const [sStart, setSStart] = useState("");
  const [sEnd, setSEnd] = useState("");
  const [sCap, setSCap] = useState<number>(0);

  // inline editing state for existing shifts
  const [editing, setEditing] = useState<string | null>(null);
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [editCap, setEditCap] = useState<number>(0);

  async function load() {
    setErr("");
    const { data: ev } = await supabase.from("events").select("*").eq("id", id).maybeSingle();
    if (ev) {
      setEvent(ev as any);
      setTitle((ev as any).title ?? "");
      setDesc((ev as any).description ?? "");
      setLocation((ev as any).location ?? "");
    }
    const { data: sh } = await supabase
      .from("event_shifts")
      .select("*")
      .eq("event_id", id)
      .order("starts_at");
    setShifts((sh as any) ?? []);
  }

  useEffect(() => { load(); }, [id]);

  async function saveEvent() {
    setSaving(true);
    setErr("");
    const { error } = await supabase
      .from("events")
      .update({
        title: title.trim(),
        description: desc || null,
        location: location || null,
      })
      .eq("id", id);
    setSaving(false);
    if (error) setErr(error.message);
  }

  async function deleteEvent() {
    if (!confirm("Delete this event? This cannot be undone.")) return;
    setSaving(true);
    const { error } = await supabase.from("events").delete().eq("id", id);
    setSaving(false);
    if (error) { setErr(error.message); return; }
    router.push("/app/events");
  }

  async function addShift() {
    if (!sStart || !sEnd) { setErr("Shift start and end required"); return; }
    setSaving(true);
    const { error } = await supabase.from("event_shifts").insert({
      event_id: id,
      starts_at: new Date(sStart).toISOString(),
      ends_at: new Date(sEnd).toISOString(),
      capacity: Number.isFinite(Number(sCap)) ? Number(sCap) : 0,
    });
    setSaving(false);
    if (error) { setErr(error.message); return; }
    setSStart(""); setSEnd(""); setSCap(0);
    await load(); // trigger recomputes event bounds
  }

  function beginEdit(shift: Shift) {
    setEditing(shift.id);
    setEditStart(toLocalInputValue(shift.starts_at));
    setEditEnd(toLocalInputValue(shift.ends_at));
    setEditCap(shift.capacity ?? 0);
  }

  function cancelEdit() {
    setEditing(null);
    setEditStart(""); setEditEnd(""); setEditCap(0);
  }

  async function saveShift(shiftId: string) {
    if (!editStart || !editEnd) { setErr("Start and end required"); return; }
    setSaving(true);
    const { error } = await supabase.from("event_shifts").update({
      starts_at: new Date(editStart).toISOString(),
      ends_at: new Date(editEnd).toISOString(),
      capacity: Number.isFinite(Number(editCap)) ? Number(editCap) : 0,
    }).eq("id", shiftId);
    setSaving(false);
    if (error) { setErr(error.message); return; }
    cancelEdit();
    await load();
  }

  async function deleteShift(shiftId: string) {
    if (!confirm("Delete this shift?")) return;
    setSaving(true);
    const { error } = await supabase.from("event_shifts").delete().eq("id", shiftId);
    setSaving(false);
    if (error) { setErr(error.message); return; }
    await load();
  }

  if (!event) return <div style={{ padding: 16 }}>Loading…</div>;

  return (
    <div style={{ padding: 16, display: "grid", gap: 16, maxWidth: 800 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h1 style={{ margin: 0 }}>Edit event</h1>
        <a href={`/app/events/${id}`} className="hover:underline">View event</a>
      </div>

      {/* Event fields */}
      <div style={{ display: "grid", gap: 8 }}>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Title"
          style={{ border: "1px solid #ddd", borderRadius: 8, padding: 8 }}
        />
        <textarea
          value={desc}
          onChange={e => setDesc(e.target.value)}
          placeholder="Description (optional)"
          style={{ border: "1px solid #ddd", borderRadius: 8, padding: 8, minHeight: 90 }}
        />
        <input
          value={location}
          onChange={e => setLocation(e.target.value)}
          placeholder="Location (optional)"
          style={{ border: "1px solid #ddd", borderRadius: 8, padding: 8 }}
        />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            onClick={saveEvent}
            disabled={saving}
            style={{ background: "black", color: "white", borderRadius: 8, padding: "8px 12px" }}
          >
            {saving ? "…" : "Save details"}
          </button>
          <button
            onClick={deleteEvent}
            disabled={saving}
            style={{ background: "#fee2e2", border: "1px solid #ef4444", color: "#991b1b", borderRadius: 8, padding: "8px 12px" }}
          >
            Delete event
          </button>
          {err && <span style={{ color: "crimson", alignSelf: "center" }}>{err}</span>}
        </div>
      </div>

      {/* Shifts */}
      <div style={{ borderTop: "1px solid #eee", paddingTop: 12 }}>
        <h2>Shifts</h2>

        {/* Existing shifts (editable) */}
        <div style={{ display: "grid", gap: 8 }}>
          {shifts.length === 0 && <div style={{ color: "#666" }}>No shifts yet.</div>}
          {shifts.map((s) => {
            const isEditing = editing === s.id;
            return (
              <div key={s.id} style={{ border: "1px solid #eee", borderRadius: 8, padding: 10 }}>
                {!isEditing ? (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>
                        {new Date(s.starts_at).toLocaleString()} – {new Date(s.ends_at).toLocaleString()}
                      </div>
                      <div style={{ fontSize: 12, color: "#666" }}>
                        Capacity: {s.capacity === 0 ? "Unlimited" : s.capacity}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => beginEdit(s)} style={{ border: "1px solid #ddd", borderRadius: 8, padding: "6px 10px" }}>
                        Edit
                      </button>
                      <button onClick={() => deleteShift(s.id)} style={{ border: "1px solid #ddd", borderRadius: 8, padding: "6px 10px" }}>
                        Delete
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <input type="datetime-local" value={editStart} onChange={e => setEditStart(e.target.value)}
                      style={{ border: "1px solid #ddd", borderRadius: 8, padding: "8px 10px" }} />
                    <input type="datetime-local" value={editEnd} onChange={e => setEditEnd(e.target.value)}
                      style={{ border: "1px solid #ddd", borderRadius: 8, padding: "8px 10px" }} />
                    <input type="number" min={0} value={editCap} onChange={e => setEditCap(Number(e.target.value))}
                      placeholder="Capacity (0 = unlimited)"
                      style={{ width: 220, border: "1px solid #ddd", borderRadius: 8, padding: "8px 10px" }} />
                    <button onClick={() => saveShift(s.id)} disabled={saving}
                      style={{ background: "black", color: "white", borderRadius: 8, padding: "8px 12px" }}>
                      {saving ? "…" : "Save"}
                    </button>
                    <button onClick={cancelEdit} style={{ border: "1px solid #ddd", borderRadius: 8, padding: "8px 12px" }}>
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Add new shift */}
        <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input type="datetime-local" value={sStart} onChange={e => setSStart(e.target.value)}
            style={{ border: "1px solid #ddd", borderRadius: 8, padding: "8px 10px" }} />
          <input type="datetime-local" value={sEnd} onChange={e => setSEnd(e.target.value)}
            style={{ border: "1px solid #ddd", borderRadius: 8, padding: "8px 10px" }} />
          <input type="number" min={0} value={sCap} onChange={e => setSCap(Number(e.target.value))}
            placeholder="Capacity (0 = unlimited)"
            style={{ width: 220, border: "1px solid #ddd", borderRadius: 8, padding: "8px 10px" }} />
          <button onClick={addShift} disabled={saving}
            style={{ background: "black", color: "white", borderRadius: 8, padding: "8px 12px" }}>
            {saving ? "…" : "Add shift"}
          </button>
        </div>
      </div>
    </div>
  );
}
