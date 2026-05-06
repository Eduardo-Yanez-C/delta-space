import { redirect } from "next/navigation";

/** Ruta histórica: las preferencias viven bajo Administración. */
export default function PreferenciasLegacyRedirectPage() {
  redirect("/admin/preferencias/ortografia");
}
