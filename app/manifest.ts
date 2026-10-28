import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cheese Pay", short_name: "Cheese Pay", description: "Tip anyone on X in USDC. Powered by 1Claw.",
    start_url: "/setup", scope: "/", display: "standalone", orientation: "portrait",
    background_color: "#FFF7DB", theme_color: "#FFC72C", categories: ["finance"],
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
