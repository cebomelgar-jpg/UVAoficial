import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Clock3, LogOut, MessageCircle, ShieldAlert, XCircle } from "lucide-react";
import { getCurrentProfile, getCurrentUser } from "@/lib/auth";
import { signOutAction } from "@/lib/actions/auth";
import { whatsappUrl } from "@/lib/config";
import { formatDate } from "@/lib/format";
import { ProfileStatusBadge } from "@/components/ui/profile-status-badge";
import type { ProfileStatus } from "@/lib/types";

export const metadata: Metadata = {
  title: "Cuenta pendiente",
};

export const dynamic = "force-dynamic";

export default async function PendingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const profile = await getCurrentProfile();
  const status = profile?.status ?? "pending";

  if (status === "approved") {
    redirect("/portal");
  }

  const tone =
    status === "pending"
      ? {
          icon: Clock3,
          title: "Tu cuenta está pendiente de habilitación",
          description:
            "El administrador revisará tu registro y habilitará el acceso al portal. Te avisaremos cuando esté listo.",
          iconClass: "bg-amber-100 text-amber-700",
        }
      : status === "rejected"
        ? {
            icon: XCircle,
            title: "Tu solicitud fue rechazada",
            description:
              "Escribinos por WhatsApp para revisar tu situación y resolver el inconveniente.",
            iconClass: "bg-rose-100 text-rose-700",
          }
        : {
            icon: ShieldAlert,
            title: "Tu cuenta está suspendida",
            description:
              "Escribinos por WhatsApp para revisar tu situación y resolver el inconveniente.",
            iconClass: "bg-slate-100 text-slate-700",
          };

  const Icon = tone.icon;

  return (
    <div className="card p-7 text-center">
      <span
        className={`mx-auto grid size-14 place-items-center rounded-2xl ${tone.iconClass}`}
      >
        <Icon className="size-7" />
      </span>
      <h2 className="mt-5 text-2xl text-ink">{tone.title}</h2>
      <p className="mt-3 text-sm leading-relaxed text-muted">{tone.description}</p>

      <div className="mt-6 rounded-2xl border border-ink/10 bg-paper/60 p-4 text-left">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
          Tus datos
        </p>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Nombre</dt>
            <dd className="font-medium text-ink">
              {profile?.full_name ?? user.email ?? "Paciente"}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Email</dt>
            <dd className="font-medium text-ink">{user.email}</dd>
          </div>
          {profile?.created_at ? (
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Registro</dt>
              <dd className="font-medium text-ink">{formatDate(profile.created_at)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Estado</dt>
            <dd>
              {profile ? (
                <ProfileStatusBadge status={(profile.status ?? "pending") as ProfileStatus} />
              ) : (
                <span className="text-xs text-muted">Creando perfil…</span>
              )}
            </dd>
          </div>
        </dl>
      </div>

      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Link href="/pendiente" className="btn-outline btn-sm">
          Actualizar estado
        </Link>
        <a
          href={whatsappUrl(
            "Hola, consulto por el estado de mi cuenta del portal de Un Viaje Astral.",
          )}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary btn-sm"
        >
          <MessageCircle className="size-3.5" />
          Escribir por WhatsApp
        </a>
      </div>

      <form action={signOutAction} className="mt-6">
        <button type="submit" className="btn-ghost btn-sm">
          <LogOut className="size-3.5" />
          Cerrar sesión
        </button>
      </form>
    </div>
  );
}
