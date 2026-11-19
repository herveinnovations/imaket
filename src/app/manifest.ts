import type { MetadataRoute } from "next";

/** Makes iMaket installable as an app (Chrome/Edge on computers, Android, iPhone "Add to Home Screen"). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "iMaket",
    short_name: "iMaket",
    description: "Shop from independent creators and open your own store.",
    start_url: "/?source=app",
    scope: "/",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: "#2DD4BF",
    categories: ["shopping", "lifestyle"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Shop all products", url: "/marketplace", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "My account", url: "/dashboard", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
