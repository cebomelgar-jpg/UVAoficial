import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DeclarationForm } from "@/components/adhesion/declaration-form";
import { requireApplicant } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { AdhesionApplication } from "@/lib/types";

export const metadata: Metadata = {
  title: "Declaración jurada de vinculación",
};

export const dynamic = "force-dynamic";

export default async function AdhesionDeclarationPage() {
  const profile = await requireApplicant();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("adhesion_applications")
    .select("full_name, dni, address")
    .eq("user_id", profile.id)
    .maybeSingle();

  if (error) {
    console.error("[adhesion] No se pudo cargar el formulario.", error.code);
    throw new Error("No pudimos cargar la declaración jurada.");
  }
  const details = data as Pick<AdhesionApplication, "full_name" | "dni" | "address"> | null;

  return (
    <main className="portal-canvas min-h-screen px-5 py-8 sm:px-8 sm:py-12">
      <div className="print-hide mx-auto mb-6 max-w-4xl">
        <Link href="/adhesion/recorrido#paso-5" className="btn-ghost btn-sm">
          <ArrowLeft className="size-3.5" />
          Volver al recorrido
        </Link>
      </div>
      <div className="print-hide mx-auto mb-5 max-w-4xl">
        <h1 className="text-2xl text-ink">Declaración jurada de vinculación</h1>
        <p className="mt-2 text-sm text-muted">
          Completá los datos que faltan, revisá el contenido y usá la opción de imprimir para firmar el documento.
        </p>
      </div>
      <DeclarationForm
        fullName={details?.full_name ?? ""}
        dni={details?.dni ?? ""}
        address={details?.address ?? ""}
      />
    </main>
  );
}
