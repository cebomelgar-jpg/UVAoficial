import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PatientSupportChat } from "@/components/support/encrypted-support-chat";
import { requireApplicant } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Ayuda y chat de adhesión",
};

export default async function ApplicantSupportPage() {
  const applicant = await requireApplicant();

  return (
    <main className="portal-canvas min-h-screen px-5 py-8 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-5xl space-y-6">
        <Link href="/adhesion/recorrido#paso-4" className="btn-ghost btn-sm">
          <ArrowLeft className="size-3.5" />
          Volver al recorrido
        </Link>
        <div>
          <p className="eyebrow">Atención</p>
          <h1 className="mt-1 text-3xl text-ink">Ayuda y chat</h1>
          <p className="mt-2 text-sm text-muted">
            Usá esta conversación privada para coordinar la entrevista médica y consultar al equipo sobre tu adhesión.
          </p>
        </div>
        <PatientSupportChat userId={applicant.id} />
      </div>
    </main>
  );
}
