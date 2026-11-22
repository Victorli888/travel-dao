import { signIn } from "@/auth";
import PageShell from "@/components/ui/PageShell";
import Wordmark from "@/components/ui/Wordmark";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import AuthNotice from "@/components/auth/AuthNotice";
import { authFieldClass } from "@/components/auth/fieldStyles";
import { GoogleIcon } from "@/components/ui/icons";
import { requestAccessMailto } from "@/lib/constants";
import { loginMessage } from "@/lib/auth/login-messages";
import { requestOtpAction } from "./actions";

interface Props {
  searchParams: Promise<{ error?: string | string[] }>;
}

export default async function LoginPage({ searchParams }: Props) {
  const message = loginMessage((await searchParams).error);

  return (
    <PageShell>
      <div className="mb-10">
        <Wordmark tagline="Sign in to continue" />
      </div>

      <Card className="p-6 space-y-5">
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
        >
          <Button type="submit" variant="white" fullWidth className="gap-3">
            <GoogleIcon />
            Continue with Google
          </Button>
        </form>

        <div className="flex items-center gap-3 text-xs text-zinc-600">
          <span className="h-px flex-1 bg-line" />
          or
          <span className="h-px flex-1 bg-line" />
        </div>

        <form action={requestOtpAction} className="space-y-3">
          {message && <AuthNotice message={message} />}
          <label htmlFor="email" className="sr-only">
            Email address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            className={authFieldClass}
          />
          <Button type="submit" variant="ghost" fullWidth>
            Email me a sign-in code
          </Button>
        </form>
      </Card>

      <p className="mt-6 text-center text-xs text-zinc-600">
        Don&apos;t have access?{" "}
        <a
          href={requestAccessMailto()}
          className="text-accent-light hover:text-accent-pale transition-colors"
        >
          Request access
        </a>
      </p>
    </PageShell>
  );
}
