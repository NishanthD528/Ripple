import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://ripple-hq.netlify.app"
  ),
  title: {
    default: "Ripple — Supply chain risk alerts for small manufacturers",
    template: "%s — Ripple",
  },
  description:
    "Know about tariff changes, weather, and supplier disruptions before they cost you. Plain-English alerts for small US manufacturers.",
  openGraph: {
    title: "Ripple — Supply chain risk alerts",
    description:
      "Know about supply chain problems before they cost you. Tariff, weather, and news alerts for your specific suppliers.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
