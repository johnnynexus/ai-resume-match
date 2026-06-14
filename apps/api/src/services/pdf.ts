// pdf-parse is CommonJS; import the library entry directly to avoid its
// index.js debug harness (which tries to read a bundled sample file).
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { AppError } from "../lib/errors.js";

/**
 * Minimum characters of extracted text below which we assume the PDF is a
 * scanned/image-only file. CLAUDE.md: detect this and return a clear error
 * rather than sending empty text to Claude. (OCR is a documented stretch goal.)
 */
const MIN_TEXT_LENGTH = 30;

export type ParsedPdf = {
  text: string;
  charCount: number;
};

export async function parsePdf(buffer: Buffer): Promise<ParsedPdf> {
  let text: string;
  try {
    const result = await pdfParse(buffer);
    text = result.text.trim();
  } catch {
    throw new AppError("PDF_PARSE_FAILED", "Could not read the PDF file. Is it a valid PDF?", 400);
  }

  if (text.length < MIN_TEXT_LENGTH) {
    throw new AppError(
      "EMPTY_PDF",
      "This PDF appears to be scanned or image-only — no extractable text was found. " +
        "Please upload a text-based PDF.",
      422,
    );
  }

  return { text, charCount: text.length };
}
