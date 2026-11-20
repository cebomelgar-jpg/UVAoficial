import type { Metadata } from "next";
import {
  Clock3,
  FileCheck2,
  LockKeyhole,
  MessageCircle,
  ShieldCheck,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { DocumentUploadCard } from "@/components/portal/document-upload-card";
import { requireProfile } from "@/lib/auth";
import { getPatientDocuments } from "@/lib/data";
import {
  DOCUMENT_DESCRIPTIONS,
  DOCUMENT_LABELS,
  PATIENT_DOCUMENT_TYPES,
} from "@/lib/documents";
import { whatsappUrl } from "@/lib/config";

export const metadata: Metadata = {
  title: "Documentación",
};

export default async function DocumentsPage() {
  const profile = await requireProfile();
  const { documents, ready } = await getPatientDocuments(profile.id);

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Documentación privada"
        title="Mi documentación"
        description="Subí tu certificado de trámite habilitado y tu credencial REPROCANN. Los archivos son privados: solo vos y el equipo administrativo pueden verlos."
      />

      {!ready ? (
        <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-relaxed text-amber-900">
          <Clock3 className="mt-0.5 size-4 shrink-0" />
          <p>
            La carga de documentación todavía no está habilitada. Escribinos por
            WhatsApp y lo resolvemos con el equipo.
          </p>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        {PATIENT_DOCUMENT_TYPES.map((type) => (
          <DocumentUploadCard
            key={type}
            type={type}
            title={DOCUMENT_LABELS[type]}
            description={DOCUMENT_DESCRIPTIONS[type]}
            document={
              documents.find((document) => document.document_type === type) ??
              null
            }
            userId={profile.id}
            ready={ready}
          />
        ))}
      </div>

      <section className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
        <div className="card p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-green-text" />
            <h2 className="text-lg text-ink">Cómo cuidamos tus archivos</h2>
          </div>
          <ul className="mt-4 space-y-3 text-xs leading-relaxed text-muted">
            <li className="flex gap-2.5">
              <LockKeyhole className="mt-0.5 size-3.5 shrink-0 text-green-text" />
              <span>
                El bucket de documentación es privado. Los archivos se abren con
                enlaces temporales y no quedan indexados ni públicos.
              </span>
            </li>
            <li className="flex gap-2.5">
              <FileCheck2 className="mt-0.5 size-3.5 shrink-0 text-green-text" />
              <span>
                Podés reemplazar un documento cuando se venza o cambie. El
                archivo anterior se elimina automáticamente.
              </span>
            </li>
            <li className="flex gap-2.5">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-green-text" />
              <span>
                Solo el paciente titular y el equipo administrativo pueden
                consultar la documentación.
              </span>
            </li>
          </ul>
        </div>

        <div className="rounded-3xl border border-ink/10 bg-white/50 p-5 text-xs leading-relaxed text-muted">
          <p className="font-semibold text-ink">¿Necesitás ayuda?</p>
          <p className="mt-1">
            Si tu certificado o credencial está en trámite, escribinos y
            coordinamos la forma de acreditarlo.
          </p>
          <a
            href={whatsappUrl(
              "Hola, necesito ayuda con la documentación de mi cuenta del portal.",
            )}
            target="_blank"
            rel="noreferrer"
            className="btn-outline btn-sm mt-4"
          >
            <MessageCircle className="size-3.5" />
            Contactar al equipo
          </a>
        </div>
      </section>
    </div>
  );
}
