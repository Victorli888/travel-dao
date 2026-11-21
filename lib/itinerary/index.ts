/**
 * The public surface. Every function takes the signed-in `userEmail` first
 * and scopes its own query; callers authorize in the action as well.
 *
 * Reads return `null` or `[]`. Writes throw `NotFoundError` when the scoped
 * statement matched nothing — missing and not-yours are not distinguished.
 *
 * Server Components and Server Actions call these directly. There is no
 * `/api/trips` and should not be one unless something outside React needs it.
 */
import "server-only";

export {
  listTrips,
  getTrip,
  createTrip,
  updateTrip,
  deleteTrip,
} from "./trips";

export {
  getItinerary,
  listDays,
  generateDays,
  addDay,
  renameDay,
  removeDay,
} from "./days";

export {
  listActivities,
  getActivity,
  addActivity,
  updateActivity,
  deleteActivity,
} from "./activities";

export {
  appendActivityToDay,
  placeActivityOnDay,
  moveActivityToDay,
  unplaceActivity,
  reorderDay,
  listPlacements,
} from "./placements";

export type {
  Activity,
  ActivityRow,
  Day,
  DayRow,
  DayWithActivities,
  Itinerary,
  PlacedActivity,
  Placement,
  PlacementRow,
  Trip,
  TripRow,
} from "./types";

export type {
  ActivityDraft,
  CreateDatedTripInput,
  CreateTripInput,
  UpdateActivityInput,
  UpdateTripInput,
} from "./schemas";

export {
  ActivityDraftSchema,
  CreateDatedTripSchema,
  CreateTripSchema,
  DayNameSchema,
  PriorityScoreSchema,
  TripStatusSchema,
  UpdateActivitySchema,
  UpdateTripSchema,
} from "./schemas";
