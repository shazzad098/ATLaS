"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart, LayoutDashboard, Package, Star, User } from "lucide-react";

/** Buyer panel navigation with the current section highlighted. */

export function BuyerAccountNav({ slug }: { slug: string }) {
  const pathname = usePathname();
  const base = `/store/${slug}/account`;

  const items = [
    { href: base, label: "ড্যাশবোর্ড", icon: LayoutDashboard, exact: true },
    { href: `${base}/orders`, label: "আমার অর্ডার", icon: Package },
    { href: `${base}/reviews`, label: "রিভিউ ও মন্তব্য", icon: Star },
    { href: `${base}/wishlist`, label: "উইশলিস্ট", icon: Heart },
    { href: `${base}/profile`, label: "প্রোফাইল", icon: User },
  ];

  return (
    <nav aria-label="Buyer account" className="flex flex-wrap gap-1 pb-1 sm:flex-col sm:flex-nowrap">
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`store-btn inline-flex shrink-0 items-center gap-2 px-3 py-2 text-xs font-medium transition ${
              active
                ? "text-white shadow-sm"
                : "muted border border-black/10 bg-white hover:border-black/20"
            }`}
            style={active ? { background: "var(--store-primary)" } : undefined}
          >
            <item.icon className="h-3.5 w-3.5" />
            <span className="whitespace-nowrap">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
