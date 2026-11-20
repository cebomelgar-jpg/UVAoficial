"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import { encryptPassword, isCredentialStorageConfigured } from "@/lib/credentials";
import {
  firstZodError,
  loginSchema,
  profileSchema,
  registerSchema,
} from "@/lib/validation";
import type { ActionState } from "@/lib/types";
import type { AuthResponse, AuthTokenResponsePassword } from "@supabase/supabase-js";
import { PORTAL_URL } from "@/lib/config";
import { safeNext } from "@/lib/safe-redirect";

function resolveOrigin(originHeader: string | null) {
  if (originHeader) {
    try {
      const url = new URL(originHeader);
      if (url.protocol === "https:" || url.protocol === "http:") {
        return url.origin;
      }
    } catch {
      // El header no es una URL válida; usamos la URL pública configurada.
    }
  }

  return PORTAL_URL;
}

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
          "Tu email todavía no está confirmado. Revisá tu bandeja de entrada o escribinos por WhatsApp para recibir un nuevo enlace.",
      };
    }
    return { error: "Email o contraseña incorrectos." };
  }

  redirect(safeNext(formData.get("next")));
}

async function storeInitialPassword(userId: string, password: string) {
  if (!isAdminClientConfigured()) {
    console.warn(
      "[auth] SUPABASE_SERVICE_ROLE_KEY no configurado; no se pudo guardar la contraseña cifrada.",
    );
    return;
  }
  if (!isCredentialStorageConfigured()) {
    console.warn(
      "[auth] No hay clave de cifrado; no se pudo guardar la contraseña cifrada.",
    );
    return;
  }
  try {
    const adminClient = createAdminClient();
    const { error } = await adminClient.from("profile_credentials").upsert(
      {
        profile_id: userId,
        password_ciphertext: encryptPassword(password),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "profile_id" },
    );
    if (error) {
      console.error("[auth] No se pudo guardar la contraseña cifrada.", error.message);
    }
  } catch (error) {
    console.error("[auth] Error al guardar la contraseña cifrada.", error);
  }
}

export async function registerAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = registerSchema.safeParse({
    fullName: formData.get("fullName"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    branchId: formData.get("branchId"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    acceptTerms: formData.get("acceptTerms"),
    isAdult: formData.get("isAdult"),
  });

  if (!parsed.success) {
    return { error: firstZodError(parsed.error) };
  }

  const headerStore = await headers();
  const origin = resolveOrigin(headerStore.get("origin"));

  let signUpResult: AuthResponse;

  try {
    const supabase = await createClient();
    signUpResult = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        data: {
          full_name: parsed.data.fullName,
          phone: parsed.data.phone,
          branch_id: parsed.data.branchId,
        },
        emailRedirectTo: new URL("/auth/callback?next=/portal", origin).toString(),
      },
    });
  } catch (error) {
    logAuthError("No se pudo registrar la cuenta", error);
    return {
      error:
        "No pudimos conectar con el servicio de registro. Esperá unos segundos y volvé a intentar.",
    };
  }

  const { data, error } = signUpResult;

  if (error) {
    if (error.message.toLowerCase().includes("already registered")) {
      return {
        error:
          "Ese email ya tiene una cuenta. Probá iniciar sesión o escribinos por WhatsApp para recuperar el acceso.",
      };
    }
    return {
      error:
        "No pudimos crear la cuenta. Revisá los datos e intentá nuevamente.",
    };
  }

  const isNewUser = Boolean(data.user) && (data.user?.identities?.length ?? 0) > 0;
  if (isNewUser && data.user) {
    await storeInitialPassword(data.user.id, parsed.data.password);
  }

  if (data.session) {
    redirect("/portal");
  }

  return {
    message:
      "Cuenta creada. Te enviamos un email para confirmar tu dirección. Revisá también la carpeta de spam.",
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
