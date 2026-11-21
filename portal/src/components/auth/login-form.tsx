"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { AlertCircle, Eye, EyeOff, Loader2, LogIn } from "lucide-react";
import { loginAction } from "@/lib/actions/auth";
import type { ActionState } from "@/lib/types";

const initialState: ActionState = {};

export function LoginForm({ nextPath }: { nextPath?: string }) {
  const [state, formAction, pending] = useActionState(loginAction, initialState);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="next" value={nextPath ?? "/portal"} />

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
        <label htmlFor="email" className="label">
          Email
        </label>
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
        <div className="flex items-center justify-between">
          <label htmlFor="password" className="label">
            Contraseña
          </label>
          <div className="mb-2 flex gap-3 text-[11px] font-medium">
            <Link href="/ayuda/solicitar?motivo=password" className="text-green-text hover:underline">
              ¿Olvidaste tu contraseña?
            </Link>
            <Link href="/registro" className="text-green-text hover:underline">
              Ya soy paciente
            </Link>
          </div>
        </div>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Tu contraseña"
            className="input pr-12"
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

      <button
        type="submit"
        className="btn-primary w-full"
        disabled={pending}
      >
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Ingresando…
          </>
        ) : (
          <>
            <LogIn className="size-4" />
            Ingresar al portal
          </>
        )}
      </button>

      <p className="text-center text-[11px] leading-relaxed text-muted">
        El administrador atenderá la solicitud de acceso desde el panel, sin
        enviar un correo.
      </p>
    </form>
  );
}
