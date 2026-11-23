import type { Activity } from "./types";
import { filterBankEntries, fold } from "./bank";

export type SavedBankFilters = {
  search: string;
  country: string;
  activityType: string;
  trip: string;
};

export function savedBankOptions(
  activities: Activity[],
  field: "country" | "activityType",
) {
  const labels = new Map<string, string>();
  for (const activity of activities) {
    const label = activity[field]?.trim();
    if (label && !labels.has(fold(label))) labels.set(fold(label), label);
  }
  return [...labels.values()].sort((a, b) => a.localeCompare(b));
}

export function filterSavedActivities(activities: Activity[], filters: SavedBankFilters) {
  return filterBankEntries(activities, filters.search).filter((activity) =>
    (!filters.country || fold(activity.country?.trim() ?? "") === fold(filters.country)) &&
    (!filters.activityType || fold(activity.activityType?.trim() ?? "") === fold(filters.activityType)) &&
    (!filters.trip || activity.tripId === filters.trip)
  );
}
