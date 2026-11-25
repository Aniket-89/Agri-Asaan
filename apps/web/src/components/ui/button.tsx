import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "accent" | "secondary" | "quiet" | "danger";
export type ButtonSize = "md" | "sm";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-brand text-white shadow-button hover:bg-brand-strong active:shadow-none",
  // Sprout green with dark text, for the one call to action on a green surface.
  accent: "bg-leaf text-forest shadow-soft hover:brightness-105 active:shadow-none",
  secondary: "bg-surface text-ink shadow-soft hover:shadow-raised active:shadow-none",
  quiet: "bg-transparent text-brand hover:bg-brand-soft",
  danger: "bg-clay text-white shadow-soft hover:brightness-95 active:shadow-none",
};

const SIZES: Record<ButtonSize, string> = {
  md: "min-h-12 px-5 text-base",
  sm: "min-h-10 px-3.5 text-sm",
};

// Class string for anything that should look like a button (links too).
export function buttonClass({
  variant = "primary",
  size = "md",
  block = false,
}: { variant?: ButtonVariant; size?: ButtonSize; block?: boolean } = {}): string {
  return [
    "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition",
    "disabled:pointer-events-none disabled:opacity-50",
    VARIANTS[variant],
    SIZES[size],
    block ? "w-full" : "",
  ].join(" ");
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  icon?: ReactNode;
};

export function Button({
  variant,
  size,
  block,
  icon,
  className = "",
  children,
  type = "submit",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`${buttonClass({ variant, size, block })} ${className}`}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}
