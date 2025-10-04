"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Role = "admin" | "moderator" | "user";
type Profile = { id: string; email: string | null; role: Role | null; created_at?: string };

export default function MembersAdmin() {
  const [me, setMe] = useState<Profile | null>(null);
  const [rows, setRows] = useState<Profile[]>([]);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (u.user?.id) {
        const { data: p } = await supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle();
        setMe(p as any);
      }
      const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: true });
      setRows((data as any) ?? []);
    })();
  }, []);

  const isAdmin = useMemo(() => me?.role === "admin", [me]);

  async function setRole(id: string, role: Role) {
    setErr("");
    setSaving(id);
    const { error } = await supabase.from("profiles").update({ role }).eq("id", id);
    setSaving(null);
    if (error) { setErr(error.message); return; }
    const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: true });
    setRows((data as any) ?? []);
  }

  return (
    <div style={{ padding: 16, display: "grid", gap: 12, maxWidth: 800 }}>
      <h1>Members</h1>
      {!isAdmin && <div style={{ color: "crimson" }}>Admins only.</div>}
      {err && <div style={{ color: "crimson" }}>{err}</div>}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #eee", textAlign: "left" }}>
            <th style={{ padding: 8 }}>Email</th>
            <th style={{ padding: 8 }}>Role</th>
            <th style={{ padding: 8 }}></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} style={{ borderBottom: "1px solid #f4f4f4" }}>
              <td style={{ padding: 8 }}>{r.email ?? r.id}</td>
              <td style={{ padding: 8 }}>
                <span style={{
                  fontSize: 12, padding: "2px 6px", borderRadius: 999, border: "1px solid #eee",
                  background: r.role === "admin" ? "#ecfdf5" : r.role === "moderator" ? "#eef2ff" : "#f5f5f5",
                  color: "#333",
                }}>
                  {r.role ?? "user"}
                </span>
              </td>
              <td style={{ padding: 8 }}>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => setRole(r.id, "user")} disabled={!isAdmin || saving === r.id}>User</button>
                  <button onClick={() => setRole(r.id, "moderator")} disabled={!isAdmin || saving === r.id}>Moderator</button>
                  <button onClick={() => setRole(r.id, "admin")} disabled={!isAdmin || saving === r.id}>Admin</button>
                </div>
              </td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td style={{ padding: 8, color: "#666" }}>No members.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
