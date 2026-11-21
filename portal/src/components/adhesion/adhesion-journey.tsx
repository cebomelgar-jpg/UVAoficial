"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  FileText,
  MapPin,
  MessageCircle,
  Printer,
  Save,
} from "lucide-react";
import {
  markAdhesionStepAction,
  saveAdhesionDetailsAction,
} from "@/lib/actions/adhesion";
import type { AdhesionApplication } from "@/lib/types";

const REPROCANN_URL = "https://reprocann.msal.gob.ar/";
const REPROCANN_FAQ_URL =
  "https://www.argentina.gob.ar/salud/cannabis-medicinal/frecuentes";
const DRIVE_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLScZofO6fJxl3XCCu6xfb2OeBf80Y5mo2x7Nla_EvMSUe4SxDA/viewform?usp=sf_link";

const STEPS = [
  "Datos personales",
  "Mi Argentina activa",
  "Iniciar REPROCANN",
  "Entrevista médica",
  "Formularios del club",
  "Esperar habilitación",
];

function StepCompletion({
  step,
  complete,
}: {
  step: number;
  complete: boolean;
}) {
  const [state, action, pending] = useActionState(markAdhesionStepAction, {});

  return (
    <div className="mt-5 border-t border-ink/10 pt-4">
      {state.error ? (
        <p role="alert" className="mb-3 text-xs text-rose-700">{state.error}</p>
      ) : state.message ? (
        <p role="status" className="mb-3 text-xs text-green-text">{state.message}</p>
      ) : null}
      <form action={action}>
        <input type="hidden" name="step" value={step} />
        <input type="hidden" name="completed" value={String(!complete)} />
        <button type="submit" className={complete ? "btn-outline btn-sm" : "btn-mint btn-sm"} disabled={pending}>
          <CheckCircle2 className="size-3.5" />
          {pending ? "Guardando…" : complete ? "Reabrir paso" : "Marcar paso como completado"}
        </button>
      </form>
    </div>
  );
}

function PersonalDetailsForm({
  application,
  email,
}: {
  application: AdhesionApplication | null;
  email: string;
}) {
  const [state, action, pending] = useActionState(saveAdhesionDetailsAction, {});

  return (
    <form action={action} className="mt-5 grid gap-4 sm:grid-cols-2">
      {state.error ? (
        <div role="alert" className="sm:col-span-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
          {state.error}
        </div>
      ) : null}
      {state.message ? (
        <div role="status" className="sm:col-span-2 rounded-xl border border-green/20 bg-mint/20 p-3 text-xs text-green-text">
          {state.message}
        </div>
      ) : null}

      <div className="sm:col-span-2">
        <label htmlFor="clinicalReason" className="label">Motivo clínico</label>
        <textarea id="clinicalReason" name="clinicalReason" className="input min-h-24" maxLength={2000} required defaultValue={application?.clinical_reason ?? ""} />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="fullName" className="label">Nombres y apellidos completos como figuran en el DNI</label>
        <input id="fullName" name="fullName" className="input" autoComplete="name" maxLength={120} required defaultValue={application?.full_name ?? ""} />
      </div>
      <div>
        <label htmlFor="age" className="label">Edad</label>
        <input id="age" name="age" type="number" min={18} max={120} className="input" required defaultValue={application?.age ?? ""} />
      </div>
      <div>
        <label htmlFor="dni" className="label">DNI</label>
        <input id="dni" name="dni" inputMode="numeric" pattern="[0-9]{7,10}" className="input" maxLength={10} required defaultValue={application?.dni ?? ""} />
      </div>
      <div>
        <label htmlFor="birthDate" className="label">Fecha de nacimiento</label>
        <input id="birthDate" name="birthDate" type="date" className="input" required defaultValue={application?.birth_date ?? ""} />
      </div>
      <div>
        <label htmlFor="phone" className="label">Teléfono</label>
        <input id="phone" name="phone" type="tel" autoComplete="tel" className="input" maxLength={30} required defaultValue={application?.phone ?? ""} />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="address" className="label">Domicilio real</label>
        <input id="address" name="address" autoComplete="street-address" className="input" maxLength={200} required defaultValue={application?.address ?? ""} />
      </div>
      <div>
        <label htmlFor="locality" className="label">Localidad de residencia</label>
        <input id="locality" name="locality" autoComplete="address-level2" className="input" maxLength={120} required defaultValue={application?.locality ?? ""} />
      </div>
      <div>
        <label htmlFor="healthInsurance" className="label">Obra social</label>
        <input id="healthInsurance" name="healthInsurance" className="input" maxLength={120} required defaultValue={application?.health_insurance ?? ""} />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="email" className="label">Email de la cuenta</label>
        <input id="email" name="email" type="email" className="input" readOnly value={email} required />
        <p className="mt-1 text-[11px] text-muted">Usamos el email con el que creaste la cuenta.</p>
      </div>
      <div className="sm:col-span-2">
        <button type="submit" className="btn-primary btn-sm" disabled={pending}>
          <Save className="size-3.5" />
          {pending ? "Guardando…" : "Guardar datos personales"}
        </button>
      </div>
    </form>
  );
}

export function AdhesionJourney({
  application,
  email,
  rejected,
}: {
  application: AdhesionApplication | null;
  email: string;
  rejected: boolean;
}) {
  const completed = new Set(application?.completed_steps ?? []);

  return (
    <div className="space-y-6">
      {rejected ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900">
          Tu solicitud necesita revisión del equipo. Podés continuar el recorrido y escribir a administración por el chat de ayuda.
        </div>
      ) : null}

      <section className="card p-5 sm:p-7">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-mint/30 text-green-text">
            <ClipboardCheck className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="eyebrow">Tu recorrido de adhesión</p>
            <h1 className="mt-1 text-2xl text-ink">Avanzá paso a paso</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Esta cuenta es solo para completar la solicitud. No habilita el portal de pacientes; administración revisará el proceso y, cuando corresponda, asignará tu sede y habilitará el acceso.
            </p>
          </div>
        </div>
        <ol className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {STEPS.map((title, index) => {
            const step = index + 1;
            const isComplete = completed.has(step);
            return (
              <li key={title} className={`flex items-center gap-3 rounded-xl border p-3 text-xs ${isComplete ? "border-green/25 bg-mint/20 text-green-text" : "border-ink/10 bg-white/60 text-muted"}`}>
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-white text-[10px] font-bold text-ink">
                  {isComplete ? <CheckCircle2 className="size-4" /> : `0${step}`}
                </span>
                {title}
              </li>
            );
          })}
        </ol>
      </section>

      <section id="paso-1" className="card scroll-mt-24 p-5 sm:p-7">
        <p className="eyebrow">Paso 1</p>
        <h2 className="mt-1 text-xl text-ink">Datos personales</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Completá la información tal como aparece en tu DNI. Tus datos personales y el motivo clínico solo son visibles para vos y el equipo administrador autorizado.
        </p>
        <PersonalDetailsForm application={application} email={email} />
        {application ? <StepCompletion step={1} complete={completed.has(1)} /> : null}
      </section>

      <section id="paso-2" className="card scroll-mt-24 p-5 sm:p-7">
        <p className="eyebrow">Paso 2</p>
        <h2 className="mt-1 text-xl text-ink">Activar Mi Argentina</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Necesitás una cuenta activa para validar tus datos al iniciar el trámite de REPROCANN. Si la verificación biométrica no funciona, acercate al Punto ANSES de Villaguay.
        </p>
        <div className="mt-4 rounded-2xl border border-ink/10 bg-paper/70 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            <MapPin className="size-4 text-green-text" />
            Punto ANSES · Villaguay
          </p>
          <p className="mt-2 text-sm text-muted">25 de Mayo y Rivadavia · de 09:00 a 12:00.</p>
          <p className="mt-1 text-xs text-muted">Corroboran tu identidad y habilitan la aplicación. Llevá tu DNI.</p>
          <a
            href="https://www.google.com/maps/search/?api=1&query=25+de+Mayo+y+Rivadavia%2C+Villaguay%2C+Entre+R%C3%ADos"
            target="_blank"
            rel="noreferrer"
            className="link-underline mt-3 inline-flex text-xs"
          >
            Ver ubicación aproximada <ExternalLink className="ml-1 size-3" />
          </a>
        </div>
        <StepCompletion step={2} complete={completed.has(2)} />
      </section>

      <section id="paso-3" className="card scroll-mt-24 p-5 sm:p-7">
        <p className="eyebrow">Paso 3</p>
        <h2 className="mt-1 text-xl text-ink">Iniciar el trámite en REPROCANN</h2>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-muted">
          <li>Ingresá al sistema oficial con tu cuenta activa de Mi Argentina.</li>
          <li>Iniciá un trámite con el rol de paciente y completá tus datos según tu DNI.</li>
          <li>El equipo médico te orientará sobre la documentación y la vinculación correspondiente antes de finalizar la presentación.</li>
          <li>El profesional prescriptor debe adjuntar la declaración jurada y el consentimiento informado en PDF, y vincular al paciente según el procedimiento vigente.</li>
        </ol>
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
          No envíes documentación médica ni selecciones una vinculación que no hayas confirmado con el equipo profesional. El trámite oficial requiere indicación médica y consentimiento informado.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a href={REPROCANN_URL} target="_blank" rel="noreferrer" className="btn-primary btn-sm">
            Abrir REPROCANN <ExternalLink className="size-3.5" />
          </a>
          <a href={REPROCANN_FAQ_URL} target="_blank" rel="noreferrer" className="btn-outline btn-sm">
            Preguntas frecuentes oficiales <ExternalLink className="size-3.5" />
          </a>
        </div>
        <StepCompletion step={3} complete={completed.has(3)} />
      </section>

      <section id="paso-4" className="card scroll-mt-24 p-5 sm:p-7">
        <p className="eyebrow">Paso 4</p>
        <h2 className="mt-1 text-xl text-ink">Coordinar entrevista médica</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          La entrevista con la Dra. Sol Mina se coordina directamente con el equipo. Escribinos por el chat privado y te indicaremos cómo continuar.
        </p>
        <Link href="/adhesion/ayuda" className="btn-primary btn-sm mt-4">
          <MessageCircle className="size-3.5" />
          Abrir Ayuda y chat
        </Link>
        <StepCompletion step={4} complete={completed.has(4)} />
      </section>

      <section id="paso-5" className="card scroll-mt-24 p-5 sm:p-7">
        <p className="eyebrow">Paso 5</p>
        <h2 className="mt-1 text-xl text-ink">Formularios internos del club</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Completá el formulario de Google y la declaración jurada de vinculación. La declaración se puede completar en pantalla e imprimir para firmarla.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a href={DRIVE_FORM_URL} target="_blank" rel="noreferrer" className="btn-outline btn-sm">
            <FileText className="size-3.5" />
            Abrir formulario de Google <ExternalLink className="size-3" />
          </a>
          <Link href="/adhesion/declaracion" className="btn-primary btn-sm">
            <Printer className="size-3.5" />
            Completar e imprimir declaración
          </Link>
        </div>
        <StepCompletion step={5} complete={completed.has(5)} />
      </section>

      <section id="paso-6" className="card scroll-mt-24 p-5 sm:p-7">
        <p className="eyebrow">Paso 6</p>
        <h2 className="mt-1 text-xl text-ink">Esperar la habilitación de REPROCANN</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Una vez presentada la solicitud, esperá la resolución oficial. La aprobación del trámite y la habilitación del portal son procesos distintos; el administrador asignará tu sede y activará tu cuenta de paciente cuando el recorrido esté completo.
        </p>
        {completed.size === 6 ? (
          <p className="mt-4 rounded-xl border border-green/20 bg-mint/20 p-3 text-sm text-green-text">
            Completaste los pasos. Tu solicitud quedó lista para revisión administrativa.
          </p>
        ) : null}
        <StepCompletion step={6} complete={completed.has(6)} />
      </section>
    </div>
  );
}
