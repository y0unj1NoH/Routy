"use client";

import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";

import type { ButtonShape, ButtonSize, ButtonVariant } from "@/components/ui/button-styles";
import { buttonStyles } from "@/components/ui/button-styles";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  shape?: ButtonShape;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", shape = "default", fullWidth = false, type = "button", ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={buttonStyles({ variant, size, shape, fullWidth, className })}
      {...props}
    />
  );
});
