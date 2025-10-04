  const { data, error } = await supabase
    .from("shift_signups")
    .select(`
      user_id, status, checked_in_at,
      profiles:profiles!inner(id, display_name, email),
      profile_skills:profile_skills!left(skill_id),
      skills:skills!profile_skills_skill_id_fkey(name)
    `)
    .eq("shift_id", shiftId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // aggregate skills per user
  const byUser = new Map<string, { user_id: string; status: string; checked_in_at: string | null; name: string; email: string; skill_badges: string[] }>();
  (data ?? []).forEach((row: any) => {
    const key = row.user_id;
    const current = byUser.get(key) ?? {
      user_id: key,
      status: row.status,
      checked_in_at: row.checked_in_at,
      name: row.profiles?.display_name || row.profiles?.email || "",
      email: row.profiles?.email || "",
      skill_badges: []
    };
    if (row.skills?.name && !current.skill_badges.includes(row.skills.name)) current.skill_badges.push(row.skills.name);
    byUser.set(key, current);
  });

  return NextResponse.json({ roster: Array.from(byUser.values()) });
