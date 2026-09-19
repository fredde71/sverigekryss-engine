const SPEECH_CONTRACT_VERSION = 1;
const REQUEST_TYPE = "speech-generation-request";
const AUDIO_REFERENCE_TYPE = "spoken-audio-reference";
const REQUEST_KEYS = new Set([
  "type",
  "version",
  "sourceRef",
  "contentSequence",
  "locale",
  "voiceProfileId",
  "sourceFingerprint"
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

function createSpeechGenerationRequest({
  sourceRef,
  contentSequence,
  locale,
  voiceProfileId
}) {
  const normalizedSourceRef = normalizeSourceRef(sourceRef);
  const normalizedContentSequence = normalizeContentSequence(contentSequence);
  const normalizedLocale = requireNonEmptyString(locale, "locale");
  const normalizedVoiceProfileId = requireNonEmptyString(
    voiceProfileId,
    "voiceProfileId"
  );

  return deepFreeze({
    type: REQUEST_TYPE,
    version: SPEECH_CONTRACT_VERSION,
    sourceRef: normalizedSourceRef,
    contentSequence: normalizedContentSequence,
    locale: normalizedLocale,
    voiceProfileId: normalizedVoiceProfileId,
    sourceFingerprint: createSpeechSourceFingerprint({
      contentSequence: normalizedContentSequence,
      locale: normalizedLocale,
      voiceProfileId: normalizedVoiceProfileId
    })
  });
}

function validateSpeechGenerationRequest(input) {
  assertPlainObject(input, "SpeechGenerationRequest");
  assertOnlyKeys(input, REQUEST_KEYS, "SpeechGenerationRequest");
  if (input.type !== REQUEST_TYPE) {
    throw contractError("SpeechGenerationRequest type is invalid");
  }
  if (input.version !== SPEECH_CONTRACT_VERSION) {
    throw contractError("SpeechGenerationRequest version is unsupported");
  }

  const normalized = createSpeechGenerationRequest(input);
  if (input.sourceFingerprint !== normalized.sourceFingerprint) {
    throw contractError("SpeechGenerationRequest sourceFingerprint is invalid");
  }

  return normalized;
}

function createSpeechSourceFingerprint({ contentSequence, locale, voiceProfileId }) {
  const canonicalSource = JSON.stringify({
    contractVersion: SPEECH_CONTRACT_VERSION,
    contentSequence: createSpokenContentSequence(
      normalizeContentSequence(contentSequence)
    ),
    locale: requireNonEmptyString(locale, "locale"),
    voiceProfileId: requireNonEmptyString(voiceProfileId, "voiceProfileId")
  });

  return `speech-v${SPEECH_CONTRACT_VERSION}-fnv1a64-${fnv1a64(canonicalSource)}`;
}

function createSpokenAudioReference(input) {
  assertPlainObject(input, "SpokenAudioReference");
  assertOnlyKeys(input, AUDIO_REFERENCE_KEYS, "SpokenAudioReference");
  if (input.type !== undefined && input.type !== AUDIO_REFERENCE_TYPE) {
    throw contractError("SpokenAudioReference type is invalid");
  }
  if (
    input.version !== undefined
    && input.version !== SPEECH_CONTRACT_VERSION
  ) {
    throw contractError("SpokenAudioReference version is unsupported");
  }
  if (!Number.isInteger(input.assetVersion) || input.assetVersion < 1) {
    throw contractError("assetVersion must be a positive integer");
  }

  const mediaType = requireNonEmptyString(input.mediaType, "mediaType");
  if (!mediaType.startsWith("audio/")) {
    throw contractError("mediaType must be an audio media type");
  }

  return deepFreeze({
    type: AUDIO_REFERENCE_TYPE,
    version: SPEECH_CONTRACT_VERSION,
    assetId: requireNonEmptyString(input.assetId, "assetId"),
    assetVersion: input.assetVersion,
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
      throw contractError("Musikkryss answer number must be a positive integer");
    }
    if (value.direction !== "across" && value.direction !== "down") {
      throw contractError("Musikkryss answer direction is invalid");
    }
    return deepFreeze({
      type: "musikkryss-answer",
      number: value.number,
      direction: value.direction
    });
  }
  throw contractError("Unsupported speech sourceRef");
}

function normalizeContentSequence(value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw contractError("contentSequence must be a non-empty array");
  }
  return value.map((entry, index) => {
    assertPlainObject(entry, `contentSequence[${index}]`);
    if (typeof entry.type !== "string" || entry.type.trim() === "") {
      throw contractError(`contentSequence[${index}].type is required`);
    }
    if (
      entry.type === "text"
      && Object.hasOwn(entry, "speechText")
      && typeof entry.speechText !== "string"
    ) {
      throw contractError(
        `contentSequence[${index}].speechText must be a string`
      );
    }
    return normalizeSerializableValue(entry, `contentSequence[${index}]`);
  });
}

function createSpokenContentSequence(contentSequence) {
  return contentSequence.map(entry => {
    if (entry.type !== "text" || !Object.hasOwn(entry, "speechText")) {
      return entry;
    }
    const { speechText, ...spokenEntry } = entry;
    return {
      ...spokenEntry,
      text: speechText
    };
  });
}

function normalizeSerializableValue(value, path) {
  if (value === null || typeof value === "boolean" || typeof value === "number") {
    if (typeof value === "number" && !Number.isFinite(value)) {
      throw contractError(`${path} contains a non-finite number`);
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
  throw contractError(`${path} must contain only serializable domain data`);
}

function fnv1a64(value) {
  let high = 0xcbf29ce4;
  let low = 0x84222325;
  const primeLow = 0x1b3;

  for (const character of value) {
    low = (low ^ character.codePointAt(0)) >>> 0;
    const lowProduct = low * primeLow;
    const carry = Math.floor(lowProduct / 0x100000000);
    high = ((high * primeLow) + (low * 0x100) + carry) >>> 0;
    low = lowProduct >>> 0;
  }

  return high.toString(16).padStart(8, "0")
    + low.toString(16).padStart(8, "0");
}

function requireNonEmptyString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw contractError(`${field} must be a non-empty string`);
  }
  return value.trim().normalize("NFC");
}

function assertOnlyKeys(value, allowedKeys, contractName) {
  const unexpected = Object.keys(value).filter(key => !allowedKeys.has(key));
  if (unexpected.length > 0) {
    throw contractError(
      `${contractName} contains unsupported fields: ${unexpected.join(", ")}`
    );
  }
}

function assertPlainObject(value, name) {
  if (!isPlainObject(value)) {
    throw contractError(`${name} must be an object`);
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

function contractError(message) {
  const error = new TypeError(message);
  error.code = "SPEECH_REQUEST_INVALID";
  return error;
}

module.exports = {
  SPEECH_CONTRACT_VERSION,
  createSpeechGenerationRequest,
  createSpeechSourceFingerprint,
  createSpokenAudioReference,
  validateSpeechGenerationRequest
};
