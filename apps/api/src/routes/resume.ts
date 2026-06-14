import type { FastifyInstance } from "fastify";
import { AppError } from "../lib/errors.js";
import { parsePdf } from "../services/pdf.js";

/**
 * Parse an uploaded resume PDF into text. The web app uploads here first, then
 * sends the returned text to /api/analyze. PDF bytes never leave the server.
 */
export async function resumeRoutes(app: FastifyInstance): Promise<void> {
  app.post("/api/resume/parse", async (request) => {
    const file = await request.file();
    if (!file) {
      throw new AppError("NO_FILE", "No file was uploaded.", 400);
    }
    if (file.mimetype !== "application/pdf") {
      throw new AppError("UNSUPPORTED_FILE_TYPE", "Only PDF files are supported.", 415);
    }

    const buffer = await file.toBuffer();
    const { text, charCount } = await parsePdf(buffer);

    return { fileName: file.filename, parsedText: text, charCount };
  });
}
