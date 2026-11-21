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

export function hasValidDocumentSignature(
  mimeType: string,
  bytes: Uint8Array,
) {
  switch (mimeType) {
    case "application/pdf":
      return bytes.length >= 5 && new TextDecoder().decode(bytes.subarray(0, 5)) === "%PDF-";
    case "image/jpeg":
      return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    case "image/png":
      return (
        bytes.length >= 8 &&
        bytes[0] === 0x89 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x4e &&
        bytes[3] === 0x47 &&
        bytes[4] === 0x0d &&
        bytes[5] === 0x0a &&
        bytes[6] === 0x1a &&
        bytes[7] === 0x0a
      );
    case "image/webp":
      return (
        bytes.length >= 12 &&
        new TextDecoder().decode(bytes.subarray(0, 4)) === "RIFF" &&
        new TextDecoder().decode(bytes.subarray(8, 12)) === "WEBP"
      );
    default:
      return false;
  }
}
