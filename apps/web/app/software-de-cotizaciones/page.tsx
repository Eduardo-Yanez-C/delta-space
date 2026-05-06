import { redirect } from "next/navigation";

/** La entrada «Ventas» del menú y los accesos viven en el desplegable lateral; la URL del hub redirige al panel. */
export default function SoftwareDeCotizacionesHubPage() {
  redirect("/software-de-cotizaciones/panel-de-ventas");
}
