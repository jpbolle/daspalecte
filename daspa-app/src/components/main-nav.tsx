"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface NavItem {
  href: string;
  label: string;
}

export function MainNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  if (items.length === 0) return null;

  return (
    <nav aria-label="Sections" className="flex items-center gap-1">
      {items.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={
              "rounded-sm px-2.5 py-1.5 text-sm transition-colors duration-150 " +
              (active
                ? "bg-element font-medium text-ink"
                : "text-ink-secondary hover:bg-element hover:text-ink")
            }
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
