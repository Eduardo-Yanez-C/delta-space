/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Solo para build de escritorio: standalone (no afecta build web)
  ...(process.env.BUILD_DESKTOP === "1" && { output: "standalone" }),
  // Rewrite /api/* al backend: en dev no se usa porque lib/api.ts apunta directo a localhost:4000.
  // Si en producción se sirve todo desde el mismo origen y API en /api, este rewrite puede servir.
  // Nota: en el build de Next la destination puede quedar undefined; por eso el frontend no depende de esto en dev.
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (apiUrl && apiUrl !== "" && !apiUrl.startsWith("/")) return [];
    return [
      { source: "/api/:path*", destination: "http://localhost:4000/api/:path*" },
    ];
  },
};

export default nextConfig;
