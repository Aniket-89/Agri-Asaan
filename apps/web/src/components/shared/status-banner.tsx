import { CheckCircleIcon, WarningCircleIcon } from "@phosphor-icons/react/dist/ssr";

// Result message shown after a form redirect (?status=… / ?error=…).
export function StatusBanner({ kind, text }: { kind: "success" | "error"; text: string }) {
  const isError = kind === "error";
  const Icon = isError ? WarningCircleIcon : CheckCircleIcon;
  return (
    <p
      role={isError ? "alert" : "status"}
      className={`flex items-start gap-2.5 rounded-xl px-4 py-3 font-medium shadow-soft ${
        isError ? "bg-clay-soft text-clay" : "bg-leaf-soft text-leaf-ink"
      }`}
    >
      <Icon weight="fill" className="mt-0.5 size-5 shrink-0" aria-hidden />
      <span>{text}</span>
    </p>
  );
}
