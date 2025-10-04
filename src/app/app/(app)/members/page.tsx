"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  email: string;
  display_name: string | null;
  role: string | null;
};

export default function MembersPage() {
  const [members, setMembers] = useState<Profile[]>([]);

  useEffect(() => {
    supabase.from("profiles").select("id, email, display_name, role")
      .then(({ data }) => setMembers(data || []));
  }, []);

  return (
    <div style={{ padding: 20, maxWidth: 600 }}>
      <h1 style={{ marginBottom: 16 }}>Members</h1>
      <div style={{ display: "grid", gap: 10 }}>
        {members.map((m) => (
          <div key={m.id} style={{
            border: "1px solid #eee",
            borderRadius: 8,
            padding: 10,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}>
            <div>
              <strong>{m.display_name || m.email}</strong>
              <div style={{ fontSize: 12, color: "#666" }}>{m.email}</div>
            </div>
            <span style={{
              fontSize: 12,
              padding: "4px 8px",
              borderRadius: 6,
              background: m.role === "admin" ? "#cdeccd"
                        : m.role === "moderator" ? "#cce0f8"
                        : "#f0f0f0"
            }}>
              {m.role ?? "user"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
