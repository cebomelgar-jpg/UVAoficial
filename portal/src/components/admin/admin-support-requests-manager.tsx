"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Check, Clock3, ExternalLink, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/providers/toast-provider";
import {
  deleteSupportRequestAction,
  updateSupportRequestStatusAction,
} from "@/lib/actions/support";
import type { SupportContactRequest } from "@/lib/types";

const requestLabels = {
  password: "Ayuda para ingresar",
  privacy: "Datos y privacidad",
  general: "Consulta general",
  problem: "Problema o inconveniente",
  product: "Producto especial",
} as const;

export function AdminSupportRequestsManager({
  requests,
}: {
  requests: SupportContactRequest[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [showHandled, setShowHandled] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const filtered = requests.filter((request) =>
    showHandled ? request.status === "handled" : request.status === "pending",
  );

  function updateStatus(request: SupportContactRequest, status: "pending" | "handled") {
    setPendingId(request.id);
    startTransition(async () => {
      try {
        const result = await updateSupportRequestStatusAction(request.id, status);
        if (result.error) {
          toast({ title: "No se pudo actualizar", description: result.error, variant: "error" });
          return;
        }
        toast({ title: result.message ?? "Solicitud actualizada" });
        router.refresh();
      } catch (error) {
        console.error("[admin/support] No se pudo actualizar la solicitud.", error);
        toast({ title: "Error inesperado", variant: "error" });
      } finally {
        setPendingId(null);
      }
    });
  }

  function deleteRequest(request: SupportContactRequest) {
    if (!window.confirm(`¿Eliminar la solicitud de ${request.full_name}?`)) return;
    setPendingId(request.id);
    startTransition(async () => {
      try {
        const result = await deleteSupportRequestAction(request.id);
        if (result.error) {
          toast({ title: "No se pudo eliminar", description: result.error, variant: "error" });
          return;
        }
        toast({ title: "Solicitud eliminada" });
        router.refresh();
      } catch (error) {
        console.error("[admin/support] No se pudo eliminar la solicitud.", error);
        toast({ title: "Error inesperado", variant: "error" });
      } finally {
        setPendingId(null);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted">
          El formulario de acceso no envía correo; las solicitudes llegan directamente acá.
        </p>
        <button
          type="button"
          onClick={() => setShowHandled((value) => !value)}
          className="btn-outline btn-sm"
        >
          <Clock3 className="size-3.5" />
          {showHandled ? "Ver pendientes" : "Ver atendidas"}
        </button>
      </div>

      {filtered.length ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {filtered.map((request) => (
            <article key={request.id} className="card space-y-4 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="badge border-ink/10 bg-white text-ink">
                    {requestLabels[request.request_type]}
                  </span>
                  <h2 className="mt-3 font-semibold text-ink">{request.full_name}</h2>
                  <p className="mt-1 break-all text-xs text-muted">{request.email}</p>
                  <p className="mt-1 text-xs text-muted">{request.phone}</p>
                </div>
                <span className="shrink-0 text-[10px] text-muted">
                  {new Intl.DateTimeFormat("es-AR", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(request.created_at))}
                </span>
              </div>

              {request.request_type === "password" ? (
                <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
                  Verificá la identidad usando los datos de la cuenta. Después,
                  buscá el perfil por email y restablecé el acceso desde el panel.
                  Nunca pidas ni envíes la contraseña anterior.
                </p>
              ) : null}
              {request.details ? (
                <div className="rounded-xl border border-ink/10 bg-paper/60 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Detalle</p>
                  <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-ink">{request.details}</p>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2 border-t border-ink/10 pt-3">
                {request.request_type === "password" ? (
                  <Link
                    href={`/admin/perfiles?buscar=${encodeURIComponent(request.email)}`}
                    className="btn-outline btn-sm"
                  >
                    <ExternalLink className="size-3.5" />
                    Abrir perfil
                  </Link>
                ) : null}
                <button
                  type="button"
                  onClick={() =>
                    updateStatus(
                      request,
                      request.status === "pending" ? "handled" : "pending",
                    )
                  }
                  disabled={isPending && pendingId === request.id}
                  className="btn-mint btn-sm"
                >
                  <Check className="size-3.5" />
                  {request.status === "pending" ? "Marcar atendida" : "Reabrir"}
                </button>
                <button
                  type="button"
                  onClick={() => deleteRequest(request)}
                  disabled={isPending && pendingId === request.id}
                  className="btn-ghost btn-sm text-rose-700"
                >
                  <Trash2 className="size-3.5" />
                  Borrar solicitud
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="card p-10 text-center">
          <Check className="mx-auto size-7 text-green-text" />
          <p className="mt-3 font-semibold text-ink">
            {showHandled ? "No hay solicitudes atendidas." : "No hay solicitudes pendientes."}
          </p>
        </div>
      )}
    </div>
  );
}
