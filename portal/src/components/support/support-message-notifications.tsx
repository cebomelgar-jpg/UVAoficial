"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { LockKeyhole, MessageCircle, X } from "lucide-react";
import {
  decryptSupportMessage,
  deriveSupportEncryptionKey,
  getStoredSupportKeyPair,
  getSupportPublicKey,
} from "@/lib/support-chat-crypto";
import { createClient } from "@/lib/supabase/client";
import {
  isSupportNotificationEnabled,
  subscribeSupportNotificationPreferences,
} from "@/lib/support-notification-preferences";
import type { ProfileRole, SupportChatMessage, SupportConversation } from "@/lib/types";

type ConversationReference = Pick<
  SupportConversation,
  "id" | "patient_id" | "admin_id" | "expires_at"
>;

type ChatToast = {
  id: string;
  conversationId: string;
  title: string;
  preview: string;
  href: string;
};

function parseMessage(value: Record<string, unknown>): SupportChatMessage | null {
  const fields = ["id", "conversation_id", "sender_id", "ciphertext", "iv", "created_at"] as const;
  if (fields.some((field) => typeof value[field] !== "string")) return null;
  return {
    id: value.id as string,
    conversation_id: value.conversation_id as string,
    sender_id: value.sender_id as string,
    ciphertext: value.ciphertext as string,
    iv: value.iv as string,
    created_at: value.created_at as string,
  };
}

function parseConversation(value: Record<string, unknown>): ConversationReference | null {
  const fields = ["id", "patient_id", "admin_id", "expires_at"] as const;
  if (fields.some((field) => typeof value[field] !== "string")) return null;
  return {
    id: value.id as string,
    patient_id: value.patient_id as string,
    admin_id: value.admin_id as string,
    expires_at: value.expires_at as string,
  };
}

export function SupportMessageNotifications({
  userId,
  role,
}: {
  userId: string;
  role: ProfileRole;
}) {
  const supabase = useMemo(() => createClient(), []);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeConversationId = searchParams.get("conversation");
  const [toast, setToast] = useState<ChatToast | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const currentRouteRef = useRef({ pathname, activeConversationId });
  currentRouteRef.current = { pathname, activeConversationId };

  useEffect(() => {
    let active = true;
    const conversations = new Map<string, ConversationReference>();
    const seenMessages = new Set<string>();

    async function getConversation(id: string) {
      const cached = conversations.get(id);
      if (cached) return cached;

      const { data, error } = await supabase
        .from("support_conversations")
        .select("id, patient_id, admin_id, expires_at")
        .eq("id", id)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();
      if (error) {
        console.error("[support/notifications] No pudimos consultar la conversación.", error.message);
        return null;
      }
      if (!data) return null;
      const conversation = data as ConversationReference;
      if (
        (role === "admin" && conversation.admin_id !== userId) ||
        (role === "patient" && conversation.patient_id !== userId)
      ) {
        return null;
      }
      conversations.set(id, conversation);
      return conversation;
    }

    async function notify(message: SupportChatMessage) {
      if (!active || message.sender_id === userId || seenMessages.has(message.id)) return;
      seenMessages.add(message.id);
      if (seenMessages.size > 200) {
        const oldest = seenMessages.values().next().value;
        if (oldest) seenMessages.delete(oldest);
      }

      const conversation = await getConversation(message.conversation_id);
      if (!active || !conversation || Date.parse(conversation.expires_at) <= Date.now()) return;

      const expectedPeerId = role === "admin" ? conversation.patient_id : conversation.admin_id;
      if (message.sender_id !== expectedPeerId) return;
      const currentRoute = currentRouteRef.current;
      if (
        !isSupportNotificationEnabled(userId, conversation.id) ||
        (role === "patient" && currentRoute.pathname === "/portal/ayuda") ||
        (role === "admin" &&
          currentRoute.pathname === "/admin/mensajes" &&
          currentRoute.activeConversationId === conversation.id)
      ) {
        return;
      }

      let preview = "Nuevo mensaje cifrado. Abrí el chat para leerlo.";
      try {
        const [ownKey, ownPublicRow, peerPublicRow] = await Promise.all([
          getStoredSupportKeyPair(userId),
          supabase
            .from("support_chat_keys")
            .select("public_key")
            .eq("user_id", userId)
            .maybeSingle(),
          supabase
            .from("support_chat_keys")
            .select("public_key")
            .eq("user_id", expectedPeerId)
            .maybeSingle(),
        ]);
        if (
          ownKey &&
          !ownPublicRow.error &&
          !peerPublicRow.error &&
          ownPublicRow.data &&
          peerPublicRow.data &&
          (await getSupportPublicKey(ownKey)) === ownPublicRow.data.public_key
        ) {
          const encryptionKey = await deriveSupportEncryptionKey(
            ownKey,
            peerPublicRow.data.public_key,
            conversation.id,
          );
          preview = await decryptSupportMessage(
            encryptionKey,
            message.ciphertext,
            message.iv,
            conversation.id,
            message.sender_id,
          );
        }
      } catch {
        preview = "Nuevo mensaje cifrado. Abrí el chat para leerlo.";
      }

      if (!active) return;
      let title = "Administración UVA";
      if (role === "admin") {
        const { data: patient, error } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", conversation.patient_id)
          .maybeSingle();
        if (error) {
          console.error("[support/notifications] No pudimos consultar el nombre del paciente.", error.message);
        }
        title = patient?.full_name ?? "Paciente";
      }

      setToast({
        id: message.id,
        conversationId: conversation.id,
        title,
        preview: preview.slice(0, 180),
        href:
          role === "admin"
            ? `/admin/mensajes?conversation=${encodeURIComponent(conversation.id)}`
            : "/portal/ayuda",
      });
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => setToast(null), 12_000);
    }

    async function refreshConversation(value: Record<string, unknown>) {
      const conversation = parseConversation(value);
      if (!conversation) return;
      if (
        (role === "admin" && conversation.admin_id !== userId) ||
        (role === "patient" && conversation.patient_id !== userId)
      ) {
        return;
      }
      if (Date.parse(conversation.expires_at) > Date.now()) {
        conversations.set(conversation.id, conversation);
      } else {
        conversations.delete(conversation.id);
      }
    }

    const channel = supabase
      .channel(`support-notifications-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_chat_messages" },
        (payload: { new: Record<string, unknown> }) => {
          const message = parseMessage(payload.new);
          if (message) void notify(message);
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "support_conversations" },
        (payload: {
          eventType: string;
          new: Record<string, unknown>;
          old: Record<string, unknown>;
        }) => {
          if (payload.eventType === "DELETE" && typeof payload.old.id === "string") {
            conversations.delete(payload.old.id);
          } else if (payload.new) {
            void refreshConversation(payload.new);
          }
        },
      )
      .subscribe((status: string) => {
        if (active && (status === "CHANNEL_ERROR" || status === "TIMED_OUT")) {
          console.error("[support/notifications] No pudimos conectar las notificaciones en tiempo real.");
        }
      });

    void (async () => {
      let query = supabase
        .from("support_conversations")
        .select("id, patient_id, admin_id, expires_at")
        .gt("expires_at", new Date().toISOString());
      query =
        role === "admin"
          ? query.eq("admin_id", userId)
          : query.eq("patient_id", userId);
      const { data, error } = await query;
      if (error) {
        console.error("[support/notifications] No pudimos cargar las conversaciones activas.", error.message);
        return;
      }
      if (!active) return;
      for (const row of data ?? []) {
        conversations.set(row.id, row as ConversationReference);
      }
    })();

    return () => {
      active = false;
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
      void supabase.removeChannel(channel);
    };
  }, [role, supabase, userId]);

  useEffect(() => {
    const unsubscribe = subscribeSupportNotificationPreferences(userId, () => {
      if (toast && !isSupportNotificationEnabled(userId, toast.conversationId)) {
        if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
        setToast(null);
      }
    });
    if (toast && !isSupportNotificationEnabled(userId, toast.conversationId)) {
      setToast(null);
    }
    return unsubscribe;
  }, [toast, userId]);

  useEffect(() => {
    if (
      toast &&
      ((role === "patient" && pathname === "/portal/ayuda") ||
        (role === "admin" &&
          pathname === "/admin/mensajes" &&
          activeConversationId === toast.conversationId))
    ) {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
      setToast(null);
    }
  }, [activeConversationId, pathname, role, toast]);

  if (!toast) return null;

  return (
    <aside
      className="no-print fixed inset-x-3 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[60] ml-auto w-auto max-w-sm animate-fade-up sm:inset-x-auto sm:right-5 sm:w-[min(24rem,calc(100vw-2rem))]"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="overflow-hidden rounded-3xl border border-ink/15 bg-white shadow-soft">
        <div className="flex items-center gap-3 px-4 pb-3 pt-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-mint/30 text-green-text">
            <MessageCircle className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">{toast.title}</p>
            <p className="mt-0.5 flex items-center gap-1 text-[10px] text-muted">
              <LockKeyhole className="size-3" />
              Nuevo mensaje cifrado
            </p>
          </div>
          <button
            type="button"
            className="grid size-8 shrink-0 place-items-center rounded-full text-muted transition hover:bg-ink/5 hover:text-ink"
            aria-label="Cerrar notificación"
            onClick={() => {
              if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
              setToast(null);
            }}
          >
            <X className="size-4" />
          </button>
        </div>
        <p className="border-y border-ink/8 bg-paper/50 px-4 py-3 text-xs leading-relaxed text-ink">
          {toast.preview}
        </p>
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <span className="text-[10px] text-muted">Vista previa temporal</span>
          <Link
            href={toast.href}
            className="btn-primary btn-sm"
            onClick={() => {
              if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
              setToast(null);
            }}
          >
            Abrir chat
          </Link>
        </div>
      </div>
    </aside>
  );
}
