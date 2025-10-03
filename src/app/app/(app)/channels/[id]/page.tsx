"use client";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import MessageList from "@/components/MessageList";
import MessageInput from "@/components/MessageInput";

type Channel = { id: string; name: string; kind: "chat" | "forum" };

export default function ChannelPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [channel, setChannel] = useState<Channel | null>(null);

  useEffect(() => {
    supabase.from("channels").select("*").eq("id", id).maybeSingle().then(({ data }) => setChannel(data as any));
  }, [id]);

  if (!channel) return <div style={{ padding: 16 }}>Loading...</div>;

  return (
    <div style={{ display: "grid", gridTemplateRows: "48px 1fr auto", height: "100vh" }}>
      <div style={{ borderBottom: "1px solid #eee", padding: "12px 16px", fontWeight: 600 }}>
        {channel.name} {channel.kind === "forum" ? "(forum)" : ""}
      </div>
      <MessageList channelId={id} />
      <MessageInput channelId={id} />
    </div>
  );
}
