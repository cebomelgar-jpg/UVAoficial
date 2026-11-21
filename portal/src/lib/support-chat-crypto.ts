import "client-only";

const DATABASE_NAME = "uva-support-chat";
const STORE_NAME = "keys";
const KEY_INFO = new TextEncoder().encode("uva-support-chat/v1");

export type SupportKeyPair = CryptoKeyPair;

export function getStoredSupportKeyPair(userId: string) {
  return readKeyPair(userId);
}

function openKeyDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readKeyPair(userId: string): Promise<SupportKeyPair | null> {
  const database = await openKeyDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction(STORE_NAME, "readonly")
      .objectStore(STORE_NAME)
      .get(userId);
    request.onsuccess = () => {
      database.close();
      resolve((request.result as SupportKeyPair | undefined) ?? null);
    };
    request.onerror = () => {
      database.close();
      reject(request.error);
    };
  });
}

async function saveKeyPair(userId: string, keyPair: SupportKeyPair) {
  const database = await openKeyDatabase();
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(keyPair, userId);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error);
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error);
    };
  });
}

export async function getOrCreateSupportKeyPair(userId: string) {
  return navigator.locks.request(`uva-support-key:${userId}`, async () => {
    const existing = await readKeyPair(userId);
    if (existing) return existing;

    const keyPair = await crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      false,
      ["deriveBits"],
    );
    await saveKeyPair(userId, keyPair);
    return keyPair;
  });
}

export async function getSupportPublicKey(keyPair: SupportKeyPair) {
  return encodeBase64(
    new Uint8Array(await crypto.subtle.exportKey("raw", keyPair.publicKey)),
  );
}

export async function deriveSupportEncryptionKey(
  keyPair: SupportKeyPair,
  peerPublicKey: string,
  conversationId: string,
) {
  const peerKey = await crypto.subtle.importKey(
    "raw",
    decodeBase64(peerPublicKey),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const sharedSecret = await crypto.subtle.deriveBits(
    { name: "ECDH", public: peerKey },
    keyPair.privateKey,
    256,
  );
  const material = await crypto.subtle.importKey(
    "raw",
    sharedSecret,
    "HKDF",
    false,
    ["deriveKey"],
  );
  new Uint8Array(sharedSecret).fill(0);

  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new TextEncoder().encode(conversationId),
      info: KEY_INFO,
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptSupportMessage(
  key: CryptoKey,
  message: string,
  conversationId: string,
  senderId: string,
) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: new TextEncoder().encode(`${conversationId}:${senderId}`),
    },
    key,
    new TextEncoder().encode(message),
  );
  return {
    ciphertext: encodeBase64(new Uint8Array(ciphertext)),
    iv: encodeBase64(iv),
  };
}

export async function decryptSupportMessage(
  key: CryptoKey,
  ciphertext: string,
  iv: string,
  conversationId: string,
  senderId: string,
) {
  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: decodeBase64(iv),
      additionalData: new TextEncoder().encode(`${conversationId}:${senderId}`),
    },
    key,
    decodeBase64(ciphertext),
  );
  return new TextDecoder("utf-8", { fatal: true }).decode(plaintext);
}

function encodeBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function decodeBase64(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
