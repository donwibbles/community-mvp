"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function EventsPage() {
  const [events, setEvents] = useState<any[]>([]);

  async function load() {
    const { data } = await supabase.from("events").select("*").order("starts_at", { ascending: true });
    setEvents((data as any) ?? []);
  }

  useEffect(() => { load(); }, []);

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h1>Events</h1>
        <a href="/app/events/new" style={{ border: "1px solid #ddd", padding: "8px 10px", borderRadius: 8 }}>Create event</a>
      </div>
      <div style={{ display: "grid", gap: 10 }}>
        {events.map(e => (
          <a key={e.id} href={`/app/events/${e.id}`} style={{ border: "1px solid #eee", borderRadius: 8, padding: 12 }}>
            <div style={{ fontWeight: 600 }}>{e.title}</div>
            <div style={{ fontSize: 12, color: "#666" }}>
              {new Date(e.starts_at).toLocaleString()} – {new Date(e.ends_at).toLocaleString()}
            </div>
            {e.location && <div style={{ fontSize: 14 }}>{e.location}</div>}
          </a>
        ))}
      </div>
    </div>
  );
}
