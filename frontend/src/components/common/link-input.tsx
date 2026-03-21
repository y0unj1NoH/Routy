"use client";

import { forwardRef } from "react";
import { Link2 } from "lucide-react";
import type { InputHTMLAttributes } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";

type LinkInputProps = InputHTMLAttributes<HTMLInputElement>;

export const LinkInput = forwardRef<HTMLInputElement, LinkInputProps>(function LinkInput({ className, ...props }, ref) {
  return (
    <div className="relative">
      <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/35" />
      <Input ref={ref} className={cn("pl-9 md:pl-10", className)} {...props} />
    </div>
  );
});
