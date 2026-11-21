import type { Metadata } from "next";
import { Inbox } from "lucide-react";
import { AdminSupportRequestsManager } from "@/components/admin/admin-support-requests-manager";
import { MetricCard } from "@/components/ui/metric-card";
import { PageHeader } from "@/components/ui/page-header";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { SupportContactRequest } from "@/lib/types";

export const metadata: Metadata = {
  title: "Solicitudes de ayuda",
};

export default async function AdminSupportRequestsPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("support_contact_requests")
    .select("id, request_type, full_name, email, phone, details, status, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[admin/support] No se pudieron cargar las solicitudes.", error.message);
    throw new Error("No pudimos cargar las solicitudes de ayuda.");
  }

  const requests = (data ?? []) as SupportContactRequest[];
  const pending = requests.filter((request) => request.status === "pending").length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Atención interna"
        title="Solicitudes de ayuda"
        description="Las consultas y pedidos de recuperación llegan acá; no se envían a una casilla de correo."
      />
      <MetricCard
        label="Pendientes"
        value={String(pending)}
        hint="Solicitudes por atender"
        icon={<Inbox className="size-4" />}
        tone={pending > 0 ? "amber" : "default"}
      />
      <AdminSupportRequestsManager requests={requests} />
    </div>
  );
}
