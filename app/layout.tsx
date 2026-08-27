import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { siteUrl, withBasePath } from "./site-paths";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Threebyrd Meal Prep - Chicken and Beef Meal Prep",
  description:
    "Chicken and beef meal prep in two portion sizes, with rice and broccoli. Online ordering is coming soon.",
  openGraph: {
    title: "Threebyrd Meal Prep",
    description:
      "Chicken and beef meal prep in two portion sizes. Online ordering is coming soon.",
    type: "website",
    images: [
      {
        url: siteUrl("/og.png"),
        width: 1200,
        height: 630,
        alt: "Threebyrd Meal Prep social preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Threebyrd Meal Prep",
    description:
      "Chicken and beef meal prep in two portion sizes. Online ordering is coming soon.",
    images: [siteUrl("/og.png")],
  },
  icons: {
    icon: withBasePath("/favicon.svg"),
    shortcut: withBasePath("/favicon.svg"),
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} antialiased`}>{children}</body>
    </html>
  );
}
