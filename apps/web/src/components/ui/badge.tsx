import type { ReactNode } from "react";

export type BadgeTone = "sun" | "sky" | "leaf" | "brand" | "clay" | "neutral";

const TONES: Record<BadgeTone, string> = {
  sun: "bg-sun-soft text-sun-ink",
  sky: "bg-sky-soft text-sky",
  leaf: "bg-leaf-soft text-leaf-ink",
  brand: "bg-brand text-white",
  clay: "bg-clay-soft text-clay",
  neutral: "bg-field text-ink-muted",
};

export function Badge({
  tone,
  icon,
  children,
}: {
  tone: BadgeTone;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm leading-none font-semibold whitespace-nowrap ${TONES[tone]}`}
    >
      {icon}
      {children}
    </span>
  );
}
