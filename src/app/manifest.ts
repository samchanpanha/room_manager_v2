import type { MetadataRoute } from "next";

/// §M25 "mobile-first web/PWA" — installable manifest for the tenant portal.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RentManager Resident",
    short_name: "Resident",
    description: "Tenant self-service: rent, requests, documents",
    start_url: "/portal",
    display: "standalone",
    background_color: "#0b0b0c",
    theme_color: "#0b0b0c"
  };
}
