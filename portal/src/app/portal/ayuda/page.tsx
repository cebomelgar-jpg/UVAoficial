import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { PatientSupportChat } from "@/components/support/encrypted-support-chat";
import { requireProfile } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Ayuda y chat",
};

export default async function PatientSupportPage({
  searchParams,
}: {
  searchParams: Promise<{ producto?: string }>;
}) {
  const profile = await requireProfile();
  const params = await searchParams;
  const productName = params.producto?.trim().slice(0, 80) || undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Atención"
        title="Ayuda y chat"
        description="Contactá al administrador desde una conversación privada y temporal."
      />
      <PatientSupportChat userId={profile.id} requestProduct={productName} />
    </div>
  );
}
