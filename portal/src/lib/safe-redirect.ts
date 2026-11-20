const DEFAULT_PATH = "/portal";
const MAX_LENGTH = 2048;
const BASE_ORIGIN = "https://portal.invalid";

/**
 * Normaliza un destino interno después del login.
 *
 * Rechaza URLs absolutas, protocol-relative (`//`), barras invertidas y
 * caracteres de control. Las barras invertidas son importantes: el parser de
 * URLs las interpreta como barras y `/\evil.com` termina apuntando a otro
 * origen. Al final se valida el origen con `new URL` para no depender de una
 * lista de casos especiales.
 */
export function safeNext(value: unknown): string {
  if (typeof value !== "string") return DEFAULT_PATH;

  const candidate = value.trim();
  if (!candidate || candidate.length > MAX_LENGTH) return DEFAULT_PATH;
  if (!candidate.startsWith("/") || candidate.startsWith("//")) {
    return DEFAULT_PATH;
  }
  if (/[\\\u0000-\u001f\u007f]/.test(candidate)) return DEFAULT_PATH;

  try {
    const url = new URL(candidate, BASE_ORIGIN);
    if (url.origin !== BASE_ORIGIN) return DEFAULT_PATH;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return DEFAULT_PATH;
  }
}
