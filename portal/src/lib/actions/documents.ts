"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireProfile } from "@/lib/auth";
import {
  DOCUMENT_MIME_EXTENSIONS,
  MAX_DOCUMENT_BYTES,
  PATIENT_DOCUMENT_TYPES,
} from "@/lib/documents";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";

const BUCKET = "patient-documents";
const documentTypeSchema = z.enum(PATIENT_DOCUMENT_TYPES);

const saveDocumentSchema = z.object({
  documentType: documentTypeSchema,
  filePath: z.string().min(1).max(500),
  fileName: z.string().min(1).max(200),
  mimeType: z
    .string()
    .refine((value) => value in DOCUMENT_MIME_EXTENSIONS, {
      message: "Formato de archivo no permitido.",
    }),
  fileSize: z.number().int().positive().max(MAX_DOCUMENT_BYTES),
});

function parseDocumentType(value: FormDataEntryValue | null) {
  const parsed = documentTypeSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function sanitizeFileName(value: string) {
  const name = value.split(/[\\/]/).pop() ?? "documento";
  const clean = name.replace(/[^a-zA-Z0-9._ -]+/g, "_").trim().slice(0, 120);
  return clean || "documento";
}

/**
 * Guarda la metadata de un archivo que el navegador ya subió directamente a
 * Supabase Storage. La ruta se valida contra el usuario autenticado para que
 * nadie pueda registrar documentos de otra carpeta.
 */
export async function saveDocumentAction(input: {
  documentType: string;
  filePath: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
}): Promise<ActionState> {
  const profile = await requireProfile();
  const parsed = saveDocumentSchema.safeParse(input);

  if (!parsed.success) {
    return {
      error:
        "El archivo no es válido. Subí un PDF, JPG, PNG o WebP de hasta 10 MB.",
    };
  }

  const { documentType, filePath, fileName, mimeType, fileSize } = parsed.data;
  const extension = DOCUMENT_MIME_EXTENSIONS[mimeType];
  const expectedPath = `${profile.id}/${documentType}.${extension}`;

  if (filePath !== expectedPath) {
    return { error: "El archivo no corresponde al documento seleccionado." };
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("patient_documents")
    .select("file_path")
    .eq("user_id", profile.id)
    .eq("document_type", documentType)
    .maybeSingle();

  const { error: dbError } = await supabase.from("patient_documents").upsert(
    {
      user_id: profile.id,
      document_type: documentType,
      file_path: filePath,
      file_name: sanitizeFileName(fileName),
      mime_type: mimeType,
      file_size: fileSize,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,document_type" },
  );

  if (dbError) {
    if (existing?.file_path !== filePath) {
      await supabase.storage.from(BUCKET).remove([filePath]);
    }
    console.error(
      "[documents] No pudimos guardar el documento:",
      dbError.message,
    );
    return { error: "No pudimos guardar el documento. Intentá nuevamente." };
  }

  if (existing?.file_path && existing.file_path !== filePath) {
    await supabase.storage.from(BUCKET).remove([existing.file_path]);
  }

  revalidatePath("/portal/documentacion");
  revalidatePath("/portal");
  return { message: "Documento subido correctamente." };
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
  const { data: existing } = await supabase
    .from("patient_documents")
    .select("file_path")
    .eq("user_id", profile.id)
    .eq("document_type", documentType)
    .maybeSingle();

  if (existing?.file_path) {
    const { error: removeError } = await supabase.storage
      .from(BUCKET)
      .remove([existing.file_path]);

    if (removeError) {
      console.error(
        "[documents] No pudimos borrar el archivo:",
        removeError.message,
      );
      return { error: "No pudimos eliminar el archivo. Intentá nuevamente." };
    }
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

  revalidatePath("/portal/documentacion");
  revalidatePath("/portal");
  return { message: "Documento eliminado." };
}
