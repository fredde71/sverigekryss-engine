import {
  createCrosswordSnapshot,
  normalizeCrosswordSnapshot
} from "./crosswordSnapshot";
import { normalizeHelpAccessToken } from "./publicationAccess";

export function createPublication(input = {}) {
  const publication = {
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
  const snapshot = normalizeCrosswordSnapshot(input.crosswordSnapshot);

  if (input.crosswordSnapshot != null && !snapshot) {
    throw new Error("Invalid Publication snapshot");
  }

  if (snapshot) {
    if (snapshot.crosswordId !== publication.crosswordId) {
      throw new Error("Publication snapshot crosswordId mismatch");
    }
    publication.crosswordSnapshot = snapshot;
  }

  const helpAccessToken = normalizeHelpAccessToken(input.helpAccessToken);
  if (helpAccessToken) {
    publication.helpAccessToken = helpAccessToken;
    publication.helpAccessStatus = input.helpAccessStatus === "active"
      ? "active"
      : "inactive";
  }

  return publication;
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
    statistics: {},
    crosswordSnapshot: createCrosswordSnapshot(template)
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
