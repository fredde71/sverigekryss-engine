export const SPEECH_CONTRACT_VERSION = 1;

const REQUEST_TYPE = "speech-generation-request";
const AUDIO_REFERENCE_TYPE = "spoken-audio-reference";
const COMPARISON_TYPE = "spoken-audio-reference-comparison";
const REQUEST_KEYS = new Set([
  "sourceRef",
  "contentSequence",
  "locale",
  "voiceProfileId"
]);
const AUDIO_REFERENCE_KEYS = new Set([
  "type",
  "version",
  "assetId",
  "assetVersion",
  "mediaType",
  "publicUrl",
  "sourceFingerprint",
  "voiceProfileId",
  "locale"
]);

export function createSpeechGenerationRequest(input) {
  assertPlainObject(input, "SpeechGenerationRequest input");
  assertOnlyKeys(input, REQUEST_KEYS, "SpeechGenerationRequest");

  const sourceRef = normalizeSourceRef(input.sourceRef);
  const contentSequence = normalizeContentSequence(input.contentSequence);
  const locale = requireNonEmptyString(input.locale, "locale");
  const voiceProfileId = requireNonEmptyString(
    input.voiceProfileId,
    "voiceProfileId"
  );
  const sourceFingerprint = createSpeechSourceFingerprint({
    contentSequence,
    locale,
    voiceProfileId
  });

  return deepFreeze({
    type: REQUEST_TYPE,
    version: SPEECH_CONTRACT_VERSION,
    sourceRef,
    contentSequence,
    locale,
    voiceProfileId,
    sourceFingerprint
  });
}

export function createSpeechSourceFingerprint({
  contentSequence,
  locale,
  voiceProfileId
}) {
  const normalizedContentSequence = normalizeContentSequence(contentSequence);
  const normalizedLocale = requireNonEmptyString(locale, "locale");
  const normalizedVoiceProfileId = requireNonEmptyString(
    voiceProfileId,
    "voiceProfileId"
  );
  const canonicalSource = JSON.stringify({
    contractVersion: SPEECH_CONTRACT_VERSION,
    contentSequence: normalizedContentSequence,
    locale: normalizedLocale,
    voiceProfileId: normalizedVoiceProfileId
  });

  return `speech-v${SPEECH_CONTRACT_VERSION}-fnv1a64-${fnv1a64(canonicalSource)}`;
}

export function createSpokenAudioReference(input) {
  assertPlainObject(input, "SpokenAudioReference input");
  assertOnlyKeys(input, AUDIO_REFERENCE_KEYS, "SpokenAudioReference");
  if (input.type !== undefined && input.type !== AUDIO_REFERENCE_TYPE) {
    throw new TypeError("SpokenAudioReference type is invalid");
  }
  if (
    input.version !== undefined
    && input.version !== SPEECH_CONTRACT_VERSION
  ) {
    throw new TypeError("SpokenAudioReference version is unsupported");
  }

  const assetVersion = input.assetVersion;
  if (!Number.isInteger(assetVersion) || assetVersion < 1) {
    throw new TypeError("assetVersion must be a positive integer");
  }

  const mediaType = requireNonEmptyString(input.mediaType, "mediaType");
  if (!mediaType.startsWith("audio/")) {
    throw new TypeError("mediaType must be an audio media type");
  }

  return deepFreeze({
    type: AUDIO_REFERENCE_TYPE,
    version: SPEECH_CONTRACT_VERSION,
    assetId: requireNonEmptyString(input.assetId, "assetId"),
    assetVersion,
    mediaType,
    publicUrl: requireNonEmptyString(input.publicUrl, "publicUrl"),
    sourceFingerprint: requireNonEmptyString(
      input.sourceFingerprint,
      "sourceFingerprint"
    ),
    voiceProfileId: requireNonEmptyString(
      input.voiceProfileId,
      "voiceProfileId"
    ),
    locale: requireNonEmptyString(input.locale, "locale")
  });
}

export function normalizeSpokenAudioReference(input) {
  if (input == null) return null;

  try {
    return createSpokenAudioReference(input);
  } catch {
    return null;
  }
}

export function compareSpokenAudioReference({ request, reference }) {
  assertSpeechGenerationRequest(request);
  const normalizedReference = normalizeSpokenAudioReference(reference);
  const status = !normalizedReference
    ? "unavailable"
    : normalizedReference.sourceFingerprint === request.sourceFingerprint
      ? "current"
      : "stale";

  return deepFreeze({
    type: COMPARISON_TYPE,
    version: SPEECH_CONTRACT_VERSION,
    status,
    requestFingerprint: request.sourceFingerprint,
    referenceFingerprint: normalizedReference?.sourceFingerprint ?? null
  });
}

function normalizeSourceRef(value) {
  assertPlainObject(value, "sourceRef");

  if (value.type === "musikkryss-intro") {
    assertOnlyKeys(value, new Set(["type"]), "Musikkryss intro sourceRef");
    return deepFreeze({ type: "musikkryss-intro" });
  }

  if (value.type === "musikkryss-answer") {
    assertOnlyKeys(
      value,
      new Set(["type", "number", "direction"]),
      "Musikkryss answer sourceRef"
    );
    if (!Number.isInteger(value.number) || value.number < 1) {
      throw new TypeError("Musikkryss answer number must be a positive integer");
    }
    if (value.direction !== "across" && value.direction !== "down") {
      throw new TypeError("Musikkryss answer direction is invalid");
    }
    return deepFreeze({
      type: "musikkryss-answer",
      number: value.number,
      direction: value.direction
    });
  }

  throw new TypeError("Unsupported speech sourceRef");
}

function normalizeContentSequence(value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new TypeError("contentSequence must be a non-empty array");
  }

  return value.map((entry, index) => {
    assertPlainObject(entry, `contentSequence[${index}]`);
    if (typeof entry.type !== "string" || entry.type.trim() === "") {
      throw new TypeError(`contentSequence[${index}].type is required`);
    }
    return normalizeSerializableValue(entry, `contentSequence[${index}]`);
  });
}

function normalizeSerializableValue(value, path) {
  if (value === null || typeof value === "boolean" || typeof value === "number") {
    if (typeof value === "number" && !Number.isFinite(value)) {
      throw new TypeError(`${path} contains a non-finite number`);
    }
    return value;
  }
  if (typeof value === "string") {
    return value.normalize("NFC").replace(/\r\n?/g, "\n");
  }
  if (Array.isArray(value)) {
    return value.map((entry, index) => (
      normalizeSerializableValue(entry, `${path}[${index}]`)
    ));
  }
  if (isPlainObject(value)) {
    return Object.fromEntries(Object.keys(value).sort().map(key => [
      key,
      normalizeSerializableValue(value[key], `${path}.${key}`)
    ]));
  }
  throw new TypeError(`${path} must contain only serializable domain data`);
}

function fnv1a64(value) {
  let high = 0xcbf29ce4;
  let low = 0x84222325;
  const primeLow = 0x1b3;

  for (const character of value) {
    low = (low ^ character.codePointAt(0)) >>> 0;

    const lowProduct = low * primeLow;
    const carry = Math.floor(lowProduct / 0x100000000);
    high = (
      (high * primeLow)
      + (low * 0x100)
      + carry
    ) >>> 0;
    low = lowProduct >>> 0;
  }

  return high.toString(16).padStart(8, "0")
    + low.toString(16).padStart(8, "0");
}

function assertSpeechGenerationRequest(value) {
  if (
    !isPlainObject(value)
    || value.type !== REQUEST_TYPE
    || value.version !== SPEECH_CONTRACT_VERSION
    || typeof value.sourceFingerprint !== "string"
  ) {
    throw new TypeError("request must be a SpeechGenerationRequest");
  }
}

function requireNonEmptyString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${field} must be a non-empty string`);
  }
  return value.trim().normalize("NFC");
}

function assertOnlyKeys(value, allowedKeys, contractName) {
  const unexpected = Object.keys(value).filter(key => !allowedKeys.has(key));
  if (unexpected.length > 0) {
    throw new TypeError(
      `${contractName} contains unsupported fields: ${unexpected.join(", ")}`
    );
  }
}

function assertPlainObject(value, name) {
  if (!isPlainObject(value)) {
    throw new TypeError(`${name} must be an object`);
  }
}

function isPlainObject(value) {
  return Boolean(value)
    && typeof value === "object"
    && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype
      || Object.getPrototypeOf(value) === null);
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
