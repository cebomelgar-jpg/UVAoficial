export const PATIENT_DOCUMENT_TYPES = ["tramite", "reprocann"] as const;

export type PatientDocumentType = (typeof PATIENT_DOCUMENT_TYPES)[number];

export const DOCUMENT_LABELS: Record<PatientDocumentType, string> = {
  tramite: "Certificado de trámite habilitado",
  reprocann: "Credencial REPROCANN",
};

export const DOCUMENT_DESCRIPTIONS: Record<PatientDocumentType, string> = {
  tramite:
    "Subí el certificado de trámite habilitado vigente, emitido por el registro correspondiente.",
  reprocann:
    "Subí tu credencial REPROCANN vigente, con el número de registro y la fecha de vencimiento visibles.",
};

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

export const DOCUMENT_MIME_EXTENSIONS: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const DOCUMENT_ACCEPT = Object.keys(DOCUMENT_MIME_EXTENSIONS).join(",");
