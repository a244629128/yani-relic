/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV !== "production";

// Strict, opinionated CSP. Next/font + Google Fonts need fonts.googleapis.com and fonts.gstatic.com.
// In dev, Next.js needs 'unsafe-eval' for HMR/RSC; we relax only in dev.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https://images.unsplash.com https://*.supabase.co",
  "media-src 'self' https://www.tiktok.com https://*.supabase.co",
  // Browser uploads files directly to Supabase Storage via signed URLs.
  "connect-src 'self' https://*.supabase.co" + (isDev ? " ws: http: https:" : ""),
  "frame-src https://www.tiktok.com https://www.depop.com",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      // Supabase Storage public URLs (e.g. https://<project>.supabase.co/storage/v1/object/public/relics/...)
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
  // Stop Next/webpack from picking up Playwright screenshots as file changes.
  webpack: (config) => {
    config.watchOptions = {
      ...(config.watchOptions || {}),
      ignored: [
        "**/node_modules/**",
        "**/.git/**",
        "**/.next/**",
        "**/.playwright-mcp/**",
        "**/*.png",
      ],
    };
    return config;
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
