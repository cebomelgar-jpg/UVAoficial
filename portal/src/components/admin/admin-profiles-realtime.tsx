"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export function AdminProfilesRealtime() {
  const router = useRouter();
  const [connected, setConnected] = useState(false);
  const connectedRef = useRef(false);
  const refreshTimeout = useRef<number | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("admin-profiles-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        () => {
          if (refreshTimeout.current) {
            window.clearTimeout(refreshTimeout.current);
          }
          refreshTimeout.current = window.setTimeout(() => router.refresh(), 250);
        },
      )
      .subscribe((status: string) => {
        const isConnected = status === "SUBSCRIBED";
        connectedRef.current = isConnected;
        setConnected(isConnected);
        if (isConnected) router.refresh();
      });

    const fallbackRefresh = window.setInterval(() => {
      if (!connectedRef.current) router.refresh();
    }, 15_000);

    return () => {
      window.clearInterval(fallbackRefresh);
      if (refreshTimeout.current) window.clearTimeout(refreshTimeout.current);
      connectedRef.current = false;
      supabase.removeChannel(channel);
    };
  }, [router]);

  return (
    <span
      className={cn(
        "badge",
        connected
          ? "border-green/25 bg-mint/20 text-green-text"
          : "border-ink/10 bg-white/60 text-muted",
      )}
      role="status"
      aria-live="polite"
      title={
        connected
          ? "Los perfiles se actualizan automáticamente."
          : "Reconectando a Supabase; mientras tanto, se comprueba la lista periódicamente."
      }
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          connected ? "bg-green animate-pulse-soft" : "bg-muted",
        )}
      />
      {connected ? "Perfiles en tiempo real" : "Sincronizando perfiles…"}
    </span>
  );
}
