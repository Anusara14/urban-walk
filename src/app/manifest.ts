import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "URBAN WALK",
    short_name: "Urban Walk",
    description: "Don't just walk through the city. Understand the city.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#141518",
    theme_color: "#141518",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      // the square home-screen logo; its glyph sits inside the maskable safe zone, so one file serves both
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/brand/urban-walk-app-icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
