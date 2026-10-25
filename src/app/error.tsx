"use client";

import { useEffect } from "react";
import { AlertTriangle, Database, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Root error boundary.
 *
 * The raw Postgres/Prisma stack ("Can't reach database server at 127.0.0.1:51214")
 * is meaningless to whoever is trying to sign in, and it is what a stopped local
 * database produced. Detect that case and tell the operator exactly which command
 * brings the database back; everything else gets a calm retry surface.
 */

function isDatabaseDown(error: Error): boolean {
  const text = `${error.name} ${error.message} ${String((error as { cause?: unknown }).cause ?? "")}`;
  return /can't reach database server|P1001|ECONNREFUSED|connection refused|database system is starting up|DatabaseNotReachable|DriverAdapterError|Connection terminated/i.test(
    text,
  );
}

export default function AppError({ error }: { error: Error & { digest?: string } }) {
  const databaseDown = isDatabaseDown(error);

  useEffect(() => {
    // Keep the real error in the browser console / server log for debugging.
    console.error(error);
  }, [error]);

  return (
    <div className="grid min-h-screen place-items-center bg-ink-50 px-4 py-16">
      <div className="w-full max-w-lg rounded-2xl border border-ink-200 bg-white p-6 shadow-sm">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-ink-100 px-2.5 py-1 text-[10.5px] font-semibold tracking-wide text-ink-600 uppercase">
          {databaseDown ? <Database className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
          ATLaS
        </span>

        <h1 className="mt-3 text-xl font-semibold text-ink-900">
          {databaseDown ? "ডাটাবেসে সংযোগ করা যাচ্ছে না" : "কিছু একটা ভুল হয়েছে"}
        </h1>

        <p className="mt-2 text-sm leading-relaxed text-ink-600">
          {databaseDown
            ? "লোকাল Prisma Postgres সার্ভার চলছে না, তাই লগইন ও ডেটা লোড হচ্ছে না। নিচের কমান্ড দিয়ে ডাটাবেস চালু করুন, তারপর আবার চেষ্টা করুন।"
            : "অনুগ্রহ করে আবার চেষ্টা করুন। সমস্যা থেকে গেলে সার্ভারের লগ দেখুন।"}
        </p>

        {databaseDown ? (
          <div className="mt-4">
            <p className="text-[11px] font-semibold tracking-wide text-ink-500 uppercase">
              Terminal
            </p>
            <pre className="mt-1.5 overflow-x-auto rounded-lg bg-ink-900 px-3 py-2 text-[12.5px] text-white select-all">
              npx prisma dev start atlas
            </pre>
            <p className="mt-2 text-[11.5px] text-ink-500">
              তারপর <span className="font-mono">npm run dev</span> চালু থাকলে শুধু এই পেজ রিলোড করুন।
            </p>
          </div>
        ) : null}

        <div className="mt-5 flex items-center gap-2">
          {/* A hard reload re-runs the server render; Next's soft `reset()` alone
              can replay the cached failure and leave the user stuck here. */}
          <Button type="button" onClick={() => window.location.reload()}>
            <RotateCcw className="h-3.5 w-3.5" />
            আবার চেষ্টা করুন
          </Button>
          <a
            href="/login"
            className="inline-flex items-center rounded-lg border border-ink-200 px-4 py-2 text-sm font-medium text-ink-700 transition hover:bg-ink-50"
          >
            লগইনে ফিরুন
          </a>
        </div>
      </div>
    </div>
  );
}
