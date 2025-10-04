"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import ThreadReply from "./ThreadReply";

type Role = "admin" | "user";
interface Message {
  id: string;
  content: string;
  author_id: string | null;
  created_at: string;
  parent_id: string | null;
}

function isImageUrl(text: string) {
  try {
    const u = new URL(text.trim());
    return /\.(gif|png|jpe?g|webp)$/i.test(u.pathname);
  } catch {
    return false;
  }
}

export default function MessageList({ channelId }: { channelId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [threadParent, setThreadParent] = useState<Message | null>(null);
  const [threadMessages, setThreadMessages] = useState<Message[]>([]);
  const [me, setMe] = useState<{ id: string | null; role: Role | null }>({ id: null, role: null });

  async function loadMe() {
    const { data } = await supabase.auth.getUser();
    const uid = data.user?.id ?? null;
    let role: Role | null = null;
    if (uid) {
      const { data: prof } = await supabase.from("profiles").select("role").eq("id", uid).maybeSingle();
      role = (prof as any)?.role ?? "user";
    }
    setMe({ id: uid, role });
  }

  async function loadMessages() {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("channel_id", channelId)
      .is("parent_id", null)
      .order("created_at", { ascending: true });
    setMessages((data as any) ?? []);
  }

  async function loadThread(parentId: string) {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("parent_id", parentId)
      .order("created_at", { ascending: true });
    setThreadMessages((data as any) ?? []);
  }

  async function deleteMsg(id: string) {
    await supabase.from("messages").delete().eq("id", id);
    await loadMessages();
    if (threadParent) await loadThread(threadParent.id);
  }

  useEffect(() => {
    loadMe();
  }, []);

  useEffect(() => {
    loadMessages();
    const sub = supabase
      .channel(`messages:${channelId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `channel_id=eq.${channelId}` }, () => {
        loadMessages();
        if (threadParent) loadThread(threadParent.id);
      })
      .subscribe();
    return () => supabase.removeChannel(sub);
  }, [channelId, threadParent]);

  const canDelete = (m: Message) => me.id && (me.id === m.author_id || me.role === "admin");

  return (
    <div style={{ display: "grid", gridTemplateColumns: threadParent ? "2fr 1fr" : "1fr", gap: 16 }}>
      {/* Main messages */}
      <div style={{ borderRight: threadParent ? "1px solid #eee" : "none", paddingRight: 12 }}>
        {messages.map((m) => (
          <div key={m.id} style={{ marginBottom: 12, border: "1px solid #eee", borderRadius: 8, padding: 8 }}>
            <div style={{ fontSize: 12, color: "#666" }}>{new Date(m.created_at).toLocaleString()}</div>
            <div style={{ marginTop: 4 }}>
              {isImageUrl(m.content) ? (
                <img src={m.content} alt="attachment" style={{ maxWidth: "100%", borderRadius: 8 }} />
              ) : (
                <div style={{ whiteSpace: "pre-wrap" }}>{m.content}</div>
              )}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              <button
                onClick={() => { setThreadParent(m); loadThread(m.id); }}
                style={{ fontSize: 12, textDecoration: "underline" }}
              >
                View thread
              </button>
              {canDelete(m) && (
                <button
                  onClick={() => deleteMsg(m.id)}
                  style={{ fontSize: 12, color: "#b91c1c", textDecoration: "underline" }}
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Thread panel */}
      {threadParent && (
        <div style={{ paddingLeft: 12 }}>
          <h3 style={{ fontWeight: 600, marginBottom: 8 }}>Thread</h3>
          <div style={{ fontSize: 14, marginBottom: 12 }}>
            {isImageUrl(threadParent.content) ? (
              <img src={threadParent.content} alt="thread root" style={{ maxWidth: "100%", borderRadius: 8 }} />
            ) : (
              threadParent.content
            )}
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {threadMessages.map((tm) => (
              <div key={tm.id} style={{ fontSize: 14, borderLeft: "2px solid #eee", paddingLeft: 8 }}>
                {isImageUrl(tm.content) ? (
                  <img src={tm.content} alt="reply" style={{ maxWidth: "100%", borderRadius: 8 }} />
                ) : (
                  tm.content
                )}
              </div>
            ))}
          </div>

          <ThreadReply
            channelId={channelId}
            parentId={threadParent.id}
            onSent={() => loadThread(threadParent.id)}
          />

          <button
            onClick={() => { setThreadParent(null); setThreadMessages([]); }}
            style={{ marginTop: 12, fontSize: 12 }}
          >
            Close thread
          </button>
        </div>
      )}
    </div>
  );
}
