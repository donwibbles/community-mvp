"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function NewEventPage() {
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [desc, setDesc] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  // shift form
  const [shifts, setShifts] = useState<
    { starts_at: string; ends_at: string; capacity: number }[]
  >([]);
  const [sStart, setSStart] = useState("");
  const [sEnd, setSEnd] = useState("");
  const [sCap, setSCap] = useState<number>(0);

  const router = useRouter();

  function addShiftTemp() {
    if (!sStart || !sEnd) { setErr("Shift start and end required"); return; }
    setShifts([...shifts, { starts_at: sStart, ends_at: sEnd, capacity: sCap }]);
    setSStart(""); setSEnd(""); setSCap(0);
  }

  async function createEvent() {
    setErr("");
    if (!title.trim()) { setErr("Title required"); return; }
    setSaving(true);

    // Create event with placeholder times (trigger will sync to shifts)
    const now = new Date();
    const plus1h = new Date(now.getTime() + 60 * 60 * 1000);

    const { data: ev, error } = await supabase
      .from("events")
      .insert({
        title: title.trim(),
        description: desc || null,
        location: location || null,
        starts_at: now.toISOString(),
        ends_at: plus1h.toISOString(),
      })
      .select("id")
      .single();

    if (error) { setErr(error.message); setSaving(false); return; }
    const eventId = ev!.id;

    // Insert shifts if any
    for (const sh of shifts) {
      await supabase.from("event_shifts").insert({
        event_id: eventId,
        starts_at: new Date(sh.starts_at).toISOString(),
        ends_at: new Date(sh.ends_at).toISOString(),
        capacity: sh.capacity || 0,
      });
    }

    setSaving(false);
    router.push(`/app/events/${eventId}`);
  }

  return (
    <div style={{ padding: 16, display: "grid", gap: 14, maxWidth: 600 }}>
      <h1>Create event</h1>
      <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Title" style={{ border:"1px solid #ddd", borderRadius:8, padding:8 }} />
      <textarea value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Description (optional)" style={{ border:"1px solid #ddd", borderRadius:8, padding:8 }} />
      <input value={location} onChange={e=>setLocation(e.target.value)} placeholder="Location (optional)" style={{ border:"1px solid #ddd", borderRadius:8, padding:8 }} />

      {/* Add shifts inline */}
      <h3>Shifts</h3>
      {shifts.map((sh, idx) => (
        <div key={idx} style={{ fontSize: 14, padding:4 }}>
          {new Date(sh.starts_at).toLocaleString()} – {new Date(sh.ends_at).toLocaleString()}
          {" • "}
          Capacity: {sh.capacity === 0 ? "Unlimited" : sh.capacity}
        </div>
      ))}
      <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
        <input type="datetime-local" value={sStart} onChange={e=>setSStart(e.target.value)} />
        <input type="datetime-local" value={sEnd} onChange={e=>setSEnd(e.target.value)} />
        <input type="number" min={0} value={sCap} onChange={e=>setSCap(Number(e.target.value))} placeholder="Capacity (0=unlimited)" />
        <button onClick={addShiftTemp}>Add Shift</button>
      </div>

      <div style={{ display:"flex", gap:8 }}>
        <button onClick={createEvent} disabled={saving} style={{ background:"black", color:"white", borderRadius:8, padding:"8px 12px" }}>
          {saving ? "…" : "Create event"}
        </button>
        {err && <span style={{ color:"crimson" }}>{err}</span>}
      </div>
    </div>
  );
}
