import { Suspense } from "react";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { connection } from "next/server";

import { getRequestBranding } from "@/lib/branding/request-branding";
import { LOCALES } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionary";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

// The title is the tenant brand for the request's hostname, so metadata is
// resolved at request time.
export async function generateMetadata(): Promise<Metadata> {
  const [{ t }, branding] = await Promise.all([getDictionary(), getRequestBranding()]);
  return {
    title: { default: branding.name, template: `%s | ${branding.name}` },
    description: t.metadata.description,
  };
}

async function RequestTimeMarker() {
  await connection();
  return null;
}

export default async function RootLayout({ children }: LayoutProps<"/[lang]">) {
  const { locale } = await getDictionary();

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        {/* Tells Next.js that request-time metadata is intentional while the
            rest of each page stays in the static shell. */}
        <Suspense>
          <RequestTimeMarker />
        </Suspense>
      </body>
    </html>
  );
}
