"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import {
  decryptPassword,
  encryptPassword,
  isCredentialStorageConfigured,
} from "@/lib/credentials";
import type { ActionState } from "@/lib/types";

const profileIdSchema = z.string().uuid();

const passwordSchema = z
  .string()
  .min(8, "La contraseña debe tener al menos 8 caracteres.")
  .max(72, "Máximo 72 caracteres.")
  .refine((value) => /[A-Za-z]/.test(value), "Incluí al menos una letra.")
  .refine((value) => /[0-9]/.test(value), "Incluí al menos un número.");

export async function updateProfileStatusAction(
  profileId: string,
  status: "approved" | "rejected" | "suspended",
): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsedId = profileIdSchema.safeParse(profileId);
  if (!parsedId.success) return { error: "Perfil inválido." };

  if (parsedId.data === admin.id && status !== "approved") {
    return { error: "No podés suspender o rechazar tu propia cuenta." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      status,
      approved_at: status === "approved" ? new Date().toISOString() : null,
      approved_by: status === "approved" ? admin.id : null,
    })
    .eq("id", parsedId.data);

  if (error) {
    console.error("[profiles] No pudimos actualizar el estado.", error.message);
    return { error: "No pudimos actualizar el estado de la cuenta." };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/perfiles");
  revalidatePath("/pendiente");
  return {
    message:
      status === "approved"
        ? "Cuenta habilitada."
        : status === "rejected"
          ? "Cuenta rechazada."
          : "Cuenta suspendida.",
  };
}

export async function getProfilePasswordAction(
  profileId: string,
): Promise<{ password?: string; error?: string }> {
  await requireAdmin();
  const parsedId = profileIdSchema.safeParse(profileId);
  if (!parsedId.success) return { error: "Perfil inválido." };

  if (!isCredentialStorageConfigured()) {
    return {
      error:
        "Falta configurar CREDENTIALS_ENCRYPTION_KEY (o SUPABASE_SERVICE_ROLE_KEY) para descifrar contraseñas.",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profile_credentials")
    .select("password_ciphertext")
    .eq("profile_id", parsedId.data)
    .maybeSingle();

  if (error) {
    console.error("[profiles] No pudimos leer la credencial.", error.message);
    return { error: "No pudimos leer la contraseña." };
  }

  if (!data?.password_ciphertext) {
    return {
      error:
        "No hay una contraseña guardada para este perfil. Restablecela para empezar a verla.",
    };
  }

  const password = decryptPassword(data.password_ciphertext);
  if (!password) {
    return {
      error:
        "No pudimos descifrar la contraseña. Revisá la clave de cifrado del servidor.",
    };
  }

  return { password };
}

export async function changeProfilePasswordAction(
  profileId: string,
  password: string,
): Promise<{ password?: string; error?: string; message?: string }> {
  const admin = await requireAdmin();
  const parsedId = profileIdSchema.safeParse(profileId);
  if (!parsedId.success) return { error: "Perfil inválido." };

  const parsedPassword = passwordSchema.safeParse(password);
  if (!parsedPassword.success) return { error: parsedPassword.error.issues[0]?.message };

  if (!isAdminClientConfigured()) {
    return {
      error:
        "Falta SUPABASE_SERVICE_ROLE_KEY en el servidor para cambiar contraseñas de otros usuarios.",
    };
  }
  if (!isCredentialStorageConfigured()) {
    return {
      error:
        "Falta CREDENTIALS_ENCRYPTION_KEY (o SUPABASE_SERVICE_ROLE_KEY) para guardar la contraseña.",
    };
  }

  const adminClient = createAdminClient();
  const { error: authError } = await adminClient.auth.admin.updateUserById(
    parsedId.data,
    { password: parsedPassword.data },
  );

  if (authError) {
    console.error("[profiles] No se pudo actualizar la contraseña en Auth.", authError.message);
    return { error: "No pudimos actualizar la contraseña en Supabase Auth." };
  }

  const { error: dbError } = await adminClient
    .from("profile_credentials")
    .upsert(
      {
        profile_id: parsedId.data,
        password_ciphertext: encryptPassword(parsedPassword.data),
        updated_at: new Date().toISOString(),
        updated_by: admin.id,
      },
      { onConflict: "profile_id" },
    );

  if (dbError) {
    console.error("[profiles] No pudimos guardar la credencial.", dbError.message);
    return {
      password: parsedPassword.data,
      error:
        "La contraseña se cambió, pero no pudimos guardarla para mostrarla. Guardála manualmente.",
    };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/perfiles");
  return { password: parsedPassword.data, message: "Contraseña actualizada." };
}
