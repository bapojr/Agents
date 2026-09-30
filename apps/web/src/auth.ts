import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import PostgresAdapter from "@auth/pg-adapter";
import { database } from "./lib/database";
import { env } from "./lib/env";
import { authenticate, credentialsSchema } from "./lib/identity";
import { allowAttempt, clientBucket } from "./lib/rate-limit";

export const { handlers, auth } = NextAuth(() => {
  const config = env();
  return {
    secret: config.AUTH_SECRET,
    // AUTH_URL is explicitly set by deployment; do not derive it from an untrusted Host.
    trustHost: true,
    adapter: PostgresAdapter(database()),
    session: { strategy: "jwt", maxAge: 60 * 60 * 24 },
    pages: { signIn: "/sign-in", error: "/sign-in" },
    providers: [
      Credentials({
        credentials: { email: {}, password: {} },
        async authorize(input, request) {
          const parsed = credentialsSchema.safeParse(input);
          if (!parsed.success) return null;
          const bucket = clientBucket(request.headers, config.TRUST_PROXY === "true");
          if (!await allowAttempt("login-client", bucket, 30, 60)) return null;
          if (!await allowAttempt("login-email", parsed.data.email, 5, 900)) return null;
          return authenticate(database(), parsed.data);
        },
      }),
      ...(config.AUTH_GOOGLE_ID && config.AUTH_GOOGLE_SECRET ? [Google({
        clientId: config.AUTH_GOOGLE_ID, clientSecret: config.AUTH_GOOGLE_SECRET,
        profile(profile) {
          return {id: profile.sub, name: profile.name, email: profile.email.toLowerCase(), image: profile.picture};
        },
        // Account linking remains Auth.js's explicit, authenticated flow.
        allowDangerousEmailAccountLinking: false,
      })] : []),
    ],
    callbacks: {
      signIn({ account, profile }) {
        return account?.provider !== "google" || profile?.email_verified === true;
      },
      jwt({ token, user }) {
        if (user?.id) token.sub = String(user.id);
        return token;
      },
      async session({ session, token }) {
        if (token.sub) session.user.id = token.sub;
        return session;
      },
    },
    logger: {
      error() { console.error("Authentication request failed"); },
      warn(code) { console.warn("Authentication warning", code); },
    },
  };
});
