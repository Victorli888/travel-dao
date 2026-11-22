import { cn } from "@/lib/cn";

const VARIANTS = {
  /** Purple call-to-action. */
  primary:
    "bg-accent hover:bg-accent-bright text-white font-semibold transition-colors",
  /** Bordered, low-emphasis action on a dark surface. */
  ghost:
    "border border-line text-zinc-400 hover:text-zinc-200 hover:border-line-strong hover:bg-white/5 font-medium transition-all",
  /** Solid white — reserved for third-party sign-in. */
  white:
    "bg-white hover:bg-zinc-100 text-zinc-900 font-semibold transition-colors",
  /** Text-only, no chrome. */
  quiet: "text-zinc-500 hover:text-zinc-300 transition-colors",
  /**
   * Travel Tao light palette. The design system outlines its primary action
   * rather than filling it, and tints on hover — keep it that way.
   */
  tao: "border border-tao text-tao hover:bg-tao-wash font-medium transition-colors",
  /**
   * The one sunset-orange action on a light page: the landing's primary call
   * to action. Ink text, not white — white on ember fails contrast.
   */
  ember:
    "bg-ember text-ink hover:bg-ember/85 font-semibold shadow-sm shadow-ember/20 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tao",
  /** Quiet text action on the light palette. */
  taoQuiet: "text-ink-subtle hover:text-tao font-medium transition-colors",
} as const;

const SIZES = {
  sm: "text-xs px-4 py-2 rounded-lg",
  md: "text-sm px-5 py-3 rounded-xl",
  /** Vertical padding only — for full-width text actions. */
  block: "text-sm py-3 rounded-xl",
  /** No padding at all — for `quiet`. */
  bare: "text-sm",
} as const;

export interface ButtonStyleOptions {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  fullWidth?: boolean;
  className?: string;
}

/**
 * Shared button styling. Exported separately so anchors and `<button>`s can
 * look identical without wrapping one in the other.
 */
export function buttonStyles({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
}: ButtonStyleOptions = {}): string {
  return cn(
    "flex items-center justify-center gap-2 cursor-pointer",
    "disabled:opacity-30 disabled:cursor-not-allowed",
    VARIANTS[variant],
    SIZES[size],
    fullWidth && "w-full",
    className
  );
}

type Props = ButtonStyleOptions &
  React.ButtonHTMLAttributes<HTMLButtonElement>;

export default function Button({
  variant,
  size,
  fullWidth,
  className,
  ...props
}: Props) {
  return (
    <button
      {...props}
      className={buttonStyles({ variant, size, fullWidth, className })}
    />
  );
}
