import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Deployment target: Vercel (no custom output needed).
     NOTE: "output: standalone" must NOT be set — it breaks Vercel builds. */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // libSQL ships native bindings — must stay external in the server bundle
  // (otherwise the Vercel build can break the .node binaries).
  serverExternalPackages: ["@libsql/client", "@prisma/adapter-libsql"],
};

export default nextConfig;
