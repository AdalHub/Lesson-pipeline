import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppHeader } from "@/components/AppHeader";
import { TRPCProvider } from "@/trpc/client";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Lesson Pipeline",
  description: "Paste a test question, get a TEKS-anchored lesson.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen font-sans antialiased`}
      >
        <TRPCProvider>
          <AppHeader />
          <main className="mx-auto w-full max-w-[1180px] px-5 py-10 sm:px-8 lg:px-0 lg:py-12">
            {children}
          </main>
        </TRPCProvider>
      </body>
    </html>
  );
}
