"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function Page() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    location.reload();
  }

  if (!user) {
    return (
      <main style={{ padding: 24 }}>
        <h1>Hello from Community MVP 🚀</h1>
        <p style={{ marginTop: 8 }}>You’re not logged in.</p>
        <a href="/login" style={{ marginTop: 12, display: "inline-block", textDecoration: "underline" }}>
          Log in
        </a>
      </main>
    );
  }

  return (
    <main style={{ padding: 24 }}>
      <h1>Welcome</h1>
      <p style={{ marginTop: 8 }}>You’re logged in as <strong>{user.email}</strong>.</p>
      <button onClick={signOut} style={{ marginTop: 12, padding: "8px 12px", borderRadius: 8, border: "1px solid #ddd" }}>
        Sign out
      </button>
      <div style={{ marginTop: 20 }}>
        Next we’ll add channels, threads, and events.
      </div>
    </main>
  );
}
