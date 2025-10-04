"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import ChannelList from "./ChannelList";

type Me = { email: string | null; id: string | null; role: "admin" | "user" | null };

export default function Sidebar() {
  const [me, setMe] = useState<Me>({ email: null, id: null, role: null });

  useEffect(() => {
    let unsub = () => {};
    (async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (user) {
        // load role from profiles
        const { data: prof } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();
        setMe({ email: user.email ?? null, id: user.id, role: (prof as any)?.role ?? "user" });
      } else {
        setMe({ email: null, id: null, role: null });
      }

      const sub = supabase.auth.onAuthStateChange(async (_e, session) => {
        const u = session?.user ?? null;
        if (!u) {
          setMe({ email: null, id: null, role: null });
          return;
        }
        const { data: prof2 } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", u.id)
          .maybeSingle();
        setMe({ email: u.email ?? null, id: u.id, role: (prof2 as any)?.role ?? "user" });
      });
      unsub = () => sub.data.subscription.unsubscribe();
    })();
    return () => unsub();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <aside
      style={{
        borderRight: "1px solid #eee",
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        minWidth: 220,
        height: "100vh",
        justifyContent: "space-between",
      }}
    >
      {/* Top section: brand + user chip + nav + channels */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontWeight: 700 }}>Community</div>

        {/* User chip */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 10px",
            border: "1px solid #eee",
            borderRadius: 10,
            background: "#fafafa",
          }}
        >
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: "50%",
              border: "1px solid #ddd",
              display: "grid",
              placeItems: "center",
              fontSize: 12,
            }}
          >
            {me.email ? me.email[0]?.toUpperCase() : "?"}
          </div>
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
            <span style={{ fontSize: 13 }}>{me.email ?? "Guest"}</span>
            <span
              style={{
                marginTop: 2,
                fontSize: 11,
                color: me.role === "admin" ? "#065f46" : "#555",
                background: me.role === "admin" ? "#ecfdf5" : "#f5f5f5",
                border: "1px solid #eee",
                padding: "2px 6px",
                borderRadius: 999,
                width: "fit-content",
              }}
            >
              {me.role ? me.role : "not signed in"}
            </span>
          </div>
        </div>

        {/* Main navigation */}
        <nav style={{ display: "grid", gap: 6 }}>
          <Link href="/app" className="hover:underline">
            Home
          </Link>
          <Link href="/app/events" className="hover:underline">
            Events
          </Link>
          <Link href="/app/admin/invites" className="hover:underline">
            Admin · Invites
          </Link>
        </nav>

        {/* Channels */}
        <div
          style={{
            marginTop: 12,
            fontSize: 12,
            color: "#666",
            textTransform: "uppercase",
          }}
        >
          Channels
        </div>
        <ChannelList />
      </div>

      {/* Bottom: logout */}
      <button
        onClick={handleLogout}
        style={{
          marginTop: "auto",
          padding: "8px 12px",
          borderRadius: 8,
          background: "#f5f5f5",
          border: "1px solid #ddd",
          fontSize: 14,
          cursor: "pointer",
        }}
      >
        Log out
      </button>
    </aside>
  );
}
