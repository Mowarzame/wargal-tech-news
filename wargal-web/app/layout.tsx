import type { Metadata } from "next";
import Providers from "./providers";
import Navbar from "@/app/components/layout/Navbar";

export const metadata: Metadata = {
  title: "Wargal News",
  description: "Somali tech/news aggregator + community",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <Navbar />
          {children}
        </Providers>
      </body>
    </html>
  );
}
