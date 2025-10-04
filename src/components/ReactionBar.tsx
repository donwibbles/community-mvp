"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type ReactionRow = { message_id: string; user_id: string; emoji: string };

const COMMON = ["👍","❤️","🔥","😂","🎉","🙏"];

export default function ReactionBar({ messageId }: { messageId: string }) {
  const [mine, setMine] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});

  async function load() {
    const { data } = await supabase
      .from("message_reactions")
      .select("*")
      .eq("message_id", messageId);
    const rows = (data as any as ReactionRow[]) ?? [];
    const by: Record<string, number> = {};
    rows.forEach(r => { by[r.emoji] = (by[r.emoji] ?? 0) + 1; });
    setCounts(by);

    const { data: u } = await supabase.auth.getUser();
    const uid = u.user?.id;
    if (uid) {
      const mineRow = rows.find(r => r.user_id === uid);
      setMine(mineRow?.emoji ?? null);
    } else {
      setMine(null);
    }
  }

  async function toggle(emoji: string) {
    const { data: u } = await supabase.auth.getUser();
    const uid = u.user?.id;
    if (!uid) return;
    if (mine === emoji) {
      await supabase.from("message_reactions").delete().eq("message_id", messageId).eq("user_id", uid).eq("emoji", emoji);
    } else {
      await supabase.from("message_reactions").upsert({ message_id: messageId, emoji });
    }
    load();
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`reactions:${messageId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "message_reactions", filter: `message_id=eq.${messageId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [messageId]);

  const sorted = useMemo(
    () => Object.entries(counts).sort((a,b) => b[1]-a[1]),
    [counts]
  );

  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 6 }}>
      {sorted.map(([emoji, n]) => (
        <button
          key={emoji}
          onClick={() => toggle(emoji)}
          style={{
            fontSize: 13,
            padding: "2px 6px",
            borderRadius: 12,
            border: "1px solid #eee",
            background: mine === emoji ? "#eef2ff" : "#fafafa"
          }}
          title={`React with ${emoji}`}
        >
          {emoji} {n}
        </button>
      ))}
      <div style={{ display: "flex", gap: 4, marginLeft: 6 }}>
        {COMMON.map(e => (
          <button key={e} onClick={() => toggle(e)} style={{ fontSize: 13, padding: "2px 6px", borderRadius: 12, border: "1px solid #eee", background: "#fff" }}>
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}
