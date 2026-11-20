import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { BranchBadge } from "@/components/ui/branch-badge";
import { requireProfile } from "@/lib/auth";
import { findBranchById } from "@/lib/branches";
import { getBranches } from "@/lib/data";
import { CheckoutForm } from "./checkout-form";

export const metadata: Metadata = {
  title: "Confirmar pedido",
};

export default async function CheckoutPage() {
  const profile = await requireProfile();
  const branches = await getBranches();
  const branch = findBranchById(branches, profile.branch_id);

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Checkout privado"
        title="Confirmá tu pedido."
        description={
          branch
            ? `Completá el contacto, elegí cómo abonar y dejanos las indicaciones que necesites. El pedido se prepara con el catálogo de ${branch.name}.`
            : "Completá el contacto, elegí cómo abonar y dejanos las indicaciones que necesites. El equipo revisa cada pedido antes de despachar."
        }
        actions={
          <>
            <BranchBadge branch={branch} />
            <Link href="/portal/carrito" className="btn-outline">
              <ArrowLeft className="size-4" />
              Volver al carrito
            </Link>
          </>
        }
      />

      <div className="flex items-center gap-2 rounded-2xl border border-green/15 bg-mint/15 px-4 py-3 text-xs text-green-text">
        <LockKeyhole className="size-4" />
        Tus datos y los detalles del pedido se comparten solo con el equipo
        administrativo.
      </div>

      <CheckoutForm profile={profile} />
    </div>
  );
}
