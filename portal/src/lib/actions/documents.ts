"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireProfile } from "@/lib/auth";
import {
  DOCUMENT_MIME_EXTENSIONS,
  hasValidDocumentSignature,
  MAX_DOCUMENT_BYTES,
  PATIENT_DOCUMENT_TYPES,
} from "@/lib/documents";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionState } from "@/lib/types";

const BUCKET = "patient-documents";
const documentTypeSchema = z.enum(PATIENT_DOCUMENT_TYPES);

function parseDocumentType(value: FormDataEntryValue | null) {
  const parsed = documentTypeSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function sanitizeFileName(value: string) {
  const name = value.split(/[\\/]/).pop() ?? "documento";
  const clean = name.replace(/[^a-zA-Z0-9._ -]+/g, "_").trim().slice(0, 120);
  return clean || "documento";
}

export async function uploadDocumentAction(formData: FormData): Promise<ActionState> {
  const profile = await requireProfile();
  const documentType = parseDocumentType(formData.get("documentType"));
  const file = formData.get("file");
  if (!documentType || !(file instanceof File)) {
    return { error: "Seleccioná un tipo de documento y un archivo válido." };
  }
  if (file.size < 1 || file.size > MAX_DOCUMENT_BYTES) {
    return {
      error: "El archivo debe tener contenido y no superar los 10 MB.",
    };
  }

  const mimeType = file.type;
  const extension = DOCUMENT_MIME_EXTENSIONS[mimeType];
  const filenameExtension = file.name.split(".").pop()?.toLowerCase();
  if (
    !extension ||
    (filenameExtension !== extension &&
      !(mimeType === "image/jpeg" && filenameExtension === "jpeg"))
  ) {
    return { error: "Formato no permitido. Subí un PDF, JPG, PNG o WebP válido." };
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!hasValidDocumentSignature(mimeType, bytes)) {
    return {
      error: "El contenido no coincide con el formato declarado. No se guardó.",
    };
  }

  const supabase = await createClient();
  const { data: existing, error: existingError } = await supabase
    .from("patient_documents")
    .select("file_path")
    .eq("user_id", profile.id)
    .eq("document_type", documentType)
    .maybeSingle();

  if (existingError) {
    console.error("[documents] No pudimos verificar el documento existente:", existingError.message);
    return { error: "No pudimos verificar el documento actual. Intentá nuevamente." };
  }

  const filePath = `${profile.id}/${documentType}/${crypto.randomUUID()}.${extension}`;
  const storage = createAdminClient().storage.from(BUCKET);
  const { error: uploadError } = await storage.upload(filePath, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: mimeType,
  });

  if (uploadError) {
    console.error("[documents] No pudimos guardar el archivo verificado:", uploadError.message);
    return { error: "No pudimos guardar el archivo. Intentá nuevamente." };
  }

  const { error: dbError } = await supabase.from("patient_documents").upsert(
    {
      user_id: profile.id,
      document_type: documentType,
      file_path: filePath,
      file_name: sanitizeFileName(file.name),
      mime_type: mimeType,
      file_size: file.size,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,document_type" },
  );

  if (dbError) {
    const { error: cleanupError } = await storage.remove([filePath]);
    if (cleanupError) {
      console.error("[documents] No pudimos limpiar el archivo rechazado:", cleanupError.message);
    }
    console.error(
      "[documents] No pudimos guardar el documento:",
      dbError.message,
    );
    return { error: "No pudimos guardar el documento. Intentá nuevamente." };
  }

  let cleanupWarning = "";
  if (existing?.file_path) {
    const { error: removeError } = await storage.remove([existing.file_path]);
    if (removeError) {
      console.error("[documents] No pudimos eliminar la versión anterior:", removeError.message);
      cleanupWarning =
        " La versión anterior no pudo eliminarse automáticamente; contactá al administrador para que la revise.";
    }
  }

  revalidatePath("/portal/documentacion");
  revalidatePath("/portal");
  revalidatePath("/admin/archivos");
  return { message: `Documento subido correctamente.${cleanupWarning}` };
}

export async function deleteDocumentAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const profile = await requireProfile();
  const documentType = parseDocumentType(formData.get("documentType"));

  if (!documentType) {
    return { error: "Tipo de documento inválido." };
  }

  const supabase = await createClient();
  const { data: existing, error: existingError } = await supabase
    .from("patient_documents")
    .select("file_path")
    .eq("user_id", profile.id)
    .eq("document_type", documentType)
    .maybeSingle();

  if (existingError) {
    console.error("[documents] No pudimos verificar el archivo:", existingError.message);
    return { error: "No pudimos verificar el documento actual. Intentá nuevamente." };
  }

  const { error } = await supabase
    .from("patient_documents")
    .delete()
    .eq("user_id", profile.id)
    .eq("document_type", documentType);

  if (error) {
    console.error(
      "[documents] No pudimos borrar el documento:",
      error.message,
    );
    return { error: "No pudimos eliminar el documento. Intentá nuevamente." };
  }

  if (existing?.file_path) {
    const { error: removeError } = await createAdminClient()
      .storage.from(BUCKET)
      .remove([existing.file_path]);
    if (removeError) {
      console.error("[documents] No pudimos eliminar el archivo privado:", removeError.message);
      revalidatePath("/portal/documentacion");
      revalidatePath("/admin/archivos");
      return {
        error:
          "El documento se quitó de tu perfil, pero el archivo no pudo eliminarse físicamente. El administrador debe revisar el almacenamiento.",
      };
    }
  }

  revalidatePath("/portal/documentacion");
  revalidatePath("/portal");
  revalidatePath("/admin/archivos");
  return { message: "Documento eliminado." };
}
