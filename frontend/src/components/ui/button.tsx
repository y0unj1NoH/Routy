"use client";

import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";

import type { ButtonShape, ButtonSize, ButtonVariant } from "@/components/ui/button-styles";
import { buttonStyles } from "@/components/ui/button-styles";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  shape?: ButtonShape;
  iconOnly?: boolean;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "medium", shape = "default", iconOnly = false, fullWidth = false, type = "button", ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={buttonStyles({ variant, size, shape, iconOnly, fullWidth, className })}
      {...props}
    />
  );
});
