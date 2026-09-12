import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "side-a" | "side-b" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-ink text-paper hover:bg-ink-soft",
  "side-a": "bg-side-a text-paper hover:bg-side-a-dim",
  "side-b": "bg-side-b text-paper hover:bg-side-b-dim",
  ghost: "bg-transparent text-ink border-2 border-ink hover:bg-ink hover:text-paper",
  danger: "bg-transparent text-side-a border-2 border-side-a hover:bg-side-a hover:text-paper",
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-5 py-2.5 text-base",
  lg: "px-7 py-4 text-lg",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", className = "", disabled, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled}
      className={[
        "font-ui font-bold uppercase tracking-wide transition-colors duration-150",
        "disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none",
        "inline-flex items-center justify-center gap-2",
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </button>
  );
});
