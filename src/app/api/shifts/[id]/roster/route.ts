import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

type SignupRow = {
  user_id: string;
  status: string;
  checked_in_at: string | null;
};

type ProfileRow = {
  id: string;
  display_name: string | null;
  email: string | null;
};

type ProfSkillRow = {
  profile_id: string;
  skill_id: string;
};

type SkillRow = {
  id: string;
  name: string;
};

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const shiftId = params.id;

  // 1) Signups for this shift
  const { data: signups, error: e1 } = await supabase
    .from("shift_signups")
    .select("user_id, status, checked_in_at")
    .eq("shift_id", shiftId);

  if (e1) {
    return NextResponse.json({ error: e1.message }, { status: 500 });
  }

  const srows = (signups ?? []) as SignupRow[];
  if (srows.length === 0) {
    return NextResponse.json({ roster: [] });
  }

  const userIds = Array.from(new Set(srows.map((s) => s.user_id)));

  // 2) Profiles for those users
  const { data: profiles, error: e2 } = await supabase
    .from("profiles")
    .select("id, display_name, email")
    .in("id", userIds);

  if (e2) {
    return NextResponse.json({ error: e2.message }, { status: 500 });
  }

  const pmap = new Map<string, ProfileRow>();
  (profiles ?? []).forEach((p) => pmap.set(p.id, p as ProfileRow));

  // 3) Skills for those users (two-step: profile_skills then skills)
  const { data: profSkills, error: e3 } = await supabase
    .from("profile_skills")
    .select("profile_id, skill_id")
    .in("profile_id", userIds);

  if (e3) {
    return NextResponse.json({ error: e3.message }, { status: 500 });
  }

  const skillIds = Array.from(
    new Set(((profSkills ?? []) as ProfSkillRow[]).map((r) => r.skill_id))
  );

  let skillsMap = new Map<string, string>();
  if (skillIds.length) {
    const { data: skills, error: e4 } = await supabase
      .from("skills")
      .select("id, name")
      .in("id", skillIds);

    if (e4) {
      return NextResponse.json({ error: e4.message }, { status: 500 });
    }
    skillsMap = new Map(
      ((skills ?? []) as SkillRow[]).map((s) => [s.id, s.name])
    );
  }

  // Build roster
  const roster = srows.map((s) => {
    const prof = pmap.get(s.user_id);
    const skill_badges =
      ((profSkills ?? []) as ProfSkillRow[])
        .filter((ps) => ps.profile_id === s.user_id)
        .map((ps) => skillsMap.get(ps.skill_id))
        .filter(Boolean) as string[];

    return {
      user_id: s.user_id,
      status: s.status,
      checked_in_at: s.checked_in_at,
      name: prof?.display_name || prof?.email || "",
      email: prof?.email || "",
      skill_badges,
    };
  });

  return NextResponse.json({ roster });
}
