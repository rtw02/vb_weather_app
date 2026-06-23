import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

// Body / UI text — built for screen legibility at small sizes.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

// Display / headings — single weight (800) keeps the title distinct at minimal cost.
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["800"],
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Volleyball Weather Calendar",
  description:
    "Stoplight calendar showing ideal outdoor volleyball weather (no rain, wind under 20 mph) for the next ~16 days.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jakarta.variable}`}>
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
