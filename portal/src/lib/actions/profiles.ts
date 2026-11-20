"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";
import type { ActionState } from "@/lib/types";

const profileIdSchema = z.string().uuid();
const passwordSchema = z
  .string()
  .min(8, "La contraseña debe tener al menos 8 caracteres.")
  .max(72, "Máximo 72 caracteres.")
  .regex(/[A-Za-z]/, "Incluí al menos una letra.")
  .regex(/[0-9]/, "Incluí al menos un número.");

const adminProfileSchema = z.object({
  profileId: profileIdSchema,
  fullName: z.string().trim().min(2, "Ingresá el nombre completo.").max(80),
  phone: z.string().trim().min(6, "Ingresá un teléfono válido.").max(30),
  branchId: z.string().uuid("Elegí una sede válida."),
});

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

export async function updateAdminPatientProfileAction(
  input: z.input<typeof adminProfileSchema>,
): Promise<ActionState> {
  await requireAdmin();
  const parsed = adminProfileSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisá los datos del perfil." };
  }

  const supabase = await createClient();
  const { data: branch, error: branchError } = await supabase
    .from("branches")
    .select("id")
    .eq("id", parsed.data.branchId)
    .eq("active", true)
    .maybeSingle();

  if (branchError) {
    console.error("[profiles] No pudimos validar la sede.", branchError.message);
    return { error: "No pudimos validar la sede seleccionada." };
  }
  if (!branch) return { error: "La sede seleccionada no está disponible." };

  const { data, error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.fullName,
      phone: parsed.data.phone,
      branch_id: parsed.data.branchId,
    })
    .eq("id", parsed.data.profileId)
    .eq("role", "patient")
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[profiles] No pudimos corregir los datos.", error.message);
    return { error: "No pudimos actualizar el perfil. Intentá nuevamente." };
  }
  if (!data) return { error: "No encontramos un perfil de paciente para actualizar." };

  revalidatePath("/admin");
  revalidatePath("/admin/perfiles");
  return { message: "Datos del perfil actualizados." };
}

export async function changePatientPasswordAction(
  profileId: string,
  password: string,
): Promise<ActionState> {
  await requireAdmin();
  const parsedId = profileIdSchema.safeParse(profileId);
  if (!parsedId.success) return { error: "Perfil inválido." };

  const parsedPassword = passwordSchema.safeParse(password);
  if (!parsedPassword.success) {
    return { error: parsedPassword.error.issues[0]?.message ?? "Contraseña inválida." };
  }

  try {
    const adminClient = createAdminClient();
    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("id, role")
      .eq("id", parsedId.data)
      .maybeSingle();

    if (profileError) {
      console.error("[profiles] No pudimos verificar el usuario.", profileError.message);
      return { error: "No pudimos verificar la cuenta." };
    }
    if (!profile || profile.role !== "patient") {
      return { error: "Solo se pueden restablecer contraseñas de pacientes." };
    }

    const { error } = await adminClient.auth.admin.updateUserById(profile.id, {
      password: parsedPassword.data,
    });

    if (error) {
      console.error("[profiles] Supabase no pudo actualizar la contraseña.", error.message);
      return { error: "Supabase no pudo actualizar la contraseña." };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    console.error(`[profiles] No pudimos restablecer la contraseña: ${message}`);
    return {
      error:
        "No pudimos restablecer la contraseña. Verificá la clave administrativa del servidor.",
    };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/perfiles");
  return { message: "Contraseña restablecida." };
}
