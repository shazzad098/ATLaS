"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Bell,
  BellRing,
  Boxes,
  LifeBuoy,
  Palette,
  Receipt,
  RefreshCw,
  SearchX,
  ShieldCheck,
  ShoppingCart,
  Store,
  Users,
  type LucideIcon,
} from "lucide-react";
import { formatRelativeBn } from "@/lib/dates";
import type {
  PlatformActivityItem,
  PlatformActivitySnapshot,
  PlatformActivityTone,
} from "@/lib/services/platform-activity-service";

/**
 * Super Admin notification UI.
 *
 * The feed polls the platform activity API every 12 seconds (and immediately
 * on window focus), so a merchant product/order/settings update shows up here
 * without a page reload. "Unread" is tracked in localStorage: opening the bell
 * or the notifications page stores the newest activity timestamp.
 */

const SEEN_KEY = "atlas-super-admin-notifications-seen-at";
const SEEN_EVENT = "atlas:notifications-seen";
const POLL_MS = 12_000;

const TONE: Record<
  PlatformActivityTone,
  { icon: LucideIcon; light: string; dark: string }
> = {
  order: {
    icon: ShoppingCart,
    light: "bg-sky-50 text-sky-700 ring-sky-100",
    dark: "bg-sky-400/15 text-sky-300",
  },
  catalog: {
    icon: Boxes,
    light: "bg-violet-50 text-violet-700 ring-violet-100",
    dark: "bg-violet-400/15 text-violet-300",
  },
  store: {
    icon: Store,
    light: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    dark: "bg-emerald-400/15 text-emerald-300",
  },
  staff: {
    icon: Users,
    light: "bg-amber-50 text-amber-700 ring-amber-100",
    dark: "bg-amber-400/15 text-amber-300",
  },
  theme: {
    icon: Palette,
    light: "bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-100",
    dark: "bg-fuchsia-400/15 text-fuchsia-300",
  },
  billing: {
    icon: Receipt,
    light: "bg-teal-50 text-teal-700 ring-teal-100",
    dark: "bg-teal-400/15 text-teal-300",
  },
  support: {
    icon: LifeBuoy,
    light: "bg-rose-50 text-rose-700 ring-rose-100",
    dark: "bg-rose-400/15 text-rose-300",
  },
  security: {
    icon: ShieldCheck,
    light: "bg-indigo-50 text-indigo-700 ring-indigo-100",
    dark: "bg-indigo-400/15 text-indigo-300",
  },
  neutral: {
    icon: Bell,
    light: "bg-ink-100 text-ink-600 ring-ink-200",
    dark: "bg-white/10 text-white/70",
  },
};

function markSeen(timestamp: string) {
  try {
    localStorage.setItem(SEEN_KEY, timestamp);
  } catch {
    // Private mode can block storage; the feed still works without unread state.
  }
  window.dispatchEvent(new Event(SEEN_EVENT));
}

function readSeen(): string | null {
  try {
    return localStorage.getItem(SEEN_KEY);
  } catch {
    return null;
  }
}

function badgeLabel(count: number): string {
  return count > 9 ? "9+" : String(count);
}

async function fetchActivity(limit: number, since: string | null): Promise<PlatformActivitySnapshot | null> {
  try {
    const params = new URLSearchParams({ limit: String(limit) });
    if (since) params.set("since", since);
    const response = await fetch(`/api/v1/super-admin/notifications?${params.toString()}`, {
      cache: "no-store",
    });
    if (!response.ok) return null;
    const json = (await response.json()) as { data?: PlatformActivitySnapshot };
    return json.data ?? null;
  } catch {
    return null;
  }
}

export function SuperAdminNotificationBell({ initialUnread }: { initialUnread: number }) {
  const pathname = usePathname();
  const onNotificationsPage = pathname === "/super-admin/notifications";
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<PlatformActivityItem[]>([]);
  const [unread, setUnread] = useState(initialUnread);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const data = await fetchActivity(8, readSeen());
    if (!data) {
      setLoading(false);
      return;
    }
    setItems(data.items);
    setUnread(onNotificationsPage || open ? 0 : data.unread);
    setLoading(false);
  }, [onNotificationsPage, open]);

  useEffect(() => {
    const initial = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, POLL_MS);
    const onFocus = () => load();
    const onSeen = () => load();
    window.addEventListener("focus", onFocus);
    window.addEventListener(SEEN_EVENT, onSeen);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener(SEEN_EVENT, onSeen);
    };
  }, [load]);

  const seen = () => {
    const latest = items[0]?.createdAt ?? new Date().toISOString();
    setUnread(0);
    markSeen(latest);
  };

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      setUnread(0);
      const latest = items[0]?.createdAt;
      if (latest) markSeen(latest);
      void load();
    } else {
      seen();
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`নোটিফিকেশন${unread > 0 && !onNotificationsPage ? ` (${unread}টি নতুন)` : ""}`}
        className="relative grid h-9 w-9 place-items-center rounded-lg text-white/55 transition hover:bg-white/5 hover:text-white"
      >
        {unread > 0 && !onNotificationsPage ? (
          <BellRing className="h-4 w-4" strokeWidth={1.8} />
        ) : (
          <Bell className="h-4 w-4" strokeWidth={1.8} />
        )}
        {unread > 0 && !onNotificationsPage ? (
          <span className="absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white ring-2 ring-[#0b1220]">
            {badgeLabel(unread)}
          </span>
        ) : null}
      </button>

      {open ? (
        <>
          <div
            aria-hidden="true"
            className="fixed inset-0 z-40"
            onClick={() => {
              setOpen(false);
              seen();
            }}
          />
          <div
            role="dialog"
            aria-label="প্ল্যাটফর্ম নোটিফিকেশন"
            className="absolute top-full right-0 z-50 mt-2 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-white/10 bg-[#0f172a] text-left text-white shadow-2xl shadow-black/40"
          >
            <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
              <div>
                <p className="text-sm font-semibold">প্ল্যাটফর্ম নোটিফিকেশন</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-[10px] text-white/45">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                  লাইভ সিঙ্ক · প্রতি ১২ সেকেন্ডে
                </p>
              </div>
              <Link
                href="/super-admin/notifications"
                onClick={() => {
                  setOpen(false);
                  seen();
                }}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-indigo-300 transition hover:bg-white/5 hover:text-indigo-200"
              >
                সব দেখুন
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            {loading && items.length === 0 ? (
              <div className="flex items-center justify-center gap-2 px-4 py-10 text-xs text-white/50">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                লোড হচ্ছে…
              </div>
            ) : items.length === 0 ? (
              <p className="px-4 py-10 text-center text-xs text-white/50">
                এখনো কোনো প্ল্যাটফর্ম আপডেট নেই।
              </p>
            ) : (
              <ul className="max-h-[25rem] divide-y divide-white/5 overflow-y-auto">
                {items.slice(0, 6).map((item) => {
                  const tone = TONE[item.tone] ?? TONE.neutral;
                  const Icon = tone.icon;
                  return (
                    <li key={item.id}>
                      <Link
                        href={item.href ?? "/super-admin/notifications"}
                        onClick={() => {
                          setOpen(false);
                          seen();
                        }}
                        className="flex gap-3 px-4 py-3 transition hover:bg-white/[0.04]"
                      >
                        <span
                          className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg ${tone.dark}`}
                        >
                          <Icon className="h-4 w-4" strokeWidth={1.8} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[12px] font-semibold text-white">
                              {item.title}
                            </span>
                            <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[8px] font-medium text-white/50">
                              {item.category}
                            </span>
                          </span>
                          <span className="mt-1 line-clamp-2 block text-[11px] leading-relaxed text-white/60">
                            {item.detail}
                          </span>
                          <span className="mt-1 block truncate text-[10px] text-white/35">
                            {item.actorName}
                            {item.tenantName && item.tenantName !== item.actorName
                              ? ` · ${item.tenantName}`
                              : ""}{" "}
                            · {formatRelativeBn(item.createdAt)}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="border-t border-white/10 px-4 py-2.5 text-center">
              <Link
                href="/super-admin/notifications"
                onClick={() => {
                  setOpen(false);
                  seen();
                }}
                className="text-[10px] font-medium text-white/45 transition hover:text-white/70"
              >
                সম্পূর্ণ অ্যাক্টিভিটি ফিড
              </Link>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

export function PlatformNotificationsFeed({ initial }: { initial: PlatformActivitySnapshot }) {
  const [items, setItems] = useState<PlatformActivityItem[]>(initial.items);
  const [filter, setFilter] = useState("সব");
  const [updatedAt, setUpdatedAt] = useState(initial.serverTime);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    const data = await fetchActivity(100, readSeen());
    if (data) {
      setItems(data.items);
      setUpdatedAt(data.serverTime);
      if (data.items[0]) markSeen(data.items[0].createdAt);
    }
    setRefreshing(false);
  }, []);

  useEffect(() => {
    if (initial.latestAt) markSeen(initial.latestAt);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, POLL_MS);
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [initial.latestAt, load]);

  const categories = useMemo(
    () => ["সব", ...Array.from(new Set(items.map((item) => item.category)))],
    [items],
  );

  const visible = filter === "সব" ? items : items.filter((item) => item.category === filter);
  const now = new Date(updatedAt);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {categories.map((category) => {
            const active = category === filter;
            return (
              <button
                key={category}
                type="button"
                onClick={() => setFilter(category)}
                className={`rounded-full border px-3 py-1 text-[11px] font-medium transition ${
                  active
                    ? "border-indigo-600 bg-indigo-600 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:text-indigo-700"
                }`}
              >
                {category}
                {category === "সব" ? ` (${items.length})` : null}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3 text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            লাইভ · শেষ আপডেট {formatRelativeBn(now)}
          </span>
          <button
            type="button"
            onClick={() => void load()}
            disabled={refreshing}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
            রিফ্রেশ
          </button>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <span className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-slate-50 text-slate-400">
            <SearchX className="h-5 w-5" />
          </span>
          <p className="mt-3 text-sm font-semibold text-slate-800">কোনো আপডেট নেই</p>
          <p className="mt-1 text-xs text-slate-500">
            এই ফিল্টারে কোনো প্ল্যাটফর্ম নোটিফিকেশন পাওয়া যায়নি।
          </p>
        </div>
      ) : (
        <ol className="space-y-2.5">
          {visible.map((item) => {
            const tone = TONE[item.tone] ?? TONE.neutral;
            const Icon = tone.icon;
            return (
              <li
                key={item.id}
                className="flex gap-3.5 rounded-xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:border-slate-300"
              >
                <span
                  className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg ring-1 ${tone.light}`}
                >
                  <Icon className="h-4 w-4" strokeWidth={1.8} />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <h3 className="text-sm font-semibold text-slate-900">{item.title}</h3>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[9px] font-medium text-slate-500">
                      {item.category}
                    </span>
                    {item.href ? (
                      <Link
                        href={item.href}
                        className="text-[10px] font-semibold text-indigo-600 hover:underline"
                      >
                        বিস্তারিত
                      </Link>
                    ) : null}
                  </div>
                  <p className="mt-1 text-[12px] leading-relaxed text-slate-600">{item.detail}</p>
                  <p className="mt-2 flex flex-wrap items-center gap-x-1.5 text-[10px] text-slate-400">
                    <span className="font-medium text-slate-500">{item.actorName}</span>
                    {item.tenantName && item.tenantName !== item.actorName ? (
                      <span>· {item.tenantName}</span>
                    ) : null}
                    {item.resourceType ? (
                      <span className="font-mono">
                        · {item.resourceType}
                        {item.resourceId ? `:${item.resourceId.slice(-6)}` : ""}
                      </span>
                    ) : null}
                    <span>· {formatRelativeBn(item.createdAt)}</span>
                  </p>
                </div>

                <span
                  className="hidden shrink-0 self-center font-mono text-[10px] text-slate-400 sm:block"
                  title={new Date(item.createdAt).toLocaleString("bn-BD")}
                >
                  {new Date(item.createdAt).toLocaleTimeString("bn-BD", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
