import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, UserRoundPlus } from "lucide-react";
import { AdhesionRegisterForm } from "@/components/adhesion/register-form";

export const metadata: Metadata = {
  title: "Solicitar adhesión",
};

export default function AdhesionRegistrationPage() {
  return (
    <main className="portal-canvas relative flex min-h-screen items-center justify-center px-5 py-10 sm:px-8">
      <div className="pointer-events-none absolute inset-0 grain" />
      <div className="relative w-full max-w-md">
        <div className="mb-8 flex items-center justify-between">
          <Link href="/" className="font-display text-xl text-ink">
            Un Viaje Astral
          </Link>
          <Link href="/legal" className="text-xs text-muted transition hover:text-ink">
            Privacidad
          </Link>
        </div>
        <div className="card p-6 sm:p-8">
          <Link href="/#adhesion" className="btn-ghost btn-sm">
            <ArrowLeft className="size-3.5" />
            Volver a la bienvenida
          </Link>
          <span className="mt-6 grid size-11 place-items-center rounded-2xl bg-mint/30 text-green-text">
            <UserRoundPlus className="size-5" />
          </span>
          <p className="eyebrow mt-5">Nuevos socios</p>
          <h1 className="mt-2 text-3xl text-ink">Solicitá tu adhesión</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Registrate con tu email para iniciar el recorrido de adhesión. Esta
            cuenta no da acceso al portal de pacientes; ese acceso solo se
            habilita después de completar los pasos y de la revisión del
            administrador.
          </p>
          <div className="mt-6">
            <AdhesionRegisterForm />
          </div>
        </div>
        <p className="mt-8 text-center text-[10px] leading-relaxed text-muted/80">
          Espacio exclusivo para mayores de 18 años. Tus datos personales y
          clínicos solo se comparten con el equipo autorizado.
        </p>
      </div>
    </main>
  );
}
