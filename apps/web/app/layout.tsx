import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ResumeMatch",
  description: "Analyze how well your resume matches a job description, powered by Claude.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
