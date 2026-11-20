import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { BranchFilter } from "@/components/admin/branch-filter";
import { AdminRealtimeRefresh } from "@/components/admin/admin-realtime-refresh";
import { AdminOrdersTable } from "@/components/admin/admin-orders-table";
import { requireAdmin } from "@/lib/auth";
import { findBranch } from "@/lib/branches";
import { getAdminOrders, getBranches } from "@/lib/data";

export const metadata: Metadata = {
  title: "Pedidos",
};

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ pedido?: string; sede?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const branches = await getBranches(true);
  const selectedBranch = findBranch(branches, params.sede);
  const orders = await getAdminOrders(1000, selectedBranch?.id);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operación"
        title="Pedidos"
        description={
          selectedBranch
            ? `Planilla de despacho de ${selectedBranch.name}. Los pedidos nuevos de esta sede aparecen automáticamente.`
            : "Planilla de despacho de todas las sedes. Cada pedido indica el catálogo con el que fue creado."
        }
        actions={
          <>
            <BranchFilter
              branches={branches}
              activeSlug={selectedBranch?.slug}
              basePath="/admin/pedidos"
              extraParams={{ pedido: params.pedido }}
            />
            <AdminRealtimeRefresh />
          </>
        }
      />

      <AdminOrdersTable
        orders={orders}
        initialOrderId={params.pedido}
      />
    </div>
  );
}
