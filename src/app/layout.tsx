import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
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
          <header className="border-b border-border bg-card/60">
            <nav className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
              <Link href="/" className="font-semibold tracking-tight">
                Lesson Pipeline
              </Link>
              <div className="flex gap-5 text-sm text-muted">
                <Link href="/" className="hover:text-foreground">
                  New lesson
                </Link>
                <Link href="/lessons" className="hover:text-foreground">
                  History
                </Link>
              </div>
            </nav>
          </header>
          <main className="mx-auto max-w-3xl px-4 py-8">{children}</main>
        </TRPCProvider>
      </body>
    </html>
  );
}
