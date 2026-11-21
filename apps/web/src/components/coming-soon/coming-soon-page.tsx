import Image from "next/image";

import { isSupabaseConfigured } from "@/lib/env";
import type { Branding } from "@/modules/branding";

function AgriAsaanMark() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 96 96"
      className="h-14 w-14 shrink-0 sm:h-16 sm:w-16"
      fill="none"
    >
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
// brand; otherwise nothing, so a white-label page never shows our mark.
function BrandMark({ branding }: { branding: Branding }) {
  if (branding.logoUrl) {
    return (
      <Image
        src={branding.logoUrl}
        alt=""
        width={64}
        height={64}
        unoptimized
        className="h-14 w-14 shrink-0 object-contain sm:h-16 sm:w-16"
      />
    );
  }
  return branding.isPlatformDefault ? <AgriAsaanMark /> : null;
}

function DroneIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-8 w-8" fill="none" aria-hidden="true">
      <path
        d="M15 20h18l4 6H11l4-6Z"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        d="M24 20v-6m-9 6-7-5m25 5 7-5M18 26l-5 9m17-9 5 9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M4 14h10m20 0h10M20 11h8"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="24" cy="23" r="2" fill="currentColor" />
    </svg>
  );
}

function SatelliteIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-8 w-8" fill="none" aria-hidden="true">
      <path
        d="m19 17 12 12m-9-18 8 8m-18 8 8 8m-6-24-6 6 8 8 6-6-8-8Zm20 20-6 6-8-8 6-6 8 8Z"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        d="m28 12 8-8m-5 13 10-2m-14-2 2-10"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-8 w-8" fill="currentColor" aria-hidden="true">
      <circle cx="24" cy="13" r="7" />
      <circle cx="10" cy="18" r="5" />
      <circle cx="38" cy="18" r="5" />
      <path d="M11 39c0-8 5-13 13-13s13 5 13 13v2H11v-2Z" />
      <path d="M1 39c0-6 3-10 9-11 3 0 5 1 7 3-3 3-4 6-4 10H1v-2Zm46 0c0-6-3-10-9-11-3 0-5 1-7 3 3 3 4 6 4 10h12v-2Z" />
    </svg>
  );
}

const features = [
  {
    title: "Drone Services",
    detail: "On-demand spraying",
    Icon: DroneIcon,
  },
  {
    title: "Crop Monitoring",
    detail: "Satellite-based insights",
    Icon: SatelliteIcon,
  },
  {
    title: "Farm Operations",
    detail: "From booking to completion",
    Icon: PeopleIcon,
  },
];

export function ComingSoonPage({ branding }: { branding: Branding }) {
  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-[#f8eddb] text-[#103d25]">
      <Image
        src="/agriaasaan-hero.png"
        alt="Lush agricultural fields at sunrise with a crop-spraying drone and satellite crop imagery"
        fill
        priority
        sizes="100vh"
        className="absolute inset-0 -z-20 object-cover object-center"
      />

      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-[#fffaf0]/55 via-[#fff6e8]/30 to-transparent" />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,rgba(255,248,235,0.76)_0%,rgba(255,248,235,0.48)_42%,rgba(255,248,235,0.04)_78%)]" />

      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col items-center px-5 pb-10 pt-8 text-center sm:px-8 sm:pt-10">
        <a href="#" aria-label={`${branding.name} home`} className="inline-flex items-center gap-3">
          <BrandMark branding={branding} />
          <span className="text-left">
            <span
              className="block text-3xl font-extrabold tracking-[-0.06em] sm:text-4xl"
              style={{ color: branding.primaryColor }}
            >
              {branding.name}
            </span>
            {branding.tagline ? (
              <span className="mt-0.5 block text-[10px] font-semibold tracking-[0.12em] text-[#244b31] sm:text-xs">
                {branding.tagline}
              </span>
            ) : null}
          </span>
        </a>

        <section className="mt-16 flex w-full flex-1 flex-col items-center sm:mt-20">
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#244b31] sm:text-sm sm:tracking-[0.38em]">
            A smarter way to manage your farms
          </p>

          <h1 className="mt-5 text-5xl font-black leading-[0.95] tracking-[-0.065em] text-[#103d25] drop-shadow-[0_2px_1px_rgba(255,255,255,0.25)] sm:text-7xl md:text-8xl">
            Coming Soon
          </h1>
          <div
            className="mt-4 h-1.5 w-36 rotate-[-3deg] rounded-full sm:w-48"
            style={{ backgroundColor: branding.accentColor }}
          />

          <p className="mt-7 max-w-2xl text-base font-medium leading-relaxed text-[#163d29] sm:text-xl md:text-2xl">
            A digital platform for on-demand drone spraying, crop health monitoring and farm service
            management.
          </p>

          <div className="mt-12 grid w-full max-w-3xl grid-cols-1 gap-7 sm:grid-cols-3 sm:gap-0">
            {features.map(({ title, detail, Icon }, index) => (
              <div
                key={title}
                className={`flex flex-col items-center px-4 ${
                  index !== 0 ? "sm:border-l sm:border-[#668b61]/50" : ""
                }`}
              >
                <span className="text-[#328344]">
                  <Icon />
                </span>
                <h2 className="mt-2 text-base font-bold text-[#173c28] sm:text-lg">{title}</h2>
                <p className="mt-0.5 text-sm text-[#284a34]">{detail}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-12 inline-flex items-center gap-3 rounded-full border border-white/70 bg-[#fff0c7]/95 px-7 py-3.5 text-base font-bold text-[#173f27] shadow-[0_8px_30px_rgba(74,78,36,0.12)] backdrop-blur-sm sm:mt-8 sm:px-10 sm:py-4 sm:text-xl">
          <span className="text-[#328344]" aria-hidden="true">
            ✦
          </span>
          Launching Soon
          <span className="text-[#328344]" aria-hidden="true">
            ✦
          </span>
        </div>

        <div className="mt-6 inline-flex items-center gap-3 rounded-full border border-[#1d5f45]/15 bg-white/45 px-4 py-2 text-xs font-semibold text-[#173f27] shadow-sm backdrop-blur-sm sm:text-sm">
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${
              isSupabaseConfigured ? "bg-emerald-500" : "bg-amber-500"
            }`}
            aria-hidden="true"
          />
          {isSupabaseConfigured ? "Supabase connected" : "Add Supabase env vars to connect"}
        </div>
      </div>
    </main>
  );
}
