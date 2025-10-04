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

  // ---- load current user ---------------------------------------------------
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

  // ---- load messages + thread ---------------------------------------------
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
    rows.forEach((r) => r.author_id && ids.add(r.author_id));
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
      ((data as any) ?? []).forEach((p: Profile) => (next[p.id] = p));
      setProfiles(next);
    }
  }

  // ---- live updates --------------------------------------------------------
  useEffect(() => {
    // messages realtime
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

    // profiles realtime (so display_name/avatars reflect immediately)
    const profSub = supabase
      .channel("profiles:changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        (payload: any) => {
          const p = payload.new as Profile;
          setProfiles((prev) => ({ ...prev, [p.id]: { ...(prev[p.id] ?? {}), ...p } }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
      supabase.removeChannel(profSub);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId, threadParent]);

  useEffect(() => {
    loadMe();
    loadMessages();
  }, [channelId]);

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

  async function quickReply(parent: Message, content: string) {
    const trimmed = content.trim();
    if (!trimmed) return;
    await supabase.from("messages").insert({
      channel_id: parent.channel_id ?? channelId,
      parent_id: parent.id,
      content: trimmed,
    });
    setThreadParent(parent);
    await loadThread(parent.id);
  }

  // ---- permissions (UI) ----------------------------------------------------
  const canDelete = (m: Message) =>
    (me?.id && me.id === m.author_id) || me?.role === "admin" || me?.role === "moderator";

  const canEdit = (m: Message) =>
    me?.role === "admin" || (me?.id && me.id === m.author_id); // mods can’t edit others

  // ---- sub-components ------------------------------------------------------
  function AuthorChip({ p }: { p?: Profile }) {
    const name = p?.display_name || p?.email || "Unknown";
    const role = p?.role ?? "user";
    const badgeBg = role === "admin" ? "#ecfdf5" : role === "moderator" ? "#eef2ff" : "#f5f5f5";
    const badgeColor = role === "admin" ? "#065f46" : role === "moderator" ? "#1e3a8a" : "#555";
    const icon = role === "admin" ? "👑" : role === "moderator" ? "🛡️" : "";

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
              background: "#fff",
            }}
          >
            {initialsFrom(p?.display_name, p?.email)}
          </div>
        )}

        <div style={{ fontSize: 13, color: "#222", fontWeight: 600 }}>
          {name}
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
            {icon && <span style={{ marginRight: 4 }}>{icon}</span>}
            {role}
          </span>
        </div>
      </div>
    );
  }

  function MessageBubble({ m, i, isReply = false }: { m: Message; i: number; isReply?: boolean }) {
    const p = m.author_id ? profiles[m.author_id] : undefined;
    const [hover, setHover] = useState(false);
    const [quick, setQuick] = useState("");
    const [quickFocused, setQuickFocused] = useState(false);

    // alternating background
    const bg = i % 2 === 0 ? "#ffffff" : "#fcfcfd";

    const notAllowedEdit = !canEdit(m);
    const notAllowedDelete = !canDelete(m);

    const showTools = hover || quickFocused || editingId === m.id; // keep visible while focused/editing

    return (
      <div
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          marginBottom: 10,
          border: "1px solid #eee",
          borderRadius: 12,
          padding: 10,
          background: bg,
          transition: "background 120ms ease",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <AuthorChip p={p} />
          {/* timestamp only when tools are visible */}
          {showTools && (
            <div style={{ marginLeft: "auto", fontSize: 12, color: "#666" }}>
              {new Date(m.created_at).toLocaleString()}
            </div>
          )}
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
                title="Save edit"
              >
                Save
              </button>
              <button
                onClick={() => setEditingId(null)}
                style={{ border: "1px solid #ddd", borderRadius: 8, padding: "8px 10px" }}
                title="Cancel edit"
              >
                Cancel
              </button>
            </div>
          ) : isImageUrl(m.content) ? (
            <img src={m.content} alt="attachment" style={{ maxWidth: "100%", borderRadius: 8 }} />
          ) : (
            <div style={{ whiteSpace: "pre-wrap" }}>
              {m.content.split(/(\s+)/).map((t, idx) =>
                /^@[\w.\-]+$/.test(t) ? (
                  <span key={idx} style={{ background: "#fef3c7", padding: "0 3px", borderRadius: 4 }}>
                    {t}
                  </span>
                ) : (
                  <span key={idx}>{t}</span>
                )
              )}
            </div>
          )}
        </div>

        {/* actions row */}
        <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
          {/* Hide "View thread" on replies (no threads-of-threads) */}
          {!isReply && (
            <button
              onClick={() => {
                setThreadParent(m);
                loadThread(m.id);
              }}
              style={{ fontSize: 12, textDecoration: "underline" }}
              title="Open thread"
            >
              View thread
            </button>
          )}

          <button
            onClick={() => {
              setEditingId(m.id);
              setEditValue(m.content);
            }}
            disabled={notAllowedEdit}
            title={
              notAllowedEdit
                ? me?.role === "moderator"
                  ? "Moderators can’t edit others’ messages"
                  : "You can only edit your own messages"
                : "Edit message"
            }
            style={{
              fontSize: 12,
              textDecoration: notAllowedEdit ? "none" : "underline",
              color: notAllowedEdit ? "#aaa" : "inherit",
              cursor: notAllowedEdit ? "not-allowed" : "pointer",
            }}
          >
            Edit
          </button>

          <button
            onClick={() => deleteMsg(m.id)}
            disabled={notAllowedDelete}
            title={notAllowedDelete ? "You don’t have permission to delete this" : "Delete message"}
            style={{
              fontSize: 12,
              color: notAllowedDelete ? "#d1d5db" : "#b91c1c",
              textDecoration: notAllowedDelete ? "none" : "underline",
              cursor: notAllowedDelete ? "not-allowed" : "pointer",
            }}
          >
            Delete
          </button>

          <div style={{ flex: 1 }} />

          {/* reaction bar: hidden until hover or focus */}
          <div style={{ display: showTools ? "block" : "none" }}>
            <ReactionBar messageId={m.id} />
          </div>
        </div>

        {/* inline quick reply (stays open while focused) */}
        {!isReply && (
          <div style={{ marginTop: 8, display: showTools ? "flex" : "none", gap: 6 }}>
            <input
              value={quick}
              onChange={(e) => setQuick(e.target.value)}
              onFocus={() => setQuickFocused(true)}
              onBlur={() => setQuickFocused(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  quickReply(m, quick).then(() => setQuick(""));
                }
              }}
              placeholder="Reply…"
              style={{ flex: 1, border: "1px solid #ddd", borderRadius: 8, padding: "6px 10px", fontSize: 14 }}
            />
            <button
              onClick={() => {
                quickReply(m, quick).then(() => setQuick(""));
              }}
              style={{ border: "1px solid #ddd", borderRadius: 8, padding: "6px 10px" }}
              title="Reply to start a thread"
            >
              Send
            </button>
          </div>
        )}
      </div>
    );
  }

  // ---- render --------------------------------------------------------------
  return (
    <div style={{ display: "grid", gridTemplateColumns: threadParent ? "2fr 1fr" : "1fr", gap: 16 }}>
      {/* main column */}
      <div style={{ borderRight: threadParent ? "1px solid #eee" : "none", paddingRight: 12 }}>
        {messages.map((m, i) => (
          <MessageBubble key={m.id} m={m} i={i} />
        ))}
      </div>

      {/* thread panel */}
      {threadParent && (
        <div style={{ paddingLeft: 12 }}>
          <h3 style={{ fontWeight: 600, marginBottom: 8 }}>Thread</h3>
          <div style={{ marginBottom: 12 }}>
            <MessageBubble m={threadParent} i={0} />
          </div>
          <div style={{ display: "grid", gap: 8, marginBottom: 8 }}>
            {threadMessages.map((tm, i) => (
              <MessageBubble key={tm.id} m={tm} i={i} isReply />
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
