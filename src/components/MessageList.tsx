"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import ThreadReply from "./ThreadReply";

interface Message {
  id: string;
  content: string;
  user_id: string;
  created_at: string;
  parent_id: string | null;
}

export default function MessageList({ channelId }: { channelId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [threadParent, setThreadParent] = useState<Message | null>(null);
  const [threadMessages, setThreadMessages] = useState<Message[]>([]);

  // Load top-level messages
  async function loadMessages() {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("channel_id", channelId)
      .is("parent_id", null)
      .order("created_at", { ascending: true });
    setMessages((data as any) ?? []);
  }

  // Load replies for a specific parent
  async function loadThread(parentId: string) {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("parent_id", parentId)
      .order("created_at", { ascending: true });
    setThreadMessages((data as any) ?? []);
  }

  // Subscribe to realtime changes
  useEffect(() => {
    loadMessages();
    const sub = supabase
      .channel(`messages:${channelId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => {
        loadMessages();
        if (threadParent) loadThread(threadParent.id);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(sub);
    };
  }, [channelId, threadParent]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: threadParent ? "2fr 1fr" : "1fr", gap: 16 }}>
      {/* Main message list */}
      <div style={{ borderRight: threadParent ? "1px solid #eee" : "none", paddingRight: 12 }}>
        {messages.map((m) => (
          <div key={m.id} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 14 }}>{m.content}</div>
            <div style={{ fontSize: 12, color: "#666" }}>
              {new Date(m.created_at).toLocaleString()}
            </div>
            <button
              onClick={() => {
                setThreadParent(m);
                loadThread(m.id);
              }}
              style={{ fontSize: 12, marginTop: 4 }}
            >
              View thread
            </button>
          </div>
        ))}
      </div>

      {/* Thread panel */}
      {threadParent && (
        <div style={{ paddingLeft: 12 }}>
          <h3 style={{ fontWeight: 600, marginBottom: 8 }}>Thread</h3>
          <div style={{ fontSize: 14, marginBottom: 12 }}>{threadParent.content}</div>
          <div style={{ display: "grid", gap: 8 }}>
            {threadMessages.map((tm) => (
              <div key={tm.id} style={{ fontSize: 14, borderLeft: "2px solid #eee", paddingLeft: 8 }}>
                {tm.content}
              </div>
            ))}
          </div>

          {/* Reply box */}
          <ThreadReply
            channelId={channelId}
            parentId={threadParent.id}
            onSent={() => loadThread(threadParent.id)}
          />

          <button
            onClick={() => {
              setThreadParent(null);
              setThreadMessages([]);
            }}
            style={{ marginTop: 12, fontSize: 12 }}
          >
            Close thread
          </button>
        </div>
      )}
    </div>
  );
}
