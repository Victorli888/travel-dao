import { auth } from "@/auth";

/**
 * The signed-in email, which is what ownership is in this app — there is no
 * `users` table and every `lib/itinerary/` function takes it first.
 *
 * `middleware.ts` has already turned away anyone unauthenticated or off the
 * allow-list before a page or action runs, so the throw is a type-narrowing
 * backstop rather than a path a visitor can reach.
 */
export async function requireUserEmail(): Promise<string> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) throw new Error("No signed-in user.");
  return email;
}
