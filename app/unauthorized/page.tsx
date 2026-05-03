import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";

export default async function UnauthorizedPage() {
  const session = await auth();

  if (!session) redirect("/login");

  const email = session.user?.email ?? "";
  const name = session.user?.name ?? "";

  return (
    <main className="min-h-screen flex flex-col items-center justify-center py-16 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <h1 className="flex items-baseline justify-center gap-3 text-4xl font-bold text-white tracking-tight">
            Dao
            <span className="text-3xl font-normal text-purple-400/70">道</span>
          </h1>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#13131f] p-6 space-y-5">
          <div className="text-center space-y-1">
            <p className="text-white font-semibold">Access Restricted</p>
            <p className="text-zinc-400 text-sm">
              {name ? `Hey ${name.split(" ")[0]}, your` : "Your"} account doesn&apos;t have access yet.
            </p>
          </div>

          {email && (
            <div className="rounded-lg bg-white/5 border border-white/10 px-4 py-2.5 text-center">
              <p className="text-xs text-zinc-500 mb-0.5">Signed in as</p>
              <p className="text-sm text-zinc-300 font-medium">{email}</p>
            </div>
          )}

          <a
            href={`mailto:victorli7462@gmail.com?subject=Dao Access Request&body=Hi, I'd like to request access to Dao. My Google account email is: ${email}`}
            className="flex items-center justify-center gap-2 w-full bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold px-5 py-3 rounded-xl transition-colors"
          >
            Request Access
          </a>

          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button
              type="submit"
              className="w-full text-sm text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
