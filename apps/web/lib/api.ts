import type {
  AnalyzeRequest,
  AnalyzeResponse,
  ApiError,
} from "@resumematch/shared";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

/** Thrown for non-2xx API responses; carries the structured error code. */
export class ApiRequestError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "ApiRequestError";
    this.code = code;
  }
}

function isApiError(body: unknown): body is ApiError {
  return (
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof (body as ApiError).error?.message === "string"
  );
}

async function unwrap<T>(res: Response): Promise<T> {
  const body = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) {
    if (isApiError(body)) throw new ApiRequestError(body.error.code, body.error.message);
    throw new ApiRequestError("UNKNOWN", `Request failed with status ${res.status}`);
  }
  return body as T;
}

export type ParsedResume = {
  fileName: string;
  parsedText: string;
  charCount: number;
};

/** Upload a resume PDF; the API parses it server-side and returns the text. */
export async function parseResume(file: File): Promise<ParsedResume> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/api/resume/parse`, {
    method: "POST",
    body: form,
  });
  return unwrap<ParsedResume>(res);
}

/** Run the analysis against parsed resume text + a job description. */
export async function analyze(req: AnalyzeRequest): Promise<AnalyzeResponse> {
  const res = await fetch(`${API_BASE}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  return unwrap<AnalyzeResponse>(res);
}
