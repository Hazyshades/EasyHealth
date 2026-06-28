import type { Metadata } from "next";
import { Figtree, Geist_Mono } from "next/font/google";
import "./globals.css";
import { WalletProvider } from "@/components/wallet-provider";

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "EasyHealth - AI-powered personal health record",
  description:
    "Upload labs, track biomarkers, and get pay-per-insight doctor summaries .",
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
        <WalletProvider>{children}</WalletProvider>
      </body>
    </html>
  );
}
