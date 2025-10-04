"use client";
import Link from "next/link";
import ChannelList from "./ChannelList";
import { supabase } from "@/lib/supabase";

export default function Sidebar() {
  async function handleLogout() {
    await supabase.auth.signOut();
    // Refresh the page so you drop back to login
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
        minWidth: 200,
        height: "100vh",
        justifyContent: "space-between",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontWeight: 600 }}>Community</div>

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

        {/* Channels section */}
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
