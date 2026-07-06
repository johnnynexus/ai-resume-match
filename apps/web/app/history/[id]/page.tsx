import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { analysisResultSchema } from "@resumematch/shared";
import { AnalysisView } from "@/components/AnalysisView";

export default async function HistoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/");
  }

  const { id } = await params;
  const row = await prisma.analysis.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!row) {
    notFound();
  }

  const parsed = analysisResultSchema.safeParse(row.resultJson);
  if (!parsed.success) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <header className="mb-8">
        <Link href="/history" className="text-sm text-neutral-500 underline">
          ← Back to history
        </Link>
        <h1 className="mt-2 text-3xl font-bold">Past analysis</h1>
        <p className="text-neutral-500">{row.createdAt.toLocaleString()}</p>
      </header>

      <AnalysisView result={parsed.data} cached />
    </main>
  );
}
