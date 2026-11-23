import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";
import PageShell from "@/components/ui/PageShell";
import Wordmark from "@/components/ui/Wordmark";
import Card from "@/components/ui/Card";
import Button, { buttonStyles } from "@/components/ui/Button";
import { requestAccessMailto } from "@/lib/constants";

export default async function UnauthorizedPage() {
  const session = await auth();

  if (!session) redirect("/login");

  const email = session.user?.email ?? "";
  const name = session.user?.name ?? "";

  return (
    <PageShell>
      <div className="mb-10">
        <Wordmark />
      </div>

      <Card className="p-6 space-y-5">
        <div className="text-center space-y-1">
          <p className="text-white font-semibold">Access Restricted</p>
          <p className="text-zinc-400 text-sm">
            {name ? `Hey ${name.split(" ")[0]}, your` : "Your"} account
            doesn&apos;t have access yet.
          </p>
        </div>

        {email && (
          <div className="rounded-lg bg-white/5 border border-line px-4 py-2.5 text-center">
            <p className="text-xs text-zinc-500 mb-0.5">Signed in as</p>
            <p className="text-sm text-zinc-300 font-medium">{email}</p>
          </div>
        )}

        <a
          href={requestAccessMailto(email)}
          className={buttonStyles({ fullWidth: true })}
        >
          Request Access
        </a>

        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <Button type="submit" variant="quiet" size="bare" fullWidth>
            Sign out
          </Button>
        </form>
      </Card>
    </PageShell>
  );
}
