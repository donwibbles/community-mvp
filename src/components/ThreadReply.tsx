"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function ThreadReply({
  channelId,
  parentId,
  onSent
}: { channelId: string; parentId: string; onSent: () => void }) {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  async function send() {
    const content = value.trim();
    if (!content) return;
    setSaving(true);
    await supabase.from("messages").insert({ channel_id: channelId, parent_id: parentId, content });
    setSaving(false);
    setValue("");
    onSent();
  }

  return (
    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
      <input
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder="Reply in thread…"
        style={{ flex: 1, border: "1px solid #ddd", borderRadius: 8, padding: "8px 10px" }}
      />
      <button onClick={send} disabled={saving} style={{ padding: "8px 10px", borderRadius: 8, background: "black", color: "white" }}>
        {saving ? "…" : "Reply"}
      </button>
    </div>
  );
}
