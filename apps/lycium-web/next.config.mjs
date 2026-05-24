const configuredBasePath = process.env.NEXT_PUBLIC_LYCIUM_BASE_PATH ?? "/Lycium";
const basePath = configuredBasePath === "/" ? "" : configuredBasePath.replace(/\/$/, "");

/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath,
  reactStrictMode: true,
  poweredByHeader: false,
  outputFileTracingRoot: new URL("../..", import.meta.url).pathname,
  images: {
    unoptimized: true,
  },
  async redirects() {
    return [
      {
        source: "/",
        destination: "/catalog",
        permanent: false,
        basePath: false,
      },
    ];
  },
};

export default nextConfig;
