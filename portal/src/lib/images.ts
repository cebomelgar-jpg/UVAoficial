import { SUPABASE_URL } from "@/lib/config";

const SUPABASE_STORAGE_PREFIX = "/storage/v1/object/public/";

/**
 * Valida las imágenes que puede mostrar `next/image`.
 *
 * Se aceptan rutas locales (`/products/...`) y archivos públicos de Supabase
 * Storage. Cualquier otro host falla en `next.config.ts` y rompería la página,
 * por eso se valida antes de guardar y antes de renderizar la vista previa.
 */
export function isAllowedImageUrl(value: string) {
  const candidate = value.trim();
  if (!candidate) return true;
  if (candidate.startsWith("/")) return !candidate.startsWith("//");

  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:") return false;

    const supabaseHost = new URL(SUPABASE_URL).hostname;
    const isSupabaseHost =
      url.hostname === supabaseHost || url.hostname.endsWith(".supabase.co");

    return isSupabaseHost && url.pathname.startsWith(SUPABASE_STORAGE_PREFIX);
  } catch {
    return false;
  }
}
