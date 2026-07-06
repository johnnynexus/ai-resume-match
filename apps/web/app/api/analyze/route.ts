import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getApiBaseUrl, internalAuthHeaders } from "@/lib/backend";

export async function POST(req: Request): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Sign in to run an analysis." } },
      { status: 401 },
    );
  }

  const body = await req.text();
  const res = await fetch(`${getApiBaseUrl()}/api/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...internalAuthHeaders(session.user.id),
    },
    body,
  });

  const data: unknown = await res.json().catch(() => null);
  return NextResponse.json(data, { status: res.status });
}
