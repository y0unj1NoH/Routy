"use client";

import { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        "min-h-10 w-full rounded-md border border-border bg-card/92 px-3 py-2 text-sm leading-5 text-foreground shadow-inset-field md:min-h-11 md:px-4 md:py-2.5",
        "transition-[border-color,box-shadow,background-color] duration-200 placeholder:text-foreground/40 focus-visible:border-primary-light focus-visible:outline-hidden focus-visible:ring-4 focus-visible:ring-primary/15",
        className
      )}
      {...props}
    />
  );
});
