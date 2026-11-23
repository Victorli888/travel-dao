import { signIn } from "@/auth";
import PageShell from "@/components/ui/PageShell";
import Wordmark from "@/components/ui/Wordmark";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { GoogleIcon } from "@/components/ui/icons";
import { requestAccessMailto } from "@/lib/constants";

export default function LoginPage() {
  return (
    <PageShell>
      <div className="mb-10">
        <Wordmark tagline="Sign in to continue" />
      </div>

      <Card className="p-6">
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
