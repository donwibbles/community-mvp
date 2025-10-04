"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import ThreadReply from "./ThreadReply";
import ReactionBar from "./ReactionBar";

type Role = "admin" | "moderator" | "user";

type Message = {
  id: string;
  content: string;
  author_id: string | null;
  created_at: string;
  parent_id: string | null;
  channel_id?: string;
};

type Profile = {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  role: Role | null;
};

function isImageUrl(text: string) {
  try {
    const u = new URL(text.trim());
    return /\.(gif|png|jpe?g|webp)$/i.test(u.pathname);
  } catch {
    return false;
  }
}

function initialsFrom(name?: string | null, email?: string | null) {
  const base = (name || email || "?").trim();
  return base[0]?.toUpperCase() ?? "?";
}

export default function MessageList({ channelId }: { channelId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [threadParent, setThreadParent] = useState<Message | null>(null);
  const [threadMessages, setThreadMessages] = useState<Message[]>([]);
  const [me, setMe] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  // ---- loads ---------------------------------------------------------------

  async function loadMe() {
    const { data } = await supabase.auth.getUser();
    const uid = data.user?.id ?? null;
    if (!uid) {
      setMe(null);
      return;
    }
    const { data: prof } = await supabase
      .from("profiles")
      .select("id,email,display_name,avatar_url,role")
      .eq("id", uid)
      .maybeSingle();
    setMe((prof as any) ?? null);
  }

  async function loadMessages() {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("channel_id", channelId)
      .is("parent_id", null)
      .order("created_at", { ascending: true });
    const rows = (data as any as Message[]) ?? [];
    setMessages(rows);
    await loadProfilesFor(rows);
  }

  async function loadThread(parentId: string) {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("parent_id", parentId)
      .order("created_at", { ascending: true });
    const rows = (data as any as Message[]) ?? [];
    setThreadMessages(rows);
    await loadProfilesFor(rows);
  }

  async function loadProfilesFor(rows: Message[]) {
    const ids = new Set<string>();
    rows.forEach((r) => {
      if (r.author_id) ids.add(r.author_id);
    });
    if (threadParent) {
      const { data: trows } = await supabase
        .from("messages")
        .select("author_id")
        .eq("parent_id", threadParent.id);
      (trows as any[])?.forEach((r) => r.author_id && ids.add(r.author_id));
    }
    const missing = Array.from(ids).filter((id) => !profiles[id]);
    if (missing.length) {
      const { data } = await supabase
        .from("profiles")
        .select("id,email,display_name,avatar_url,role")
        .in("id", missing);
      const next = { ...profiles };
      ((data as any) ?? []).forEach((p: Profile) => {
        next[p.id] = p;
      });
      setProfiles(next);
    }
  }

  // ---- actions -------------------------------------------------------------

  async function deleteMsg(id: string) {
    await supabase.from("messages").delete().eq("id", id);
    await loadMessages();
    if (threadParent) await loadThread(threadParent.id);
  }

  async function saveEdit(id: string) {
    await supabase.from("messages").update({ content: editValue }).eq("id", id);
    setEditingId(null);
    await loadMessages();
    if (threadParent) await loadThread(threadParent.id);
  }

  // ---- effects -------------------------------------------------------------

  useEffect(() => {
    loadMe();
  }, []);

  useEffect(() => {
    loadMessages();
    const sub = supabase
      .channel(`messages:${channelId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `channel_id=eq.${channelId}` },
        () => {
          loadMessages();
          if (threadParent) loadThread(threadParent.id);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(sub);
    };
  }, [channelId, threadParent]);

  // ---- permissions ---------------------------------------------------------

  const canDelete = (m: Message) =>
    (me?.id && me.id === m.author_id) || me?.role === "admin" || me?.role === "moderator";

  const canEdit = (m: Message) => me?.id && me.id === m.author_id;

  // ---- UI helpers ----------------------------------------------------------

  function AuthorChip({ p }: { p?: Profile }) {
    const name = p?.display_name || p?.email || "Unknown";
    const badgeBg =
      p?.role === "admin" ? "#ecfdf5" : p?.role === "moderator" ? "#eef2ff" : "#f5f5f5";
    const badgeColor =
      p?.role === "admin" ? "#065f46" : p?.role === "moderator" ? "#1e3a8a" : "#555";

    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {p?.avatar_url ? (
          <img
            src={p.avatar_url}
            alt={name}
            style={{ width: 24, height: 24, borderRadius: "50%", objectFit: "cover", border: "1px solid #ddd" }}
          />
        ) : (
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: "50%",
              border: "1px solid #ddd",
              display: "grid",
              placeItems: "center",
              fontSize: 12,
            }}
          >
            {initialsFrom(p?.display_name, p?.email)}
          </div>
        )}

        <div style={{ fontSize: 13, color: "#222", fontWeight: 600 }}>
          {name}
          {p?.role && (
            <span
              style={{
                marginLeft: 6,
                fontSize: 11,
                padding: "2px 6px",
                borderRadius: 999,
                border: "1px solid #eee",
                background: badgeBg,
                color: badgeColor,
              }}
            >
              {p.role}
            </span>
          )}
        </div>
      </div>
    );
  }

  function MessageBubble({ m }: { m: Message }) {
    const p = m.author_id ? profiles[m.author_id] : undefined;

    return (
      <div
        style={{
          marginBottom: 12,
          border: "1px solid #eee",
          borderRadius: 12,
          padding: 10,
          background: "#fff",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <AuthorChip p={p} />
          <div style={{ marginLeft: "auto", fontSize: 12, color: "#666" }}>
            {new Date(m.created_at).toLocaleString()}
          </div>
        </div>

        <div style={{ marginTop: 8 }}>
          {editingId === m.id ? (
            <div style={{ display: "flex", gap: 6 }}>
              <input
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                style={{ flex: 1, border: "1px solid #ddd", borderRadius: 8, padding: "8px 10px" }}
              />
              <button
                onClick={() => saveEdit(m.id)}
                style={{ border: "1px solid #ddd", borderRadius: 8, padding: "8px 10px" }}
              >
                Save
              </button>
              <button
                onClick={() => setEditingId(null)}
                style={{ border: "1px solid #ddd", borderRadius: 8, padding: "8px 10px" }}
              >
                Cancel
              </button>
            </div>
          ) : isImageUrl(m.content) ? (
            <img src={m.content} alt="attachment" style={{ maxWidth: "100%", borderRadius: 8 }} />
          ) : (
            <div style={{ whiteSpace: "pre-wrap" }}>
              {m.content.split(/(\s+)/).map((t, i) =>
                /^@[\w.\-]+$/.test(t) ? (
                  <span key={i} style={{ background: "#fef3c7", padding: "0 3px", borderRadius: 4 }}>
                    {t}
                  </span>
                ) : (
                  <span key={i}>{t}</span>
                )
              )}
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button
            onClick={() => {
              setThreadParent(m);
              loadThread(m.id);
            }}
            style={{ fontSize: 12, textDecoration: "underline" }}
          >
            View thread
          </button>
          {canEdit(m) && (
            <button
              onClick={() => {
                setEditingId(m.id);
                setEditValue(m.content);
              }}
              style={{ fontSize: 12, textDecoration: "underline" }}
            >
              Edit
            </button>
          )}
          {canDelete(m) && (
            <button
              onClick={() => deleteMsg(m.id)}
              style={{ fontSize: 12, color: "#b91c1c", textDecoration: "underline" }}
            >
              Delete
            </button>
          )}
        </div>

        <ReactionBar messageId={m.id} />
      </div>
    );
  }

  // ---- render --------------------------------------------------------------

  return (
    <div style={{ display: "grid", gridTemplateColumns: threadParent ? "2fr 1fr" : "1fr", gap: 16 }}>
      {/* main column */}
      <div style={{ borderRight: threadParent ? "1px solid #eee" : "none", paddingRight: 12 }}>
        {messages.map((m) => (
          <MessageBubble key={m.id} m={m} />
        ))}
      </div>

      {/* thread panel */}
      {threadParent && (
        <div style={{ paddingLeft: 12 }}>
          <h3 style={{ fontWeight: 600, marginBottom: 8 }}>Thread</h3>
          <div style={{ marginBottom: 12 }}>
            <MessageBubble m={threadParent} />
          </div>
          <div style={{ display: "grid", gap: 8, marginBottom: 8 }}>
            {threadMessages.map((tm) => (
              <MessageBubble key={tm.id} m={tm} />
            ))}
          </div>
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
