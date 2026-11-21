import { AppShell } from "@/components/layout/app-shell";
import { AdminSupportRealtime } from "@/components/admin/admin-support-realtime";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireAdmin();
  const supabase = await createClient();
  const [{ count: chatCount, error: chatError }, { count: requestCount, error: requestError }] =
    await Promise.all([
      supabase
        .from("support_conversations")
        .select("id", { count: "exact", head: true })
        .eq("admin_id", profile.id)
        .gt("expires_at", new Date().toISOString()),
      supabase
        .from("support_contact_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
    ]);

  if (chatError || requestError) {
    console.error(
      "[admin/layout] No se pudieron cargar los contadores de soporte.",
      chatError?.message ?? requestError?.message,
    );
    throw new Error("No pudimos cargar el resumen de atención.");
  }

  return (
    <AppShell
      profile={profile}
      mode="admin"
      supportCounts={{ chats: chatCount ?? 0, requests: requestCount ?? 0 }}
    >
      <AdminSupportRealtime />
      {children}
    </AppShell>
  );
}
