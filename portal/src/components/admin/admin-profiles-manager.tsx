"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  Download,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Pencil,
  RefreshCw,
  Search,
  ShieldAlert,
  UserCheck,
  UserX,
} from "lucide-react";
import { BranchBadge } from "@/components/ui/branch-badge";
import { Dialog } from "@/components/ui/dialog";
import { ProfileStatusBadge } from "@/components/ui/profile-status-badge";
import { useToast } from "@/components/providers/toast-provider";
import {
  changePatientPasswordAction,
  updateAdminPatientProfileAction,
  updateProfileStatusAction,
} from "@/lib/actions/profiles";
import { formatDate } from "@/lib/format";
import type { AdminProfile, Branch, ProfileStatus } from "@/lib/types";
import { cn, downloadCsv, initials, normalizeSearch } from "@/lib/utils";

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
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const numbers = "23456789";
  const all = `${upper}${lower}${numbers}`;
  const randomIndex = (length: number) => {
    const limit = Math.floor(256 / length) * length;
    const byte = new Uint8Array(1);
    do {
      crypto.getRandomValues(byte);
    } while (byte[0] >= limit);
    return byte[0] % length;
  };
  const characters = [
    upper[randomIndex(upper.length)],
    lower[randomIndex(lower.length)],
    numbers[randomIndex(numbers.length)],
    ...Array.from({ length: 13 }, () => all[randomIndex(all.length)]),
  ];

  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swapIndex = randomIndex(index + 1);
    [characters[index], characters[swapIndex]] = [
      characters[swapIndex],
      characters[index],
    ];
  }
  return characters.join("");
}

function isStrongPassword(value: string) {
  return (
    value.length >= 8 &&
    value.length <= 72 &&
    /[A-Za-z]/.test(value) &&
    /[0-9]/.test(value)
  );
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
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [search, setSearch] = useState(searchParams.get("buscar") ?? "");
  const [status, setStatus] = useState<StatusFilter>("todos");
  const [role, setRole] = useState<RoleFilter>("todos");
  const [branchId, setBranchId] = useState<string>("todas");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<AdminProfile | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editBranchId, setEditBranchId] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [passwordTarget, setPasswordTarget] = useState<AdminProfile | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);

  useEffect(() => {
    setSearch(searchParams.get("buscar") ?? "");
  }, [searchParams]);

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
    let result;
    try {
      result = await updateProfileStatusAction(profile.id, next);
    } catch (error) {
      console.error("[admin/profiles] No se pudo actualizar el estado.", error);
      toast({
        title: "No se pudo actualizar",
        description: "Ocurrió un error inesperado. Intentá nuevamente.",
        variant: "error",
      });
      return;
    } finally {
      setUpdatingId(null);
    }

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

  function openEditDialog(profile: AdminProfile) {
    setEditTarget(profile);
    setEditName(profile.full_name);
    setEditPhone(profile.phone ?? "");
    setEditBranchId(profile.branch_id ?? "");
  }

  function closeEditDialog() {
    if (savingProfile) return;
    setEditTarget(null);
    setEditName("");
    setEditPhone("");
    setEditBranchId("");
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editTarget) return;

    setSavingProfile(true);
    try {
      const result = await updateAdminPatientProfileAction({
        profileId: editTarget.id,
        fullName: editName,
        phone: editPhone,
        branchId: editBranchId,
      });
      if (result.error) {
        toast({ title: "No se pudo guardar", description: result.error, variant: "error" });
        return;
      }

      toast({ title: "Perfil actualizado", description: editName });
      setEditTarget(null);
      router.refresh();
    } catch (error) {
      console.error("[admin/profiles] No se pudieron actualizar los datos.", error);
      toast({
        title: "No se pudo guardar",
        description: "Ocurrió un error inesperado. Intentá nuevamente.",
        variant: "error",
      });
    } finally {
      setSavingProfile(false);
    }
  }

  function openPasswordDialog(profile: AdminProfile) {
    setPasswordTarget(profile);
    setNewPassword(generatePassword());
    setConfirmPassword("");
    setShowPassword(false);
    setPasswordError(null);
    setPasswordSaved(false);
  }

  function closePasswordDialog() {
    if (savingPassword) return;
    setPasswordTarget(null);
    setNewPassword("");
    setConfirmPassword("");
    setPasswordError(null);
    setPasswordSaved(false);
  }

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!passwordTarget) return;
    if (!isStrongPassword(newPassword)) {
      setPasswordError("Usá entre 8 y 72 caracteres, con al menos una letra y un número.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Las contraseñas no coinciden.");
      return;
    }

    setSavingPassword(true);
    setPasswordError(null);
    try {
      const result = await changePatientPasswordAction(
        passwordTarget.id,
        newPassword,
      );
      if (result.error) {
        setPasswordError(result.error);
        return;
      }

      setPasswordSaved(true);
      toast({
        title: "Contraseña restablecida",
        description: `${passwordTarget.full_name} deberá usar la nueva contraseña.`,
      });
    } catch (error) {
      console.error("[admin/profiles] No se pudo restablecer la contraseña.", error);
      setPasswordError("Ocurrió un error inesperado. Intentá nuevamente.");
    } finally {
      setSavingPassword(false);
    }
  }

  async function copyPassword() {
    try {
      await navigator.clipboard.writeText(newPassword);
      toast({ title: "Contraseña copiada" });
    } catch {
      toast({
        title: "No se pudo copiar",
        description: "Seleccioná la contraseña y copiala manualmente.",
        variant: "error",
      });
    }
  }

  function exportProfiles() {
    downloadCsv("perfiles-uva.csv", [
      ["Nombre", "Email", "Teléfono", "Sede", "Rol", "Estado", "Fecha de registro"],
      ...filtered.map((profile) => [
        profile.full_name,
        profile.email ?? "",
        profile.phone ?? "",
        profile.branch?.name ?? "",
        profile.role === "admin" ? "Administrador" : "Paciente",
        profile.status,
        formatDate(profile.created_at),
      ]),
    ]);
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
          <button
            type="button"
            onClick={exportProfiles}
            className="btn-outline btn-sm"
            disabled={filtered.length === 0}
          >
            <Download className="size-3.5" />
            Exportar CSV
          </button>
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
              <th className="text-right">Acciones</th>
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
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {profile.role === "patient" ? (
                          <>
                            <button
                              type="button"
                              onClick={() => openEditDialog(profile)}
                              className="btn-ghost btn-sm"
                              aria-label={`Editar datos de ${profile.full_name}`}
                            >
                              <Pencil className="size-3.5" />
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => openPasswordDialog(profile)}
                              className="btn-ghost btn-sm"
                              aria-label={`Restablecer contraseña de ${profile.full_name}`}
                            >
                              <KeyRound className="size-3.5" />
                              Contraseña
                            </button>
                          </>
                        ) : null}
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

      <Dialog
        open={Boolean(editTarget)}
        onClose={closeEditDialog}
        title="Corregir perfil"
        description={
          editTarget
            ? `${editTarget.email ?? "Paciente"} · El email de acceso no se modifica desde este panel.`
            : undefined
        }
        size="md"
      >
        <form onSubmit={saveProfile} className="space-y-4">
          <div>
            <label htmlFor="admin-profile-name" className="label">
              Nombre y apellido
            </label>
            <input
              id="admin-profile-name"
              value={editName}
              onChange={(event) => setEditName(event.target.value)}
              className="input"
              required
              minLength={2}
              maxLength={80}
            />
          </div>
          <div>
            <label htmlFor="admin-profile-phone" className="label">
              Teléfono
            </label>
            <input
              id="admin-profile-phone"
              value={editPhone}
              onChange={(event) => setEditPhone(event.target.value)}
              className="input"
              type="tel"
              required
              minLength={6}
              maxLength={30}
            />
          </div>
          <div>
            <label htmlFor="admin-profile-branch" className="label">
              Sede
            </label>
            <select
              id="admin-profile-branch"
              value={editBranchId}
              onChange={(event) => setEditBranchId(event.target.value)}
              className="select"
              required
            >
              <option value="" disabled>
                Elegí una sede
              </option>
              {branches.filter((branch) => branch.active).map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name} · {branch.city}, {branch.province}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={closeEditDialog}
              disabled={savingProfile}
              className="btn-ghost btn-sm"
            >
              Cancelar
            </button>
            <button type="submit" disabled={savingProfile} className="btn-primary btn-sm">
              {savingProfile ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="size-3.5" />
              )}
              Guardar cambios
            </button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={Boolean(passwordTarget)}
        onClose={closePasswordDialog}
        title="Restablecer contraseña"
        description={
          passwordTarget
            ? `${passwordTarget.full_name} · ${passwordTarget.email ?? "Sin email"}`
            : undefined
        }
        size="md"
      >
        {passwordSaved ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
              <p>
                Contraseña restablecida. Comunicala al paciente por un canal
                seguro; por seguridad, no se guarda una copia.
              </p>
            </div>
            <div>
              <label htmlFor="admin-new-password-result" className="label">
                Nueva contraseña
              </label>
              <div className="flex gap-2">
                <input
                  id="admin-new-password-result"
                  className="input font-mono"
                  value={newPassword}
                  readOnly
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="btn-outline btn-sm"
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
                <button type="button" onClick={copyPassword} className="btn-outline btn-sm">
                  <Copy className="size-4" />
                  Copiar
                </button>
              </div>
            </div>
            <button type="button" onClick={closePasswordDialog} className="btn-primary w-full">
              Listo
            </button>
          </div>
        ) : (
          <form onSubmit={savePassword} className="space-y-4">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-relaxed text-amber-900">
              El cambio invalida la contraseña anterior inmediatamente. No se
              envía por email y no se conserva una copia.
            </div>
            <div>
              <label htmlFor="admin-new-password" className="label">
                Nueva contraseña
              </label>
              <div className="flex gap-2">
                <input
                  id="admin-new-password"
                  className="input font-mono"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  type={showPassword ? "text" : "password"}
                  minLength={8}
                  maxLength={72}
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => {
                    const generated = generatePassword();
                    setNewPassword(generated);
                    setConfirmPassword(generated);
                  }}
                  className="btn-outline btn-sm"
                >
                  <RefreshCw className="size-3.5" />
                  Generar
                </button>
              </div>
              <p className="mt-1 text-[11px] text-muted">
                Entre 8 y 72 caracteres, con al menos una letra y un número.
              </p>
            </div>
            <div>
              <label htmlFor="admin-confirm-password" className="label">
                Confirmar contraseña
              </label>
              <input
                id="admin-confirm-password"
                className="input font-mono"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-muted">
              <input
                type="checkbox"
                checked={showPassword}
                onChange={(event) => setShowPassword(event.target.checked)}
                className="size-4 accent-[#009468]"
              />
              Mostrar contraseña
            </label>
            {passwordError ? (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span>{passwordError}</span>
              </div>
            ) : null}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closePasswordDialog}
                disabled={savingPassword}
                className="btn-ghost btn-sm"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={savingPassword}
                className="btn-primary btn-sm"
              >
                {savingPassword ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <KeyRound className="size-3.5" />
                )}
                Restablecer contraseña
              </button>
            </div>
          </form>
        )}
      </Dialog>
    </div>
  );
}
