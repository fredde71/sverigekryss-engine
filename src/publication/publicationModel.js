export function createPublication(input = {}) {
  return {
    publicationId: normalizeString(input.publicationId),
    crosswordId: normalizeString(input.crosswordId),
    newspaper: normalizeString(input.newspaper),
    group: normalizeString(input.group),
    publishDate: normalizeString(input.publishDate),
    publishWeek: normalizeString(input.publishWeek),
    status: normalizeString(input.status) || "draft",
    url: normalizeString(input.url),
    statistics: normalizeStatistics(input.statistics)
  };
}

export function createPublicationFromTemplate({
  template,
  publicUrl,
  status = "published"
}) {
  return createPublication({
    crosswordId: template.crosswordId,
    newspaper: "",
    group: "",
    publishDate: "",
    publishWeek: "",
    status,
    url: publicUrl,
    statistics: {}
  });
}

function normalizeString(value) {
  if (value == null) return "";

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }

  if (typeof value !== "string") return "";

  return value.trim();
}

function normalizeStatistics(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return { ...value };
}
