const notificationEvent = "uva-support-notification-preferences";

function storageKey(userId: string) {
  return `uva-support-notification-preferences:${userId}`;
}

function readPreferences(userId: string): Record<string, boolean> {
  try {
    const stored = window.localStorage.getItem(storageKey(userId));
    if (!stored) return {};
    const parsed: unknown = JSON.parse(stored);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, boolean] =>
        typeof entry[1] === "boolean",
      ),
    );
  } catch (error) {
    console.error("[support/notifications] No se pudieron leer las preferencias.", error);
    return {};
  }
}

export function isSupportNotificationEnabled(userId: string, conversationId: string) {
  if (typeof window === "undefined") return true;
  return readPreferences(userId)[conversationId] !== false;
}

export function setSupportNotificationEnabled(
  userId: string,
  conversationId: string,
  enabled: boolean,
) {
  try {
    const preferences = readPreferences(userId);
    preferences[conversationId] = enabled;
    window.localStorage.setItem(storageKey(userId), JSON.stringify(preferences));
    window.dispatchEvent(new Event(notificationEvent));
  } catch (error) {
    console.error("[support/notifications] No se pudo guardar la preferencia.", error);
    throw new Error("No pudimos guardar la preferencia de notificaciones.");
  }
}

export function subscribeSupportNotificationPreferences(
  userId: string,
  listener: () => void,
) {
  const onChange = (event: Event) => {
    if (event.type === "storage" && (event as StorageEvent).key !== storageKey(userId)) return;
    listener();
  };
  window.addEventListener(notificationEvent, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(notificationEvent, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function readLastRead(userId: string): Record<string, string> {
  try {
    const stored = window.localStorage.getItem(`uva-support-chat-read:${userId}`);
    if (!stored) return {};
    const parsed: unknown = JSON.parse(stored);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, string] =>
        typeof entry[1] === "string",
      ),
    );
  } catch (error) {
    console.error("[support/chat] No se pudieron leer los estados de lectura.", error);
    return {};
  }
}

export function getSupportConversationLastRead(userId: string, conversationId: string) {
  if (typeof window === "undefined") return null;
  return readLastRead(userId)[conversationId] ?? null;
}

export function markSupportConversationRead(userId: string, conversationId: string) {
  try {
    const lastRead = readLastRead(userId);
    lastRead[conversationId] = new Date().toISOString();
    window.localStorage.setItem(`uva-support-chat-read:${userId}`, JSON.stringify(lastRead));
  } catch (error) {
    console.error("[support/chat] No se pudo guardar el estado de lectura.", error);
    throw new Error("No pudimos actualizar el estado de lectura del chat.");
  }
}
