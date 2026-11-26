import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import "driver.js/dist/driver.css";
import { AuthProvider } from "@/components/auth-provider";

const figtree = localFont({
  src: "./fonts/Figtree-Variable.woff2",
  variable: "--font-figtree",
  weight: "300 900",
  display: "swap",
});

const geistMono = localFont({
  src: "./fonts/GeistMono-Variable.woff2",
  variable: "--font-geist-mono",
  weight: "100 900",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://easyhealth.app"),
  title: "EasyHealth - AI-powered personal health record",
  description:
    "Upload labs, track biomarkers, and generate educational health insights.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body
        className={`${figtree.variable} ${geistMono.variable} font-sans antialiased min-h-full bg-background text-foreground`}
      >
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
