/** Internal storage key for editable labels in activities.source_metadata. */
export const ACTIVITY_BANK_LABELS = "travelTaoActivityBankV1";

type ActivityLabels = {
  country?: string | null;
  activityType?: string | null;
};

export function activityLabelPatch(input: ActivityLabels): ActivityLabels {
  const { country, activityType } = input;
  return {
    ...(country !== undefined ? { country } : {}),
    ...(activityType !== undefined ? { activityType } : {}),
  };
}

function object(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
}

function label(value: unknown) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed && trimmed.length <= 100 ? trimmed : null;
}

export function readActivityMetadata(value: unknown) {
  const record = object(value);
  const overrides = record && "sourceMetadata" in record
    ? object(record[ACTIVITY_BANK_LABELS])
    : undefined;
  const sourceMetadata = overrides ? record?.sourceMetadata : value;
  const source = object(sourceMetadata);
  return {
    sourceMetadata,
    country: label(overrides && "country" in overrides ? overrides.country : source?.country),
    activityType: overrides && "activityType" in overrides
      ? label(overrides.activityType)
      : label(source?.activityType) ?? label(source?.category),
  };
}
