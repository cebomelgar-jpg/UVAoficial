"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  Bell,
  BellOff,
  Clock3,
  LockKeyhole,
  Loader2,
  MessageCircle,
  Send,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { deleteSupportConversationAction } from "@/lib/actions/support";
import {
  getSupportConversationLastRead,
  isSupportNotificationEnabled,
  markSupportConversationRead,
  setSupportNotificationEnabled,
} from "@/lib/support-notification-preferences";
import {
  decryptSupportMessage,
  deriveSupportEncryptionKey,
  encryptSupportMessage,
  getOrCreateSupportKeyPair,
  getStoredSupportKeyPair,
  getSupportPublicKey,
} from "@/lib/support-chat-crypto";
import type { SupportChatMessage, SupportConversation } from "@/lib/types";
import { cn } from "@/lib/utils";

type DecryptedMessage = SupportChatMessage & { plaintext: string };
async function getChatIdentity(supabase: ReturnType<typeof createClient>, userId: string) {
  const { data: row, error } = await supabase
    .from("support_chat_keys")
    .select("public_key")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error("No pudimos consultar la clave del chat.");

  if (row) {
    const keyPair = await getStoredSupportKeyPair(userId);
    if (!keyPair || (await getSupportPublicKey(keyPair)) !== row.public_key) {
      throw new Error(
        "No se encontró la clave privada de este dispositivo. Por seguridad, no regeneramos la clave porque dejaría los mensajes activos ilegibles.",
      );
    }
    return keyPair;
  }

  const keyPair = await getOrCreateSupportKeyPair(userId);
  const publicKey = await getSupportPublicKey(keyPair);
  const { error: insertError } = await supabase
    .from("support_chat_keys")
    .insert({ user_id: userId, public_key: publicKey });

  if (!insertError) return keyPair;

  const { data: racedRow, error: racedError } = await supabase
    .from("support_chat_keys")
    .select("public_key")
    .eq("user_id", userId)
    .maybeSingle();
  if (racedError || racedRow?.public_key !== publicKey) {
    throw new Error("No pudimos inicializar la clave del chat. Recargá e intentá otra vez.");
  }
  return keyPair;
}

function friendlyError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("todavía no está habilitado")) {
    return "El administrador todavía no habilitó el chat en este dispositivo.";
  }
  if (message.includes("clave privada")) return message;
  if (message.includes("venció")) {
    return "La conversación venció. Actualizá la página para iniciar una nueva.";
  }
  return message || "No pudimos conectar el chat. Intentá nuevamente.";
}

export function PatientSupportChat({
  userId,
  requestProduct,
}: {
  userId: string;
  requestProduct?: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [conversation, setConversation] = useState<SupportConversation | null>(null);
  const [adminId, setAdminId] = useState<string | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function resetLostKey() {
    const { error: resetError } = await supabase.rpc("reset_support_chat_key");
    if (resetError) {
      setError(friendlyError(new Error(resetError.message)));
      return;
    }
    window.location.reload();
  }

  useEffect(() => {
    let active = true;
    async function initialize() {
      try {
        await getChatIdentity(supabase, userId);
        const { data: primaryAdminId, error: adminError } = await supabase.rpc(
          "primary_support_admin_id",
        );
        if (adminError || !primaryAdminId) {
          throw new Error("Todavía no hay un administrador disponible para el chat.");
        }

        const { data, error: openError } = await supabase.rpc(
          "open_support_conversation",
        );
        if (openError) throw new Error(openError.message);
        const current = (data as SupportConversation[] | null)?.[0];
        if (!current) throw new Error("No pudimos abrir la conversación.");
        if (active) {
          setAdminId(primaryAdminId as string);
          setConversation(current);
          setError(null);
        }
      } catch (reason) {
        if (active) setError(friendlyError(reason));
      } finally {
        if (active) setLoading(false);
      }
    }
    void initialize();
    return () => {
      active = false;
    };
  }, [supabase, userId]);

  useEffect(() => {
    if (conversation) {
      setNotificationsEnabled(isSupportNotificationEnabled(userId, conversation.id));
    }
  }, [conversation, userId]);

  function toggleNotifications() {
    if (!conversation) return;
    const enabled = !notificationsEnabled;
    try {
      setSupportNotificationEnabled(userId, conversation.id, enabled);
      setNotificationsEnabled(enabled);
      setError(null);
    } catch (reason) {
      setError(friendlyError(reason));
    }
  }

  return (
    <div className="space-y-5">
      <div className="card flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-mint/30 text-green-text">
            <ShieldCheck className="size-5" />
          </span>
          <div>
            <h2 className="font-semibold text-ink">Chat cifrado extremo a extremo</h2>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted">
              Solo vos y el administrador autorizado pueden leer los mensajes.
              No se guarda historial: la conversación se elimina tras 60 minutos
              sin mensajes. No compartas contraseñas ni urgencias médicas.
              La clave privada queda en este navegador; no borres sus datos.
            </p>
          </div>
        </div>
        <span className="badge border-green/25 bg-mint/20 text-green-text">
          <LockKeyhole className="size-3" />
          ECDH · AES-GCM
        </span>
      </div>

      {loading ? (
        <div className="card flex items-center justify-center gap-3 p-12 text-sm text-muted">
          <Loader2 className="size-4 animate-spin" />
          Preparando claves seguras…
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <p>{error}</p>
          </div>
          {error.includes("No se encontró la clave privada") ? (
            <button type="button" onClick={resetLostKey} className="btn-outline btn-sm mt-3">
              Restablecer clave local
            </button>
          ) : null}
        </div>
      ) : conversation && adminId ? (
        <>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={toggleNotifications}
              className="btn-outline btn-sm"
              aria-pressed={notificationsEnabled}
            >
              {notificationsEnabled ? (
                <Bell className="size-3.5" />
              ) : (
                <BellOff className="size-3.5" />
              )}
              Notificaciones emergentes{" "}
              {notificationsEnabled ? "activadas" : "desactivadas"}
            </button>
          </div>
          <EncryptedConversation
            key={requestProduct ?? "support"}
            conversation={conversation}
            userId={userId}
            peerId={adminId}
            peerName="Administración UVA"
            initialDraft={
              requestProduct
                ? `Hola, quisiera consultar disponibilidad y fecha estimada para ${requestProduct} por encargo en mi sede.`
                : undefined
            }
          />
        </>
      ) : null}
    </div>
  );
}

export function AdminSupportChats({
  userId,
  conversations: initialConversations,
}: {
  userId: string;
  conversations: SupportConversation[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedConversationId = searchParams.get("conversation");
  const [conversations, setConversations] = useState(initialConversations);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [keyReady, setKeyReady] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [notificationPreferences, setNotificationPreferences] = useState<
    Record<string, boolean>
  >(() => Object.fromEntries(initialConversations.map((conversation) => [conversation.id, true])));
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function resetLostKey() {
    const { error: resetError } = await supabase.rpc("reset_support_chat_key");
    if (resetError) {
      setKeyError(friendlyError(new Error(resetError.message)));
      return;
    }
    window.location.reload();
  }

  useEffect(() => setConversations(initialConversations), [initialConversations]);

  useEffect(() => {
    if (
      requestedConversationId &&
      conversations.some((conversation) => conversation.id === requestedConversationId)
    ) {
      setSelectedId(requestedConversationId);
      try {
        markSupportConversationRead(userId, requestedConversationId);
        setUnreadCounts((current) => ({ ...current, [requestedConversationId]: 0 }));
      } catch (reason) {
        setKeyError(friendlyError(reason));
      }
    }
  }, [conversations, requestedConversationId, userId]);

  useEffect(() => {
    setNotificationPreferences(
      Object.fromEntries(
        conversations.map((conversation) => [
          conversation.id,
          isSupportNotificationEnabled(userId, conversation.id),
        ]),
      ),
    );
  }, [conversations, userId]);

  useEffect(() => {
    let active = true;
    const conversationIds = conversations.map((conversation) => conversation.id);
    if (!conversationIds.length) {
      setUnreadCounts({});
      return;
    }

    const seenMessages = new Set<string>();
    const lastReadByConversation = new Map(
      conversations.map((conversation) => [
        conversation.id,
        getSupportConversationLastRead(userId, conversation.id) ??
          conversation.created_at,
      ]),
    );

    async function loadUnreadMessages() {
      const { data, error } = await supabase
        .from("support_chat_messages")
        .select("id, conversation_id, sender_id, created_at")
        .in("conversation_id", conversationIds)
        .neq("sender_id", userId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("[admin/support] No se pudieron contar los mensajes nuevos.", error.message);
        return;
      }
      if (!active) return;

      const counts: Record<string, number> = {};
      for (const message of data ?? []) {
        seenMessages.add(message.id);
        const lastRead = lastReadByConversation.get(message.conversation_id);
        if (
          message.conversation_id !== selectedId &&
          lastRead &&
          message.created_at > lastRead
        ) {
          counts[message.conversation_id] = (counts[message.conversation_id] ?? 0) + 1;
        }
      }
      setUnreadCounts(counts);
    }

    const channel = supabase
      .channel(`admin-support-unread-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_chat_messages" },
        (payload: { new: Record<string, unknown> }) => {
          const message = payload.new;
          if (
            typeof message.id !== "string" ||
            typeof message.conversation_id !== "string" ||
            message.sender_id === userId ||
            !conversationIds.includes(message.conversation_id) ||
            seenMessages.has(message.id)
          ) {
            return;
          }
          seenMessages.add(message.id);
          if (message.conversation_id === selectedId) {
            try {
              markSupportConversationRead(userId, message.conversation_id);
            } catch (reason) {
              console.error("[admin/support] No se pudo marcar el chat como leído.", reason);
            }
            setUnreadCounts((current) => ({ ...current, [message.conversation_id as string]: 0 }));
            return;
          }
          setUnreadCounts((current) => ({
            ...current,
            [message.conversation_id as string]:
              (current[message.conversation_id as string] ?? 0) + 1,
          }));
        },
      )
      .subscribe((status: string) => {
        if (active && (status === "CHANNEL_ERROR" || status === "TIMED_OUT")) {
          console.error("[admin/support] No se pudo conectar el contador de mensajes en tiempo real.");
        }
      });

    void loadUnreadMessages();
    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [conversations, selectedId, supabase, userId]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const { data: primaryAdminId, error: adminError } = await supabase.rpc(
          "primary_support_admin_id",
        );
        if (adminError || primaryAdminId !== userId) {
          throw new Error(
            "El chat está vinculado al dispositivo del administrador principal.",
          );
        }
        await getChatIdentity(supabase, userId);
        if (active) {
          setKeyReady(true);
          setKeyError(null);
        }
      } catch (reason) {
        if (active) setKeyError(friendlyError(reason));
      }
    })();
    return () => {
      active = false;
    };
  }, [supabase, userId]);

  const selected = conversations.find((item) => item.id === selectedId) ?? null;

  function openConversation(conversationId: string) {
    setSelectedId(conversationId);
    try {
      markSupportConversationRead(userId, conversationId);
      setUnreadCounts((current) => ({ ...current, [conversationId]: 0 }));
    } catch (reason) {
      setKeyError(friendlyError(reason));
    }
    router.replace(
      `/admin/mensajes?conversation=${encodeURIComponent(conversationId)}`,
      { scroll: false },
    );
  }

  function toggleConversationNotifications(conversationId: string) {
    const enabled = notificationPreferences[conversationId] === false;
    try {
      setSupportNotificationEnabled(userId, conversationId, enabled);
      setNotificationPreferences((current) => ({ ...current, [conversationId]: enabled }));
    } catch (reason) {
      setKeyError(friendlyError(reason));
    }
  }

  async function deleteConversation(conversation: SupportConversation) {
    if (
      !window.confirm(
        `¿Borrar la conversación de ${conversation.patient?.full_name ?? "este paciente"}? Se eliminarán permanentemente todos sus mensajes.`,
      )
    ) {
      return;
    }
    setDeletingId(conversation.id);
    try {
      const result = await deleteSupportConversationAction(conversation.id);
      if (result.error) {
        setKeyError(result.error);
        return;
      }
      setConversations((current) =>
        current.filter((item) => item.id !== conversation.id),
      );
      setUnreadCounts((current) => {
        const next = { ...current };
        delete next[conversation.id];
        return next;
      });
      if (selectedId === conversation.id) {
        setSelectedId(null);
        router.replace("/admin/mensajes", { scroll: false });
      }
      router.refresh();
    } catch (reason) {
      console.error("[admin/support] No se pudo borrar la conversación.", reason);
      setKeyError("No pudimos borrar la conversación. Intentá nuevamente.");
    } finally {
      setDeletingId(null);
    }
  }

  useEffect(() => {
    if (selectedId && !conversations.some((conversation) => conversation.id === selectedId)) {
      setSelectedId(null);
    }
  }, [conversations, selectedId]);

  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <div>
          <h2 className="font-semibold text-ink">Conversaciones activas</h2>
          <p className="mt-1 text-xs text-muted">
            Elegí un mosaico para abrir ese chat. Al seleccionar otro, la
            conversación anterior se cierra. Los chats vencen tras 60 minutos
            sin actividad.
          </p>
        </div>
        {conversations.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {conversations.map((conversation) => {
              const isSelected = selectedId === conversation.id;
              return (
                <article
                  key={conversation.id}
                  className={cn(
                    "card min-w-0 p-4 transition hover:-translate-y-0.5 hover:border-green/30 hover:shadow-card",
                    isSelected && "border-green/40 bg-mint/15 ring-2 ring-green/15",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => openConversation(conversation.id)}
                    aria-pressed={isSelected}
                    className="w-full text-left"
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-ink">
                          {conversation.patient?.full_name ?? "Paciente"}
                        </span>
                        <span className="mt-1 block truncate text-xs text-muted">
                          {conversation.patient?.email ?? "Sin email"}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        {unreadCounts[conversation.id] ? (
                          <span
                            className="grid min-w-6 place-items-center rounded-full bg-green-text px-1.5 py-0.5 text-[10px] font-bold text-white"
                            aria-label={`${unreadCounts[conversation.id]} mensajes nuevos`}
                          >
                            {unreadCounts[conversation.id] > 99
                              ? "99+"
                              : unreadCounts[conversation.id]}
                          </span>
                        ) : null}
                        <span className="text-[10px] text-muted">
                          {new Intl.DateTimeFormat("es-AR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          }).format(new Date(conversation.last_activity_at))}
                        </span>
                      </span>
                    </span>
                    <span className="mt-4 flex items-center justify-between gap-2 border-t border-ink/10 pt-3">
                      <span className="flex items-center gap-1 text-[10px] text-green-text">
                        <LockKeyhole className="size-3" />
                        Contenido cifrado
                      </span>
                      <span className="text-[10px] font-semibold text-green-text">
                        {isSelected ? "Chat abierto" : "Abrir chat"}
                      </span>
                    </span>
                  </button>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => toggleConversationNotifications(conversation.id)}
                      className="btn-outline btn-sm"
                      aria-pressed={notificationPreferences[conversation.id] !== false}
                    >
                      {notificationPreferences[conversation.id] === false ? (
                        <BellOff className="size-3.5" />
                      ) : (
                        <Bell className="size-3.5" />
                      )}
                      {notificationPreferences[conversation.id] === false
                        ? "Activar emergentes"
                        : "Desactivar emergentes"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteConversation(conversation)}
                      disabled={deletingId === conversation.id}
                      className="btn-ghost btn-sm text-rose-700 disabled:opacity-50"
                    >
                      {deletingId === conversation.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="size-3.5" />
                      )}
                      Borrar chat
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="card p-8 text-center">
            <MessageCircle className="mx-auto size-7 text-muted/60" />
            <p className="mt-3 text-sm font-semibold text-ink">Sin chats activos</p>
            <p className="mt-1 text-xs text-muted">
              Los nuevos mensajes aparecerán acá en tiempo real.
            </p>
          </div>
        )}
      </section>

      <section className="min-w-0">
        {keyError ? (
          <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            <p>{keyError}</p>
            {keyError.includes("No se encontró la clave privada") ? (
              <button type="button" onClick={resetLostKey} className="btn-outline btn-sm mt-3">
                Restablecer clave local
              </button>
            ) : null}
          </div>
        ) : !keyReady ? (
          <div className="card flex items-center justify-center gap-3 p-12 text-sm text-muted">
            <Loader2 className="size-4 animate-spin" />
            Preparando clave segura de administración…
          </div>
        ) : selected ? (
          <EncryptedConversation
            key={selected.id}
            conversation={selected}
            userId={userId}
            peerId={selected.patient_id}
            peerName={selected.patient?.full_name ?? "Paciente"}
          />
        ) : (
          <div className="card grid min-h-72 place-items-center p-8 text-center">
            <div>
              <MessageCircle className="mx-auto size-8 text-muted/60" />
              <p className="mt-3 font-semibold text-ink">Elegí un mosaico para abrir un chat</p>
              <p className="mt-1 text-xs text-muted">
                Los mensajes se descifran solo en este dispositivo.
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function EncryptedConversation({
  conversation,
  userId,
  peerId,
  peerName,
  initialDraft,
}: {
  conversation: SupportConversation;
  userId: string;
  peerId: string;
  peerName: string;
  initialDraft?: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [messages, setMessages] = useState<DecryptedMessage[]>([]);
  const [encryptionKey, setEncryptionKey] = useState<CryptoKey | null>(null);
  const [draft, setDraft] = useState(initialDraft ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [connected, setConnected] = useState(false);
  const [expiresAt, setExpiresAt] = useState(conversation.expires_at);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | undefined;
    async function loadMessages(key: CryptoKey) {
      const { data, error: queryError } = await supabase
        .from("support_chat_messages")
        .select("id, conversation_id, sender_id, ciphertext, iv, created_at")
        .eq("conversation_id", conversation.id)
        .order("created_at", { ascending: true });

      if (queryError) throw new Error("No pudimos cargar los mensajes cifrados.");
      const decrypted = await Promise.all(
        ((data ?? []) as SupportChatMessage[]).map(async (message) => ({
          ...message,
          plaintext: await decryptSupportMessage(
            key,
            message.ciphertext,
            message.iv,
            conversation.id,
            message.sender_id,
          ),
        })),
      );
      if (active) setMessages(decrypted);
    }

    async function initialize() {
      try {
        const [ownKey, peer] = await Promise.all([
          getChatIdentity(supabase, userId),
          supabase
            .from("support_chat_keys")
            .select("public_key")
            .eq("user_id", peerId)
            .maybeSingle(),
        ]);
        if (peer.error || !peer.data) {
          throw new Error("No encontramos la clave pública del otro participante.");
        }
        const key = await deriveSupportEncryptionKey(
          ownKey,
          peer.data.public_key,
          conversation.id,
        );
        if (!active) return;
        setEncryptionKey(key);

        const loadLatestExpiry = async () => {
          const { data: current, error: currentError } = await supabase
            .from("support_conversations")
            .select("expires_at")
            .eq("id", conversation.id)
            .maybeSingle();
          if (currentError) throw new Error("No pudimos verificar la vigencia del chat.");
          if (current?.expires_at && active) setExpiresAt(current.expires_at);
          else if (active) setExpiresAt(new Date().toISOString());
        };

        channel = supabase
          .channel(`support-chat-${conversation.id}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "support_chat_messages",
              filter: `conversation_id=eq.${conversation.id}`,
            },
            () => {
              void loadMessages(key).catch((reason: unknown) => {
                if (active) setError(friendlyError(reason));
              });
              void loadLatestExpiry();
            },
          )
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "support_conversations",
              filter: `id=eq.${conversation.id}`,
            },
            () => void loadLatestExpiry(),
          )
          .subscribe((status: string) => {
            if (active) setConnected(status === "SUBSCRIBED");
          });

        await loadMessages(key);
        if (active) {
          setError(null);
          setLoading(false);
        }
      } catch (reason) {
        if (active) {
          setError(friendlyError(reason));
          setLoading(false);
        }
      }
    }

    void initialize();
    return () => {
      active = false;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [conversation.id, peerId, supabase, userId]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = draft.trim();
    if (!message || !encryptionKey || sending) return;
    if (new TextEncoder().encode(message).length > 2000) {
      setError("El mensaje no puede superar los 2.000 bytes.");
      return;
    }

    setSending(true);
    setError(null);
    try {
      const encrypted = await encryptSupportMessage(
        encryptionKey,
        message,
        conversation.id,
        userId,
      );
      const { error: insertError } = await supabase
        .from("support_chat_messages")
        .insert({
          conversation_id: conversation.id,
          sender_id: userId,
          ...encrypted,
        });
      if (insertError) throw new Error(insertError.message);
      setDraft("");
      const { data: current } = await supabase
        .from("support_conversations")
        .select("expires_at")
        .eq("id", conversation.id)
        .maybeSingle();
      if (current?.expires_at) setExpiresAt(current.expires_at);
    } catch (reason) {
      setError(friendlyError(reason));
    } finally {
      setSending(false);
    }
  }

  const expired = new Date(expiresAt).getTime() <= now;
  const remainingMinutes = Math.max(
    0,
    Math.ceil((new Date(expiresAt).getTime() - now) / 60_000),
  );

  useEffect(() => {
    if (!expired) return;
    setMessages([]);
    setDraft("");
    setEncryptionKey(null);
  }, [expired]);

  return (
    <section className="card flex min-h-[30rem] flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-ink/10 p-4">
        <div className="min-w-0">
          <h2 className="truncate font-semibold text-ink">{peerName}</h2>
          <p className="mt-1 flex items-center gap-1 text-[11px] text-muted">
            <LockKeyhole className="size-3" />
            Mensajes cifrados en este dispositivo
          </p>
        </div>
        <span
          className={cn(
            "badge shrink-0",
            connected
              ? "border-green/25 bg-mint/20 text-green-text"
              : "border-ink/10 bg-white text-muted",
          )}
          role="status"
        >
          <span className={cn("size-1.5 rounded-full", connected ? "bg-green" : "bg-muted")} />
          {connected ? "En línea" : "Conectando"}
        </span>
      </div>

      <div className="flex items-center justify-between gap-2 border-b border-ink/5 bg-white/40 px-4 py-2 text-[10px] text-muted">
        <span className="flex items-center gap-1">
          <Clock3 className="size-3" />
          {expired ? "Chat vencido" : `Se elimina en ${remainingMinutes} min sin actividad`}
        </span>
        <span>Sin historial</span>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
        {loading ? (
          <div className="flex h-full min-h-40 items-center justify-center gap-2 text-sm text-muted">
            <Loader2 className="size-4 animate-spin" />
            Descifrando en este dispositivo…
          </div>
        ) : expired ? (
          <div className="grid h-full min-h-40 place-items-center text-center">
            <div>
              <Clock3 className="mx-auto size-7 text-muted/60" />
              <p className="mt-2 text-sm font-medium text-ink">La conversación venció</p>
              <p className="mt-1 text-xs text-muted">
                El contenido local se limpió. Iniciá un nuevo chat para continuar.
              </p>
            </div>
          </div>
        ) : messages.length ? (
          messages.map((message) => {
            const ownMessage = message.sender_id === userId;
            return (
              <div
                key={message.id}
                className={cn("flex", ownMessage ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3.5 py-2.5",
                    ownMessage
                      ? "rounded-br-md bg-ink text-paper"
                      : "rounded-bl-md border border-ink/10 bg-white text-ink",
                  )}
                >
                  <p className="whitespace-pre-wrap break-words text-sm">{message.plaintext}</p>
                  <p
                    className={cn(
                      "mt-1 text-right text-[9px]",
                      ownMessage ? "text-paper/60" : "text-muted",
                    )}
                  >
                    {new Intl.DateTimeFormat("es-AR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    }).format(new Date(message.created_at))}
                  </p>
                </div>
              </div>
            );
          })
        ) : (
          <div className="grid h-full min-h-40 place-items-center text-center">
            <div>
              <MessageCircle className="mx-auto size-7 text-muted/60" />
              <p className="mt-2 text-sm font-medium text-ink">Iniciá la conversación</p>
              <p className="mt-1 text-xs text-muted">
                No incluyas contraseñas ni datos médicos sensibles.
              </p>
            </div>
          </div>
        )}
      </div>

      {error ? (
        <div
          role="alert"
          className="mx-4 mb-3 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <form onSubmit={sendMessage} className="flex items-end gap-2 border-t border-ink/10 p-3">
        <label htmlFor={`message-${conversation.id}`} className="sr-only">
          Escribir un mensaje
        </label>
        <textarea
          id={`message-${conversation.id}`}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          className="input min-h-11 max-h-32 resize-y py-3"
          placeholder={expired ? "Esta conversación venció" : "Escribí un mensaje seguro…"}
          maxLength={2000}
          rows={1}
          disabled={expired || loading || !encryptionKey}
        />
        <button
          type="submit"
          className="btn-primary h-11 shrink-0 px-3"
          aria-label="Enviar mensaje cifrado"
          disabled={expired || sending || loading || !draft.trim() || !encryptionKey}
        >
          {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </button>
      </form>
    </section>
  );
}
