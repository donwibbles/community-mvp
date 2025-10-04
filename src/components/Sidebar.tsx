"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import ChannelList from "./ChannelList";

type Role = "admin" | "moderator" | "user";
type Me = {
  id: string | null;
  email: string | null;
  role: Role | null;
};

export default function Sidebar() {
  const [me, setMe] = useState<Me>({ id: null, email: null, role: null });

  useEffect(() => {
    let cleanup = () => {};
    (async () => {
      // initial load
      const { data } = await supabase.auth.getUser();
      const u = data.user ?? null;
      if (u) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", u.id)
          .maybeSingle();
        const role = ((prof as any)?.role ?? "user") as Role;
        setMe({ id: u.id, email: u.email ?? null, role });
      } else {
        setMe({ id: null, email: null, role: null });
      }

      // subscribe to auth changes
      const sub = supabase.auth.onAuthStateChange(async (_e, sess) => {
        const uu = sess?.user ?? null;
        if (!uu) {
          setMe({ id: null, email: null, role: null });
          return;
        }
        const { data: prof2 } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", uu.id)
          .maybeSingle();
        const role = ((prof2 as any)?.role ?? "user") as Role;
        setMe({ id: uu.id, email: uu.email ?? null, role });
      });

      cleanup = () => sub.data.subscription.unsubscribe();
    })();

    return () => cleanup();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  const isAdmin = me.role === "admin";
  const isModerator = me.role === "moderator";

  return (
    <aside
      style={{
        borderRight: "1px solid #eee",
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        minWidth: 230,
        height: "100vh",
        justifyContent: "space-between",
      }}
    >
      {/* top area */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontWeight: 700 }}>Community</div>

        {/* user chip */}
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
                color:
                  me.role === "admin"
                    ? "#065f46"
                    : me.role === "moderator"
                    ? "#1e3a8a"
                    : "#555",
                background:
                  me.role === "admin"
                    ? "#ecfdf5"
                    : me.role === "moderator"
                    ? "#eef2ff"
                    : "#f5f5f5",
                border: "1px solid #eee",
                padding: "2px 6px",
                borderRadius: 999,
                width: "fit-content",
              }}
            >
              {me.role ?? "not signed in"}
            </span>
          </div>
        </div>

        {/* main navigation */}
        <nav style={{ display: "grid", gap: 6 }}>
          <Link href="/app" className="hover:underline">Home</Link>
          <Link href="/app/events" className="hover:underline">Events</Link>
          <Link href="/app/members" className="hover:underline">Members</Link>
          {/* Admin tools (visible only to admins) */}
          {isAdmin && (
            <>
              <div style={{ marginTop: 8, fontSize: 12, color: "#666", textTransform: "uppercase" }}>
                Admin
              </div>
              <Link href="/app/admin/invites" className="hover:underline">Admin · Invites</Link>
              <Link href="/app/admin/channels" className="hover:underline">Admin · Channels</Link>
              <Link href="/app/admin/members" className="hover:underline">Admin · Members</Link>
            </>
          )}
          {/* If you later allow moderators to manage channels, show tools here */}
          {isModerator && !isAdmin && (
            <>
              <div style={{ marginTop: 8, fontSize: 12, color: "#666", textTransform: "uppercase" }}>
                Moderator
              </div>
              {/* Example: <Link href="/app/mod/tools" className="hover:underline">Moderator · Tools</Link> */}
            </>
          )}
        </nav>

        {/* channels */}
        <div style={{ marginTop: 12, fontSize: 12, color: "#666", textTransform: "uppercase" }}>
          Channels
        </div>
        <ChannelList />
      </div>

      {/* bottom area */}
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
