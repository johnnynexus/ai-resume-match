"use client";

import { signIn, signOut, useSession } from "next-auth/react";

export function AuthButton() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <span className="text-sm text-neutral-500">Loading…</span>;
  }

  if (!session) {
    return (
      <button
        type="button"
        onClick={() => signIn("google")}
        className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
      >
        Sign in with Google
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-neutral-600 dark:text-neutral-400">{session.user.email}</span>
      <button
        type="button"
        onClick={() => signOut()}
        className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
      >
        Sign out
      </button>
    </div>
  );
}
