import { redirect } from "next/navigation";

/** Inicio redirige al panel de ventas del módulo Ventas (dashboard que antes estaba aquí). */
export default function HomeRedirectPage() {
  redirect("/software-de-cotizaciones/panel-de-ventas");
}
