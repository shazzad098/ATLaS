import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Buttons.
 *
 * `Button` is a plain `<button>` (used inside forms with server actions); `ButtonLink`
 * renders the same styles on a Next `Link`. Both accept the same visual variants so
 * the admin and marketing surfaces stay consistent.
 */

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 border border-transparent",
  secondary: "bg-ink-900 text-white hover:bg-ink-800 border border-transparent",
  outline: "bg-white text-ink-800 border border-ink-200 hover:bg-ink-50",
  ghost: "bg-transparent text-ink-700 border border-transparent hover:bg-ink-100",
  danger: "bg-red-600 text-white hover:bg-red-700 border border-transparent",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-5 py-2.5 text-sm sm:text-base",
};

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md"): string {
  return cn(
    "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-60",
    VARIANTS[variant],
    SIZES[size],
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button({ variant = "primary", size = "md", className, ...rest }: ButtonProps) {
  return <button className={cn(buttonClass(variant, size), className)} {...rest} />;
}

type ButtonLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
};

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link href={href} className={cn(buttonClass(variant, size), className)} {...rest}>
      {children}
    </Link>
  );
}
