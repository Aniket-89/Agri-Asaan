import Image from "next/image";

import type { Branding } from "@/modules/branding";

// The AgriAsaan leaf mark (platform brand only).
export function AgriAsaanMark({ className = "size-10" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 96 96" className={`shrink-0 ${className}`} fill="none">
      <path
        d="M48 13C35 2 13 9 10 30c-3 20 14 39 38 54 24-15 41-34 38-54C83 9 61 2 48 13Z"
        fill="#75B82A"
      />
      <path d="M48 84V30" stroke="#14532D" strokeWidth="4" strokeLinecap="round" />
      <path d="M47 36C30 35 23 25 23 17c15 0 24 7 24 19Z" fill="#166534" />
      <path d="M50 29C51 14 62 8 75 9c-1 14-10 22-25 20Z" fill="#3F9B42" />
      <path
        d="M15 52c18-1 37 2 66 13M22 67c17-1 31 2 52 9"
        stroke="#F7F5E9"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M12 43c20 0 40 4 71 17"
        stroke="#F7F5E9"
        strokeWidth="3"
        strokeLinecap="round"
        opacity=".9"
      />
    </svg>
  );
}

// Tenant logo when configured; the AgriAsaan mark only for the platform's own
// brand; otherwise the organization's initial on its brand colour, so a
// white-label app never shows our mark.
export function BrandMark({
  branding,
  className = "size-10",
}: {
  branding: Branding;
  className?: string;
}) {
  if (branding.logoUrl) {
    return (
      <Image
        src={branding.logoUrl}
        alt=""
        width={64}
        height={64}
        unoptimized
        className={`shrink-0 object-contain ${className}`}
      />
    );
  }
  if (branding.isPlatformDefault) {
    return <AgriAsaanMark className={className} />;
  }
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-xl text-lg font-bold text-white ${className}`}
      style={{ backgroundColor: branding.primaryColor }}
    >
      {branding.name.trim().charAt(0).toUpperCase()}
    </span>
  );
}
