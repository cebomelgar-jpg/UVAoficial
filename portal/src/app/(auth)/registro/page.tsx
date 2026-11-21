import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, UserCheck } from "lucide-react";
import { ExistingPatientRegisterForm } from "@/components/auth/existing-patient-register-form";
import { getBranches } from "@/lib/data";

export const metadata: Metadata = {
  title: "Registro de paciente existente",
};

export default async function RegisterPage() {
  const branches = await getBranches();

  return (
    <div className="card p-6 sm:p-8">
      <Link href="/login" className="btn-ghost btn-sm">
        <ArrowLeft className="size-3.5" />
        Volver a ingresar
      </Link>
      <span className="mt-6 grid size-11 place-items-center rounded-2xl bg-mint/30 text-green-text">
        <UserCheck className="size-5" />
      </span>
      <p className="eyebrow mt-5">Ya soy paciente</p>
      <h1 className="mt-2 text-3xl text-ink">Crear cuenta del portal</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Este acceso es para personas que ya tienen REPROCANN y cuentan con el acompañamiento de la asociación. Administración verificará la cuenta antes de habilitar el portal.
      </p>
      <ExistingPatientRegisterForm branches={branches} />
    </div>
  );
}
