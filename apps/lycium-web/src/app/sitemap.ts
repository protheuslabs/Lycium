import type { MetadataRoute } from "next";

const siteRoot = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://protheuslabs.github.io/Lycium").replace(/\/$/, "");
const basePath = (process.env.NEXT_PUBLIC_LYCIUM_BASE_PATH ?? "/Lycium").replace(/\/$/, "");
const root = siteRoot.endsWith(basePath) ? siteRoot : `${siteRoot}${basePath}`;

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${root}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${root}/tools`, lastModified: now, changeFrequency: "monthly", priority: .8 },
    { url: `${root}/tools/graph`, lastModified: now, changeFrequency: "monthly", priority: .9 },
    { url: `${root}/tools/flashcards`, lastModified: now, changeFrequency: "monthly", priority: .7 },
    { url: `${root}/catalog`, lastModified: now, changeFrequency: "weekly", priority: .8 },
    { url: `${root}/catalog/courses`, lastModified: now, changeFrequency: "weekly", priority: .8 },
  ];
}
