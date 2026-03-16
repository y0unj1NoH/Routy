"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { buttonStyles } from "@/components/ui/button-styles";
import { cn } from "@/lib/cn";

type PageBackButtonProps = {
  ariaLabel?: string;
  href?: string;
  onClick?: () => void;
  className?: string;
};

const baseClassName = buttonStyles({
  variant: "ghost",
  size: "sm",
  className:
    "h-10 w-10 shrink-0 rounded-full p-0 text-foreground/72 hover:bg-primary-soft hover:text-foreground"
});

export function PageBackButton({
  ariaLabel = "뒤로가기",
  href,
  onClick,
  className
}: PageBackButtonProps) {
  const resolvedClassName = cn(baseClassName, className);

  if (href) {
    return (
      <Link href={href} aria-label={ariaLabel} className={resolvedClassName}>
        <ArrowLeft className="h-5 w-5" />
      </Link>
    );
  }

  return (
    <button type="button" aria-label={ariaLabel} onClick={onClick} className={resolvedClassName}>
      <ArrowLeft className="h-5 w-5" />
    </button>
  );
}
