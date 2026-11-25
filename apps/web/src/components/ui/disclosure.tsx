import { PlusIcon } from "@phosphor-icons/react/dist/ssr";
import type { ReactNode } from "react";

// An occasional task (add a drone, invite a pilot) folded under one line so
// the list above stays the main content. Opens by itself when the list is
// empty, because then adding is the only thing to do.
export function Disclosure({
  summary,
  open = false,
  children,
}: {
  summary: ReactNode;
  open?: boolean;
  children: ReactNode;
}) {
  return (
    <details className="group rounded-xl bg-canvas" open={open}>
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 font-semibold text-brand [&::-webkit-details-marker]:hidden">
        <PlusIcon weight="bold" className="size-5 transition group-open:rotate-45" aria-hidden />
        {summary}
      </summary>
      <div className="p-4 pt-1">{children}</div>
    </details>
  );
}
