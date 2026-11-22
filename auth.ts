import NextAuth from "next-auth";
import { isEmailAllowed } from "@/lib/auth/allowlist";
import { createAuthConfig } from "@/lib/auth/config";
import { shouldUseSecureCookies } from "@/lib/auth/cookies";
import { getOtpSecret } from "@/lib/auth/otp-secret";
import { verifyOtp } from "@/lib/auth/otp-service";
import { neonOtpStore } from "@/lib/auth/otp-store";
import { neonSessionStore } from "@/lib/auth/sessions";

export const { handlers, auth, signIn, signOut } = NextAuth(
  createAuthConfig({
    isEmailAllowed,
    verifyOtp: (email, code) =>
      verifyOtp(
        { store: neonOtpStore, secret: getOtpSecret(), now: () => new Date() },
        email,
        code,
      ),
    sessions: neonSessionStore,
    secureCookies: shouldUseSecureCookies(),
  }),
);
