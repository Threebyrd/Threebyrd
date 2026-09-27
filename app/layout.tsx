import type { Metadata } from "next";
import "@fontsource/anton/latin-400.css";
import "@fontsource-variable/inter/wght.css";
import "@fontsource-variable/source-serif-4/wght.css";
import "./globals.css";
import { siteUrl, withBasePath } from "./site-paths";

export const metadata: Metadata = {
  title: "ThreeByrd Meal Prep | Chicken + Beef, Delivered",
  alternates: {
    canonical: siteUrl("/"),
  },
  description:
    "High-protein Chicken or Beef meal prep delivered free in Ithaca. Mix and match a minimum of 3 meals.",
  openGraph: {
    title: "ThreeByrd Meal Prep | Chicken + Beef, Delivered",
    description:
      "High-protein Chicken and Beef meal prep, delivered free in Ithaca.",
    type: "website",
    images: [
      {
        url: siteUrl("/og/threebyrd-share.png"),
        width: 1200,
        height: 630,
        type: "image/png",
        alt: "ThreeByrd Meal Prep social preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ThreeByrd Meal Prep | Chicken + Beef, Delivered",
    description:
      "Build a one-time Chicken or Beef meal-prep order. Minimum 3 meals, delivered free in Ithaca.",
    images: [siteUrl("/og/threebyrd-share.png")],
  },
  icons: {
    icon: [
      { url: withBasePath("/favicon-16x16.png"), sizes: "16x16", type: "image/png" },
      { url: withBasePath("/favicon-32x32.png"), sizes: "32x32", type: "image/png" },
      { url: withBasePath("/favicon.ico"), type: "image/x-icon" },
    ],
    shortcut: withBasePath("/favicon.ico"),
    apple: withBasePath("/apple-touch-icon.png"),
  },
  manifest: withBasePath("/site.webmanifest"),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
