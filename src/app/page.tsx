"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function Page() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    let unsub = () => {};
    (async () => {
      const { data } = await supabase.auth.getUser();
      const u = data.user;
      setUser(u || null);

      // Subscribe to auth changes
      const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
        const uu = session?.user ?? null;
        setUser(uu);
        if (uu) upsertProfile(uu);
      });
      unsub = () => sub.subscription.unsubscribe();

      // If already logged in, upsert profile now
      if (u) upsertProfile(u);
    })();

    return () => unsub();
  }, []);

  async function upsertProfile(u: any) {
    // create or update the user's profile row
    await supabase.from("profiles").upsert({
      id: u.id,
      full_name: u.user_metadata?.full_name ?? null,
      avatar_url: u.user_metadata?.avatar_url ?? null
    });
  }

  if (!user) {
    return (
      <main style={{ padding: 24 }}>
        <h1>Community MVP</h1>
        <p>You are not logged in.</p>
        <a href="/login" style={{ textDecoration: "underline" }}>Log in</a>
      </main>
    );
  }

  return (
    <main style={{ padding: 24 }}>
      <h1>Welcome</h1>
      <p>Logged in as {user.email}</p>
      <a href="/app" style={{ display: "inline-block", marginTop: 12, textDecoration: "underline" }}>
        Enter app
      </a>
    </main>
  );
}
