import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Volleyball Weather",
    short_name: "VB Weather",
    description:
      "Stoplight calendar of ideal outdoor volleyball weather for the next ~16 days.",
    start_url: "/",
    display: "standalone",
    background_color: "#0b1026",
    theme_color: "#2a8fe0",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
