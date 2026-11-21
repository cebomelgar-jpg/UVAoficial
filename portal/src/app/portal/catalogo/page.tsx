import type { Metadata } from "next";
import Link from "next/link";
import { Leaf, MessageCircle, PackageSearch } from "lucide-react";
import { CatalogClient } from "@/components/catalog/catalog-client";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { BranchBadge } from "@/components/ui/branch-badge";
import { requireProfile } from "@/lib/auth";
import { findBranch, findBranchById } from "@/lib/branches";
import { getActiveProducts, getBranches } from "@/lib/data";
import type { ProductCategory } from "@/lib/types";

export const metadata: Metadata = {
  title: "Catálogo",
};

const validCategories: ProductCategory[] = ["flores", "rosin_hash", "vapes"];

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string; sede?: string }>;
}) {
  const params = await searchParams;
  const profile = await requireProfile();
  const branches = await getBranches();
  const previewBranch =
    profile.role === "admin" ? findBranch(branches, params.sede) : null;
  const branch =
    previewBranch ??
    findBranchById(branches, profile.branch_id) ??
    (profile.role === "admin" ? branches[0] ?? null : null);
  const initialCategory = validCategories.includes(
    params.categoria as ProductCategory,
  )
    ? (params.categoria as ProductCategory)
    : "todos";
  const products = await getActiveProducts(undefined, branch?.id);

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow={profile.role === "admin" ? "Vista previa del catálogo" : "Catálogo privado"}
        title="Elegí con calma."
        description={
          branch
            ? `Catálogo de ${branch.name}. Fichas con cannabinoides, proporción sativa/indica, aromas, sabores y stock. Los precios y la disponibilidad se confirman al crear el pedido.`
            : "Fichas con cannabinoides, proporción sativa/indica, aromas, sabores y stock. Los precios y la disponibilidad se confirman al crear el pedido."
        }
        actions={
          <>
            <BranchBadge branch={branch} />
            <Link href="/portal/carrito" className="btn-outline">
              <PackageSearch className="size-4" />
              Ver carrito
            </Link>
          </>
        }
      />

      {products.length === 0 ? (
        <EmptyState
          icon={<Leaf className="size-6" />}
          title="El catálogo está en preparación"
          description={
            branch
              ? `El administrador todavía no publicó productos con precio y stock para ${branch.name}. Podés consultar disponibilidad mientras tanto.`
              : "El administrador todavía no publicó productos con precio y stock. Podés consultar disponibilidad mientras tanto."
          }
          action={
            <Link
              href="/portal/ayuda"
              className="btn-mint btn-sm"
            >
              <MessageCircle className="size-3.5" />
              Consultar al administrador
            </Link>
          }
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-green/15 bg-mint/15 px-4 py-3 text-xs text-green-text">
            <Leaf className="size-4" />
            Catálogo exclusivo para pacientes registrados. El stock se descuenta
            al confirmar el pedido.
            {profile.role === "admin" && branch ? (
              <span className="font-semibold">Vista previa: {branch.name}.</span>
            ) : null}
          </div>
          <CatalogClient products={products} initialCategory={initialCategory} />
        </>
      )}
    </div>
  );
}
