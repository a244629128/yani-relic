import { Cormorant_Garamond, Inter } from "next/font/google";
import "./globals.css";
import SiteBanner from "@/components/SiteBanner";
import CursorSparkleTrail from "@/components/decor/CursorSparkleTrail";

const serif = Cormorant_Garamond({
  variable: "--font-serif",
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  display: "swap",
});

const sans = Inter({
  variable: "--font-sans",
  weight: ["300", "400", "500", "600"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata = {
  title: "Yani Relics — Handmade Labradorite Relics",
  description:
    "Handmade labradorite relics for soft witches and moonlit souls. One-of-one pieces wrapped by hand.",
  openGraph: {
    title: "Yani Relics",
    description:
      "Handmade labradorite relics for soft witches and moonlit souls.",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export const viewport = {
  themeColor: "#0d1611",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-forest text-cream font-sans">
        <SiteBanner />
        {children}
        <CursorSparkleTrail />
      </body>
    </html>
  );
}
