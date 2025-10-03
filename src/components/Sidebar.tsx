"use client";
import Link from "next/link";
import ChannelList from "./ChannelList";

export default function Sidebar() {
  return (
    <aside style={{ borderRight: "1px solid #eee", padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ fontWeight: 600 }}>Community</div>
      <nav style={{ display: "grid", gap: 6 }}>
        <Link href="/app" className="hover:underline">Home</Link>
      </nav>
      <div style={{ marginTop: 8, fontSize: 12, color: "#666", textTransform: "uppercase" }}>Channels</div>
      <ChannelList />
    </aside>
  );
}
