const configuredBasePath = process.env.NEXT_PUBLIC_LYCIUM_BASE_PATH ?? "/Lycium";
const basePath = configuredBasePath === "/" ? "" : configuredBasePath.replace(/\/$/, "");

/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath,
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    unoptimized: true,
  },
  async redirects() {
    const redirects = [
      {
        source: "/",
        destination: `${basePath || ""}/catalog`,
        permanent: false,
        basePath: false,
      },
    ];

    if (basePath) {
      redirects.push({
        source: "/",
        destination: "/catalog",
        permanent: false,
        basePath: true,
      });
    }

    return redirects;
  },
};

export default nextConfig;
