const configuredBasePath = process.env.NEXT_PUBLIC_LYCIUM_BASE_PATH ?? "/Lycium";
const basePath = configuredBasePath === "/" ? "" : configuredBasePath.replace(/\/$/, "");
const staticExport = process.env.NEXT_OUTPUT === "export";

/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath,
  output: staticExport ? "export" : undefined,
  trailingSlash: staticExport ? true : undefined,
  typedRoutes: false,
  reactStrictMode: true,
  poweredByHeader: false,
  outputFileTracingRoot: new URL("../..", import.meta.url).pathname,
  images: {
    unoptimized: true,
  },
  async redirects() {
    if (staticExport) {
      return [];
    }

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
