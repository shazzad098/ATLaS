"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form";
import { EMPTY_ADMIN_STATE } from "@/app/admin/state";
import {
  cancelDeletionAction,
  changePasswordAction,
  requestDeletionAction,
  updateProfileAction,
} from "@/app/account/actions";

/** Client forms for the account page; each one wraps a single server action. */

function Feedback({ ok, message }: { ok: boolean; message: string }) {
  if (!message) return null;
  return <p className={`text-xs ${ok ? "text-emerald-700" : "text-red-600"}`}>{message}</p>;
}

export function ProfileForm({ name, email, phone }: { name: string; email: string; phone: string }) {
  const [state, submit, pending] = useActionState(updateProfileAction, EMPTY_ADMIN_STATE);

  return (
    <form action={submit} className="space-y-3">
      <Field label="নাম" required>
        <Input name="name" defaultValue={name} required />
      </Field>
      <Field label="ইমেইল" hint="ইনভয়েস ও নোটিফিকেশনের জন্য">
        <Input name="email" type="email" defaultValue={email} placeholder="you@example.com" />
      </Field>
      <Field label="মোবাইল নম্বর" hint="নম্বর বদলাতে সহায়তা টিমে টিকেট খুলুন">
        <Input value={phone} readOnly disabled />
      </Field>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "সংরক্ষণ হচ্ছে…" : "সংরক্ষণ করুন"}
        </Button>
        <Feedback ok={state.ok} message={state.message} />
      </div>
    </form>
  );
}

export function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const [state, submit, pending] = useActionState(changePasswordAction, EMPTY_ADMIN_STATE);

  return (
    <form action={submit} className="space-y-3">
      {hasPassword ? (
        <Field label="বর্তমান পাসওয়ার্ড" required>
          <Input name="currentPassword" type="password" required autoComplete="current-password" />
        </Field>
      ) : (
        <p className="text-xs text-ink-500">
          এই অ্যাকাউন্টে এখনো পাসওয়ার্ড নেই — প্রথমবার সেট করছেন।
        </p>
      )}
      <Field label="নতুন পাসওয়ার্ড" required hint="অন্তত ৮ অক্ষর, একটি সংখ্যা ও একটি বড় হাতের অক্ষর">
        <Input name="newPassword" type="password" required autoComplete="new-password" />
      </Field>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "হালনাগাদ হচ্ছে…" : "পাসওয়ার্ড বদলান"}
        </Button>
        <Feedback ok={state.ok} message={state.message} />
      </div>
    </form>
  );
}

export function DeletionForm({ effectiveAt }: { effectiveAt: string | null }) {
  const [state, submit, pending] = useActionState(requestDeletionAction, EMPTY_ADMIN_STATE);
  const [cancelState, cancelSubmit, cancelPending] = useActionState(cancelDeletionAction, EMPTY_ADMIN_STATE);

  if (effectiveAt) {
    return (
      <form action={cancelSubmit} className="space-y-3">
        <p className="text-sm text-amber-800">
          মুছে ফেলার অনুরোধ {effectiveAt} পর্যন্ত সক্রিয়। এর মধ্যে বাতিল না করলে ডেটা স্থায়ীভাবে মুছে যাবে।
        </p>
        <div className="flex items-center gap-3">
          <Button type="submit" variant="outline" disabled={cancelPending}>
            {cancelPending ? "…" : "অনুরোধ বাতিল করুন"}
          </Button>
          <Feedback ok={cancelState.ok} message={cancelState.message} />
        </div>
      </form>
    );
  }

  return (
    <form action={submit} className="space-y-3">
      <Field label="কারণ (ঐচ্ছিক)" hint="কেন অ্যাকাউন্ট বন্ধ করতে চান — সেবা উন্নত করতে সহায়ক">
        <Textarea name="reason" placeholder="যেমন: আর ব্যবসা চালাচ্ছি না" />
      </Field>
      <p className="text-xs text-ink-500">
        ৩০ দিনের রিটেনশন উইন্ডো থাকবে, এর মধ্যে আবার লগইন করে বাতিল করা যাবে।
      </p>
      <div className="flex items-center gap-3">
        <Button type="submit" variant="danger" disabled={pending} className="bg-red-600">
          {pending ? "…" : "মুছে ফেলার অনুরোধ"}
        </Button>
        <Feedback ok={state.ok} message={state.message} />
      </div>
    </form>
  );
}
