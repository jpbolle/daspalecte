import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}

const base =
  "inline-flex items-center justify-center gap-2 rounded-sm border font-medium " +
  "transition-[background-color,border-color,color,box-shadow] duration-150 ease-out " +
  "disabled:cursor-not-allowed disabled:opacity-55 disabled:shadow-none";

const variants: Record<Variant, string> = {
  primary:
    "border-primary bg-primary text-on-primary shadow-card " +
    "enabled:hover:border-primary-hover enabled:hover:bg-primary-hover " +
    "enabled:active:bg-primary enabled:active:shadow-none",
  secondary:
    "border-line bg-card text-ink " +
    "enabled:hover:border-line-strong enabled:hover:bg-element " +
    "enabled:active:bg-element",
  ghost:
    "border-transparent bg-transparent text-ink-secondary " +
    "enabled:hover:bg-element enabled:hover:text-ink " +
    "enabled:active:bg-element",
  danger:
    "border-danger bg-card text-danger " +
    "enabled:hover:bg-danger enabled:hover:text-white " +
    "enabled:active:opacity-90",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[0.8125rem]",
  md: "h-10 px-4 text-sm",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  children,
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  );
}

function Spinner() {
  return (
    <svg
      className="size-4 shrink-0 animate-spin motion-reduce:animate-none"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="8"
        cy="8"
        r="6.5"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="2"
      />
      <path
        d="M8 1.5a6.5 6.5 0 0 1 6.5 6.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
