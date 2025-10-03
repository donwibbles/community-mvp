"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function MessageInput({ channelId, parentId = null }: { channelId: string; parentId?: string | null }) {
  const [value, setValue] = useState("");

  async function send() {
    const content = value.trim();
    if (!content) return;
    await supabase.from("messages").insert({ channel_id: channelId, content, parent_id: parentId });
    setValue("");
  }

  return (
    <div style={{ display: "flex", gap: 8, borderTop: "1px solid #eee", padding: 8 }}>
      <input
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder="Write a message. Paste a GIF URL if you want."
        style={{ flex: 1, border: "1px solid #ddd", borderRadius: 8, padding: "10px 12px" }}
      />
      <button onClick={send} style={{ padding: "10px 12px", borderRadius: 8, background: "black", color: "white" }}>
        Send
      </button>
    </div>
  );
}
