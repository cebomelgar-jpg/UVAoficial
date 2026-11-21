"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/providers/toast-provider";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

export function AdminSupportRealtime() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    let active = true;
    let refreshTimeout: number | undefined;
    const scheduleRefresh = () => {
      window.clearTimeout(refreshTimeout);
      refreshTimeout = window.setTimeout(() => router.refresh(), 250);
    };
    const channel = supabase
      .channel("admin-support-updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "support_conversations" },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "support_chat_messages" },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "support_contact_requests" },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          if (payload.eventType === "INSERT") {
            toast({
              title: "Nueva solicitud recibida",
              description: "Problema, ayuda o producto especial.",
            });
          }
          scheduleRefresh();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          if (payload.eventType === "INSERT") {
            toast({
              title: "Nuevo perfil registrado",
              description: "Hay una cuenta esperando revisión.",
              variant: "info",
            });
          }
          scheduleRefresh();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "adhesion_applications" },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            toast({
              title: "Actualización de adhesión",
              description: "El recorrido de un solicitante cambió.",
              variant: "info",
            });
          }
          scheduleRefresh();
        },
      )
      .subscribe((status: string) => {
        if (active && (status === "CHANNEL_ERROR" || status === "TIMED_OUT")) {
          console.error("[admin/support] No se pudo conectar con las actualizaciones en tiempo real.");
        }
      });
    const fallback = window.setInterval(scheduleRefresh, 30_000);

    return () => {
      active = false;
      window.clearInterval(fallback);
      window.clearTimeout(refreshTimeout);
      void supabase.removeChannel(channel);
    };
  }, [router, supabase, toast]);

  return null;
}
