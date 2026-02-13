import type { Metadata } from "next";
import Providers from "./providers";
import Navbar from "@/app/components/layout/Navbar";
import Script from "next/script";

export const metadata: Metadata = {
  title: "Wargal News",
  description: "Somali tech/news aggregator + community",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* Google Identity Services (GIS) */}
        <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />

        <Providers>
          <Navbar />
          {children}
        </Providers>
      </body>
    </html>
  );
}
