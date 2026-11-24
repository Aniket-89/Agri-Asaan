import type { PostgrestError } from "@supabase/supabase-js";

export type DomainErrorCode = "forbidden" | "duplicate" | "invalid" | "not_found";

export type DomainResult<T = undefined> =
  | (T extends undefined ? { ok: true } : { ok: true; value: T })
  | { ok: false; error: DomainErrorCode };

// Maps expected database rejections (constraints, RLS) to user-facing
// outcomes. Anything else is unexpected and is thrown, never swallowed.
export function toDomainError(error: PostgrestError): DomainErrorCode {
  switch (error.code) {
    case "23505":
      return "duplicate";
    case "23514":
    case "23503":
    case "22P02":
      return "invalid";
    case "42501":
      return "forbidden";
    default:
      throw new Error(`Unexpected database error (${error.code}).`);
  }
}

// Escapes LIKE wildcards so user search text is matched literally.
export function escapeLikePattern(text: string): string {
  return text.replace(/[\\%_]/g, (character) => `\\${character}`);
}
