import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "xsmall" | "small" | "medium" | "large";
export type ButtonShape = "default" | "pill";

type ButtonStyleOptions = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  shape?: ButtonShape;
  iconOnly?: boolean;
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
  "inline-flex shrink-0 items-center justify-center border border-transparent font-semibold break-keep transition-[background-color,border-color,color,box-shadow,transform] duration-200 focus-visible:outline-hidden [&_svg]:shrink-0";

const buttonFocusClasses =
  "focus-visible:ring-4 focus-visible:ring-primary/20 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50";

const buttonVariantClasses: Record<ButtonVariant, string> = {
  primary: `${buttonVariantToneClasses.primary} shadow-surface hover:bg-primary-hover`,
  secondary: `${buttonVariantToneClasses.secondary} shadow-subtle hover:border-primary-light hover:bg-primary-soft`,
  ghost: `${buttonVariantToneClasses.ghost} hover:bg-primary-soft`,
  danger: `${buttonVariantToneClasses.danger} shadow-subtle hover:bg-danger-hover`
};

const buttonIconOnlyVariantClasses: Record<ButtonVariant, string> = {
  primary: "border-0 bg-transparent text-primary shadow-none hover:bg-transparent hover:text-primary-hover",
  secondary: "border-0 bg-transparent text-foreground shadow-none hover:bg-transparent hover:text-primary-hover",
  ghost: "border-0 bg-transparent text-foreground/62 shadow-none hover:bg-transparent hover:text-foreground",
  danger: "border-0 bg-transparent text-danger shadow-none hover:bg-transparent hover:text-danger-hover"
};

const buttonSizeClasses: Record<ButtonSize, string> = {
  xsmall:
    "min-h-8 gap-1 px-2.5 py-1 text-[11px] [&_svg]:h-3 [&_svg]:w-3 md:min-h-10 md:gap-1.5 md:px-3.5 md:py-2 md:text-xs md:[&_svg]:h-4 md:[&_svg]:w-4",
  small:
    "min-h-9 gap-1.5 px-3 py-2 text-xs [&_svg]:h-3.5 [&_svg]:w-3.5 md:min-h-10 md:px-3.5 md:[&_svg]:h-4 md:[&_svg]:w-4",
  medium:
    "min-h-10 gap-1.5 px-4 py-2 text-sm [&_svg]:h-4 [&_svg]:w-4 md:min-h-11 md:gap-2 md:px-5 md:py-2.5 md:[&_svg]:h-[18px] md:[&_svg]:w-[18px]",
  large:
    "min-h-11 gap-2 px-5 py-2.5 text-sm [&_svg]:h-4 [&_svg]:w-4 md:min-h-12 md:px-6 md:py-3 md:[&_svg]:h-[18px] md:[&_svg]:w-[18px]"
};

const buttonIconOnlySizeClasses: Record<ButtonSize, string> = {
  xsmall:
    "relative isolate min-h-0 gap-0 px-0 py-0 text-inherit leading-none [&_svg]:h-3.5 [&_svg]:w-3.5 after:pointer-events-auto after:absolute after:-inset-1 after:content-[''] md:[&_svg]:h-4 md:[&_svg]:w-4",
  small:
    "relative isolate min-h-0 gap-0 px-0 py-0 text-inherit leading-none [&_svg]:h-4 [&_svg]:w-4 after:pointer-events-auto after:absolute after:-inset-1 after:content-[''] md:[&_svg]:h-[18px] md:[&_svg]:w-[18px]",
  medium:
    "relative isolate min-h-0 gap-0 px-0 py-0 text-inherit leading-none [&_svg]:h-[18px] [&_svg]:w-[18px] after:pointer-events-auto after:absolute after:-inset-1 after:content-[''] md:[&_svg]:h-5 md:[&_svg]:w-5",
  large:
    "relative isolate min-h-0 gap-0 px-0 py-0 text-inherit leading-none [&_svg]:h-5 [&_svg]:w-5 after:pointer-events-auto after:absolute after:-inset-1 after:content-[''] md:[&_svg]:h-6 md:[&_svg]:w-6"
};

const buttonShapeClasses: Record<ButtonShape, string> = {
  default: "rounded-md",
  pill: "rounded-full"
};

export function buttonStyles({
  variant = "primary",
  size = "medium",
  shape = "default",
  iconOnly = false,
  fullWidth = false,
  className
}: ButtonStyleOptions = {}) {
  return cn(
    buttonBaseClasses,
    buttonFocusClasses,
    iconOnly ? buttonIconOnlyVariantClasses[variant] : buttonVariantClasses[variant],
    iconOnly ? buttonIconOnlySizeClasses[size] : buttonSizeClasses[size],
    iconOnly ? "rounded-none" : buttonShapeClasses[shape],
    fullWidth && !iconOnly && "w-full",
    className
  );
}
