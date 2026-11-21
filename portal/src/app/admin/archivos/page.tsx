import type { Metadata } from "next";
import Link from "next/link";
import { Download, FileText, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { requireAdmin } from "@/lib/auth";
import { getAdminPatientDocuments } from "@/lib/data";
import { DOCUMENT_LABELS } from "@/lib/documents";
import { formatDate, formatFileSize } from "@/lib/format";

export const metadata: Metadata = {
  title: "Archivos compartidos",
};

export default async function AdminFilesPage() {
  await requireAdmin();
  const documents = await getAdminPatientDocuments();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administración"
        title="Archivos compartidos"
        description="Documentación vigente cargada por los pacientes. Los enlaces son privados y vencen a los 5 minutos."
        actions={
          <Link href="/admin/perfiles" className="btn-outline btn-sm">
            Ver perfiles
          </Link>
        }
      />

      <div className="card flex items-start gap-3 p-4 text-xs leading-relaxed text-muted">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-green-text" />
        <p>
          Los archivos se validan en el servidor, se guardan en un bucket
          privado y se entregan como descarga. La validación no equivale a un
          análisis antivirus; verificá los archivos descargados con las
          herramientas de seguridad del dispositivo.
        </p>
      </div>

      {documents.length ? (
        <section className="grid gap-4 xl:grid-cols-2" aria-label="Archivos de pacientes">
          {documents.map((document) => (
            <article key={document.id} className="card p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-mint/25 text-green-text">
                  <FileText className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">
                    {DOCUMENT_LABELS[document.document_type]}
                  </p>
                  <p className="mt-1 truncate text-xs text-muted">
                    {document.patient.full_name}
                    {document.patient.email ? ` · ${document.patient.email}` : ""}
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-ink/10 bg-white/60 p-4">
                <p className="truncate text-xs font-medium text-ink" title={document.file_name}>
                  {document.file_name}
                </p>
                <p className="mt-1 text-[11px] text-muted">
                  {formatFileSize(document.file_size)} · Actualizado el{" "}
                  {formatDate(document.updated_at)}
                </p>
                {document.signed_url ? (
                  <a
                    href={document.signed_url}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-outline btn-sm mt-3"
                  >
                    <Download className="size-3.5" />
                    Descargar archivo
                  </a>
                ) : (
                  <p className="mt-3 text-xs text-rose-700">
                    No pudimos generar un enlace de descarga. Recargá la página
                    para intentarlo nuevamente.
                  </p>
                )}
              </div>
            </article>
          ))}
        </section>
      ) : (
        <div className="card p-10 text-center">
          <FileText className="mx-auto size-8 text-muted/60" />
          <h2 className="mt-3 text-lg text-ink">Todavía no hay archivos</h2>
          <p className="mt-1 text-sm text-muted">
            Los documentos que compartan los pacientes aparecerán en esta sección.
          </p>
        </div>
      )}
    </div>
  );
}
