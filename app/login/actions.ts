"use server";

import { after } from "next/server";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";
import { isEmailAllowed } from "@/lib/auth/allowlist";
import { clientIp } from "@/lib/auth/client-ip";
import { EMAIL_OTP_PROVIDER } from "@/lib/auth/config";
import { shouldUseSecureCookies } from "@/lib/auth/cookies";
import { EmailSchema, OTP_TTL_MS, OtpCodeSchema } from "@/lib/auth/otp";
import { otpEmail } from "@/lib/auth/otp-email";
import { getOtpSecret } from "@/lib/auth/otp-secret";
import { requestOtp } from "@/lib/auth/otp-service";
import { neonOtpStore } from "@/lib/auth/otp-store";
import { PENDING_EMAIL_COOKIE } from "@/lib/auth/pending-email";
import { getMailer } from "@/lib/mail/mailer";

/**
 * The email-code sign-in, as two Server Actions and no client JS. Each one
 * ends in a redirect, and the pages read `?error=` to say what happened.
 *
 * The address being signed in is carried between the two steps in a
 * short-lived httpOnly cookie rather than the URL, so it does not land in
 * history, logs or a `Referer`.
 */

/** Step 1: issue a code. Answers the same whether or not the address can sign in. */
export async function requestOtpAction(formData: FormData): Promise<void> {
  const parsed = EmailSchema.safeParse(String(formData.get("email") ?? ""));
  if (!parsed.success) redirect("/login?error=email");
  const email = parsed.data;

  let result;
  try {
    const mailer = getMailer();
    result = await requestOtp(
      {
        store: neonOtpStore,
        secret: getOtpSecret(),
        now: () => new Date(),
        isAllowed: isEmailAllowed,
        sendCode: async (to, code) => {
          await mailer.send(otpEmail(to, code));
        },
        defer: (task) => after(task),
      },
      email,
      clientIp(await headers()),
    );
  } catch (error) {
    console.error("requestOtpAction failed:", error);
    redirect("/login?error=unavailable");
  }

  (await cookies()).set(PENDING_EMAIL_COOKIE, email, {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookies(),
    path: "/login",
    maxAge: OTP_TTL_MS / 1000,
  });

  redirect(result.status === "rate_limited" ? "/login/verify?error=rate_limited" : "/login/verify");
}

/** Step 2: check the code and, if it is right, sign in. */
export async function verifyOtpAction(formData: FormData): Promise<void> {
  const jar = await cookies();
  const email = EmailSchema.safeParse(jar.get(PENDING_EMAIL_COOKIE)?.value ?? "");
  if (!email.success) redirect("/login?error=expired");

  const code = OtpCodeSchema.safeParse(String(formData.get("code") ?? ""));
  if (!code.success) redirect("/login/verify?error=code");

  try {
    await signIn(EMAIL_OTP_PROVIDER, {
      email: email.data,
      code: code.data,
      redirect: false,
    });
  } catch (error) {
    // Wrong, expired, used up, or out of attempts — deliberately one answer.
    if (error instanceof AuthError) redirect("/login/verify?error=invalid");
    throw error;
  }

  jar.delete({ name: PENDING_EMAIL_COOKIE, path: "/login" });
  redirect("/");
}

/** Revokes the server-side session, then clears the cookie. */
export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}
