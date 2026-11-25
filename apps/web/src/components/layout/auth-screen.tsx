import type { ReactNode } from "react";

// Sign-in, registration and password screens: a green field band across the
// top with the form card lifted over it.
export function AuthScreen({ top, children }: { top?: ReactNode; children: ReactNode }) {
  return (
    <main className="relative isolate min-h-dvh bg-canvas px-4 pt-6 pb-12">
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 -z-10 h-72 overflow-hidden rounded-b-[2.5rem] bg-linear-135 from-brand to-forest"
      >
        <div
          className="absolute inset-0 opacity-[0.14]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(-28deg, var(--leaf) 0 3px, transparent 3px 22px)",
          }}
        />
      </div>
      <div className="mx-auto w-full max-w-md space-y-6">
        {top ? <div className="flex justify-end">{top}</div> : null}
        <div className="space-y-5 rounded-3xl bg-surface p-6 shadow-raised sm:p-8">{children}</div>
      </div>
    </main>
  );
}
