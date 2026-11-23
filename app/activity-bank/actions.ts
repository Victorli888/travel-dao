"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AppError, ValidationError } from "@/lib/api/errors";
import { requireUserEmail } from "@/lib/auth/session";
import { addActivity, deleteActivity, updateActivity } from "@/lib/itinerary";

export type ActivityFormState = {
  error: string | null;
  values?: Record<string, string>;
  attempt: number;
};

export async function saveActivityAction(
  activityId: string | null,
  previous: ActivityFormState,
  formData: FormData,
): Promise<ActivityFormState> {
  const email = await requireUserEmail();
  const values = Object.fromEntries(
    ["tripId", "name", "summary", "country", "activityType", "area", "address",
      "hoursOperation", "durationMinutes", "priorityScore", "lat", "lng"].map(
      (key) => [key, String(formData.get(key) ?? "").trim()],
    ),
  );
  const draft = {
    name: values.name,
    summary: values.summary,
    country: values.country || null,
    activityType: values.activityType || null,
    area: values.area || null,
    address: values.address || null,
    hoursOperation: values.hoursOperation || null,
    durationMinutes: values.durationMinutes ? Number(values.durationMinutes) : null,
    priorityScore: values.priorityScore ? Number(values.priorityScore) : null,
    lat: values.lat ? Number(values.lat) : null,
    lng: values.lng ? Number(values.lng) : null,
  };

  let tripId: string;
  try {
    const activity = activityId
      ? await updateActivity(email, activityId, draft)
      : await addActivity(email, values.tripId, { ...draft, source: "manual" });
    tripId = activity.tripId;
  } catch (error) {
    return { error: errorMessage(error, "save"), values, attempt: previous.attempt + 1 };
  }
  revalidatePath(`/plan/${tripId}`);
  redirect("/activity-bank");
}

export async function deleteActivityAction(
  activityId: string,
  previous: ActivityFormState,
  formData: FormData,
): Promise<ActivityFormState> {
  const email = await requireUserEmail();
  try {
    if (formData.get("confirm") !== "yes") {
      throw new ValidationError("Confirm that you want to delete this activity and its placements.");
    }
    await deleteActivity(email, activityId);
  } catch (error) {
    return { error: errorMessage(error, "delete"), attempt: previous.attempt + 1 };
  }
  revalidatePath("/plan/[tripId]", "page");
  redirect("/activity-bank");
}

function errorMessage(error: unknown, operation: string) {
  if (error instanceof AppError) return error.message;
  console.error(`Unhandled activity bank ${operation} error:`, error);
  return `Something went wrong trying to ${operation} the activity.`;
}
