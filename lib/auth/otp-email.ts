import type { MailMessage } from "@/lib/mail/mailer";
import { OTP_TTL_MS } from "./otp";

/** The sign-in code email. Plain text: it is a code, not a newsletter. */
export function otpEmail(to: string, code: string): MailMessage {
  const minutes = Math.round(OTP_TTL_MS / 60_000);
  return {
    to,
    subject: `Your Travel Tao sign-in code: ${code}`,
    text: [
      `Your Travel Tao sign-in code is ${code}.`,
      "",
      `It expires in ${minutes} minutes and works once.`,
      "If you didn't ask to sign in, you can ignore this email.",
    ].join("\n"),
  };
}
