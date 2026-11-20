import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Boxes,
  ClipboardList,
  Clock3,
  Leaf,
  PackageOpen,
  Users,
  Wallet,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { MetricCard } from "@/components/ui/metric-card";
import { OrderStatusBadge } from "@/components/ui/order-status-badge";
import { BranchBadge } from "@/components/ui/branch-badge";
import { BranchFilter } from "@/components/admin/branch-filter";
import { AdminRealtimeRefresh } from "@/components/admin/admin-realtime-refresh";
import { getAdminOverview, getBranches } from "@/lib/data";
import { requireAdmin } from "@/lib/auth";
import { findBranch } from "@/lib/branches";
import {
  CATEGORY_LABELS,
  formatARS,
  formatDate,
  formatOrderNumber,
} from "@/lib/format";

export const metadata: Metadata = {
  title: "Administración",
};

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ sede?: string }>;
}) {
  const profile = await requireAdmin();
  const params = await searchParams;
  const branches = await getBranches(true);
  const selectedBranch = findBranch(branches, params.sede);
  const overview = await getAdminOverview(selectedBranch?.id);
  const branchById = new Map(branches.map((branch) => [branch.id, branch]));
  const firstName = profile.full_name.split(/\s+/)[0] || "equipo";
  const sedeQuery = selectedBranch ? `?sede=${selectedBranch.slug}` : "";

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Administración"
        title={`Hola, ${firstName}.`}
        description={
          selectedBranch
            ? `Resumen operativo de ${selectedBranch.name}: pedidos, stock y actividad de los últimos 30 días.`
            : "Resumen operativo del portal: pedidos, stock y actividad de todas las sedes en los últimos 30 días."
        }
        actions={
          <>
            <BranchFilter
              branches={branches}
              activeSlug={selectedBranch?.slug}
              basePath="/admin"
            />
            <AdminRealtimeRefresh />
            <Link href={`/admin/pedidos${sedeQuery}`} className="btn-primary">
              <ClipboardList className="size-4" />
              Gestionar pedidos
            </Link>
          </>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <MetricCard
          label="Ingresos 30 días"
          value={formatARS(overview.monthRevenue)}
          hint="Pedidos no cancelados"
          icon={<Wallet className="size-4" />}
          tone="dark"
        />
        <MetricCard
          label="Pedidos 30 días"
          value={String(overview.monthOrders)}
          hint="Excluye cancelados"
          icon={<ClipboardList className="size-4" />}
        />
        <MetricCard
          label="Pendientes"
          value={String(overview.pendingOrders)}
          hint="Requieren revisión"
          icon={<PackageOpen className="size-4" />}
          tone="amber"
        />
        <MetricCard
          label="Pacientes"
          value={String(overview.patients)}
          hint="Cuentas registradas"
          icon={<Users className="size-4" />}
          tone="mint"
        />
        <MetricCard
          label="Pendientes de acceso"
          value={overview.profilesReady ? String(overview.pendingProfiles) : "—"}
          hint={
            overview.profilesReady
              ? "Cuentas por habilitar"
              : "Aplicá la migración de perfiles"
          }
          icon={<Clock3 className="size-4" />}
          tone={overview.pendingProfiles > 0 ? "amber" : "default"}
        />
        <MetricCard
          label="Productos activos"
          value={String(overview.activeProducts)}
          hint="Visibles en el catálogo"
          icon={<Leaf className="size-4" />}
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_.75fr]">
        <section className="card p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="eyebrow">Actividad reciente</p>
              <h2 className="mt-1 text-2xl text-ink">Últimos pedidos</h2>
            </div>
            <Link href={`/admin/pedidos${sedeQuery}`} className="link-underline text-xs">
              Ver todos
            </Link>
          </div>

          {overview.recentOrders.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-ink/15 p-8 text-center text-sm text-muted">
              Todavía no hay pedidos. Cuando un paciente confirme uno, aparece
              acá en tiempo real.
            </div>
          ) : (
            <div className="mt-5 divide-y divide-ink/10">
              {overview.recentOrders.map((order) => (
                <Link
                  key={order.id}
                  href={`/admin/pedidos?pedido=${order.id}${
                    selectedBranch ? `&sede=${selectedBranch.slug}` : ""
                  }`}
                  className="flex items-center justify-between gap-3 py-3.5 transition hover:bg-mint/5"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-ink">
                        {formatOrderNumber(order.order_number)}
                      </p>
                      <OrderStatusBadge status={order.status} />
                      <BranchBadge branch={order.branch} />
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted">
                      {order.patient_name} · {formatDate(order.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-ink">
                      {formatARS(order.total)}
                    </span>
                    <ArrowRight className="size-4 text-muted" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="card p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="eyebrow">Registros</p>
              <h2 className="mt-1 text-2xl text-ink">Registros recientes</h2>
            </div>
            <Link href="/admin/perfiles" className="link-underline text-xs">
              Ver todos
            </Link>
          </div>

          {!overview.profilesReady ? (
            <p className="mt-5 rounded-2xl border border-dashed border-amber-200 bg-amber-50/70 p-5 text-center text-xs text-amber-800">
              Aplicá la migración de perfiles para ver quiénes se van registrando.
            </p>
          ) : overview.recentProfiles.length === 0 ? (
            <p className="mt-5 rounded-2xl border border-dashed border-ink/15 p-6 text-center text-xs text-muted">
              Todavía no hay registros de pacientes.
            </p>
          ) : (
            <div className="mt-5 divide-y divide-ink/10">
              {overview.recentProfiles.map((profile) => (
                <Link
                  key={profile.id}
                  href="/admin/perfiles"
                  className="flex items-center justify-between gap-3 py-3 transition hover:bg-mint/5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">
                      {profile.full_name}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {profile.email ?? "Sin email"} · {formatDate(profile.created_at)}
                    </p>
                  </div>
                  <span
                    className={
                      profile.status === "pending"
                        ? "badge border-amber-300/70 bg-amber-50 text-amber-800"
                        : profile.status === "approved"
                          ? "badge border-emerald-300/70 bg-emerald-50 text-emerald-800"
                          : "badge border-slate-300/70 bg-slate-50 text-slate-700"
                    }
                  >
                    {profile.status === "pending"
                      ? "Pendiente"
                      : profile.status === "approved"
                        ? "Habilitado"
                        : profile.status === "rejected"
                          ? "Rechazado"
                          : "Suspendido"}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="card p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="eyebrow">Atención</p>
              <h2 className="mt-1 text-2xl text-ink">Stock bajo</h2>
            </div>
            <Link href={`/admin/catalogo${sedeQuery}`} className="link-underline text-xs">
              Catálogo
            </Link>
          </div>

          {overview.lowStock.length === 0 ? (
            <p className="mt-5 rounded-2xl border border-dashed border-ink/15 p-6 text-center text-xs text-muted">
              No hay productos activos para revisar.
            </p>
          ) : (
            <div className="mt-5 space-y-2">
              {overview.lowStock.map((product) => (
                <Link
                  key={product.id}
                  href={`/admin/catalogo?editar=${product.id}${
                    selectedBranch ? `&sede=${selectedBranch.slug}` : ""
                  }`}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-ink/10 bg-white/50 p-3 transition hover:border-green/20 hover:bg-white"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-ink">
                      {product.name}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-[10px] uppercase tracking-[0.12em] text-muted">
                        {CATEGORY_LABELS[product.category]}
                      </p>
                      <BranchBadge
                        branch={branchById.get(product.branch_id) ?? null}
                      />
                    </div>
                  </div>
                  <span
                    className={
                      product.stock <= 0
                        ? "badge border-rose-200 bg-rose-50 text-rose-700"
                        : "badge border-amber-200 bg-amber-50 text-amber-800"
                    }
                  >
                    {product.stock <= 0 ? "Sin stock" : `${product.stock} u.`}
                  </span>
                </Link>
              ))}
            </div>
          )}

          <div className="mt-5 rounded-2xl border border-ink/10 bg-white/50 p-3 text-[11px] leading-relaxed text-muted">
            Los productos activos con stock 0 siguen visibles pero no se pueden
            agregar al carrito. Actualizá el stock desde el catálogo.
          </div>
        </section>
      </div>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <QuickAction
          href={`/admin/pedidos${sedeQuery}`}
          icon={<ClipboardList className="size-5" />}
          title="Pedidos"
          description="Planilla tipo Excel con edición de estado, pago y notas."
        />
        <QuickAction
          href={`/admin/catalogo${sedeQuery}`}
          icon={<Boxes className="size-5" />}
          title="Catálogo"
          description="Crear y editar productos, precios, stock e imágenes."
        />
        <QuickAction
          href="/admin/perfiles"
          icon={<Users className="size-5" />}
          title="Perfiles"
          description="Habilitar cuentas, revisar datos y administrar contraseñas."
        />
        <QuickAction
          href={`/admin/analiticas${sedeQuery}`}
          icon={<BarChart3 className="size-5" />}
          title="Analíticas"
          description="Semana, mes o año: ingresos, categorías y productos."
        />
      </section>
    </div>
  );
}

function QuickAction({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group card flex items-start gap-4 p-5 transition hover:-translate-y-0.5 hover:shadow-soft"
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-ink/5 text-ink transition group-hover:bg-ink group-hover:text-mint">
        {icon}
      </span>
      <span>
        <span className="flex items-center gap-2 text-sm font-semibold text-ink">
          {title}
          <ArrowRight className="size-3.5 text-muted transition group-hover:translate-x-0.5" />
        </span>
        <span className="mt-1 block text-xs leading-relaxed text-muted">
          {description}
        </span>
      </span>
    </Link>
  );
}
