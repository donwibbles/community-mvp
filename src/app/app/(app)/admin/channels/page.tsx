"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Channel = { id: string; name: string; kind: "chat" | "forum"; created_at: string };
type Role = "admin" | "user";

export default function AdminChannelsPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"chat" | "forum">("chat");
  const [err, setErr] = useState("");
  const [role, setRole] = useState<Role | null>(null);

  async function load() {
    setErr("");
    const { data: user } = await supabase.auth.getUser();
    if (user.user?.id) {
      const { data: prof } = await supabase.from("profiles").select("role").eq("id", user.user.id).maybeSingle();
      setRole((prof as any)?.role ?? "user");
    }
    const { data } = await supabase.from("channels").select("*").order("name");
    setChannels((data as any) ?? []);
  }

  async function create() {
    setErr("");
    if (!name.trim()) return;
    // admin-only enforced by RLS, this will error for non-admins
    const { error } = await supabase.from("channels").insert({ name: name.trim(), kind });
    if (error) { setErr(error.message); return; }
    setName("");
    setKind("chat");
    load();
  }

  async function del(id: string) {
    setErr("");
    const { error } = await supabase.from("channels").delete().eq("id", id);
    if (error) { setErr(error.message); return; }
    load();
  }

  useEffect(() => { load(); }, []);

  const isAdmin = role === "admin";

  return (
    <div style={{ padding: 16, display: "grid", gap: 12, maxWidth: 720 }}>
      <h1>Channels (Admin)</h1>
      {!isAdmin && (
        <div style={{ color: "crimson" }}>
          You are not an admin. You can view channels but can’t create or delete them.
        </div>
      )}

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Channel name (e.g. general)"
          style={{ flex: 1, border: "1px solid #ddd", borderRadius: 8, padding: "8px 10px" }}
          disabled={!isAdmin}
        />
        <select
          value={kind}
          onChange={e => setKind(e.target.value as "chat" | "forum")}
          style={{ border: "1px solid #ddd", borderRadius: 8, padding: "8px 10px" }}
          disabled={!isAdmin}
        >
          <option value="chat">chat</option>
          <option value="forum">forum</option>
        </select>
        <button
          onClick={create}
          disabled={!isAdmin}
          style={{ padding: "8px 12px", borderRadius: 8, background: "black", color: "white" }}
        >
          Create
        </button>
      </div>

      {err && <div style={{ color: "crimson" }}>{err}</div>}

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #eee" }}>
            <th style={{ padding: 8 }}>Name</th>
            <th style={{ padding: 8 }}>Kind</th>
            <th style={{ padding: 8 }}>Created</th>
            <th style={{ padding: 8 }}></th>
          </tr>
        </thead>
        <tbody>
          {channels.map(c => (
            <tr key={c.id} style={{ borderBottom: "1px solid #f1f1f1" }}>
              <td style={{ padding: 8 }}>
                <a href={`/app/channels/${c.id}`} style={{ textDecoration: "underline" }}>{c.name}</a>
              </td>
              <td style={{ padding: 8 }}>{c.kind}</td>
              <td style={{ padding: 8 }}>{c.created_at ? new Date(c.created_at).toLocaleString() : "-"}</td>
              <td style={{ padding: 8 }}>
                <button
                  onClick={() => del(c.id)}
                  disabled={!isAdmin}
                  style={{ border: "1px solid #ddd", borderRadius: 8, padding: "6px 10px" }}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
          {channels.length === 0 && (
            <tr><td colSpan={4} style={{ padding: 8, color: "#666" }}>No channels yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
