"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

export default function ProfilePage() {
  const [me, setMe] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) return;
      const { data } = await supabase
        .from("profiles")
        .select("id, email, display_name, avatar_url")
        .eq("id", uid)
        .maybeSingle();
      const p = (data as any) as Profile | null;
      setMe(p);
      setDisplayName(p?.display_name ?? "");
      setAvatarUrl(p?.avatar_url ?? "");
    })();
  }, []);

  async function save() {
    if (!me?.id) return;
    setSaving(true);
    setErr("");
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: displayName.trim() || null,
        avatar_url: avatarUrl.trim() || null,
      })
      .eq("id", me.id);
    setSaving(false);
    if (error) { setErr(error.message); return; }
  }

  if (!me) return <div style={{ padding: 16 }}>Loading…</div>;

  return (
    <div style={{ padding: 16, display: "grid", gap: 12, maxWidth: 520 }}>
      <h1>My profile</h1>

      <label style={{ fontSize: 12, color: "#666" }}>Email</label>
      <input value={me.email ?? ""} readOnly style={{ border:"1px solid #eee", borderRadius:8, padding:8, background:"#fafafa" }} />

      <label style={{ fontSize: 12, color: "#666" }}>Display name</label>
      <input
        value={displayName}
        onChange={e => setDisplayName(e.target.value)}
        placeholder="Your name"
        style={{ border:"1px solid #ddd", borderRadius:8, padding:8 }}
      />

      <label style={{ fontSize: 12, color: "#666" }}>Avatar URL (optional)</label>
      <input
        value={avatarUrl}
        onChange={e => setAvatarUrl(e.target.value)}
        placeholder="https://…/avatar.png"
        style={{ border:"1px solid #ddd", borderRadius:8, padding:8 }}
      />

      <div style={{ display:"flex", gap:8, alignItems:"center" }}>
        <button
          onClick={save}
          disabled={saving}
          style={{ background:"black", color:"white", borderRadius:8, padding:"8px 12px" }}
        >
          {saving ? "…" : "Save changes"}
        </button>
        {err && <span style={{ color:"crimson" }}>{err}</span>}
      </div>
    </div>
  );
}
