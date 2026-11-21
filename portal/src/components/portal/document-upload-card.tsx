"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  FileText,
  Loader2,
  Trash2,
  UploadCloud,
} from "lucide-react";
import {
  deleteDocumentAction,
  uploadDocumentAction,
} from "@/lib/actions/documents";
import {
  DOCUMENT_ACCEPT,
  DOCUMENT_MIME_EXTENSIONS,
  hasValidDocumentSignature,
  MAX_DOCUMENT_BYTES,
  type PatientDocumentType,
} from "@/lib/documents";
import { formatDate, formatFileSize } from "@/lib/format";
import type { ActionState, PatientDocumentWithUrl } from "@/lib/types";
import { cn } from "@/lib/utils";

export function DocumentUploadCard({
  type,
  title,
  description,
  document: currentDocument,
  ready,
}: {
  type: PatientDocumentType;
  title: string;
  description: string;
  document: PatientDocumentWithUrl | null;
  ready: boolean;
}) {
  const router = useRouter();
  const [deleteState, deleteAction, deleting] = useActionState<
    ActionState,
    FormData
  >(deleteDocumentAction, {});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!deleteState.message && !deleteState.error) return;
    setUploadMessage(null);
    setUploadError(null);
  }, [deleteState.message, deleteState.error]);

  const uploaded = Boolean(currentDocument);
  const error = uploadError ?? deleteState.error;
  const message = uploadMessage ?? deleteState.message;

  async function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUploadError(null);
    setUploadMessage(null);

    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setUploadError("Seleccioná un archivo para subir.");
      return;
    }

    const extension = DOCUMENT_MIME_EXTENSIONS[file.type];
    if (!extension) {
      setUploadError("Formato no permitido. Subí un PDF, JPG, PNG o WebP.");
      return;
    }

    if (file.size > MAX_DOCUMENT_BYTES) {
      setUploadError("El archivo no puede superar los 10 MB.");
      return;
    }
    const fileExtension = file.name.split(".").pop()?.toLowerCase();
    if (
      fileExtension !== extension &&
      !(file.type === "image/jpeg" && fileExtension === "jpeg")
    ) {
      setUploadError("La extensión del archivo no coincide con su formato.");
      return;
    }

    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (!hasValidDocumentSignature(file.type, bytes)) {
        setUploadError("El contenido no coincide con el formato declarado. No se subió.");
        return;
      }

      setUploading(true);
      const formData = new FormData();
      formData.set("documentType", type);
      formData.set("file", file);
      const result = await uploadDocumentAction(formData);

      if (result.error) {
        setUploadError(result.error);
        return;
      }

      setUploadMessage(result.message ?? "Documento subido correctamente.");
      setSelectedName(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      router.refresh();
    } catch {
      setUploadError(
        "No pudimos subir el archivo. Revisá tu conexión e intentá nuevamente.",
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <article className="card flex flex-col p-5 sm:p-6">
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-mint/25 text-green-text">
            <FileText className="size-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg leading-tight text-ink">{title}</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              {description}
            </p>
          </div>
        </div>
        <span
          className={cn(
            "badge shrink-0",
            uploaded
              ? "border-green/25 bg-mint/20 text-green-text"
              : "border-amber-300/70 bg-amber-50 text-amber-800",
          )}
        >
          {uploaded ? (
            <CheckCircle2 className="size-3" />
          ) : (
            <AlertCircle className="size-3" />
          )}
          {uploaded ? "Cargado" : "Pendiente"}
        </span>
      </header>

      {currentDocument ? (
        <div className="mt-5 rounded-2xl border border-ink/10 bg-white/60 p-4">
          <div className="flex items-center gap-2">
            <FileText className="size-4 shrink-0 text-green-text" />
            <p className="min-w-0 truncate text-xs font-semibold text-ink">
              {currentDocument.file_name}
            </p>
          </div>
          <p className="mt-1 text-[11px] text-muted">
            {formatFileSize(currentDocument.file_size)} · Actualizado el{" "}
            {formatDate(currentDocument.updated_at)}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {currentDocument.signed_url ? (
              <a
                href={currentDocument.signed_url}
                target="_blank"
                rel="noreferrer"
                className="btn-outline btn-sm"
              >
                <ExternalLink className="size-3.5" />
                Ver archivo
              </a>
            ) : null}
            <form
              action={deleteAction}
              onSubmit={(event) => {
                if (
                  !window.confirm(
                    "¿Eliminar este documento? Después vas a poder subir uno nuevo.",
                  )
                ) {
                  event.preventDefault();
                }
              }}
            >
              <input type="hidden" name="documentType" value={type} />
              <button
                type="submit"
                className="btn-ghost btn-sm text-rose-700"
                disabled={deleting}
              >
                {deleting ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Trash2 className="size-3.5" />
                )}
                Eliminar
              </button>
            </form>
          </div>
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-dashed border-ink/15 bg-white/40 p-4 text-center">
          <p className="text-xs text-muted">
            Todavía no subiste este documento.
          </p>
        </div>
      )}

      <form onSubmit={handleUpload} className="mt-4 space-y-3">
        <input type="hidden" name="documentType" value={type} />
        <label
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed px-4 py-6 text-center transition",
            ready && !uploading
              ? "border-ink/20 bg-white/50 hover:border-green/50 hover:bg-mint/10"
              : "cursor-not-allowed border-ink/10 bg-ink/5 opacity-70",
          )}
        >
          <UploadCloud className="size-6 text-green-text" />
          <span className="text-xs font-semibold text-ink">
            {uploaded ? "Subir un archivo nuevo" : "Subir archivo"}
          </span>
          <span className="text-[10px] text-muted">
            PDF, JPG, PNG o WebP · hasta 10 MB
          </span>
          <input
            ref={fileInputRef}
            type="file"
            name="file"
            accept={DOCUMENT_ACCEPT}
            className="sr-only"
            disabled={!ready || uploading}
            onChange={(event) => {
              setSelectedName(event.target.files?.[0]?.name ?? null);
              setUploadError(null);
              setUploadMessage(null);
            }}
          />
        </label>

        {selectedName ? (
          <p className="truncate text-[11px] text-muted">
            Archivo seleccionado:{" "}
            <span className="font-semibold text-ink">{selectedName}</span>
          </p>
        ) : null}

        <button
          type="submit"
          className="btn-primary btn-sm w-full"
          disabled={!ready || uploading}
        >
          {uploading ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              Subiendo…
            </>
          ) : (
            <>
              <UploadCloud className="size-3.5" />
              {uploaded ? "Reemplazar documento" : "Guardar documento"}
            </>
          )}
        </button>
      </form>

      {error ? (
        <div
          role="alert"
          className="mt-3 flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-[11px] leading-relaxed text-rose-800"
        >
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
          <p>{error}</p>
        </div>
      ) : null}

      {message ? (
        <div className="mt-3 flex gap-2 rounded-xl border border-green/25 bg-mint/15 p-3 text-[11px] leading-relaxed text-green-text">
          <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
          <p>{message}</p>
        </div>
      ) : null}

      {!ready ? (
        <p className="mt-3 text-[11px] leading-relaxed text-muted">
          La carga de documentación todavía no está habilitada en este entorno.
        </p>
      ) : null}
    </article>
  );
}
