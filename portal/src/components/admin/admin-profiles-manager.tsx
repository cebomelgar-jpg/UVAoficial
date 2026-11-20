"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Search,
  ShieldAlert,
  UserCheck,
  UserX,
} from "lucide-react";
import { BranchBadge } from "@/components/ui/branch-badge";
import { ProfileStatusBadge } from "@/components/ui/profile-status-badge";
import { useToast } from "@/components/providers/toast-provider";
import { updateProfileStatusAction } from "@/lib/actions/profiles";
import { formatDate } from "@/lib/format";
import type { AdminProfile, Branch, ProfileStatus } from "@/lib/types";
import { cn, initials, normalizeSearch } from "@/lib/utils";

type StatusFilter = "todos" | ProfileStatus;
type RoleFilter = "todos" | "patient" | "admin";

const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: "todos", label: "Todos" },
  { value: "pending", label: "Pendientes" },
  { value: "approved", label: "Habilitados" },
  { value: "rejected", label: "Rechazados" },
  { value: "suspended", label: "Suspendidos" },
];

export function AdminProfilesManager({
  profiles,
  branches,
  ready,
  currentAdminId,
}: {
  profiles: AdminProfile[];
  branches: Branch[];
  ready: boolean;
  currentAdminId: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("todos");
  const [role, setRole] = useState<RoleFilter>("todos");
  const [branchId, setBranchId] = useState<string>("todas");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const counts = useMemo(
    () => ({
      total: profiles.length,
      pending: profiles.filter((profile) => profile.status === "pending").length,
      approved: profiles.filter((profile) => profile.status === "approved").length,
      rejected: profiles.filter((profile) => profile.status === "rejected").length,
      suspended: profiles.filter((profile) => profile.status === "suspended").length,
    }),
    [profiles],
  );

  const filtered = useMemo(() => {
    const term = normalizeSearch(search);
    return profiles.filter((profile) => {
      if (status !== "todos" && profile.status !== status) return false;
      if (role !== "todos" && profile.role !== role) return false;
      if (branchId !== "todas" && profile.branch_id !== branchId) return false;
      if (!term) return true;
      return normalizeSearch(
        [
          profile.full_name,
          profile.email ?? "",
          profile.phone ?? "",
          profile.branch?.name ?? "",
          profile.role,
          profile.status,
        ].join(" "),
      ).includes(term);
    });
  }, [profiles, status, role, branchId, search]);

  async function changeStatus(profile: AdminProfile, next: "approved" | "rejected" | "suspended") {
    if (profile.id === currentAdminId && next !== "approved") {
      toast({
        title: "No podés cambiar tu propia cuenta",
        description: "Usá otra cuenta de administrador para suspender o rechazar.",
        variant: "info",
      });
      return;
    }
    if (next !== "approved") {
      const label = next === "rejected" ? "rechazar" : "suspender";
      if (
        !window.confirm(
          `¿Seguro que querés ${label} la cuenta de ${profile.full_name}?`,
        )
      )
        return;
    }
    setUpdatingId(profile.id);
    const result = await updateProfileStatusAction(profile.id, next);
    setUpdatingId(null);
    if (result.error) {
      toast({ title: "No se pudo actualizar", description: result.error, variant: "error" });
      return;
    }
    toast({
      title:
        next === "approved"
          ? "Cuenta habilitada"
          : next === "rejected"
            ? "Cuenta rechazada"
            : "Cuenta suspendida",
      description: profile.full_name,
    });
    router.refresh();
  }

  if (!ready) {
    return (
      <div className="card p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 size-5 text-amber-600" />
          <div>
            <p className="text-sm font-semibold text-ink">
              La migración de perfiles todavía no está aplicada
            </p>
            <p className="mt-1 text-sm text-muted">
              Aplicá en orden las migraciones{" "}
              <code className="rounded bg-ink/5 px-1.5 py-0.5 text-xs">
                202610260001_multi_branch.sql
              </code>
              ,{" "}
              <code className="rounded bg-ink/5 px-1.5 py-0.5 text-xs">
                202610270001_patient_documents.sql
              </code>
              ,{" "}
              <code className="rounded bg-ink/5 px-1.5 py-0.5 text-xs">
                202610280001_profile_approval.sql
              </code>
              {" "}y{" "}
              <code className="rounded bg-ink/5 px-1.5 py-0.5 text-xs">
                202611200001_profile_approval_hardening.sql
              </code>{" "}
              en Supabase para habilitar las sedes y la aprobación de cuentas.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nombre, email, teléfono o sede…"
            className="input pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={role}
            onChange={(event) => setRole(event.target.value as RoleFilter)}
            className="select h-9 py-2 text-xs"
          >
            <option value="todos">Todos los roles</option>
            <option value="patient">Pacientes</option>
            <option value="admin">Administradores</option>
          </select>
          <select
            value={branchId}
            onChange={(event) => setBranchId(event.target.value)}
            className="select h-9 py-2 text-xs"
          >
            <option value="todas">Todas las sedes</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((filter) => {
          const count =
            filter.value === "todos"
              ? counts.total
              : filter.value === "pending"
                ? counts.pending
                : filter.value === "approved"
                  ? counts.approved
                  : filter.value === "rejected"
                    ? counts.rejected
                    : counts.suspended;
          return (
            <button
              key={filter.value}
              type="button"
              onClick={() => setStatus(filter.value)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                status === filter.value
                  ? "border-ink bg-ink text-paper"
                  : "border-ink/10 bg-white text-ink hover:border-ink/30",
              )}
            >
              {filter.label} · {count}
            </button>
          );
        })}
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Perfil</th>
              <th>Sede</th>
              <th>Rol</th>
              <th>Estado</th>
              <th>Registro</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-10 text-center text-sm text-muted">
                  No encontramos perfiles con los filtros seleccionados.
                </td>
              </tr>
            ) : (
              filtered.map((profile) => {
                const isSelf = profile.id === currentAdminId;
                const isUpdating = updatingId === profile.id;
                return (
                  <tr key={profile.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-mint/30 text-xs font-semibold text-green-text">
                          {initials(profile.full_name)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-ink">
                            {profile.full_name}
                            {isSelf ? (
                              <span className="ml-2 rounded-full bg-ink/5 px-1.5 py-0.5 text-[10px] text-muted">
                                Vos
                              </span>
                            ) : null}
                          </p>
                          <p className="truncate text-[10px] text-muted">
                            {profile.email ?? "Sin email"}
                          </p>
                          {profile.phone ? (
                            <p className="text-[10px] text-muted">{profile.phone}</p>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td>
                      <BranchBadge branch={profile.branch ?? null} />
                    </td>
                    <td>
                      <span
                        className={cn(
                          "badge border",
                          profile.role === "admin"
                            ? "border-purple/30 bg-purple-light/20 text-ink"
                            : "border-ink/10 bg-ink/5 text-muted",
                        )}
                      >
                        {profile.role === "admin" ? "Admin" : "Paciente"}
                      </span>
                    </td>
                    <td>
                      <ProfileStatusBadge status={profile.status} />
                    </td>
                    <td className="whitespace-nowrap text-[11px] text-muted">
                      {formatDate(profile.created_at)}
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1.5">
                        {profile.status !== "approved" ? (
                          <button
                            type="button"
                            onClick={() => changeStatus(profile, "approved")}
                            disabled={isUpdating}
                            className="btn-mint btn-sm"
                          >
                            <UserCheck className="size-3.5" />
                            {profile.status === "pending" ? "Aprobar" : "Reactivar"}
                          </button>
                        ) : null}
                        {profile.status === "pending" ? (
                          <button
                            type="button"
                            onClick={() => changeStatus(profile, "rejected")}
                            disabled={isUpdating}
                            className="btn-outline btn-sm text-rose-700"
                          >
                            <UserX className="size-3.5" />
                            Rechazar
                          </button>
                        ) : null}
                        {profile.status === "approved" && !isSelf ? (
                          <button
                            type="button"
                            onClick={() => changeStatus(profile, "suspended")}
                            disabled={isUpdating}
                            className="btn-outline btn-sm"
                          >
                            <ShieldAlert className="size-3.5" />
                            Suspender
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}
