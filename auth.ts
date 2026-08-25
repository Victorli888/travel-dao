import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { isEmailAllowed } from "@/lib/auth/allowlist";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    // `user` is only present on the initial sign-in; afterwards the decision
    // is carried by the token.
    async jwt({ token, user }) {
      if (user?.email) token.isAllowed = await isEmailAllowed(user.email);
      return token;
    },
    async session({ session, token }) {
      session.user.isAllowed = token.isAllowed ?? false;
      return session;
    },
  },
});
