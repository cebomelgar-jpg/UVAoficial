"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2, UserPlus } from "lucide-react";
import { registerExistingPatientAction } from "@/lib/actions/auth";
import type { ActionState, Branch } from "@/lib/types";

const initialState: ActionState = {};

export function ExistingPatientRegisterForm({ branches }: { branches: Branch[] }) {
  const [state, formAction, pending] = useActionState(
    registerExistingPatientAction,
    initialState,
  );
  const [showPassword, setShowPassword] = useState(false);

  if (state.message) {
    return (
      <div className="mt-6 text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-mint/30 text-green-text">
          <CheckCircle2 className="size-7" />
        </span>
        <h2 className="mt-5 text-2xl text-ink">Revisá tu email</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">{state.message}</p>
        <Link href="/login" className="btn-primary mt-6 w-full">Ir a ingresar</Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-6 space-y-4">
      {state.error ? (
        <div role="alert" className="flex gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs leading-relaxed text-rose-800">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <p>{state.error}</p>
        </div>
      ) : null}
      <div>
        <label htmlFor="fullName" className="label">Nombre y apellido</label>
        <input id="fullName" name="fullName" className="input" autoComplete="name" minLength={2} maxLength={80} required />
      </div>
      <div>
        <label htmlFor="phone" className="label">Teléfono</label>
        <input id="phone" name="phone" type="tel" className="input" autoComplete="tel" minLength={6} maxLength={30} placeholder="+54 9 ..." required />
      </div>
      <div>
        <label htmlFor="branchId" className="label">Sede</label>
        <select id="branchId" name="branchId" className="select" required>
          <option value="">Elegí tu sede</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>{branch.name} · {branch.city}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="email" className="label">Email</label>
        <input id="email" name="email" type="email" className="input" autoComplete="email" placeholder="tu@email.com" required />
      </div>
      <div>
        <label htmlFor="password" className="label">Contraseña</label>
        <div className="relative">
          <input id="password" name="password" type={showPassword ? "text" : "password"} className="input pr-12" autoComplete="new-password" minLength={8} maxLength={72} placeholder="Mínimo 8 caracteres" required />
          <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-muted" aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}>
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>
      <div>
        <label htmlFor="confirmPassword" className="label">Repetir contraseña</label>
        <input id="confirmPassword" name="confirmPassword" type={showPassword ? "text" : "password"} className="input" autoComplete="new-password" required />
      </div>
      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-ink/10 bg-white/55 p-4 text-xs leading-relaxed text-muted">
        <input type="checkbox" name="acceptTerms" className="mt-0.5 size-4 shrink-0 accent-[#009468]" required />
        <span>Acepto las <Link href="/legal" className="link-underline">condiciones de uso y la política de privacidad</Link>.</span>
      </label>
      <button type="submit" className="btn-primary w-full" disabled={pending}>
        {pending ? <><Loader2 className="size-4 animate-spin" /> Creando cuenta…</> : <><UserPlus className="size-4" /> Crear cuenta de paciente</>}
      </button>
    </form>
  );
}
