"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { firstZodError, loginSchema, profileSchema } from "@/lib/validation";
import type { ActionState } from "@/lib/types";
import type { AuthTokenResponsePassword } from "@supabase/supabase-js";
import { safeNext } from "@/lib/safe-redirect";

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
  redirect("/adhesion/registro");
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
