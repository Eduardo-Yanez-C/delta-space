"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCan } from "../../../lib/useCan";
import { createFvStudy, updateQuote } from "../../../lib/api";
import { EstudioFvForm } from "../EstudioFvForm";

export default function NuevoEstudioFvPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const canCreate = useCan("create", "fvStudy");
  const preselectedClientId = searchParams?.get("clientId") ?? undefined;
  const linkQuoteId = searchParams?.get("quoteId")?.trim() || undefined;

  if (typeof window !== "undefined" && !canCreate) {
    router.replace("/acceso-restringido");
    return null;
  }

  const linkQuoteToStudy = async (studyId: string) => {
    if (!linkQuoteId) return;
    try {
      await updateQuote(linkQuoteId, { sourceFvStudyId: studyId });
    } catch (e) {
      console.error(e);
      window.alert(
        "El estudio se creó, pero no se pudo vincular automáticamente a la cotización. Vincule el estudio desde el detalle de la cotización o el estudio.",
      );
    }
  };

  const handleSubmit = async (data: Parameters<typeof createFvStudy>[0]) => {
    const study = await createFvStudy(data);
    await linkQuoteToStudy(study.id);
    router.push(`/estudios-fv/${study.id}?success=created`);
  };

  const handleSubmitAndOpenDesign = async (data: Parameters<typeof createFvStudy>[0]) => {
    const study = await createFvStudy(data);
    await linkQuoteToStudy(study.id);
    router.push(`/estudios-fv/${study.id}/diseno-implantacion?returnTo=edit`);
  };

  return (
    <div className="max-w-4xl">
      <EstudioFvForm
        mode="create"
        preselectedClientId={preselectedClientId}
        onSubmit={handleSubmit}
        onSubmitAndOpenDesign={handleSubmitAndOpenDesign}
      />
    </div>
  );
}
