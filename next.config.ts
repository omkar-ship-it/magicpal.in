import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Brain-Mate's share images read their fonts from disk at request time
   * (lib/brainMate/cards). Listed explicitly so the deploy always ships them
   * with the routes that draw cards, rather than trusting the tracer to
   * follow a `process.cwd()` join.
   */
  outputFileTracingIncludes: {
    "/brain-mate/**": ["./assets/brain-mate/*.woff"],
    "/api/brain-mate/card": ["./assets/brain-mate/*.woff"],
  },
};

export default nextConfig;
