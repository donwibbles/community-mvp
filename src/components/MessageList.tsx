"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Message = {
  id: string;
  author_id: string | null;
  content: string;
  parent_id: string | null;
  created_at: string;
};

export default function MessageList({ channelId }: { channelId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [threadParent, setThreadParent] = useState<Message | null>(null);
  const [threadMessages, setThreadMessages] = useState<Message[]>([]);

  async function loadTop() {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("channel_id", channelId)
      .is("parent_id", null)
      .order("created_at", { ascending: true });
    setMessages((data as any) ?? []);
  }

  async function openThread(m: Message) {
    setThreadParent(m);
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("parent_id", m.id)
      .order("created_at", { ascending: true });
    setThreadMessages((data as any) ?? []);
  }

  useEffect(() => {
    loadTop();
    const ch = supabase
      .channel(`messages:${channelId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `channel_id=eq.${channelId}` }, loadTop)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [channelId]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", height: "calc(100vh - 48px)" }}>
      <div style={{ padding: 12, overflow: "auto", display: "grid", gap: 8 }}>
        {messages.map(m => (
          <div key={m.id} style={{ border: "1px solid #eee", borderRadius: 8, padding: 8 }}>
            <div style={{ fontSize: 12, color: "#666" }}>{new Date(m.created_at).toLocaleString()}</div>
            <div style={{ whiteSpace: "pre-wrap" }}>{m.content}</div>
            <button onClick={() => openThread(m)} style={{ marginTop: 4, fontSize: 12, color: "#2563eb", textDecoration: "underline" }}>
              View thread
            </button>
          </div>
        ))}
      </div>
      <div style={{ borderLeft: "1px solid #eee", padding: 12, overflow: "auto" }}>
        {threadParent ? (
          <>
            <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>Thread</div>
            <div style={{ border: "1px solid #eee", borderRadius: 8, padding: 8, marginBottom: 8 }}>
              <div style={{ fontSize: 12, color: "#666" }}>{new Date(threadParent.created_at).toLocaleString()}</div>
              <div style={{ whiteSpace: "pre-wrap" }}>{threadParent.content}</div>
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              {threadMessages.map(tm => (
                <div key={tm.id} style={{ border: "1px solid #eee", borderRadius: 8, padding: 8 }}>
                  <div style={{ fontSize: 12, color: "#666" }}>{new Date(tm.created_at).toLocaleString()}</div>
                  <div style={{ whiteSpace: "pre-wrap" }}>{tm.content}</div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div style={{ fontSize: 12, color: "#666" }}>Select a message to view its thread.</div>
        )}
      </div>
    </div>
  );
}
