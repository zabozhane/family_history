import type { Metadata } from "next";
import type { ReactNode } from "react";

import { MusicPlayerProvider } from "@/components/music-player-context";

import "./globals.css";

export const metadata: Metadata = {
  title: "Family Media System",
  description: "Private family media + digital memory platform.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans">
        <MusicPlayerProvider>{children}</MusicPlayerProvider>
      </body>
    </html>
  );
}
