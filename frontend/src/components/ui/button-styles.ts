import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";
export type ButtonShape = "default" | "pill";

type ButtonStyleOptions = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  shape?: ButtonShape;
  fullWidth?: boolean;
  className?: string;
};

export const buttonVariantToneClasses: Record<ButtonVariant, string> = {
  primary: "bg-primary text-white",
  secondary: "border border-border-strong bg-card/90 text-foreground",
  ghost: "bg-transparent text-foreground",
  danger: "bg-danger text-white"
};

const buttonBaseClasses =
  "inline-flex items-center justify-center transition-[background-color,border-color,color,box-shadow] duration-200 focus-visible:outline-hidden";

const buttonFocusClasses =
  "focus-visible:ring-4 focus-visible:ring-primary/20 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50";

const buttonVariantClasses: Record<ButtonVariant, string> = {
  primary: `${buttonVariantToneClasses.primary} shadow-soft hover:bg-primary-hover`,
  secondary: `${buttonVariantToneClasses.secondary} shadow-[0_10px_24px_rgba(60,157,255,0.08)] hover:border-primary-light hover:bg-primary-soft`,
  ghost: `${buttonVariantToneClasses.ghost} hover:bg-primary-soft`,
  danger: `${buttonVariantToneClasses.danger} shadow-[0_12px_24px_rgba(228,110,124,0.22)] hover:bg-danger-hover`
};

const buttonSizeClasses: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-4 text-sm",
  lg: "h-14 px-6 text-base font-semibold"
};

const buttonShapeClasses: Record<ButtonShape, string> = {
  default: "rounded-md",
  pill: "rounded-full"
};

export function buttonStyles({
  variant = "primary",
  size = "md",
  shape = "default",
  fullWidth = false,
  className
}: ButtonStyleOptions = {}) {
  return cn(
    buttonBaseClasses,
    buttonFocusClasses,
    buttonVariantClasses[variant],
    buttonSizeClasses[size],
    buttonShapeClasses[shape],
    fullWidth && "w-full",
    className
  );
}
