import type { Metadata } from "next";
import Link from "next/link";
import { FileText, ShieldCheck } from "lucide-react";
import { AdminPatientFiles } from "@/components/admin/admin-patient-files";
import { PageHeader } from "@/components/ui/page-header";
import { requireAdmin } from "@/lib/auth";
import { getAdminPatientDocuments } from "@/lib/data";

export const metadata: Metadata = {
  title: "Archivos compartidos",
};

export default async function AdminFilesPage() {
  await requireAdmin();
  const documents = await getAdminPatientDocuments();
  const patientDocuments = new Map<string, {
    id: string;
    fullName: string;
    email: string | null;
    documents: typeof documents;
  }>();

  for (const document of documents) {
    const patient = patientDocuments.get(document.user_id);
    if (patient) {
      patient.documents.push(document);
    } else {
      patientDocuments.set(document.user_id, {
        id: document.user_id,
        fullName: document.patient.full_name,
        email: document.patient.email,
        documents: [document],
      });
    }
  }

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
        <AdminPatientFiles patients={[...patientDocuments.values()]} />
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
