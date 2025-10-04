async function rsvpShift(shiftId: string) {
  setSaving(true);
  setErr("");

  const going = counts[shiftId] ?? 0;
  const s = shifts.find((x) => x.id === shiftId);
  const cap = s?.capacity ?? 0;
  const full = cap !== 0 && going >= cap;

  const { data: u } = await supabase.auth.getUser();
  if (!u.user?.id) {
    setErr("Please log in.");
    setSaving(false);
    return;
  }

  if (full) {
    const { error } = await supabase
      .from("shift_waitlist")
      .upsert({ shift_id: shiftId, user_id: u.user.id });
    if (error) setErr(error.message);
    else setErr("Shift is full. You’ve been added to the waitlist.");
    setSaving(false);
    return;
  }

  // ✅ include user_id
  await supabase
    .from("shift_signups")
    .upsert({ shift_id: shiftId, user_id: u.user.id, status: "going" });
  await loadAll();
  setSaving(false);
}

async function cancelShift(shiftId: string) {
  setSaving(true);
  setErr("");
  const { data: u } = await supabase.auth.getUser();
  if (!u.user?.id) {
    setSaving(false);
    return;
  }
  // ✅ include user_id
  await supabase
    .from("shift_signups")
    .upsert({ shift_id: shiftId, user_id: u.user.id, status: "cancelled" });
  await loadAll();
  setSaving(false);
}
