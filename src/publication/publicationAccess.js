import {
  hasCompleteTemplateSolutions,
  stripTemplateSolutions
} from "../template/templateSolutions";

export const PUBLICATION_ACCESS_MODES = Object.freeze({
  SOLVE: "solve",
  HELP: "help"
});

const HELP_ACCESS_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/u;

export function createPublicationAccess(helpAccessGranted = false) {
  const mode = helpAccessGranted
    ? PUBLICATION_ACCESS_MODES.HELP
    : PUBLICATION_ACCESS_MODES.SOLVE;

  return Object.freeze({
    type: "publication-access",
    version: 1,
    mode,
    capabilities: Object.freeze({
      useCanonicalSolutions: helpAccessGranted
    })
  });
}

export function getPublicationHelpAccessToken(search = "") {
  const params = new URLSearchParams(search);
  return normalizeHelpAccessToken(params.get("helpAccessToken"));
}

export function createPublicationAccessLinks(publication) {
  const solveUrl = withoutAccessCapability(publication?.url || "");
  const helpAccessToken = normalizeHelpAccessToken(
    publication?.helpAccessToken
  );
  const helpAvailable = Boolean(
    helpAccessToken
    && publication?.helpAccessStatus === "active"
    && hasCompleteTemplateSolutions(publication?.crosswordSnapshot?.template)
  );

  return Object.freeze({
    publicationId: publication?.publicationId || "",
    solveUrl,
    helpUrl: helpAvailable
      ? withHelpAccessToken(solveUrl, helpAccessToken)
      : ""
  });
}

export function projectPublicationForAccess(
  publication,
  presentedHelpAccessToken
) {
  const helpAccessGranted = normalizeHelpAccessToken(
    publication?.helpAccessToken
  ) !== "" && normalizeHelpAccessToken(publication?.helpAccessToken)
    === normalizeHelpAccessToken(presentedHelpAccessToken)
    && publication?.helpAccessStatus === "active"
    && hasCompleteTemplateSolutions(publication?.crosswordSnapshot?.template);
  const access = createPublicationAccess(helpAccessGranted);
  const snapshot = publication?.crosswordSnapshot;
  const { helpAccessToken, ...publicPublication } = publication || {};

  return {
    ...publicPublication,
    access,
    ...(snapshot ? {
      crosswordSnapshot: {
        ...snapshot,
        template: access.capabilities.useCanonicalSolutions
          ? snapshot.template
          : stripTemplateSolutions(snapshot.template)
      }
    } : {})
  };
}

export function normalizeHelpAccessToken(value) {
  if (typeof value !== "string") return "";

  const normalized = value.trim();
  return HELP_ACCESS_TOKEN_PATTERN.test(normalized) ? normalized : "";
}

function withoutAccessCapability(value) {
  if (!value) return "";

  const url = new URL(value, "https://wordex.invalid");
  url.searchParams.delete("mode");
  url.searchParams.delete("helpAccessToken");
  return serializeUrl(url, value);
}

function withHelpAccessToken(value, helpAccessToken) {
  if (!value) return "";

  const url = new URL(value, "https://wordex.invalid");
  url.searchParams.set("helpAccessToken", helpAccessToken);
  return serializeUrl(url, value);
}

function serializeUrl(url, originalValue) {
  return /^[a-z][a-z\d+.-]*:/iu.test(originalValue)
    ? url.toString()
    : `${url.pathname}${url.search}${url.hash}`;
}
