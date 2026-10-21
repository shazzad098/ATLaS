import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { KeyRound, MonitorSmartphone, ShieldAlert, UserRound } from "lucide-react";
import { readSession, listSessions } from "@/lib/auth/session";
import { getAccountProfile } from "@/lib/services/account-service";
import { formatDate, formatDateTime } from "@/lib/dates";
import { Badge, Card, CardBody, CardHeader, PageHeader } from "@/components/ui/shell";
import { ButtonLink } from "@/components/ui/button";
import { FormButton } from "@/app/admin/_components/form-button";
import { logoutAction } from "@/app/(auth)/actions";
import { revokeOtherSessionsAction, revokeSessionAction } from "@/app/account/actions";
import { DeletionForm, PasswordForm, ProfileForm } from "@/app/account/_components/account-forms";

/**
 * Account & security (FR-01).
 *
 * Sessions, password and the deletion request live here, next to the profile, so
 * a merchant never has to hunt through store settings to secure their login.
 */

export const metadata: Metadata = { title: "অ্যাকাউন্ট ও সিকিউরিটি" };

export default async function AccountPage() {
  const session = await readSession();
  if (!session) redirect("/login");

  const [profile, sessions] = await Promise.all([
    getAccountProfile(session.user.id),
    listSessions(session.user.id),
  ]);

  const user = profile.user;
  const deletion = profile.deletionRequest;

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader
          title="অ্যাকাউন্ট ও সিকিউরিটি"
          description="প্রোফাইল, পাসওয়ার্ড, সেশন আর ডেটা রিটেনশন — সব এক জায়গায়।"
        />
        <div className="flex items-center gap-2">
          <ButtonLink href={user.isSuperAdmin ? "/super-admin" : "/admin"} variant="outline" size="sm">
            ড্যাশবোর্ড
          </ButtonLink>
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-ink-600 hover:bg-ink-100"
            >
              লগআউট
            </button>
          </form>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader
            title={
              <span className="inline-flex items-center gap-1.5">
                <UserRound className="h-4 w-4" /> প্রোফাইল
              </span>
            }
            description={`অ্যাকাউন্ট খোলা হয়েছে ${formatDate(user.createdAt)} · ${profile.memberships.length}টি workspace`}
          />
          <CardBody>
            <ProfileForm name={user.name ?? ""} email={user.email ?? ""} phone={user.phone} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title={
              <span className="inline-flex items-center gap-1.5">
                <KeyRound className="h-4 w-4" /> পাসওয়ার্ড
              </span>
            }
            description="OTP দিয়ে লগইন সবসময় চালু থাকে।"
          />
          <CardBody>
            <PasswordForm hasPassword={Boolean(user.passwordHash)} />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title={
            <span className="inline-flex items-center gap-1.5">
              <MonitorSmartphone className="h-4 w-4" /> সক্রিয় সেশন
            </span>
          }
          description="প্রতিটি ডিভাইসে আলাদা রিফ্রেশ টোকেন — সন্দেহ হলে বন্ধ করে দিন।"
          action={
            sessions.length > 1 ? (
              <FormButton action={revokeOtherSessionsAction} variant="outline" size="sm">
                অন্যসব সেশন বন্ধ
              </FormButton>
            ) : null
          }
        />
        <CardBody className="space-y-2">
          {sessions.map((item) => {
            const isCurrent = item.id === session.sessionId;
            return (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ink-200 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink-900">
                    {item.userAgent ? item.userAgent.split(")")[0].replace("Mozilla/5.0 (", "") : "অজানা ডিভাইস"}
                    {isCurrent ? <Badge tone="success" className="ml-2">এখনকার</Badge> : null}
                  </p>
                  <p className="text-xs text-ink-500">
                    {item.ip ?? "—"} · শুরু {formatDateTime(item.createdAt)} · শেষ {formatDate(item.expiresAt)}
                  </p>
                </div>
                {isCurrent ? null : (
                  <FormButton
                    action={revokeSessionAction}
                    fields={{ sessionId: item.id }}
                    variant="ghost"
                    size="sm"
                  >
                    বন্ধ করুন
                  </FormButton>
                )}
              </div>
            );
          })}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={
            <span className="inline-flex items-center gap-1.5">
              <ShieldAlert className="h-4 w-4 text-red-600" /> অ্যাকাউন্ট মুছে ফেলা
            </span>
          }
          description="ডেটা রিটেনশন ৩০ দিন — এর মধ্যে বাতিল করা যায়।"
        />
        <CardBody>
          <DeletionForm effectiveAt={deletion?.effectiveAt ? formatDate(deletion.effectiveAt) : null} />
        </CardBody>
      </Card>

      <p className="text-center text-xs text-ink-500">
        লগইন ইভেন্ট ও সেশন ইতিহাস{" "}
        <Link href="/super-admin/audit" className="font-medium text-brand-700 hover:underline">
          audit log
        </Link>
        -এ সংরক্ষিত থাকে।
      </p>
    </div>
  );
}
