import type { ReactNode } from "react";

const WIDTHS = { narrow: "max-w-2xl", default: "max-w-3xl", wide: "max-w-5xl" } as const;

// Standard page body inside the app shell: left-aligned, generous spacing.
export function Page({
  children,
  width = "default",
}: {
  children: ReactNode;
  width?: keyof typeof WIDTHS;
}) {
  return (
    <main className={`mx-auto w-full ${WIDTHS[width]} space-y-5 px-4 py-5 sm:px-6 lg:py-8`}>
      {children}
    </main>
  );
}
