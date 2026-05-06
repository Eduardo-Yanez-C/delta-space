import React from "react";
import { AuthProvider } from "../lib/auth-context";
import { ThemeProvider } from "../lib/theme-context";
import { AuthGuard } from "../components/layout/AuthGuard";
import "./globals.css";

export const metadata = {
  title: "DELTA SPACE",
  description: "DELTA SPACE — plataforma profesional (cotización FV, logística, suite operativa). Asistente: SAM.",
};

const themeScript = `
(function() {
  var t = localStorage.getItem('theme');
  if (t === 'dark') document.documentElement.classList.add('dark');
  else document.documentElement.classList.remove('dark');
  try {
    var g = localStorage.getItem('pfv_accent_palette_v1_guest');
    var allowed = {'dorado-metal':1,'naranjo-metal':1,'rojo-metal':1,'azul-metal':1,'celeste-metal':1,'verde-metal':1,'gris-metal':1,'azul-klein':1,'cromatico-atardecer':1,'cromatico-brisa':1,'complementario-ambar-indigo':1};
    var id = (g && allowed[g]) ? g : 'dorado-metal';
    document.documentElement.setAttribute('data-accent-palette', id);
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <AuthProvider>
          <ThemeProvider>
            <AuthGuard>{children}</AuthGuard>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

