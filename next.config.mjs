/** Served at 1claw.co/for-ai (rewrite from the main site). */
export default {
  basePath: "/for-ai",
  async redirects() { return [{ source: "/", destination: "/for-ai", permanent: false, basePath: false }]; },
};
