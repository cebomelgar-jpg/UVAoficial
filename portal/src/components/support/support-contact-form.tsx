"use client";

import Link from "next/link";
import { useActionState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Send } from "lucide-react";
import { submitSupportContactRequestAction } from "@/lib/actions/support";
import type { ActionState } from "@/lib/types";

const initialState: ActionState = {};

export function SupportContactForm({
  initialRequestType = "password",
}: {
  initialRequestType?: "password" | "privacy" | "general" | "problem" | "product";
}) {
  const [state, formAction, pending] = useActionState(
    submitSupportContactRequestAction,
    initialState,
  );

  if (state.message) {
    return (
      <div className="card p-6 sm:p-8">
        <span className="grid size-12 place-items-center rounded-2xl bg-mint/30 text-green-text">
          <CheckCircle2 className="size-6" />
        </span>
        <h1 className="mt-5 text-2xl text-ink">Solicitud recibida</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">{state.message}</p>
        <Link href="/login" className="btn-primary mt-6 w-full">
          Volver a ingresar
        </Link>
      </div>
    );
  }

  return (
    <div className="card p-6 sm:p-8">
      <span className="grid size-11 place-items-center rounded-2xl bg-ink text-mint">
        <Send className="size-5" />
      </span>
      <p className="eyebrow mt-5">Atención interna</p>
      <h1 className="mt-2 text-3xl text-ink">Solicitar ayuda</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        El administrador recibirá esta solicitud en el panel. No enviamos un
        correo ni pedimos tu contraseña. Si es por acceso, te contactará al
        teléfono registrado para verificar tu identidad.
      </p>

      <form action={formAction} className="mt-6 space-y-4">
        {state.error ? (
          <div
            role="alert"
            className="flex gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs leading-relaxed text-rose-800"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <p>{state.error}</p>
          </div>
        ) : null}
        <div>
          <label htmlFor="support-request-type" className="label">
            Motivo
          </label>
          <select
            id="support-request-type"
            name="requestType"
            className="select"
            defaultValue={initialRequestType}
            required
          >
            <option value="password">No puedo ingresar / olvidé mi contraseña</option>
            <option value="privacy">Solicitud sobre mis datos o privacidad</option>
            <option value="problem">Tengo un problema o inconveniente</option>
            <option value="product">Quiero pedir un producto especial</option>
            <option value="general">Otra consulta</option>
          </select>
        </div>
        <div>
          <label htmlFor="support-full-name" className="label">
            Nombre y apellido
          </label>
          <input
            id="support-full-name"
            name="fullName"
            className="input"
            autoComplete="name"
            minLength={2}
            maxLength={80}
            required
          />
        </div>
        <div>
          <label htmlFor="support-email" className="label">
            Email de la cuenta
          </label>
          <input
            id="support-email"
            name="email"
            type="email"
            className="input"
            autoComplete="email"
            maxLength={254}
            required
          />
        </div>
        <div>
          <label htmlFor="support-phone" className="label">
            Teléfono de contacto
          </label>
          <input
            id="support-phone"
            name="phone"
            type="tel"
            className="input"
            autoComplete="tel"
            minLength={6}
            maxLength={30}
            placeholder="+54 9 ..."
            required
          />
        </div>
        <div>
          <label htmlFor="support-details" className="label">
            Contanos qué necesitás
          </label>
          <textarea
            id="support-details"
            name="details"
            className="textarea min-h-28"
            maxLength={2000}
            placeholder="Describí el problema o indicá el producto, presentación y cantidad que buscás."
            required
          />
        </div>
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
          No incluyas contraseñas ni información médica. El equipo conserva la
          solicitud interna hasta atenderla, con un máximo de 7 días.
        </p>
        <button type="submit" className="btn-primary w-full" disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Enviando solicitud…
            </>
          ) : (
            <>
              <Send className="size-4" />
              Enviar al administrador
            </>
          )}
        </button>
      </form>

      <p className="mt-5 text-center text-xs text-muted">
        ¿Ya recuperaste el acceso?{" "}
        <Link href="/login" className="font-semibold text-green-text hover:underline">
          Volver al inicio de sesión
        </Link>
      </p>
    </div>
  );
}
