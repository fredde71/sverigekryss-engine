export const VERTICAL_PROJECTION_VISUALIZATION_TYPE = "vertical-projection";

export function createVerticalProjectionVisualization({
  id,
  title,
  axisLength,
  series
}) {
  validateNonEmptyString(id, "Vertical projection visualization id");
  validateNonEmptyString(title, "Vertical projection visualization title");

  if (!Number.isFinite(axisLength) || axisLength <= 0) {
    throw new Error("Vertical projection axisLength must be a positive number");
  }

  if (!Array.isArray(series) || series.length === 0) {
    throw new Error("Vertical projection visualization requires at least one series");
  }

  const normalizedSeries = series.map((profile) => {
    validateNonEmptyString(profile?.id, "Vertical projection series id");
    validateNonEmptyString(profile?.title, "Vertical projection series title");

    if (!profile.values || typeof profile.values[Symbol.iterator] !== "function") {
      throw new Error(`Vertical projection series ${profile.id} requires iterable values`);
    }

    const values = Array.from(profile.values);

    for (const value of values) {
      if (!Number.isFinite(value)) {
        throw new Error(`Vertical projection series ${profile.id} values must be finite numbers`);
      }
    }

    return {
      id: profile.id,
      title: profile.title,
      values
    };
  });
  const length = normalizedSeries[0].values.length;

  if (normalizedSeries.some((profile) => profile.values.length !== length)) {
    throw new Error("Vertical projection series must have equal lengths");
  }

  return {
    id,
    title,
    type: VERTICAL_PROJECTION_VISUALIZATION_TYPE,
    data: {
      axis: "vertical",
      axisLength,
      length,
      series: normalizedSeries
    }
  };
}

function validateNonEmptyString(value, label) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
}
