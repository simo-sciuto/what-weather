import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prerendered shell plus "use cache": the weather for a place is worked out once per forecast, not per visit.
  cacheComponents: true,
  // A package-lock.json in the home folder would otherwise be taken for the workspace root.
  turbopack: { root: __dirname },
  // The atlas is the site (ADR-030): the old addresses land on it, with their query (lat, lon, t, strato)
  async redirects() {
    return [
      { source: "/atlas", destination: "/", permanent: false },
      { source: "/crea", destination: "/", permanent: false },
    ];
  },
};

export default nextConfig;
