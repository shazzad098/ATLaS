import type { Metadata, Viewport } from "next";
import "./globals.css";

/**
 * Root layout.
 *
 * Deliberately thin: the marketing site, merchant admin and super admin each add
 * their own chrome below this, while `/store/[slug]` swaps in a merchant theme.
 */

export const metadata: Metadata = {
  title: {
    default: "ATLaS — বাংলাদেশের অনলাইন দোকান বানান",
    template: "%s · ATLaS",
  },
  description:
    "বিকাশ, নগদ, SSLCommerz আর ক্যাশ অন ডেলিভারি সহ সম্পূর্ণ ই-কমার্স স্টোর — সাবডোমেইন, থিম আর প্রোডাক্ট ম্যানেজমেন্ট একসাথে।",
  applicationName: "ATLaS",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
};

export const viewport: Viewport = {
  themeColor: "#12836b",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bn" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
