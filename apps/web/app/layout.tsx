import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { AuthButton } from "@/components/AuthButton";

export const metadata: Metadata = {
  title: "ResumeMatch",
  description: "Analyze how well your resume matches a job description, powered by AI.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <header className="border-b border-neutral-200 dark:border-neutral-800">
            <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
              <nav className="flex items-center gap-4">
                <Link href="/" className="font-semibold">
                  ResumeMatch
                </Link>
                <Link href="/history" className="text-sm text-neutral-600 hover:text-neutral-900 dark:text-neutral-400">
                  History
                </Link>
              </nav>
              <AuthButton />
            </div>
          </header>
          {children}
        </Providers>
      </body>
    </html>
  );
}
