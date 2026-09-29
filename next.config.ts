import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prerendered shell plus "use cache": the weather for a place is worked out once per forecast, not per visit.
  cacheComponents: true,
  // A package-lock.json in the home folder would otherwise be taken for the workspace root.
  turbopack: { root: __dirname },
};

export default nextConfig;
