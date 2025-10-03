"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Channel = { id: string; name: string; kind: "chat" | "forum" };

export default function ChannelList() {
  const [channels, setChannels] = useState<Channel[]>([]);

  async function load() {
    const { data } = await supabase.from("channels").select("*").order("name");
    setChannels((data as any) ?? []);
  }

  useEffect(() => {
    load();
    // live updates if channels are added later
    const ch = supabase
      .channel("channels")
      .on("postgres_changes", { event: "*", schema: "public", table: "channels" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  return (
    <div style={{ display: "grid", gap: 4 }}>
      {channels.map(c => (
        <Link key={c.id} href={`/app/channels/${c.id}`} className="hover:underline">
          {c.kind === "chat" ? "💬" : "🧵"} {c.name}
        </Link>
      ))}
    </div>
  );
}
