import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getApiBaseUrl } from "@/lib/backend";

export async function POST(req: Request): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Sign in to upload a resume." } },
      { status: 401 },
    );
  }

  const formData = await req.formData();
  const res = await fetch(`${getApiBaseUrl()}/api/resume/parse`, {
    method: "POST",
    body: formData,
  });

  const data: unknown = await res.json().catch(() => null);
  return NextResponse.json(data, { status: res.status });
}
