import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export default async function HistoryPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/");
  }

  const analyses = await prisma.analysis.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      overallScore: true,
      createdAt: true,
      resumeId: true,
      jobDescriptionId: true,
    },
  });

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <header className="mb-8">
        <h1 className="text-3xl font-bold">Analysis history</h1>
        <p className="text-neutral-500">Past analyses for your account.</p>
      </header>

      {analyses.length === 0 ? (
        <p className="text-neutral-500">
          No analyses yet.{" "}
          <Link href="/" className="underline">
            Run your first match
          </Link>
          .
        </p>
      ) : (
        <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
          {analyses.map((row) => (
            <li key={row.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="font-medium">{row.overallScore} / 100</p>
                <p className="text-sm text-neutral-500">
                  {row.createdAt.toLocaleString()}
                </p>
              </div>
              <Link
                href={`/history/${row.id}`}
                className="text-sm font-medium underline"
              >
                View
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
