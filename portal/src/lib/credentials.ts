import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const VERSION = "v1";

function getKey() {
  const configured = process.env.CREDENTIALS_ENCRYPTION_KEY?.trim();
  if (configured) {
    let key: Buffer | null = null;
    if (/^[0-9a-f]{64}$/i.test(configured)) {
      key = Buffer.from(configured, "hex");
    } else {
      key = Buffer.from(configured, "base64");
    }
    if (key.length === 32) return key;
    throw new Error(
      "CREDENTIALS_ENCRYPTION_KEY debe ser 32 bytes en base64 o 64 caracteres hexadecimales.",
    );
  }

  const fallback = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!fallback) {
    throw new Error(
      "Falta CREDENTIALS_ENCRYPTION_KEY o SUPABASE_SERVICE_ROLE_KEY para cifrar contraseñas.",
    );
  }
  return createHash("sha256").update(fallback).digest();
}

export function isCredentialStorageConfigured() {
  try {
    getKey();
    return true;
  } catch {
    return false;
  }
}

export function encryptPassword(password: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(password, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString("base64"),
    tag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

export function decryptPassword(payload: string) {
  try {
    const [version, ivB64, tagB64, dataB64] = payload.split(":");
    if (!version || !ivB64 || !tagB64 || !dataB64 || version !== VERSION) {
      return null;
    }
    const decipher = createDecipheriv(
      ALGORITHM,
      getKey(),
      Buffer.from(ivB64, "base64"),
    );
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}
