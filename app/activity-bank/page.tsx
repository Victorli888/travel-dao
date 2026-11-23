import Link from "next/link";
import { DeleteSavedActivityForm, SavedActivityForm } from "@/components/planner/SavedActivityForm";
import { FIELD, LABEL } from "@/components/planner/fieldStyles";
import { requireUserEmail } from "@/lib/auth/session";
import { listSavedActivities, listTrips } from "@/lib/itinerary";
import { filterSavedActivities, savedBankOptions } from "@/lib/itinerary/saved-bank";

export const metadata = { title: "Activity Bank | Travel Tao" };

const LINK = "text-sm font-medium text-tao underline-offset-4 hover:underline";
const PANEL = "rounded-2xl border border-rule bg-paper-raised p-5 sm:p-6";

export default async function ActivityBankPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const email = await requireUserEmail();
  const [params, activities, trips] = await Promise.all([
    searchParams,
    listSavedActivities(email),
    listTrips(email),
  ]);
  const param = (key: string) => typeof params[key] === "string" ? params[key].trim() : "";
  const search = param("search").slice(0, 200);
  const country = param("country").slice(0, 100);
  const activityType = param("activityType").slice(0, 100);
  const trip = param("trip");
  const add = param("add") === "1";
  const edit = param("edit");
  const remove = param("delete");
  const selected = activities.find((activity) => activity.id === (edit || remove));
  const results = filterSavedActivities(activities, { search, country, activityType, trip });
  const tripNames = new Map(trips.map(({ id, name }) => [id, name]));
  const countries = savedBankOptions(activities, "country");
  const types = savedBankOptions(activities, "activityType");

  return (
    <main className="tao-ground min-h-screen font-tao">
      <div className="mx-auto w-full max-w-[72rem] px-5 pb-16 sm:px-8">
        <nav className="flex items-baseline justify-between gap-6 py-6">
          <Link href="/" className="flex items-baseline gap-2 no-underline">
            <span className="text-[17px] font-medium tracking-tight text-ink">Travel Tao</span>
            <span className="text-[15px] text-tao-soft">道</span>
          </Link>
          <Link href="/plan" className={LINK}>Day Planner</Link>
        </nav>

        <header className="flex flex-wrap items-end justify-between gap-4 pb-8 pt-6 sm:pt-10">
          <div>
            <h1 className="text-[clamp(1.9rem,4.5vw,2.75rem)] font-medium leading-tight tracking-tight text-ink">
              Activity Bank
            </h1>
            <p className="mt-2 text-ink-muted">Manage the activities saved across your trips.</p>
          </div>
          {trips.length > 0 && !add && (
            <Link href="/activity-bank?add=1"
              className="rounded-xl bg-tao px-4 py-2.5 text-sm font-medium text-paper hover:bg-tao-bright">
              Add activity
            </Link>
          )}
        </header>

        {(add || edit || remove) && (
          <section className={`${PANEL} mb-8`}>
            {add && trips.length > 0 ? (
              <>
                <h2 className="text-xl font-medium text-ink">Add activity</h2>
                <SavedActivityForm key="new" activityId={null}
                  defaults={{ tripId: trips.length === 1 ? trips[0].id : "" }} trips={trips} />
              </>
            ) : selected && edit ? (
              <>
                <h2 className="text-xl font-medium text-ink">Edit {selected.name}</h2>
                <SavedActivityForm key={selected.id} activityId={selected.id} trips={[]}
                  defaults={{
                    name: selected.name,
                    summary: selected.summary,
                    country: selected.country ?? "",
                    activityType: selected.activityType ?? "",
                    area: selected.area ?? "",
                    address: selected.address ?? "",
                    hoursOperation: selected.hoursOperation ?? "",
                    durationMinutes: String(selected.durationMinutes ?? ""),
                    priorityScore: String(selected.priorityScore ?? ""),
                    lat: String(selected.lat ?? ""),
                    lng: String(selected.lng ?? ""),
                  }} />
              </>
            ) : selected ? (
              <>
                <h2 className="text-xl font-medium text-ink">Delete {selected.name}?</h2>
                <DeleteSavedActivityForm key={selected.id} activityId={selected.id} />
              </>
            ) : (
              <p className="text-ink-muted">
                {add ? "Create a trip before adding an activity." : "That activity does not exist."}{" "}
                <Link href={add ? "/plan" : "/activity-bank"} className={LINK}>{add ? "Day Planner" : "Back to the bank"}</Link>
              </p>
            )}
          </section>
        )}

        {activities.length === 0 ? (
          <section className={PANEL}>
            <h2 className="font-medium text-ink">No activities saved yet</h2>
            {trips.length === 0 && (
              <p className="mt-2 text-ink-muted">Create a trip in the <Link href="/plan" className={LINK}>Day Planner</Link> to save your first activity.</p>
            )}
          </section>
        ) : (
          <>
            <form action="/activity-bank" method="get" className={`${PANEL} space-y-4`}>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <label>
                  <span className={LABEL}>Search</span>
                  <input className={FIELD} type="search" name="search" defaultValue={search}
                    placeholder="Name or area" maxLength={200} />
                </label>
                <label>
                  <span className={LABEL}>Activity type</span>
                  <select className={FIELD} name="activityType" defaultValue={activityType}>
                    <option value="">All types</option>
                    {types.map((type) => <option key={type}>{type}</option>)}
                  </select>
                </label>
                <label>
                  <span className={LABEL}>Country</span>
                  <select className={FIELD} name="country" defaultValue={country}>
                    <option value="">All countries</option>
                    {countries.map((label) => <option key={label}>{label}</option>)}
                  </select>
                </label>
                <label>
                  <span className={LABEL}>Trip</span>
                  <select className={FIELD} name="trip" defaultValue={trip}>
                    <option value="">All trips</option>
                    {trips.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
                  </select>
                </label>
              </div>
              <div className="flex items-center gap-4">
                <button className="rounded-xl border border-rule-strong bg-paper px-4 py-2 text-sm font-medium text-ink hover:border-tao">
                  Apply filters
                </button>
                {(search || country || activityType || trip) && <Link href="/activity-bank" className={LINK}>Clear filters</Link>}
              </div>
            </form>
            <p className="mb-3 mt-6 text-sm text-ink-muted">
              {results.length} of {activities.length} saved {activities.length === 1 ? "activity" : "activities"}
            </p>
            {results.length === 0 ? (
              <p className="text-ink-muted">No activities match these filters.</p>
            ) : (
              <ul className="grid gap-4 md:grid-cols-2">
                {results.map((activity) => {
                  const labels = [activity.activityType, activity.country, activity.area].filter(Boolean);
                  const tripName = tripNames.get(activity.tripId);
                  return (
                    <li key={activity.id} className={`${PANEL} flex min-w-0 flex-col gap-3 break-words`}>
                      <div>
                        {tripName && <p className="text-sm text-ink-muted">{tripName}</p>}
                        <h2 className="mt-1 text-xl font-medium text-ink">{activity.name}</h2>
                        {labels.length > 0 && <p className="mt-1 text-sm text-ink-muted">{labels.join(" · ")}</p>}
                      </div>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-muted">{activity.summary}</p>
                      {activity.address && <p className="text-sm text-ink-muted">{activity.address}</p>}
                      <div className="mt-auto flex gap-4 pt-2">
                        <Link href={`/activity-bank?edit=${activity.id}`} className={LINK}
                          aria-label={`Edit ${activity.name}`}>Edit</Link>
                        <Link href={`/activity-bank?delete=${activity.id}`} className={LINK}
                          aria-label={`Delete ${activity.name}`}>Delete</Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </div>
    </main>
  );
}
