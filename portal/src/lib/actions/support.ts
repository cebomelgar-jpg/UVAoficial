"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";

const requestSchema = z.object({
  requestType: z.enum(["password", "privacy", "general"]),
  fullName: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().min(6).max(30).regex(/^[+0-9() .-]+$/),
});

const requestIdSchema = z.string().uuid();

export async function submitSupportContactRequestAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = requestSchema.safeParse({
    requestType: formData.get("requestType"),
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisá los datos ingresados." };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("submit_support_contact_request", {
      p_request_type: parsed.data.requestType,
      p_full_name: parsed.data.fullName,
      p_email: parsed.data.email,
      p_phone: parsed.data.phone,
    });

    if (error) {
      console.error("[support] No se pudo enviar la solicitud interna.", error.message);
      return {
        error: error.message.includes("reciente")
          ? "Ya recibimos una solicitud reciente para ese email. Esperá unos minutos antes de volver a enviarla."
          : "No pudimos registrar la solicitud. Revisá los datos e intentá nuevamente.",
      };
    }
  } catch (error) {
    console.error("[support] Error al enviar la solicitud interna.", error);
    return { error: "No pudimos conectar con soporte. Intentá nuevamente en unos minutos." };
  }

  return {
    message:
      "Recibimos tu solicitud. El equipo la verá desde el panel; no se envió ningún email.",
  };
}

export async function updateSupportRequestStatusAction(
  requestId: string,
  status: "pending" | "handled",
): Promise<ActionState> {
  await requireAdmin();
  const parsedId = requestIdSchema.safeParse(requestId);
  if (!parsedId.success) return { error: "Solicitud inválida." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("support_contact_requests")
    .update({ status })
    .eq("id", parsedId.data);

  if (error) {
    console.error("[support] No se pudo actualizar la solicitud.", error.message);
    return { error: "No pudimos actualizar la solicitud." };
  }

  revalidatePath("/admin/solicitudes");
  return { message: status === "handled" ? "Solicitud atendida." : "Solicitud reabierta." };
}

export async function deleteSupportRequestAction(
  requestId: string,
): Promise<ActionState> {
  await requireAdmin();
  const parsedId = requestIdSchema.safeParse(requestId);
  if (!parsedId.success) return { error: "Solicitud inválida." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("support_contact_requests")
    .delete()
    .eq("id", parsedId.data);

  if (error) {
    console.error("[support] No se pudo eliminar la solicitud.", error.message);
    return { error: "No pudimos eliminar la solicitud." };
  }

  revalidatePath("/admin/solicitudes");
  return { message: "Solicitud eliminada." };
}
