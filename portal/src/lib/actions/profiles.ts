"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import type { ActionState } from "@/lib/types";

const profileIdSchema = z.string().uuid();

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
