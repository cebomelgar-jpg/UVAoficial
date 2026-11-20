import type { Metadata } from "next";
import { UserPlus } from "lucide-react";
import { RegisterForm } from "@/components/auth/register-form";
import { findBranch } from "@/lib/branches";
import { getBranches } from "@/lib/data";

export const metadata: Metadata = {
  title: "Crear cuenta",
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ sede?: string }>;
}) {
  const params = await searchParams;
  const branches = await getBranches();
  const selectedBranch = findBranch(branches, params.sede);
  const defaultBranchId = selectedBranch?.id ?? branches[0]?.id ?? "";

  return (
    <div className="card p-6 sm:p-8">
      <span className="grid size-11 place-items-center rounded-2xl bg-mint/30 text-green-text">
        <UserPlus className="size-5" />
      </span>
      <p className="eyebrow mt-5">Alta de paciente</p>
      <h1 className="mt-2 text-3xl text-ink">Creá tu cuenta</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Necesitamos tus datos de contacto y tu sede para coordinar pedidos y
        entregas. Después de confirmar tu email, un administrador debe aprobar
        tu cuenta para habilitar el acceso al portal.
      </p>

      <div className="mt-6">
        <RegisterForm branches={branches} defaultBranchId={defaultBranchId} />
      </div>
    </div>
  );
}
