"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function NewEventPage() {
  const [title, setTitle] = useState("");
  const [starts, setStarts] = useState("");
  const [ends, setEnds] = useState("");
  const [location, setLocation] = useState("");
  const [desc, setDesc] = useState("");
  const [err, setErr] = useState("");
  const router = useRouter();

  async function create() {
    setErr("");
    if (!title || !starts || !ends) { setErr("Title, start, and end required"); return; }
    const { error, data } = await supabase.from("events").insert({
      title,
      description: desc || null,
      starts_at: new Date(starts).toISOString(),
      ends_at: new Date(ends).toISOString(),
      location: location || null
    }).select("id").single();
    if (error) { setErr(error.message); return; }
    router.push(`/app/events/${data!.id}`);
  }

  return (
    <div style={{ padding: 16, display: "grid", gap: 10, maxWidth: 560 }}>
      <h1>Create event</h1>
      <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Title" style={{ border:"1px solid #ddd", borderRadius:8, padding:8 }} />
      <textarea value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Description" style={{ border:"1px solid #ddd", borderRadius:8, padding:8 }} />
      <input type="datetime-local" value={starts} onChange={e=>setStarts(e.target.value)} style={{ border:"1px solid #ddd", borderRadius:8, padding:8 }} />
      <input type="datetime-local" value={ends} onChange={e=>setEnds(e.target.value)} style={{ border:"1px solid #ddd", borderRadius:8, padding:8 }} />
      <input value={location} onChange={e=>setLocation(e.target.value)} placeholder="Location (optional)" style={{ border:"1px solid #ddd", borderRadius:8, padding:8 }} />
      <div style={{ display:"flex", gap:8 }}>
        <button onClick={create} style={{ background:"black", color:"white", padding:"8px 12px", borderRadius:8 }}>Save</button>
        {err && <span style={{ color:"crimson" }}>{err}</span>}
      </div>
    </div>
  );
}
