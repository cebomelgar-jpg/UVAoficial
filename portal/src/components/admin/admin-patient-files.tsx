"use client";

import { useState } from "react";
import { ArrowLeft, Download, FileText, UserRound } from "lucide-react";
import { DOCUMENT_LABELS } from "@/lib/documents";
import { formatDate, formatFileSize } from "@/lib/format";
import type { AdminPatientDocument } from "@/lib/types";

type PatientFiles = {
  id: string;
  fullName: string;
  email: string | null;
  documents: AdminPatientDocument[];
};

export function AdminPatientFiles({ patients }: { patients: PatientFiles[] }) {
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const selectedPatient = patients.find((patient) => patient.id === selectedPatientId);

  if (selectedPatient) {
    return (
      <section className="space-y-4" aria-label={`Archivos de ${selectedPatient.fullName}`}>
        <button
          type="button"
          onClick={() => setSelectedPatientId(null)}
          className="btn-outline btn-sm"
        >
          <ArrowLeft className="size-3.5" />
          Volver a pacientes
        </button>
        <div>
          <h2 className="text-lg font-semibold text-ink">{selectedPatient.fullName}</h2>
          {selectedPatient.email ? (
            <p className="mt-1 text-xs text-muted">{selectedPatient.email}</p>
          ) : null}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {selectedPatient.documents.map((document) => (
            <article key={document.id} className="card min-w-0 p-4">
              <div className="flex items-start gap-2">
                <FileText className="mt-0.5 size-4 shrink-0 text-green-text" />
                <p className="min-w-0 text-xs font-semibold text-ink">
                  {DOCUMENT_LABELS[document.document_type]}
                </p>
              </div>
              <p
                className="mt-3 truncate text-xs text-muted"
                title={document.file_name}
              >
                {document.file_name}
              </p>
              <p className="mt-1 text-[10px] text-muted">
                {formatFileSize(document.file_size)} · {formatDate(document.updated_at)}
              </p>
              {document.signed_url ? (
                <a
                  href={document.signed_url}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-outline btn-sm mt-3"
                >
                  <Download className="size-3.5" />
                  Descargar
                </a>
              ) : (
                <p className="mt-3 text-xs text-rose-700">
                  No pudimos generar el enlace. Recargá la página para
                  intentarlo nuevamente.
                </p>
              )}
            </article>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section
      className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
      aria-label="Pacientes con archivos compartidos"
    >
      {patients.map((patient) => (
        <button
          key={patient.id}
          type="button"
          onClick={() => setSelectedPatientId(patient.id)}
          className="card min-w-0 p-4 text-left transition hover:-translate-y-0.5 hover:border-green/30 hover:shadow-card"
        >
          <span className="flex items-start justify-between gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-mint/25 text-green-text">
              <UserRound className="size-5" />
            </span>
            <span className="badge shrink-0 border-ink/10 bg-white text-ink">
              {patient.documents.length}{" "}
              {patient.documents.length === 1 ? "archivo" : "archivos"}
            </span>
          </span>
          <span className="mt-4 block truncate text-sm font-semibold text-ink">
            {patient.fullName}
          </span>
          <span className="mt-1 block truncate text-xs text-muted">
            {patient.email ?? "Sin email"}
          </span>
          <span className="mt-4 block border-t border-ink/10 pt-3 text-[10px] font-semibold text-green-text">
            Ver archivos
          </span>
        </button>
      ))}
    </section>
  );
}
