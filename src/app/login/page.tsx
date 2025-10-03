"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    // For invite-only, we’ll call our API route that checks invites table
    const res = await fetch("/api/create-magic-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Unable to send link");
    } else {
      setSent(true);
    }
  }

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <form onSubmit={sendMagicLink} style={{ width: 360, padding: 24, border: "1px solid #e5e7eb", borderRadius: 12 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>Log in</h1>
        <p style={{ fontSize: 14, color: "#555", marginBottom: 12 }}>
          Invite-only. Enter your email to receive a magic link.
        </p>
        <input
          type="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="you@example.com"
          style={{ width: "100%", padding: "10px 12px", border: "1px solid #ddd", borderRadius: 8, marginBottom: 10 }}
        />
        <button
          type="submit"
          style={{ width: "100%", padding: "10px 12px", borderRadius: 8, background: "black", color: "white" }}
        >
          Send magic link
        </button>
        {sent && <p style={{ marginTop: 10, color: "green" }}>Check your email for the link.</p>}
        {error && <p style={{ marginTop: 10, color: "crimson" }}>{error}</p>}
      </form>
    </main>
  );
}
