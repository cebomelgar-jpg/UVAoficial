import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { AdminAdhesionsManager } from "@/components/admin/admin-adhesions-manager";
import { PageHeader } from "@/components/ui/page-header";
import { requireAdmin } from "@/lib/auth";
import { getAdminAdhesionApplications, getBranches } from "@/lib/data";

export const metadata: Metadata = {
  title: "Solicitudes de adhesión",
};

export const dynamic = "force-dynamic";

export default async function AdminAdhesionsPage() {
  await requireAdmin();
  const [applications, branches] = await Promise.all([
    getAdminAdhesionApplications(),
    getBranches(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administración"
        title="Solicitudes de adhesión"
        description="Revisá los datos y el avance del recorrido. Solo al completar los seis pasos se puede habilitar el portal de paciente."
        actions={
          <Link href="/admin" className="btn-outline btn-sm">
            <ClipboardCheck className="size-3.5" />
            Volver al panel
          </Link>
        }
      />
      <AdminAdhesionsManager applications={applications} branches={branches} />
    </div>
  );
}
