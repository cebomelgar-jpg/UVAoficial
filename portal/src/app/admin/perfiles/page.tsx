import type { Metadata } from "next";
import Link from "next/link";
import { Clock3, ShieldAlert, UserCheck, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { MetricCard } from "@/components/ui/metric-card";
import { AdminProfilesManager } from "@/components/admin/admin-profiles-manager";
import { AdminProfilesRealtime } from "@/components/admin/admin-profiles-realtime";
import { requireAdmin } from "@/lib/auth";
import { getAdminProfiles, getBranches } from "@/lib/data";

export const metadata: Metadata = {
  title: "Perfiles",
};

export default async function AdminProfilesPage() {
  const profile = await requireAdmin();
  const [{ profiles, ready }, branches] = await Promise.all([
    getAdminProfiles(),
    getBranches(true),
  ]);

  const pending = profiles.filter((item) => item.status === "pending").length;
  const approved = profiles.filter((item) => item.status === "approved").length;
  const blocked = profiles.filter(
    (item) => item.status === "rejected" || item.status === "suspended",
  ).length;

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Administración"
        title="Perfiles"
        description="Habilitá cuentas nuevas, revisá los datos de contacto y administrá las contraseñas de todos los pacientes."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <AdminProfilesRealtime />
            <Link href="/admin" className="btn-outline btn-sm">
              Volver al panel
            </Link>
          </div>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Perfiles"
          value={String(profiles.length)}
          hint="Cuentas registradas"
          icon={<Users className="size-4" />}
        />
        <MetricCard
          label="Pendientes"
          value={String(pending)}
          hint="Esperan habilitación"
          icon={<Clock3 className="size-4" />}
          tone={pending > 0 ? "amber" : "default"}
        />
        <MetricCard
          label="Habilitados"
          value={String(approved)}
          hint="Con acceso al portal"
          icon={<UserCheck className="size-4" />}
          tone="mint"
        />
        <MetricCard
          label="Bloqueados"
          value={String(blocked)}
          hint="Rechazados o suspendidos"
          icon={<ShieldAlert className="size-4" />}
          tone={blocked > 0 ? "amber" : "default"}
        />
      </section>

      <AdminProfilesManager
        profiles={profiles}
        branches={branches}
        ready={ready}
        currentAdminId={profile.id}
      />
    </div>
  );
}
