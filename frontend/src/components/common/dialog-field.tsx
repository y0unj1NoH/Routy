"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

type DialogFieldLabelProps = {
  htmlFor?: string;
  children: ReactNode;
  required?: boolean;
  optional?: boolean;
  className?: string;
};

export function DialogFieldLabel({
  htmlFor,
  children,
  required = false,
  optional = false,
  className
}: DialogFieldLabelProps) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn("flex items-center gap-1.5 font-semibold leading-5 text-foreground/72", className)}
      style={{ fontSize: "var(--field-label-size)" }}
    >
      <span>{children}</span>
      {required ? (
        <span aria-hidden="true" className="text-danger">
          *
        </span>
      ) : null}
      {optional ? <span className="text-2xs font-semibold text-foreground/45">선택</span> : null}
    </label>
  );
}

type DialogFieldHintProps = {
  children?: ReactNode;
  error?: boolean;
  className?: string;
};

export function DialogFieldHint({ children, error = false, className }: DialogFieldHintProps) {
  if (!children) return null;

  return (
    <p className={cn(error ? "text-xs leading-5 text-danger" : "pl-1 text-xs leading-5 text-foreground/48", className)}>
      {children}
    </p>
  );
}
