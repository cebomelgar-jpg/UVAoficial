"use client";

import { useActionState } from "react";
import { CheckCircle2, Clock3, UserRoundX } from "lucide-react";
import { reviewAdhesionAction } from "@/lib/actions/adhesion";
import type { AdhesionApplication, Branch, ProfileStatus } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { ProfileStatusBadge } from "@/components/ui/profile-status-badge";

type AdminApplication = {
  application: AdhesionApplication;
  profile: {
    id: string;
    email: string | null;
    full_name: string;
    phone: string | null;
    status: ProfileStatus;
    created_at: string;
  };
};

function AdminAdhesionCard({
  application,
  profile,
  branches,
}: AdminApplication & { branches: Branch[] }) {
  const [state, action, pending] = useActionState(reviewAdhesionAction, {});
  const complete = new Set(application.completed_steps);

  return (
    <article className="card overflow-hidden">
      <header className="flex flex-col gap-3 border-b border-ink/10 bg-white/60 p-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-ink">{application.full_name}</h2>
          <p className="mt-1 text-xs text-muted">
            {application.email} · {application.phone} · Registrado {formatDate(profile.created_at)}
          </p>
        </div>
        <ProfileStatusBadge status={profile.status} />
      </header>

      <div className="grid gap-5 p-5 lg:grid-cols-[1.2fr_.8fr]">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Datos personales y clínicos</p>
          <dl className="mt-3 grid gap-x-4 gap-y-3 text-sm sm:grid-cols-2">
            <div><dt className="text-xs text-muted">DNI</dt><dd className="font-medium text-ink">{application.dni}</dd></div>
            <div><dt className="text-xs text-muted">Fecha de nacimiento · edad</dt><dd className="font-medium text-ink">{application.birth_date} · {application.age}</dd></div>
            <div className="sm:col-span-2"><dt className="text-xs text-muted">Domicilio</dt><dd className="font-medium text-ink">{application.address}, {application.locality}</dd></div>
            <div><dt className="text-xs text-muted">Obra social</dt><dd className="font-medium text-ink">{application.health_insurance}</dd></div>
            <div><dt className="text-xs text-muted">Email de la cuenta</dt><dd className="break-all font-medium text-ink">{application.email}</dd></div>
            <div className="sm:col-span-2"><dt className="text-xs text-muted">Motivo clínico</dt><dd className="whitespace-pre-wrap font-medium text-ink">{application.clinical_reason}</dd></div>
          </dl>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Avance del recorrido</p>
          <p className="mt-2 flex items-center gap-2 text-sm font-medium text-ink">
            <Clock3 className="size-4 text-green-text" />
            {complete.size} de 6 pasos completados
          </p>
          <ol className="mt-3 space-y-2">
            {["Datos personales", "Mi Argentina", "REPROCANN", "Entrevista médica", "Formularios del club", "Habilitación REPROCANN"].map((step, index) => (
              <li key={step} className="flex items-center gap-2 text-xs text-muted">
                <CheckCircle2 className={`size-3.5 ${complete.has(index + 1) ? "text-green-text" : "text-ink/20"}`} />
                {step}
              </li>
            ))}
          </ol>
        </div>
      </div>

      <form action={action} className="border-t border-ink/10 bg-paper/50 p-5">
        <input type="hidden" name="userId" value={profile.id} />
        {state.error ? <p role="alert" className="mb-3 text-xs text-rose-700">{state.error}</p> : null}
        {state.message ? <p role="status" className="mb-3 text-xs text-green-text">{state.message}</p> : null}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="w-full sm:max-w-xs">
            <label htmlFor={`branch-${profile.id}`} className="label">Sede para el portal de paciente</label>
            <select id={`branch-${profile.id}`} name="branchId" className="select">
              <option value="">Elegí una sede para habilitar</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name} · {branch.city}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="submit" name="intent" value="reject" className="btn-outline btn-sm text-rose-700" disabled={pending}>
              <UserRoundX className="size-3.5" />
              Marcar para revisión
            </button>
            <button
              type="submit"
              name="intent"
              value="approve"
              className="btn-primary btn-sm"
              disabled={pending || complete.size < 6}
              title={complete.size < 6 ? "Debe completar los seis pasos" : undefined}
            >
              <CheckCircle2 className="size-3.5" />
              Habilitar portal
            </button>
          </div>
        </div>
      </form>
    </article>
  );
}

export function AdminAdhesionsManager({
  applications,
  branches,
}: {
  applications: AdminApplication[];
  branches: Branch[];
}) {
  if (!applications.length) {
    return (
      <div className="card p-8 text-center">
        <p className="text-sm font-semibold text-ink">No hay solicitudes para revisar</p>
        <p className="mt-1 text-xs text-muted">Las nuevas adhesiones aparecerán en esta sección.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-relaxed text-amber-900">
        Esta sección contiene datos personales y motivos clínicos. Solo deben usarse para evaluar y acompañar la adhesión.
      </p>
      {applications.map(({ application, profile }) => (
        <AdminAdhesionCard
          key={application.user_id}
          application={application}
          profile={profile}
          branches={branches}
        />
      ))}
    </div>
  );
}
