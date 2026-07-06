import NextAuth, { type NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";

const providers: NextAuthConfig["providers"] = [
  Google,
  ...(process.env.AUTH_TEST_MODE === "true"
    ? [
        Credentials({
          name: "Test",
          credentials: { email: { label: "Email", type: "email" } },
          async authorize(credentials) {
            const email = credentials?.email;
            if (typeof email !== "string" || !email.includes("@")) return null;
            const user = await prisma.user.upsert({
              where: { email },
              create: { email },
              update: {},
            });
            return { id: user.id, email: user.email };
          },
        }),
      ]
    : []),
];

export const authConfig = {
  providers,
  trustHost: true,
  session: { strategy: "jwt" },
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      await prisma.user.upsert({
        where: { email: user.email },
        create: { email: user.email },
        update: {},
      });
      return true;
    },
    async jwt({ token, user }) {
      // Resolve userId from OUR database by email — never trust the provider's
      // user.id (e.g. Google's `sub`), which is not our User.id (a cuid). Using
      // it would break the Analysis.userId foreign key on persist and the
      // history lookup (which queries by session.user.id).
      const email = user?.email ?? (typeof token.email === "string" ? token.email : undefined);
      if (email) {
        token.email = email;
        // Look up on sign-in (user present) or whenever the id is missing.
        if (user || !token.userId) {
          const dbUser = await prisma.user.findUnique({ where: { email } });
          if (dbUser) token.userId = dbUser.id;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.userId) {
        session.user.id = token.userId;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;

export const { handlers, signIn, signOut, auth } = NextAuth(authConfig);
