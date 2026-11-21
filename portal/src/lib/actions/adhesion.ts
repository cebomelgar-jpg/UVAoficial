"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { AuthResponse } from "@supabase/supabase-js";
import { requireAdmin, requireApplicant, getCurrentUser } from "@/lib/auth";
import { PORTAL_URL } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";

const registrationSchema = z
  .object({
    email: z.string().trim().email("Ingresá un email válido."),
    password: z
      .string()
      .min(8, "La contraseña debe tener al menos 8 caracteres.")
      .max(72, "Máximo 72 caracteres.")
      .regex(/[A-Za-z]/, "Incluí al menos una letra.")
      .regex(/[0-9]/, "Incluí al menos un número."),
    confirmPassword: z.string(),
    acceptTerms: z.string().refine((value) => value === "on", {
      message: "Tenés que aceptar las condiciones y la política de privacidad.",
    }),
    isAdult: z.string().refine((value) => value === "on", {
      message: "La solicitud de adhesión está disponible para mayores de 18 años.",
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Las contraseñas no coinciden.",
  });

const applicationSchema = z.object({
  clinicalReason: z.string().trim().min(2).max(2000),
  fullName: z.string().trim().min(2).max(120),
  age: z.coerce.number().int().min(18).max(120),
  dni: z.string().trim().regex(/^[0-9]{7,10}$/, "Ingresá un DNI válido, solo con números."),
  birthDate: z.string().date("Ingresá una fecha válida."),
  address: z.string().trim().min(3).max(200),
  locality: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  healthInsurance: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(6).max(30).regex(/^[+0-9() .-]+$/, "Ingresá un teléfono válido."),
});

const applicantStepSchema = z.object({
  step: z.coerce.number().int().min(1).max(6),
  completed: z.enum(["true", "false"]),
});

const reviewSchema = z.object({
  userId: z.string().uuid(),
  intent: z.enum(["approve", "reject"]),
  branchId: z.string().uuid().optional(),
});

function applicationError() {
  return {
    error:
      "No pudimos guardar la solicitud. Revisá los datos e intentá nuevamente.",
  };
}

export async function registerAdhesionAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = registrationSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    acceptTerms: formData.get("acceptTerms"),
    isAdult: formData.get("isAdult"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const headerStore = await headers();
  let origin = PORTAL_URL;
  const originHeader = headerStore.get("origin");
  if (originHeader) {
    try {
      const url = new URL(originHeader);
      if (url.protocol === "https:" || url.protocol === "http:") {
        origin = url.origin;
      }
    } catch {
      origin = PORTAL_URL;
    }
  }

  let result: AuthResponse;
  try {
    const supabase = await createClient();
    result = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        data: { account_type: "adhesion_applicant" },
        emailRedirectTo: new URL(
          "/auth/callback?next=/adhesion/recorrido",
          origin,
        ).toString(),
      },
    });
  } catch (error) {
    const errorType = error instanceof Error ? error.name : "Error desconocido";
    console.error(`[adhesion] No se pudo crear la cuenta: ${errorType}`);
    return {
      error: "No pudimos conectar con el servicio de registro. Intentá nuevamente.",
    };
  }

  if (result.error) {
    return {
      error: result.error.message.toLowerCase().includes("already registered")
        ? "Ese email ya tiene una cuenta. Probá iniciar sesión."
        : "No pudimos crear la cuenta. Revisá los datos e intentá nuevamente.",
    };
  }

  if (result.data.session) redirect("/adhesion/recorrido");
  return {
    message:
      "Cuenta creada. Confirmá tu email desde el enlace que te enviamos para comenzar el recorrido de adhesión.",
  };
}

export async function saveAdhesionDetailsAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const applicant = await requireApplicant();
  const user = await getCurrentUser();
  const parsed = applicationSchema.safeParse({
    clinicalReason: formData.get("clinicalReason"),
    fullName: formData.get("fullName"),
    age: formData.get("age"),
    dni: formData.get("dni"),
    birthDate: formData.get("birthDate"),
    address: formData.get("address"),
    locality: formData.get("locality"),
    email: formData.get("email"),
    healthInsurance: formData.get("healthInsurance"),
    phone: formData.get("phone"),
  });

  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  if (!user?.email || parsed.data.email.toLowerCase() !== user.email.toLowerCase()) {
    return { error: "El email debe coincidir con la cuenta con la que ingresaste." };
  }

  const birthDate = new Date(`${parsed.data.birthDate}T00:00:00Z`);
  const now = new Date();
  let calculatedAge = now.getUTCFullYear() - birthDate.getUTCFullYear();
  const birthdayHasPassed =
    now.getUTCMonth() > birthDate.getUTCMonth() ||
    (now.getUTCMonth() === birthDate.getUTCMonth() &&
      now.getUTCDate() >= birthDate.getUTCDate());
  if (!birthdayHasPassed) calculatedAge -= 1;
  if (birthDate.getTime() > now.getTime() || calculatedAge < 18) {
    return {
      error: "La solicitud de adhesión está disponible únicamente para mayores de 18 años.",
    };
  }
  if (calculatedAge !== parsed.data.age) {
    return { error: "La edad no coincide con la fecha de nacimiento." };
  }

  const supabase = await createClient();
  const { data: existing, error: existingError } = await supabase
    .from("adhesion_applications")
    .select("completed_steps")
    .eq("user_id", applicant.id)
    .maybeSingle();

  if (existingError) {
    console.error("[adhesion] No se pudo consultar la solicitud.", existingError.code);
    return applicationError();
  }

  const completedSteps = Array.from(
    new Set([1, ...((existing?.completed_steps as number[] | undefined) ?? [])]),
  ).sort((a, b) => a - b);
  const nextStep = [1, 2, 3, 4, 5, 6].find(
    (step) => !completedSteps.includes(step),
  );
  const { error } = await supabase.from("adhesion_applications").upsert(
    {
      user_id: applicant.id,
      clinical_reason: parsed.data.clinicalReason,
      full_name: parsed.data.fullName,
      age: parsed.data.age,
      dni: parsed.data.dni,
      birth_date: parsed.data.birthDate,
      address: parsed.data.address,
      locality: parsed.data.locality,
      email: user.email,
      health_insurance: parsed.data.healthInsurance,
      phone: parsed.data.phone,
      completed_steps: completedSteps,
      current_step: nextStep ?? 6,
    },
    { onConflict: "user_id" },
  );

  if (error) {
    console.error("[adhesion] No se pudo guardar la solicitud.", error.code);
    return applicationError();
  }

  revalidatePath("/adhesion/recorrido");
  revalidatePath("/admin/adhesiones");
  return { message: "Datos personales guardados de forma privada." };
}

export async function markAdhesionStepAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const applicant = await requireApplicant();
  const parsed = applicantStepSchema.safeParse({
    step: formData.get("step"),
    completed: formData.get("completed"),
  });
  if (!parsed.success) return { error: "Paso inválido." };

  const supabase = await createClient();
  const { data: application, error: readError } = await supabase
    .from("adhesion_applications")
    .select("completed_steps")
    .eq("user_id", applicant.id)
    .maybeSingle();
  if (readError) {
    console.error("[adhesion] No se pudo consultar el avance.", readError.code);
    return { error: "No pudimos actualizar el avance. Intentá nuevamente." };
  }
  if (!application) {
    return { error: "Primero completá y guardá tus datos personales." };
  }

  const completedSteps = new Set(application.completed_steps as number[]);
  if (parsed.data.completed === "true") {
    if (parsed.data.step > 1 && !completedSteps.has(parsed.data.step - 1)) {
      return { error: "Completá los pasos anteriores en orden." };
    }
    completedSteps.add(parsed.data.step);
  } else {
    for (let step = parsed.data.step; step <= 6; step += 1) {
      completedSteps.delete(step);
    }
  }

  const orderedSteps = [...completedSteps].sort((a, b) => a - b);
  const currentStep =
    [1, 2, 3, 4, 5, 6].find((step) => !completedSteps.has(step)) ?? 6;
  const { error } = await supabase
    .from("adhesion_applications")
    .update({ completed_steps: orderedSteps, current_step: currentStep })
    .eq("user_id", applicant.id);

  if (error) {
    console.error("[adhesion] No se pudo actualizar el avance.", error.code);
    return { error: "No pudimos actualizar el avance. Intentá nuevamente." };
  }

  revalidatePath("/adhesion/recorrido");
  revalidatePath("/admin/adhesiones");
  return { message: "Avance actualizado." };
}

export async function reviewAdhesionAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = reviewSchema.safeParse({
    userId: formData.get("userId"),
    intent: formData.get("intent"),
    branchId: formData.get("branchId") || undefined,
  });
  if (!parsed.success) return { error: "Revisá la solicitud y la sede seleccionada." };

  const supabase = await createClient();
  if (parsed.data.intent === "approve") {
    if (!parsed.data.branchId) return { error: "Elegí la sede antes de habilitar el portal." };

    const { data: application, error: applicationError } = await supabase
      .from("adhesion_applications")
      .select("completed_steps, full_name, phone")
      .eq("user_id", parsed.data.userId)
      .maybeSingle();
    if (applicationError) {
      console.error("[adhesion] No se pudo revisar el avance.", applicationError.code);
      return { error: "No pudimos verificar el avance de la solicitud." };
    }
    if (!application) return { error: "No encontramos los datos de esa solicitud." };
    if (![1, 2, 3, 4, 5, 6].every((step) =>
      (application?.completed_steps as number[] | undefined)?.includes(step),
    )) {
      return { error: "La persona todavía no completó todos los pasos." };
    }

    const { data: branch, error: branchError } = await supabase
      .from("branches")
      .select("id")
      .eq("id", parsed.data.branchId)
      .eq("active", true)
      .maybeSingle();
    if (branchError || !branch) {
      if (branchError) {
        console.error("[adhesion] No se pudo validar la sede.", branchError.code);
      }
      return { error: "La sede seleccionada no está disponible." };
    }

    const { data, error } = await supabase
      .from("profiles")
      .update({
        full_name: application.full_name,
        phone: application.phone,
        role: "patient",
        status: "approved",
        branch_id: branch.id,
        approved_at: new Date().toISOString(),
        approved_by: admin.id,
      })
      .eq("id", parsed.data.userId)
      .eq("role", "applicant")
      .select("id")
      .maybeSingle();

    if (error || !data) {
      if (error) console.error("[adhesion] No se pudo habilitar el portal.", error.code);
      return { error: "No pudimos habilitar el acceso. Verificá el perfil e intentá nuevamente." };
    }
  } else {
    const { data, error } = await supabase
      .from("profiles")
      .update({
        status: "rejected",
        approved_at: null,
        approved_by: null,
      })
      .eq("id", parsed.data.userId)
      .eq("role", "applicant")
      .select("id")
      .maybeSingle();

    if (error || !data) {
      if (error) console.error("[adhesion] No se pudo rechazar la solicitud.", error.code);
      return { error: "No pudimos actualizar la solicitud." };
    }
  }

  revalidatePath("/admin");
  revalidatePath("/admin/adhesiones");
  revalidatePath("/admin/perfiles");
  revalidatePath("/adhesion/recorrido");
  revalidatePath("/portal");
  return {
    message:
      parsed.data.intent === "approve"
        ? "Adhesión aprobada y acceso al portal habilitado."
        : "Solicitud marcada para revisión; la persona conserva acceso al recorrido y al chat.",
  };
}
