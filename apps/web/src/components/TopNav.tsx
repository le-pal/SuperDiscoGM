"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@superdiscogm/db";
import { hasRole } from "@/lib/roles";

const NAV_ITEMS: { href: string; label: string; minRole?: Role }[] = [
  { href: "/", label: "Tableau de bord" },
  { href: "/profile", label: "Mon profil" },
  { href: "/admin", label: "Admin", minRole: "ADMIN" },
];

export function TopNav({ role }: { role: Role }) {
  const pathname = usePathname();

  return (
    <nav className="topnav">
      {NAV_ITEMS.filter((item) => !item.minRole || hasRole({ role }, item.minRole)).map((item) => (
        <Link key={item.href} href={item.href} className={pathname === item.href ? "active" : undefined}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
