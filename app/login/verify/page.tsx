import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import PageShell from "@/components/ui/PageShell";
import Wordmark from "@/components/ui/Wordmark";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import AuthNotice from "@/components/auth/AuthNotice";
import { authFieldClass } from "@/components/auth/fieldStyles";
import { loginMessage } from "@/lib/auth/login-messages";
import { PENDING_EMAIL_COOKIE } from "@/lib/auth/pending-email";
import { requestOtpAction, verifyOtpAction } from "../actions";

interface Props {
  searchParams: Promise<{ error?: string | string[] }>;
}

/**
 * Step 2 of email sign-in. The copy says "if it can sign in" on purpose: the
 * page looks the same whether or not a code was actually sent.
 */
export default async function VerifyPage({ searchParams }: Props) {
  const email = (await cookies()).get(PENDING_EMAIL_COOKIE)?.value;
  if (!email) redirect("/login?error=expired");

  const message = loginMessage((await searchParams).error);

  return (
    <PageShell>
      <div className="mb-10">
        <Wordmark tagline="Check your email" />
      </div>

      <Card className="p-6 space-y-5">
        <p className="text-sm text-zinc-400">
          If <span className="text-zinc-200 font-medium">{email}</span> can sign
          in, we&apos;ve sent it a 6-digit code. It expires in 10 minutes.
        </p>

        <form action={verifyOtpAction} className="space-y-3">
          {message && <AuthNotice message={message} />}
          <label htmlFor="code" className="sr-only">
            Sign-in code
          </label>
          <input
            id="code"
            name="code"
            required
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\s*(\d\s*){6}"
            maxLength={12}
            placeholder="123456"
            className={`${authFieldClass} tracking-[0.3em] text-center`}
          />
          <Button type="submit" fullWidth>
            Sign in
          </Button>
        </form>

        <div className="flex items-center justify-between text-xs">
          <Link href="/login" className="text-zinc-500 hover:text-zinc-300 transition-colors">
            Use a different email
          </Link>
          <form action={requestOtpAction}>
            <input type="hidden" name="email" value={email} />
            <Button type="submit" variant="quiet" size="bare" className="text-xs">
              Send a new code
            </Button>
          </form>
        </div>
      </Card>
    </PageShell>
  );
}
