"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { firstZodError, loginSchema, profileSchema } from "@/lib/validation";
import type { ActionState } from "@/lib/types";
import type { AuthTokenResponsePassword } from "@supabase/supabase-js";
import { safeNext } from "@/lib/safe-redirect";
import { z } from "zod";

function logAuthError(context: string, error: unknown) {
  const message = error instanceof Error ? error.message : "Error desconocido";
  console.error(`[auth] ${context}: ${message}`);
}

export async function loginAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: firstZodError(parsed.error) };
  }

  let signInResult: AuthTokenResponsePassword;

  try {
    const supabase = await createClient();
    signInResult = await supabase.auth.signInWithPassword(parsed.data);
  } catch (error) {
    logAuthError("No se pudo iniciar sesión", error);
    return {
      error:
        "No pudimos conectar con el servicio de acceso. Esperá unos segundos y volvé a intentar.",
    };
  }

  const { error } = signInResult;

  if (error) {
    if (error.message.toLowerCase().includes("email not confirmed")) {
      return {
        error:
          "Tu email todavía no está confirmado. Revisá el enlace que recibiste o enviá una solicitud interna de ayuda.",
      };
    }
    return { error: "Email o contraseña incorrectos." };
  }

  redirect(safeNext(formData.get("next")));
}

export async function registerAction(
  previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  void previousState;
  void formData;
  redirect("/registro");
}

const existingPatientSchema = z
  .object({
    email: z.string().trim().email("Ingresá un email válido."),
    password: z
      .string()
      .min(8, "La contraseña debe tener al menos 8 caracteres.")
      .max(72, "Máximo 72 caracteres.")
      .regex(/[A-Za-z]/, "Incluí al menos una letra.")
      .regex(/[0-9]/, "Incluí al menos un número."),
    confirmPassword: z.string(),
    fullName: z.string().trim().min(2, "Ingresá tu nombre completo.").max(80),
    phone: z.string().trim().min(6, "Ingresá un teléfono válido.").max(30),
    branchId: z.string().uuid("Elegí una sede."),
    acceptTerms: z.string().refine((value) => value === "on", {
      message: "Tenés que aceptar las condiciones y la política de privacidad.",
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Las contraseñas no coinciden.",
  });

export async function registerExistingPatientAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = existingPatientSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    fullName: formData.get("fullName"),
    phone: formData.get("phone"),
    branchId: formData.get("branchId"),
    acceptTerms: formData.get("acceptTerms"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message };
  }

  try {
    const supabase = await createClient();
    const { data: branch, error: branchError } = await supabase
      .from("branches")
      .select("id")
      .eq("id", parsed.data.branchId)
      .eq("active", true)
      .maybeSingle();
    if (branchError || !branch) {
      return { error: "La sede seleccionada no está disponible." };
    }

    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        data: {
          account_type: "existing_patient",
          full_name: parsed.data.fullName,
          phone: parsed.data.phone,
          branch_id: branch.id,
        },
        emailRedirectTo: new URL(
          "/auth/callback?next=/pendiente",
          process.env.NEXT_PUBLIC_PORTAL_URL ?? "https://uva-oficial.vercel.app",
        ).toString(),
      },
    });

    if (error) {
      return {
        error: error.message.toLowerCase().includes("already registered")
          ? "Ese email ya tiene una cuenta. Probá iniciar sesión."
          : "No pudimos crear la cuenta. Revisá los datos e intentá nuevamente.",
      };
    }

    if (data.session) redirect("/pendiente");
  } catch (error) {
    logAuthError("No se pudo crear la cuenta de paciente existente", error);
    return {
      error: "No pudimos crear la cuenta. Intentá nuevamente en unos minutos.",
    };
  }

  return {
    message:
      "Registramos tu cuenta de paciente. Confirmá el email y el administrador revisará tu acceso.",
  };
}

export async function signOutAction() {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch (error) {
    logAuthError("No se pudo cerrar la sesión remota", error);
  }

  redirect("/login");
}

export async function updateProfileAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const profile = await requireProfile();
  const parsed = profileSchema.safeParse({
    fullName: formData.get("fullName"),
    phone: formData.get("phone"),
    branchId: formData.get("branchId"),
  });

  if (!parsed.success) {
    return { error: firstZodError(parsed.error) };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.fullName,
      phone: parsed.data.phone,
      branch_id: parsed.data.branchId,
    })
    .eq("id", profile.id);

  if (error) {
    return { error: "No pudimos actualizar tus datos. Intentá nuevamente." };
  }

  revalidatePath("/portal", "layout");
  revalidatePath("/portal/perfil");
  revalidatePath("/portal/catalogo");
  revalidatePath("/portal/carrito");
  revalidatePath("/portal/checkout");
  return { message: "Tus datos se actualizaron correctamente." };
}
