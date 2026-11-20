import type { Metadata } from "next";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Leaf } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { BranchFilter } from "@/components/admin/branch-filter";
import { AdminCatalogManager } from "@/components/admin/admin-catalog-manager";
import { requireAdmin } from "@/lib/auth";
import { findBranch } from "@/lib/branches";
import { getAllProducts, getBranches } from "@/lib/data";

export const metadata: Metadata = {
  title: "Catálogo",
};

export default async function AdminCatalogPage({
  searchParams,
}: {
  searchParams: Promise<{
    guardado?: string;
    eliminado?: string;
    error?: string;
    editar?: string;
    sede?: string;
  }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const branches = await getBranches(true);
  const selectedBranch = findBranch(branches, params.sede);
  const products = await getAllProducts(selectedBranch?.id);
  const sedeQuery = selectedBranch ? `?sede=${selectedBranch.slug}` : "";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Catálogo"
        title="Productos y stock"
        description={
          selectedBranch
            ? `Catálogo independiente de ${selectedBranch.name}. Cada sede tiene sus propios productos, precios y stock.`
            : "Catálogo de todas las sedes. Filtrá por sede para editar el catálogo que ve cada paciente."
        }
        actions={
          <>
            <BranchFilter
              branches={branches}
              activeSlug={selectedBranch?.slug}
              basePath="/admin/catalogo"
            />
            <Link
              href={`/portal/catalogo${sedeQuery}`}
              className="btn-outline"
              target="_blank"
            >
              <Leaf className="size-4" />
              Ver catálogo
            </Link>
          </>
        }
      />

      {params.guardado === "1" ? (
        <div className="flex items-start gap-3 rounded-2xl border border-green/25 bg-mint/20 p-4 text-xs leading-relaxed text-green-text">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          <p>Producto guardado. Los cambios ya se reflejan en el catálogo.</p>
        </div>
      ) : null}

      {params.eliminado === "1" ? (
        <div className="flex items-start gap-3 rounded-2xl border border-green/25 bg-mint/20 p-4 text-xs leading-relaxed text-green-text">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          <p>Producto eliminado del catálogo.</p>
        </div>
      ) : null}

      {params.error ? (
        <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs leading-relaxed text-rose-800">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <p>{params.error}</p>
        </div>
      ) : null}

      <AdminCatalogManager
        products={products}
        branches={branches}
        initialEditId={params.editar}
        selectedBranchSlug={selectedBranch?.slug}
      />
    </div>
  );
}
