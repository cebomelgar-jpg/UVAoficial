import type { Metadata } from "next";
import { MessageCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { AdminSupportChats } from "@/components/support/encrypted-support-chat";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { SupportConversation } from "@/lib/types";

export const metadata: Metadata = {
  title: "Chats de pacientes",
};

export default async function AdminSupportMessagesPage() {
  const admin = await requireAdmin();
  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("support_conversations")
    .select("id, patient_id, admin_id, created_at, last_activity_at, expires_at")
    .eq("admin_id", admin.id)
    .gt("expires_at", new Date().toISOString())
    .order("last_activity_at", { ascending: false });

  if (error) {
    console.error("[admin/support] No se pudieron cargar los chats.", error.message);
    throw new Error("No pudimos cargar los chats de soporte.");
  }

  const conversations = (rows ?? []) as SupportConversation[];
  const patientIds = [...new Set(conversations.map((conversation) => conversation.patient_id))];
  const { data: profiles, error: profilesError } = patientIds.length
    ? await supabase
        .from("profiles")
        .select("id, full_name, email, phone")
        .in("id", patientIds)
    : { data: [], error: null };

  if (profilesError) {
    console.error("[admin/support] No se pudieron cargar los datos de pacientes.", profilesError.message);
    throw new Error("No pudimos cargar los datos de los pacientes.");
  }

  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  const withPatients = conversations.map((conversation) => ({
    ...conversation,
    patient: profileById.get(conversation.patient_id) ?? null,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Atención interna"
        title="Chats de pacientes"
        description="Respondé en tiempo real. Los mensajes están cifrados de extremo a extremo y se borran tras 60 minutos sin actividad."
      />
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-relaxed text-amber-900">
        <p className="flex items-center gap-2 font-semibold">
          <MessageCircle className="size-4" />
          Clave privada de este dispositivo
        </p>
        <p className="mt-1">
          La clave de descifrado se guarda únicamente en el almacenamiento seguro
          de este navegador. Usá siempre este dispositivo y no borres los datos
          del sitio; el servidor no conserva una copia recuperable.
        </p>
      </div>
      <AdminSupportChats userId={admin.id} conversations={withPatients} />
    </div>
  );
}
