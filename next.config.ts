import type { NextConfig } from "next";
import { templatePaths } from "./lib/template";

const nextConfig: NextConfig = {
  images: {
    // Only OAuth avatars are loaded from remote hosts
    remotePatterns: [
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "*.googleusercontent.com",
        pathname: "/**",
      },
    ],
  },
  // /api/template/[id] reads the starter folders at runtime with a dynamic path,
  // so they must be bundled with that function explicitly (serverless/Vercel)
  outputFileTracingIncludes: {
    "/api/template/[id]": Object.values(templatePaths).map(
      (templatePath) => `.${templatePath}/**/*`
    ),
  },
  async headers() {
    return [
      {
        // WebContainers need cross-origin isolation (SharedArrayBuffer)
        source: '/:path*',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp',
          },
        ],
      },
    ];
  },
  reactStrictMode:false
};

export default nextConfig;
