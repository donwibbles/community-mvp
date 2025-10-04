"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Skill = { id: string; name: string; category: string };
type Profile = { id: string; email: string | null; display_name: string | null; avatar_url: string | null };

export default function ProfilePage() {
  const [me, setMe] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [skills, setSkills] = useState<Skill[]>([]);
  const [mySkillIds, setMySkillIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      const { data: au } = await supabase.auth.getUser();
      const uid = au.user?.id; if (!uid) { setLoaded(true); return; }

      const { data: p } = await supabase.from("profiles")
        .select("id,email,display_name,avatar_url")
        .eq("id", uid).maybeSingle();

      const prof = p as any as Profile | null;
      setMe(prof);
      setDisplayName(prof?.display_name ?? "");
      setAvatarUrl(prof?.avatar_url ?? "");

      const { data: all } = await supabase.from("skills").select("*").order("name");
      setSkills((all as any[]) ?? []);
      const { data: mine } = await supabase.from("profile_skills").select("skill_id").eq("profile_id", uid);
      setMySkillIds(new Set(((mine as any[]) ?? []).map(r => r.skill_id)));
      setLoaded(true);
    })();
  }, []);

  async function saveProfile() {
    if (!me?.id) return;
    setSaving(true);
    await supabase.from("profiles")
      .update({ display_name: displayName.trim() || null, avatar_url: avatarUrl.trim() || null })
      .eq("id", me.id);
    setSaving(false);
  }

  async function toggleSkill(skillId: string) {
    if (!me?.id) return;
    const next = new Set(mySkillIds);
    if (next.has(skillId)) {
      next.delete(skillId);
      await supabase.from("profile_skills").delete().eq("profile_id", me.id).eq("skill_id", skillId);
    } else {
      next.add(skillId);
      await supabase.from("profile_skills").upsert({ profile_id: me.id, skill_id: skillId });
    }
    setMySkillIds(next);
  }

  if (!loaded) return <div style={{ padding: 16 }}>Loading…</div>;
  if (!me) return <div style={{ padding: 16 }}>Please <a href="/login">log in</a>.</div>;

  return (
    <div style={{ padding: 16, display: "grid", gap: 12, maxWidth: 700 }}>
      <h1>My profile</h1>

      <label style={{ fontSize: 12, color: "#666" }}>Email</label>
      <input value={me.email ?? ""} readOnly style={{ border:"1px solid #eee", borderRadius:8, padding:8, background:"#fafafa" }} />

      <label style={{ fontSize: 12, color: "#666" }}>Display name</label>
      <input value={displayName} onChange={e => setDisplayName(e.target.value)} style={{ border:"1px solid #ddd", borderRadius:8, padding:8 }} />

      <label style={{ fontSize: 12, color: "#666" }}>Avatar URL (optional)</label>
      <input value={avatarUrl} onChange={e => setAvatarUrl(e.target.value)} style={{ border:"1px solid #ddd", borderRadius:8, padding:8 }} />

      <button onClick={saveProfile} disabled={saving} style={{ width:"fit-content", background:"black", color:"white", borderRadius:8, padding:"8px 12px" }}>
        {saving ? "…" : "Save changes"}
      </button>

      <h2 style={{ marginTop: 16 }}>Virtual skills</h2>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(220px, 1fr))", gap:8 }}>
        {skills.map(s => (
          <label key={s.id} style={{ border:"1px solid #eee", borderRadius:8, padding:"8px 10px", display:"flex", gap:8, alignItems:"center" }}>
            <input type="checkbox" checked={mySkillIds.has(s.id)} onChange={() => toggleSkill(s.id)} />
            {s.name}
          </label>
        ))}
      </div>
    </div>
  );
}
