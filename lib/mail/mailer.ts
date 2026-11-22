import { z } from "zod";
import { ConfigError } from "@/lib/api/errors";

/**
 * Outbound email, behind an interface so the provider is a configuration
 * choice. The repo had no email provider before sign-in codes needed one.
 *
 * - `RESEND_API_KEY` + `MAIL_FROM` set → Resend's HTTP API, over `fetch`
 *   (no SDK dependency, and it works on any runtime).
 * - Neither set, outside production → the console mailer, which logs the
 *   message so sign-in works locally with no provider at all.
 * - Neither set, in production → `ConfigError`. Logging a sign-in code to a
 *   production log would hand it to anyone who can read the logs.
 *
 * Adding a provider is one more `Mailer` and one more branch in `getMailer`.
 */
export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

const MailEnvSchema = z.object({
  RESEND_API_KEY: z.string().min(1).optional(),
  MAIL_FROM: z.string().min(1).optional(),
  NODE_ENV: z.string().optional(),
});

export const consoleMailer: Mailer = {
  async send({ to, subject, text }) {
    console.info(`[mail:console] to=${to} subject=${JSON.stringify(subject)}\n${text}`);
  },
};

export function resendMailer(
  apiKey: string,
  from: string,
  fetchImpl: typeof fetch = fetch,
): Mailer {
  return {
    async send({ to, subject, text }) {
      const res = await fetchImpl("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ from, to: [to], subject, text }),
      });
      if (!res.ok) {
        // The body names the problem (bad sender domain, bad key) and holds
        // nothing secret; the message itself is never echoed.
        throw new Error(`Resend rejected the message: ${res.status} ${await res.text()}`);
      }
    },
  };
}

/** Picks the mailer from the environment. See the module comment. */
export function getMailer(
  env: Record<string, string | undefined> = process.env,
): Mailer {
  const parsed = MailEnvSchema.parse(env);
  if (parsed.RESEND_API_KEY) {
    if (!parsed.MAIL_FROM) {
      throw new ConfigError("RESEND_API_KEY is set but MAIL_FROM is not.");
    }
    return resendMailer(parsed.RESEND_API_KEY, parsed.MAIL_FROM);
  }
  if (parsed.NODE_ENV === "production") {
    throw new ConfigError(
      "No mail provider configured: set RESEND_API_KEY and MAIL_FROM.",
    );
  }
  return consoleMailer;
}
