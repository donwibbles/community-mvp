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
  starts_at: string;
  ends_at: string;
  capacity: number;
};

export default function EditEventPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [event, setEvent] = useState<EventRow | null>(null);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [location, setLocation] = useState("");
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  // shift form
  const [sStart, setSStart] = useState("");
  const [sEnd, setSEnd] = useState("");
  const [sCap, setSCap] = useState<number>(0);

  async function load() {
    const { data: ev } = await supabase.from("events").select("*").eq("id", id).maybeSingle();
    if (ev) {
      setEvent(ev as any);
      setTitle((ev as any).title || "");
      setDesc((ev as any).description || "");
      setLocation((ev as any).location || "");
    }
    const { data: sh } = await supabase.from("event_shifts").select("*").eq("event_id", id).order("starts_at");
    setShifts((sh as any) ?? []);
  }

  useEffect(() => { load(); }, [id]);

  async function saveEvent() {
    setSaving(true);
    setErr("");
    const { error } = await supabase.from("events").update({
      title: title.trim(),
      description: desc || null,
      location: location || null,
    }).eq("id", id);
    if (error) setErr(error.message);
    setSaving(false);
  }

  async function addShift() {
    if (!sStart || !sEnd) { setErr("Shift start and end required"); return; }
    setSaving(true);
    const { error } = await supabase.from("event_shifts").insert({
      event_id: id,
      starts_at: new Date(sStart).toISOString(),
      ends_at: new Date(sEnd).toISOString(),
      capacity: sCap || 0,
    });
    if (error) setErr(error.message);
    setSStart(""); setSEnd(""); setSCap(0);
    await load();
    setSaving(false);
  }

  async function deleteShift(shiftId: string) {
    setSaving(true);
    await supabase.from("event_shifts").delete().eq("id", shiftId);
    await load();
    setSaving(false);
  }

  if (!event) return <div style={{ padding:16 }}>Loading…</div>;

  return (
    <div style={{ padding: 16, display:"grid", gap:14, maxWidth:720 }}>
      <h1>Edit event</h1>

      <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Title" />
      <textarea value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Description" />
      <input value={location} onChange={e=>setLocation(e.target.value)} placeholder="Location" />

      <button onClick={saveEvent} disabled={saving}>Save details</button>
      <a href={`/app/events/${id}`} style={{ marginLeft: 12, textDecoration:"underline" }}>View event</a>

      <h2>Shifts</h2>
      {shifts.map(s => (
        <div key={s.id} style={{ border:"1px solid #eee", padding:8, borderRadius:8, marginBottom:8 }}>
          <div>{new Date(s.starts_at).toLocaleString()} – {new Date(s.ends_at).toLocaleString()}</div>
          <div style={{ fontSize:12, color:"#666" }}>Capacity: {s.capacity === 0 ? "Unlimited" : s.capacity}</div>
          <button onClick={() => deleteShift(s.id)}>Delete</button>
        </div>
      ))}

      <div style={{ display:"flex", gap:8, marginTop:8, flexWrap:"wrap" }}>
        <input type="datetime-local" value={sStart} onChange={e=>setSStart(e.target.value)} />
        <input type="datetime-local" value={sEnd} onChange={e=>setSEnd(e.target.value)} />
        <input type="number" min={0} value={sCap} onChange={e=>setSCap(Number(e.target.value))} placeholder="Capacity" />
        <button onClick={addShift} disabled={saving}>Add shift</button>
      </div>

      {err && <div style={{ color:"crimson" }}>{err}</div>}
    </div>
  );
}
