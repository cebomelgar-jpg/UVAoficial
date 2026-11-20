"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  UserCheck,
  UserX,
  X,
} from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { BranchBadge } from "@/components/ui/branch-badge";
import { ProfileStatusBadge } from "@/components/ui/profile-status-badge";
import { useToast } from "@/components/providers/toast-provider";
import {
  changeProfilePasswordAction,
  getProfilePasswordAction,
  updateProfileStatusAction,
} from "@/lib/actions/profiles";
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

function generatePassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const values = new Uint32Array(12);
  crypto.getRandomValues(values);
  const random = Array.from(values, (value) => chars[value % chars.length]).join("");
  return `Aa1${random}`;
}

function isStrongPassword(value: string) {
  return value.length >= 8 && value.length <= 72 && /[A-Za-z]/.test(value) && /[0-9]/.test(value);
}

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
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [loadingPasswordId, setLoadingPasswordId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [passwordTarget, setPasswordTarget] = useState<AdminProfile | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [passwordResult, setPasswordResult] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);

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

  async function togglePassword(profile: AdminProfile) {
    if (revealed[profile.id]) {
      setRevealed((current) => {
        const next = { ...current };
        delete next[profile.id];
        return next;
      });
      return;
    }
    if (!profile.has_password) {
      openPasswordDialog(profile);
      return;
    }
    setLoadingPasswordId(profile.id);
    const result = await getProfilePasswordAction(profile.id);
    setLoadingPasswordId(null);
    if (result.error || !result.password) {
      toast({ title: "No se pudo mostrar", description: result.error, variant: "error" });
      return;
    }
    setRevealed((current) => ({ ...current, [profile.id]: result.password! }));
  }

  async function copyPassword(profileId: string, password: string) {
    try {
      await navigator.clipboard.writeText(password);
      toast({ title: "Contraseña copiada" });
    } catch {
      toast({ title: "No se pudo copiar", variant: "error" });
    }
  }

  function openPasswordDialog(profile: AdminProfile) {
    setPasswordTarget(profile);
    setNewPassword(generatePassword());
    setPasswordResult(null);
    setPasswordError(null);
  }

  function closePasswordDialog() {
    if (savingPassword) return;
    setPasswordTarget(null);
    setNewPassword("");
    setPasswordResult(null);
    setPasswordError(null);
  }

  async function submitPassword(event: React.FormEvent) {
    event.preventDefault();
    if (!passwordTarget) return;
    if (!isStrongPassword(newPassword)) {
      setPasswordError("Usá al menos 8 caracteres, con una letra y un número.");
      return;
    }
    setSavingPassword(true);
    setPasswordError(null);
    const result = await changeProfilePasswordAction(passwordTarget.id, newPassword);
    setSavingPassword(false);
    if (result.error) {
      setPasswordError(result.error);
      if (result.password) setPasswordResult(result.password);
      return;
    }
    if (result.password) {
      setPasswordResult(result.password);
      setRevealed((current) => ({ ...current, [passwordTarget.id]: result.password! }));
    }
    toast({ title: "Contraseña actualizada", description: passwordTarget.full_name });
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
              Ejecutá{" "}
              <code className="rounded bg-ink/5 px-1.5 py-0.5 text-xs">
                portal/supabase/migrations/202610280001_profile_approval.sql
              </code>{" "}
              en el SQL Editor de Supabase para habilitar la aprobación de
              cuentas y la gestión de contraseñas.
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
              <th>Contraseña</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-10 text-center text-sm text-muted">
                  No encontramos perfiles con los filtros seleccionados.
                </td>
              </tr>
            ) : (
              filtered.map((profile) => {
                const isSelf = profile.id === currentAdminId;
                const revealedPassword = revealed[profile.id];
                const isLoadingPassword = loadingPasswordId === profile.id;
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
                      {profile.has_password ? (
                        <div className="flex items-center gap-1.5">
                          <code className="max-w-[180px] truncate rounded-lg bg-ink/5 px-2 py-1 text-[11px] font-semibold text-ink">
                            {revealedPassword ?? "••••••••"}
                          </code>
                          <button
                            type="button"
                            onClick={() => togglePassword(profile)}
                            className="btn-ghost btn-sm"
                            aria-label={revealedPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                          >
                            {isLoadingPassword ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : revealedPassword ? (
                              <EyeOff className="size-3.5" />
                            ) : (
                              <Eye className="size-3.5" />
                            )}
                          </button>
                          {revealedPassword ? (
                            <button
                              type="button"
                              onClick={() => copyPassword(profile.id, revealedPassword)}
                              className="btn-ghost btn-sm"
                              aria-label="Copiar contraseña"
                            >
                              <Copy className="size-3.5" />
                            </button>
                          ) : null}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openPasswordDialog(profile)}
                          className="btn-ghost btn-sm"
                        >
                          <KeyRound className="size-3.5" />
                          Restablecer
                        </button>
                      )}
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
                        <button
                          type="button"
                          onClick={() => openPasswordDialog(profile)}
                          className="btn-ghost btn-sm"
                        >
                          <KeyRound className="size-3.5" />
                          Contraseña
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-muted">
        Las contraseñas se guardan cifradas con una clave del servidor. Las cuentas
        creadas antes de esta función no tienen contraseña visible hasta que las
        restablezcas desde este panel.
      </p>

      <Dialog
        open={Boolean(passwordTarget)}
        onClose={closePasswordDialog}
        title="Cambiar contraseña"
        description={
          passwordTarget
            ? `${passwordTarget.full_name} · ${passwordTarget.email ?? "sin email"}`
            : undefined
        }
        size="md"
      >
        {passwordResult ? (
          <div className="space-y-4">
            {passwordError ? (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50/80 p-3 text-xs text-rose-800"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span>{passwordError}</span>
              </div>
            ) : (
              <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 text-xs text-emerald-800">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                <span>Contraseña actualizada correctamente.</span>
              </div>
            )}
            <div className="rounded-2xl border border-green/25 bg-mint/15 p-4">
              <p className="text-xs font-semibold text-green-text">Contraseña actual</p>
              <div className="mt-2 flex items-center gap-2">
                <code className="flex-1 truncate rounded-xl bg-white/70 px-3 py-2 text-sm font-semibold text-ink">
                  {passwordResult}
                </code>
                <button
                  type="button"
                  onClick={() => copyPassword(passwordTarget!.id, passwordResult)}
                  className="btn-ghost btn-sm"
                >
                  <Copy className="size-3.5" />
                </button>
              </div>
              <p className="mt-2 text-[11px] text-muted">
                Copiala y compartila con el paciente. También queda guardada para
                consultarla desde la tabla.
              </p>
            </div>
            <button type="button" className="btn-primary w-full" onClick={closePasswordDialog}>
              Listo
            </button>
          </div>
        ) : (
          <form onSubmit={submitPassword} className="space-y-4">
            <div>
              <label htmlFor="new-password" className="label">
                Nueva contraseña
              </label>
              <div className="flex gap-2">
                <input
                  id="new-password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  className="input"
                  minLength={8}
                  maxLength={72}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setNewPassword(generatePassword())}
                  className="btn-outline btn-sm"
                >
                  <RefreshCw className="size-3.5" />
                  Generar
                </button>
              </div>
              <p className="mt-1 text-[10px] text-muted">
                Mínimo 8 caracteres, con al menos una letra y un número.
              </p>
            </div>
            {passwordError ? (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50/80 p-3 text-xs text-rose-800"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span>{passwordError}</span>
              </div>
            ) : null}
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="btn-ghost btn-sm"
                onClick={closePasswordDialog}
                disabled={savingPassword}
              >
                <X className="size-3.5" />
                Cancelar
              </button>
              <button
                type="submit"
                className="btn-primary btn-sm"
                disabled={savingPassword}
              >
                {savingPassword ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <KeyRound className="size-3.5" />
                )}
                Guardar contraseña
              </button>
            </div>
          </form>
        )}
      </Dialog>
    </div>
  );
}
