const base = process.env.NEXT_PUBLIC_BASE_PATH || undefined; // e.g. "/for-ai" when mounted under 1claw.co

// The wallet popup and Base RPC are the only third parties the browser talks to.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'", // Next.js inlines its bootstrap scripts
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self' https://mainnet.base.org https://*.base.org https://*.coinbase.com wss://*.coinbase.com",
  "frame-src https://keys.coinbase.com https://*.coinbase.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const security = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), publickey-credentials-create=(self), publickey-credentials-get=(self)" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" }, // the passkey wallet opens a popup
];
const noStore = [{ key: "Cache-Control", value: "no-store, max-age=0" }];

export default {
  basePath: base,
  poweredByHeader: false,
  async redirects() { return base ? [{ source: "/", destination: base, permanent: false, basePath: false }] : []; },
  async headers() {
    return [
      { source: "/:path*", headers: security },
      { source: "/setup", headers: noStore },
      { source: "/api/:path*", headers: noStore },
    ];
  },
};
