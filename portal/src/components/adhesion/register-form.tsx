"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  UserPlus,
} from "lucide-react";
import { registerAdhesionAction } from "@/lib/actions/adhesion";
import type { ActionState } from "@/lib/types";

const initialState: ActionState = {};

export function AdhesionRegisterForm() {
  const [state, formAction, pending] = useActionState(
    registerAdhesionAction,
    initialState,
  );
  const [showPassword, setShowPassword] = useState(false);

  if (state.message) {
    return (
      <div className="card p-7 text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-mint/30 text-green-text">
          <CheckCircle2 className="size-7" />
        </span>
        <h2 className="mt-5 text-2xl text-ink">Revisá tu email</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">{state.message}</p>
        <div className="mt-6 flex flex-col gap-2">
          <Link href="/login" className="btn-primary">Ir a ingresar</Link>
          <Link href="/" className="btn-ghost btn-sm">Volver al inicio</Link>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      {state.error ? (
        <div role="alert" className="flex gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs leading-relaxed text-rose-800">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <p>{state.error}</p>
        </div>
      ) : null}

      <div>
        <label htmlFor="email" className="label">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="tu@email.com"
          className="input"
          required
        />
      </div>

      <div>
        <label htmlFor="password" className="label">Contraseña</label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Mínimo 8 caracteres"
            className="input pr-12"
            minLength={8}
            maxLength={72}
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-muted transition hover:bg-ink/5 hover:text-ink"
            aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>

      <div>
        <label htmlFor="confirmPassword" className="label">Repetir contraseña</label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          placeholder="Repetí la contraseña"
          className="input"
          required
        />
      </div>

      <div className="space-y-3 rounded-2xl border border-ink/10 bg-white/55 p-4">
        <label className="flex cursor-pointer items-start gap-3 text-xs leading-relaxed text-muted">
          <input type="checkbox" name="acceptTerms" className="mt-0.5 size-4 shrink-0 accent-[#009468]" required />
          <span>
            Acepto las{" "}
            <Link href="/legal" className="link-underline">condiciones de uso y la política de privacidad</Link>.
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-3 text-xs leading-relaxed text-muted">
          <input type="checkbox" name="isAdult" className="mt-0.5 size-4 shrink-0 accent-[#009468]" required />
          <span>Confirmo que tengo 18 años o más.</span>
        </label>
      </div>

      <button type="submit" className="btn-primary w-full" disabled={pending}>
        {pending ? (
          <><Loader2 className="size-4 animate-spin" /> Creando solicitud…</>
        ) : (
          <><UserPlus className="size-4" /> Comenzar adhesión</>
        )}
      </button>

      <p className="text-center text-xs text-muted">
        ¿Ya tenés cuenta?{" "}
        <Link href="/login" className="font-semibold text-green-text hover:underline">Ingresá</Link>
      </p>
    </form>
  );
}
