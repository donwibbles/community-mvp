"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Invite = { email: string; status: "pending" | "accepted" | "revoked"; created_at: string };

export default function AdminInvitesPage() {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");
  const [meRole, setMeRole] = useState<string | null>(null);

  async function load() {
    setErr("");
    const { data: user } = await supabase.auth.getUser();
    if (user.user?.id) {
      const { data: prof } = await supabase.from("profiles").select("role").eq("id", user.user.id).maybeSingle();
      setMeRole((prof as any)?.role ?? null);
    }

    const res = await fetch("/api/admin/invites", { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) { setErr(json.error || "Failed to load"); return; }
    setInvites(json.invites || []);
  }

  async function addInvite() {
    setErr("");
    const e = email.trim().toLowerCase();
    if (!e) return;
    const res = await fetch("/api/admin/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: e })
    });
    const json = await res.json();
    if (!res.ok) { setErr(json.error || "Failed to add"); return; }
    setEmail("");
    load();
  }

  async function revokeInvite(target: string) {
    setErr("");
    const res = await fetch(`/api/admin/invites/${encodeURIComponent(target)}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) { setErr(json.error || "Failed to revoke"); return; }
    load();
  }

  useEffect(() => { load(); }, []);
  const isAdmin = meRole === "admin";

  return (
    <div style={{ padding: 16, display: "grid", gap: 12, maxWidth: 680 }}>
      <h1>Invites (Admin)</h1>

      {!isAdmin && (
        <div style={{ color: "crimson" }}>
          You are not an admin. You can view the list but cannot modify it.
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="email@domain.com"
          style={{ flex: 1, border: "1px solid #ddd", borderRadius: 8, padding: "8px 10px" }}
          disabled={!isAdmin}
        />
        <button
          onClick={addInvite}
          disabled={!isAdmin}
          style={{ padding: "8px 12px", borderRadius: 8, background: "black", color: "white" }}
        >
          Add
        </button>
      </div>

      {err && <div style={{ color: "crimson" }}>{err}</div>}

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #eee" }}>
            <th style={{ padding: 8 }}>Email</th>
            <th style={{ padding: 8 }}>Status</th>
            <th style={{ padding: 8 }}>Invited</th>
            <th style={{ padding: 8 }}></th>
          </tr>
        </thead>
        <tbody>
          {invites.map((i: any) => (
            <tr key={i.email} style={{ borderBottom: "1px solid #f1f1f1" }}>
              <td style={{ padding: 8 }}>{i.email}</td>
              <td style={{ padding: 8, textTransform: "capitalize" }}>{i.status}</td>
              <td style={{ padding: 8 }}>{i.created_at ? new Date(i.created_at).toLocaleString() : "-"}</td>
              <td style={{ padding: 8 }}>
                <button
                  onClick={() => revokeInvite(i.email)}
                  disabled={!isAdmin || i.status === "revoked"}
                  style={{
                    border: "1px solid #ddd",
                    padding: "6px 10px",
                    borderRadius: 8,
                    background: isAdmin && i.status !== "revoked" ? "white" : "#f9f9f9",
                    color: "#333"
                  }}
                >
                  Revoke
                </button>
              </td>
            </tr>
          ))}
          {invites.length === 0 && (
            <tr>
              <td colSpan={4} style={{ padding: 8, color: "#666" }}>No invites yet.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
