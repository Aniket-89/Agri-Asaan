import { ArrowLeftIcon } from "@phosphor-icons/react/dist/ssr";

import { buttonClass } from "./button";

// A quiet "back to the list" link above a detail or form page.
export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a className={`${buttonClass({ variant: "quiet", size: "sm" })} -ml-3`} href={href}>
      <ArrowLeftIcon className="size-4" aria-hidden />
      {children}
    </a>
  );
}
