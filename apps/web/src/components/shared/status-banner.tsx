// Result message shown after a form redirect (?status=… / ?error=…).
export function StatusBanner({ kind, text }: { kind: "success" | "error"; text: string }) {
  return kind === "error" ? (
    <p role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-red-900">
      {text}
    </p>
  ) : (
    <p role="status" className="rounded border border-green-300 bg-green-50 p-3 text-green-900">
      {text}
    </p>
  );
}
