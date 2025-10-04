"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function MessageInput({ channelId, parentId = null }: { channelId: string; parentId?: string | null }) {
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);

  async function send() {
    const raw = value.trim();
    if (!raw) return;

    setSending(true);

    let content = raw;

    // /giphy cats → fetch first gif url
    const giphy = raw.match(/^\/giphy\s+(.+)$/i);
    if (giphy) {
      const term = giphy[1];
      try {
        const apiKey = process.env.NEXT_PUBLIC_GIPHY_API_KEY;
        if (apiKey) {
          const res = await fetch(
            `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(term)}&limit=1&rating=g`
          );
          const json = await res.json();
          const url = json?.data?.[0]?.images?.original?.url as string | undefined;
          if (url) content = url;
        } else {
          // if no key, leave the text as-is so the user can paste a gif URL manually
          content = `GIF search needs NEXT_PUBLIC_GIPHY_API_KEY. (You typed: ${term})`;
        }
      } catch {
        // ignore and just send the raw content
      }
    }

    await supabase.from("messages").insert({ channel_id: channelId, content, parent_id: parentId });
    setValue("");
    setSending(false);
  }

  return (
    <div style={{ display: "flex", gap: 8, borderTop: "1px solid #eee", padding: 8 }}>
      <input
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder="Write a message…  Try: /giphy cats   or paste an image URL"
        style={{ flex: 1, border: "1px solid #ddd", borderRadius: 8, padding: "10px 12px" }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            send();
          }
        }}
      />
      <button
        onClick={send}
        disabled={sending}
        style={{ padding: "10px 12px", borderRadius: 8, background: "black", color: "white" }}
      >
        {sending ? "…" : "Send"}
      </button>
    </div>
  );
}
