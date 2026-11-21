import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { ConflictError, NotFoundError } from "@/lib/api/errors";
import { getSql } from "@/lib/db";
import {
  addActivity,
  addDay,
  appendActivityToDay,
  createTrip,
  deleteActivity,
  deleteTrip,
  generateDays,
  getActivity,
  getItinerary,
  getTrip,
  listActivities,
  listDays,
  listPlacements,
  listTrips,
  moveActivityToDay,
  placeActivityOnDay,
  removeDay,
  renameDay,
  reorderDay,
  unplaceActivity,
  updateActivity,
  updateTrip,
} from "./index";

/**
 * Live tests, skipped unless `TEST_DATABASE_URL` is set:
 *
 *     TEST_DATABASE_URL="$DATABASE_URL" npm test
 *
 * Needs a real Neon database — `@neondatabase/serverless` speaks HTTP, not
 * the Postgres wire protocol. Everything created belongs to the two test
 * emails below and is deleted after each test.
 */

const DATABASE_URL = process.env.TEST_DATABASE_URL;
const live = DATABASE_URL ? describe : describe.skip;

const EMAIL = "test+itinerary@travel-tao.local";
const OTHER = "test+intruder@travel-tao.local";

const TEAMLAB = {
  name: "teamLab Planets",
  summary: "Immersive digital art museum in Toyosu.",
  address: "6-1-16 Toyosu, Koto City",
  lat: 35.649,
  lng: 139.79,
  priorityScore: 5,
  source: "manual",
};

const SENSOJI = {
  name: "Senso-ji",
  summary: "Asakusa's ancient Buddhist temple.",
  source: "manual",
};

live("itinerary data access layer", () => {
  beforeAll(async () => {
    // The DAL reads DATABASE_URL through `getEnv()`, which is lazy — nothing
    // has resolved it yet, so pointing it at the test database here is enough.
    process.env.DATABASE_URL = DATABASE_URL;

    // `getEnv()` validates the whole schema in one go, so reaching the
    // database also requires the Anthropic and Notion keys to be *present*.
    // Nothing in this layer reads them; these placeholders exist only to get
    // past that check, and are named so a stray use would be obvious.
    process.env.ANTHROPIC_API_KEY ||= "unused-by-the-data-layer";
    process.env.NOTION_API_KEY ||= "unused-by-the-data-layer";

    // `trips_user_email_fkey` requires the owner to be on the allow-list.
    const sql = getSql();
    await sql`insert into allowed_emails (email) values (${EMAIL}) on conflict (email) do nothing`;
    await sql`insert into allowed_emails (email) values (${OTHER}) on conflict (email) do nothing`;
  });

  // Deleting the trip cascades its days, placements and activities, so one
  // statement per owner clears everything this file created.
  afterEach(async () => {
    const sql = getSql();
    await sql`delete from trips where user_email in (${EMAIL}, ${OTHER})`;
  });

  afterAll(async () => {
    const sql = getSql();
    await sql`delete from allowed_emails where email in (${EMAIL}, ${OTHER})`;
  });

  it("walks a trip from creation to deletion", async () => {
    // --- create -------------------------------------------------------------
    const trip = await createTrip(EMAIL, { name: "Japan 2027" });
    expect(trip.name).toBe("Japan 2027");
    expect(trip.status).toBe("draft");
    expect(trip.startDate).toBeNull();

    // --- update: a partial patch touches only what it names ------------------
    const dated = await updateTrip(EMAIL, trip.id, {
      startDate: "2027-04-01",
      endDate: "2027-04-05",
    });
    expect(dated.startDate).toBe("2027-04-01");
    expect(dated.name).toBe("Japan 2027");

    // --- days: an idempotent upsert, not a read-then-write -------------------
    const days = await generateDays(EMAIL, trip.id);
    expect(days).toHaveLength(5);
    expect(days[0].date).toBe("2027-04-01");

    const again = await generateDays(EMAIL, trip.id);
    expect(again).toHaveLength(5);

    // --- activities start on the wishlist ------------------------------------
    const teamlab = await addActivity(EMAIL, trip.id, TEAMLAB);
    expect(teamlab.priorityScore).toBe(5);
    // `numeric` arrives as a string and is parsed at this edge.
    expect(teamlab.lat).toBeCloseTo(35.649, 3);

    const beforePlacing = await getItinerary(EMAIL, trip.id);
    expect(beforePlacing!.unscheduled.map((a) => a.id)).toEqual([teamlab.id]);

    // --- placing moves it off the wishlist, without copying it ---------------
    const placement = await appendActivityToDay(EMAIL, days[0].id, teamlab.id);
    expect(placement.position).toBe(1);

    const itinerary = await getItinerary(EMAIL, trip.id);
    expect(itinerary).not.toBeNull();
    expect(itinerary!.days).toHaveLength(5);
    expect(itinerary!.days[0].activities.map((a) => a.id)).toEqual([
      teamlab.id,
    ]);
    expect(itinerary!.unscheduled).toEqual([]);
    // The superset stays whole: placing an activity moves it out of
    // `unscheduled`, never out of `activities`.
    expect(itinerary!.activities.map((a) => a.id)).toEqual([teamlab.id]);
    // The empty days survive: an INNER JOIN would have dropped four of five.
    expect(itinerary!.days[1].activities).toEqual([]);

    // --- appending twice is a no-op, not a duplicate and not an error --------
    const repeat = await appendActivityToDay(EMAIL, days[0].id, teamlab.id);
    expect(repeat.id).toBe(placement.id);
    expect(repeat.position).toBe(1);

    // --- ordering belongs to the placement -----------------------------------
    const sensoji = await addActivity(EMAIL, trip.id, SENSOJI);
    const second = await appendActivityToDay(EMAIL, days[0].id, sensoji.id);
    expect(second.position).toBe(2);

    await reorderDay(EMAIL, days[0].id, [sensoji.id, teamlab.id]);
    const reordered = await getItinerary(EMAIL, trip.id);
    expect(reordered!.days[0].activities.map((a) => a.id)).toEqual([
      sensoji.id,
      teamlab.id,
    ]);
    // Reordering a day does not touch the bank's order: `activities` keeps
    // `priority_score desc nulls last`, so the rated teamLab leads the unrated
    // Senso-ji whichever way the day is arranged.
    expect(reordered!.activities.map((a) => a.id)).toEqual([
      teamlab.id,
      sensoji.id,
    ]);

    // --- unplacing returns it to the wishlist, intact ------------------------
    await unplaceActivity(EMAIL, days[0].id, teamlab.id);
    const afterUnplace = await getItinerary(EMAIL, trip.id);
    expect(afterUnplace!.unscheduled.map((a) => a.id)).toEqual([teamlab.id]);

    // --- moving keeps one activity with one identity ------------------------
    const moved = await moveActivityToDay(
      EMAIL,
      days[0].id,
      days[1].id,
      sensoji.id,
    );
    expect(moved.dayId).toBe(days[1].id);

    // --- deleting a day frees its activities; deleting a trip destroys them --
    await removeDay(EMAIL, days[1].id);
    expect(await listDays(EMAIL, trip.id)).toHaveLength(4);
    const freed = await getItinerary(EMAIL, trip.id);
    expect(freed!.unscheduled.map((a) => a.id).sort()).toEqual(
      [teamlab.id, sensoji.id].sort(),
    );

    await deleteTrip(EMAIL, trip.id);
    expect(await getTrip(EMAIL, trip.id)).toBeNull();
  });

  it("adds a single day outside the generated range", async () => {
    const trip = await createTrip(EMAIL, {
      name: "Japan 2027",
      startDate: "2027-04-01",
      endDate: "2027-04-02",
    });
    await generateDays(EMAIL, trip.id);

    const extra = await addDay(EMAIL, trip.id, "2027-04-09");
    expect(extra.date).toBe("2027-04-09");
    expect(await listDays(EMAIL, trip.id)).toHaveLength(3);

    // Idempotent: the same date returns the same row rather than failing.
    const same = await addDay(EMAIL, trip.id, "2027-04-09");
    expect(same.id).toBe(extra.id);
  });

  it("names a day, and clears the name with an explicit null", async () => {
    const trip = await createTrip(EMAIL, {
      name: "Japan 2027",
      startDate: "2027-04-01",
      endDate: "2027-04-02",
    });
    const [first] = await generateDays(EMAIL, trip.id);

    // A generated day starts unnamed; the UI falls back to the date.
    expect(first.name).toBeNull();

    const named = await renameDay(EMAIL, first.id, "  Temple day  ");
    expect(named.name).toBe("Temple day");

    // `getItinerary` selects an explicit column list, so a name that never
    // reaches this assertion means the list was not updated.
    const itinerary = await getItinerary(EMAIL, trip.id);
    expect(itinerary!.days[0].name).toBe("Temple day");

    const cleared = await renameDay(EMAIL, first.id, null);
    expect(cleared.name).toBeNull();
  });

  it("leaves out-of-range days alone when the trip is shortened", async () => {
    const trip = await createTrip(EMAIL, {
      name: "Japan 2027",
      startDate: "2027-04-01",
      endDate: "2027-04-05",
    });
    await generateDays(EMAIL, trip.id);

    await updateTrip(EMAIL, trip.id, { endDate: "2027-04-02" });

    // Shortening a trip must not silently destroy three days of planning.
    expect(await listDays(EMAIL, trip.id)).toHaveLength(5);
  });

  it("refuses to place an activity on another trip's day", async () => {
    // The invariant no foreign key enforces: `day_itinerary_activities` has
    // two independent FKs, so only this layer stops the pairing.
    const japan = await createTrip(EMAIL, {
      name: "Japan",
      startDate: "2027-04-01",
      endDate: "2027-04-02",
    });
    const korea = await createTrip(EMAIL, {
      name: "Korea",
      startDate: "2027-05-01",
      endDate: "2027-05-02",
    });

    const japanDays = await generateDays(EMAIL, japan.id);
    const koreaDays = await generateDays(EMAIL, korea.id);
    const japanActivity = await addActivity(EMAIL, japan.id, TEAMLAB);

    await expect(
      appendActivityToDay(EMAIL, koreaDays[0].id, japanActivity.id),
    ).rejects.toThrow(NotFoundError);

    // ...and the Japan day still accepts it.
    const ok = await appendActivityToDay(
      EMAIL,
      japanDays[0].id,
      japanActivity.id,
    );
    expect(ok.dayId).toBe(japanDays[0].id);
  });

  it("scopes every read and write to the owner", async () => {
    const trip = await createTrip(EMAIL, { name: "Japan 2027" });

    // A trip that is not yours is indistinguishable from one that is not there.
    expect(await getTrip(OTHER, trip.id)).toBeNull();
    expect(await listDays(OTHER, trip.id)).toEqual([]);
    expect(await getItinerary(OTHER, trip.id)).toBeNull();

    await expect(
      updateTrip(OTHER, trip.id, { name: "Stolen" }),
    ).rejects.toThrow(NotFoundError);
    await expect(deleteTrip(OTHER, trip.id)).rejects.toThrow(NotFoundError);
    await expect(
      addActivity(OTHER, trip.id, TEAMLAB),
    ).rejects.toThrow(NotFoundError);

    // A day carries no email of its own — `renameDay` proves ownership by
    // reaching through the trip, so this is the weaker guarantee worth a test.
    const day = await addDay(EMAIL, trip.id, "2027-04-01");
    await expect(renameDay(OTHER, day.id, "Stolen")).rejects.toThrow(
      NotFoundError,
    );

    // Still intact and still ours.
    expect((await getTrip(EMAIL, trip.id))!.name).toBe("Japan 2027");
    expect((await listDays(EMAIL, trip.id))[0].name).toBeNull();
  });

  it("applies a patch field by field, and clears on explicit null", async () => {
    // The nine-branch `set` block in activities.ts — the most bug-prone code
    // in the layer, and until now the least exercised.
    const trip = await createTrip(EMAIL, { name: "Japan 2027" });
    const activity = await addActivity(EMAIL, trip.id, TEAMLAB);

    // An absent key leaves a field alone.
    const renamed = await updateActivity(EMAIL, activity.id, {
      name: "teamLab Borderless",
    });
    expect(renamed.name).toBe("teamLab Borderless");
    expect(renamed.summary).toBe(TEAMLAB.summary);
    expect(renamed.priorityScore).toBe(5);
    expect(renamed.lat).toBeCloseTo(35.649, 3);

    // An explicit null clears — including priority, which returns to unrated
    // rather than to "lowest".
    const cleared = await updateActivity(EMAIL, activity.id, {
      priorityScore: null,
      address: null,
    });
    expect(cleared.priorityScore).toBeNull();
    expect(cleared.address).toBeNull();
    expect(cleared.name).toBe("teamLab Borderless");

    // Coordinates survive the number -> numeric string -> number round trip.
    const moved = await updateActivity(EMAIL, activity.id, {
      lat: -33.8568,
      lng: 151.2153,
    });
    expect(moved.lat).toBeCloseTo(-33.8568, 4);
    expect(moved.lng).toBeCloseTo(151.2153, 4);
  });

  it("reads and deletes a single activity, scoped to its owner", async () => {
    const trip = await createTrip(EMAIL, { name: "Japan 2027" });
    const activity = await addActivity(EMAIL, trip.id, TEAMLAB);

    expect((await getActivity(EMAIL, activity.id))!.name).toBe(TEAMLAB.name);
    expect(await getActivity(OTHER, activity.id)).toBeNull();
    await expect(deleteActivity(OTHER, activity.id)).rejects.toThrow(
      NotFoundError,
    );

    await deleteActivity(EMAIL, activity.id);
    expect(await getActivity(EMAIL, activity.id)).toBeNull();
  });

  it("repositions rather than failing when placed twice", async () => {
    const trip = await createTrip(EMAIL, {
      name: "Japan 2027",
      startDate: "2027-04-01",
      endDate: "2027-04-02",
    });
    const days = await generateDays(EMAIL, trip.id);
    const activity = await addActivity(EMAIL, trip.id, TEAMLAB);

    const first = await placeActivityOnDay(EMAIL, days[0].id, activity.id, 3);
    expect(first.position).toBe(3);

    // Unlike append, place takes `excluded.position` — it moves the row.
    const second = await placeActivityOnDay(EMAIL, days[0].id, activity.id, 1);
    expect(second.id).toBe(first.id);
    expect(second.position).toBe(1);

    // Null is a legal position and means unordered, not first.
    const unordered = await placeActivityOnDay(
      EMAIL,
      days[0].id,
      activity.id,
      null,
    );
    expect(unordered.position).toBeNull();
  });

  it("rejects moving an activity onto a day it is already on", async () => {
    // The only path that reaches pg-errors.ts: a real 23505 from the
    // UNIQUE (day_id, activity_id) index, which is a 409 and not a 500.
    const trip = await createTrip(EMAIL, {
      name: "Japan 2027",
      startDate: "2027-04-01",
      endDate: "2027-04-02",
    });
    const days = await generateDays(EMAIL, trip.id);
    const activity = await addActivity(EMAIL, trip.id, TEAMLAB);

    await appendActivityToDay(EMAIL, days[0].id, activity.id);
    await appendActivityToDay(EMAIL, days[1].id, activity.id);

    await expect(
      moveActivityToDay(EMAIL, days[0].id, days[1].id, activity.id),
    ).rejects.toThrow(ConflictError);

    // Both placements survive the rejected move.
    expect(await listPlacements(EMAIL, days[0].id)).toHaveLength(1);
    expect(await listPlacements(EMAIL, days[1].id)).toHaveLength(1);
  });

  it("orders lists by the rules the columns imply", async () => {
    const undated = await createTrip(EMAIL, { name: "Someday" });
    const dated = await createTrip(EMAIL, {
      name: "Japan 2027",
      startDate: "2027-04-01",
      endDate: "2027-04-02",
    });

    // Dated trips lead; undated ones are still ideas.
    const trips = await listTrips(EMAIL);
    expect(trips.map((t) => t.id)).toEqual([dated.id, undated.id]);

    const must = await addActivity(EMAIL, dated.id, {
      ...TEAMLAB,
      priorityScore: 5,
    });
    const maybe = await addActivity(EMAIL, dated.id, {
      ...SENSOJI,
      priorityScore: 1,
    });
    const unrated = await addActivity(EMAIL, dated.id, {
      name: "Unrated",
      summary: "No priority yet.",
    });

    // NULL priority means unrated, so it sorts last rather than below a 1.
    const activities = await listActivities(EMAIL, dated.id);
    expect(activities.map((a) => a.id)).toEqual([must.id, maybe.id, unrated.id]);

    // NULL position means unordered, so it sorts last too.
    const days = await generateDays(EMAIL, dated.id);
    await placeActivityOnDay(EMAIL, days[0].id, must.id, null);
    await placeActivityOnDay(EMAIL, days[0].id, maybe.id, 1);

    const placements = await listPlacements(EMAIL, days[0].id);
    expect(placements.map((p) => p.activityId)).toEqual([maybe.id, must.id]);
  });

  it("rejects generating days before the trip has any", async () => {
    const trip = await createTrip(EMAIL, { name: "Someday" });
    await expect(generateDays(EMAIL, trip.id)).rejects.toThrow(
      /start and end date/i,
    );
  });
});
