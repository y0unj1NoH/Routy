"use client";

import { forwardRef } from "react";
import type { TextareaHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        "min-h-[88px] w-full rounded-lg border border-border bg-card/92 px-3 py-2.5 text-sm leading-5 text-foreground shadow-inset-field md:min-h-[96px] md:rounded-xl md:px-4 md:py-3",
        "transition-[border-color,box-shadow,background-color] duration-200 placeholder:text-foreground/40 focus-visible:border-primary-light focus-visible:outline-hidden focus-visible:ring-4 focus-visible:ring-primary/15",
        className
      )}
      {...props}
    />
  );
});
