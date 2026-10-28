const base = process.env.NEXT_PUBLIC_BASE_PATH || undefined; // e.g. "/for-ai" when mounted under 1claw.co
export default {
  basePath: base,
  async redirects() { return base ? [{ source: "/", destination: base, permanent: false, basePath: false }] : []; },
};
