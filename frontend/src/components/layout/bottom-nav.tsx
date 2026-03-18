"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, PlaneTakeoff, TicketsPlane, UserCircle2 } from "lucide-react";

import { UI_COPY } from "@/constants/ui-copy";
import { cn } from "@/lib/cn";

const items = [
  { href: "/", label: UI_COPY.navigation.bottomNav.home, icon: TicketsPlane },
  { href: "/saved", label: UI_COPY.navigation.bottomNav.saved, icon: ClipboardList },
  { href: "/routes/new", label: UI_COPY.navigation.bottomNav.newRoute, icon: PlaneTakeoff },
  { href: "/mypage", label: UI_COPY.navigation.bottomNav.my, icon: UserCircle2 }
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="하단 내비게이션"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-white/96 pb-[env(safe-area-inset-bottom)] shadow-floating backdrop-blur-sm"
    >
      <div className="mx-auto grid h-(--bottom-nav-height) w-full max-w-[var(--page-content-max-width)] grid-cols-4 px-1.5 md:px-2">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 rounded-xl text-2xs font-semibold leading-none transition-[background-color,color,box-shadow] duration-200 md:rounded-2xl md:text-xs",
                active
                  ? "bg-primary-soft text-primary shadow-subtle"
                  : "text-foreground/55 hover:bg-primary-soft/70 hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4 md:h-[18px] md:w-[18px]" />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
