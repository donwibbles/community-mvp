"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function EventDetail() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [event, setEvent] = useState<any>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data } = await supabase.from("events").select("*").eq("id", id).maybeSingle();
    setEvent(data || null);

    const { data: me } = await supabase.auth.getUser();
    if (me.user) {
      const { data: rsvp } = await supabase.from("rsvps").select("*")
        .eq("event_id", id).eq("user_id", me.user.id).maybeSingle();
      setStatus((rsvp as any)?.status ?? null);
    }
  }

  useEffect(() => { load(); }, [id]);

  async function setGoing() {
    setSaving(true);
    // if you created rsvp_simple():
    const { error } = await supabase.rpc("rsvp_simple", { p_event_id: id });
    if (error) {
      // fallback to upsert
      await supabase.from("rsvps").upsert({ event_id: id, status: "going" });
    }
    setSaving(false);
    load();
  }

  if (!event) return <div style={{ padding: 16 }}>Loading…</div>;

  return (
    <div style={{ padding: 16, display:"grid", gap: 8 }}>
      <h1>{event.title}</h1>
      <div style={{ color:"#666" }}>
        {new Date(event.starts_at).toLocaleString()} – {new Date(event.ends_at).toLocaleString()}
      </div>
      {event.location && <div>{event.location}</div>}
      {event.description && <p style={{ whiteSpace:"pre-wrap" }}>{event.description}</p>}

      <div style={{ marginTop: 8 }}>
        <button onClick={setGoing} disabled={saving} style={{ background:"black", color:"white", padding:"8px 12px", borderRadius:8 }}>
          {saving ? "Saving…" : (status === "going" ? "You're going ✓" : "RSVP Going")}
        </button>
      </div>
    </div>
  );
}
