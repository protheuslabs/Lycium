import type { MetadataRoute } from "next";

const siteRoot = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://protheuslabs.github.io/Lycium").replace(/\/$/, "");
const basePath = (process.env.NEXT_PUBLIC_LYCIUM_BASE_PATH ?? "/Lycium").replace(/\/$/, "");

export default function robots(): MetadataRoute.Robots {
  const root = siteRoot.endsWith(basePath) ? siteRoot : `${siteRoot}${basePath}`;
  return { rules: [{ userAgent: "*", allow: "/" }], sitemap: `${root}/sitemap.xml` };
}
