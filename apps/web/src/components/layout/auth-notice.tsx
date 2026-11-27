import Link from "next/link";
import type { ReactNode } from "react";

import { buttonClass } from "@/components/ui";

import { AuthScreen } from "./auth-screen";

// A message-only auth screen (check your email, access pending).
export function AuthNotice({
  icon,
  title,
  children,
  backHref,
  backLabel,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  backHref: string;
  backLabel: string;
}) {
  return (
    <AuthScreen>
      <span
        aria-hidden="true"
        className="flex size-14 items-center justify-center rounded-2xl bg-leaf-soft text-leaf-ink"
      >
        {icon}
      </span>
      <h1 className="text-2xl font-bold tracking-tight text-ink">{title}</h1>
      <div className="space-y-3 text-ink-muted">{children}</div>
      <Link className={buttonClass({ variant: "secondary", block: true })} href={backHref}>
        {backLabel}
      </Link>
    </AuthScreen>
  );
}
