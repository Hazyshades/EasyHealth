import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
  referrer: "no-referrer",
};

export default function PublicShareLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
