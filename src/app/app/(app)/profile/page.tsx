"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  role?: string | null;
};

export default function ProfilePage() {
  const [me, setMe] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [loaded, setLoaded] = useState(false); // <- prevents “infinite loading”

  useEffect(() => {
    let unsub = () => {};
    (async () => {
      await loadOrCreateProfile();
      const sub = supabase.auth.onAuthStateChange(async () => {
        await loadOrCreateProfile();
      });
      unsub = () => sub.data.subscription.unsubscribe();
    })();
    return () => unsub();
  }, []);

  async function loadOrCreateProfile() {
    setErr("");
    // 1) get current user
    const { data: au } = await supabase.auth.getUser();
    const uid = au.user?.id;
    const email = au.user?.email ?? null;

    if (!uid) {
      setMe(null);
      setLoaded(true);
      return;
    }

    // 2) try to load profile
    const { data: p, error } = await supabase
      .from("profiles")
      .select("id,email,display_name,avatar_url,role")
      .eq("id", uid)
      .maybeSingle();

    if (error) {
      setErr(error.message);
      setLoaded(true);
      return;
    }

    // 3) if missing, create one
    let profile = p as Profile | null;
    if (!profile) {
      const { data: ins, error: insErr } = await supabase
        .from("profiles")
        .insert({
          id: uid,
          email,
          display_name: email ? email.split("@")[0] : null,
          role: "user",
        })
        .select("id,email,display_name,avatar_url,role")
        .maybeSingle();

      if (insErr) {
        setErr(insErr.message);
        setLoaded(true);
        return;
      }
      profile = ins as Profile | null;
    }

    setMe(profile);
    setDisplayName(profile?.display_name ?? "");
    setAvatarUrl(profile?.avatar_url ?? "");
    setLoaded(true);
  }

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
    if (error) {
      setErr(error.message);
      return;
    }
  }

  // --- UI states ---
  if (!loaded) return <div style={{ padding: 16 }}>Loading…</div>;

  if (loaded && !me) {
    return (
      <div style={{ padding: 16 }}>
        <h1>My profile</h1>
        <p>You’re not signed in.</p>
        <a href="/login" style={{ textDecoration: "underline" }}>Go to login</a>
      </div>
    );
  }

  // --- main form ---
  return (
    <div style={{ padding: 16, display: "grid", gap: 12, maxWidth: 520 }}>
      <h1>My profile</h1>

      {err && <div style={{ color: "crimson" }}>{err}</div>}

      <label style={{ fontSize: 12, color: "#666" }}>Email</label>
      <input
        value={me?.email ?? ""}
        readOnly
        style={{ border: "1px solid #eee", borderRadius: 8, padding: 8, background: "#fafafa" }}
      />

      <label style={{ fontSize: 12, color: "#666" }}>Display name</label>
      <input
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        placeholder="Your name"
        style={{ border: "1px solid #ddd", borderRadius: 8, padding: 8 }}
      />

      <label style={{ fontSize: 12, color: "#666" }}>Avatar URL (optional)</label>
      <input
        value={avatarUrl}
        onChange={(e) => setAvatarUrl(e.target.value)}
        placeholder="https://…/avatar.png"
        style={{ border: "1px solid #ddd", borderRadius: 8, padding: 8 }}
      />

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button
          onClick={save}
          disabled={saving}
          style={{ background: "black", color: "white", borderRadius: 8, padding: "8px 12px" }}
        >
          {saving ? "…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}
