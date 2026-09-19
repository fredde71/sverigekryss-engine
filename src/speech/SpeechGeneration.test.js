import {
  compareSpokenAudioReference,
  createSpeechGenerationRequest,
  createSpokenAudioReference,
  normalizeSpokenAudioReference,
  SPEECH_CONTRACT_VERSION
} from "./SpeechGeneration";

const SWEDISH_VOICE_PROFILE = "sv-female-natural-v1";

test("creates deterministic fingerprints from normalized speech source data", () => {
  const first = createIntroRequest({
    contentSequence: [{ text: "Välkommen\r\ntill Musikkrysset", type: "text" }]
  });
  const second = createIntroRequest({
    contentSequence: [{ type: "text", text: "Va\u0308lkommen\ntill Musikkrysset" }]
  });

  expect(first.sourceFingerprint).toBe(second.sourceFingerprint);
  expect(first.sourceFingerprint).toBe(
    "speech-v1-fnv1a64-ee5847e462fc1e7a"
  );
  expect(first.sourceFingerprint).toMatch(
    /^speech-v1-fnv1a64-[0-9a-f]{16}$/
  );
  expect(Object.isFrozen(first)).toBe(true);
  expect(Object.isFrozen(first.contentSequence)).toBe(true);
});

test("fingerprint changes with script, provider-neutral voice profile, or locale", () => {
  const baseline = createIntroRequest();
  const changedScript = createIntroRequest({
    contentSequence: [{ type: "text", text: "Ett annat manus" }]
  });
  const changedVoice = createIntroRequest({
    voiceProfileId: "sv-female-natural-v2"
  });
  const changedLocale = createIntroRequest({ locale: "sv-FI" });

  expect(changedScript.sourceFingerprint).not.toBe(baseline.sourceFingerprint);
  expect(changedVoice.sourceFingerprint).not.toBe(baseline.sourceFingerprint);
  expect(changedLocale.sourceFingerprint).not.toBe(baseline.sourceFingerprint);
});

test("speechText controls spoken fingerprint without changing display text", () => {
  const first = createIntroRequest({
    contentSequence: [{
      type: "text",
      text: "Motörhead visas för spelaren",
      speechText: "Möterhed läses upp"
    }]
  });
  const changedDisplayText = createIntroRequest({
    contentSequence: [{
      type: "text",
      text: "Annan visningstext",
      speechText: "Möterhed läses upp"
    }]
  });
  const changedSpeechText = createIntroRequest({
    contentSequence: [{
      type: "text",
      text: "Motörhead visas för spelaren",
      speechText: "Motorhead läses upp"
    }]
  });

  expect(first.contentSequence).toEqual([{
    type: "text",
    text: "Motörhead visas för spelaren",
    speechText: "Möterhed läses upp"
  }]);
  expect(changedDisplayText.sourceFingerprint).toBe(first.sourceFingerprint);
  expect(changedSpeechText.sourceFingerprint).not.toBe(first.sourceFingerprint);
  expect(compareSpokenAudioReference({
    request: changedSpeechText,
    reference: createReference(first)
  }).status).toBe("stale");
});

test("creates intro and directional-answer requests through one contract", () => {
  const intro = createIntroRequest();
  const answer = createSpeechGenerationRequest({
    sourceRef: {
      type: "musikkryss-answer",
      number: 8,
      direction: "down"
    },
    contentSequence: [{ type: "text", text: "Åtta lodrätt" }],
    locale: "sv-SE",
    voiceProfileId: SWEDISH_VOICE_PROFILE
  });

  expect(intro).toMatchObject({
    type: "speech-generation-request",
    version: SPEECH_CONTRACT_VERSION,
    sourceRef: { type: "musikkryss-intro" },
    locale: "sv-SE",
    voiceProfileId: SWEDISH_VOICE_PROFILE
  });
  expect(answer.sourceRef).toEqual({
    type: "musikkryss-answer",
    number: 8,
    direction: "down"
  });
});

test("classifies matching, outdated, and absent audio explicitly", () => {
  const request = createIntroRequest();
  const currentReference = createReference(request);
  const changedRequest = createIntroRequest({
    contentSequence: [{ type: "text", text: "Ändrat intro" }]
  });

  expect(compareSpokenAudioReference({
    request,
    reference: currentReference
  }).status).toBe("current");
  expect(compareSpokenAudioReference({
    request: changedRequest,
    reference: currentReference
  }).status).toBe("stale");
  expect(compareSpokenAudioReference({
    request,
    reference: null
  }).status).toBe("unavailable");
});

test("keeps audio references immutable and rejects provider-specific fields", () => {
  const request = createIntroRequest();
  const reference = createReference(request);

  expect(reference).toEqual({
    type: "spoken-audio-reference",
    version: SPEECH_CONTRACT_VERSION,
    assetId: "speech-asset-1",
    assetVersion: 1,
    mediaType: "audio/mpeg",
    publicUrl: "/audio/speech-asset-1-v1.mp3",
    sourceFingerprint: request.sourceFingerprint,
    voiceProfileId: SWEDISH_VOICE_PROFILE,
    locale: "sv-SE"
  });
  expect(Object.isFrozen(reference)).toBe(true);
  expect(() => createSpokenAudioReference({
    ...reference,
    providerName: "forbidden-provider"
  })).toThrow(/unsupported fields/);
  expect(normalizeSpokenAudioReference({
    ...reference,
    providerVoiceId: "forbidden-voice"
  })).toBeNull();
  expect(() => createSpeechGenerationRequest({
    sourceRef: { type: "musikkryss-intro" },
    contentSequence: [{ type: "text", text: "Intro" }],
    locale: "sv-SE",
    voiceProfileId: SWEDISH_VOICE_PROFILE,
    apiParameters: { speed: 1 }
  })).toThrow(/unsupported fields/);
});

function createIntroRequest(overrides = {}) {
  return createSpeechGenerationRequest({
    sourceRef: { type: "musikkryss-intro" },
    contentSequence: [{ type: "text", text: "Välkommen till Musikkrysset" }],
    locale: "sv-SE",
    voiceProfileId: SWEDISH_VOICE_PROFILE,
    ...overrides
  });
}

function createReference(request) {
  return createSpokenAudioReference({
    assetId: "speech-asset-1",
    assetVersion: 1,
    mediaType: "audio/mpeg",
    publicUrl: "/audio/speech-asset-1-v1.mp3",
    sourceFingerprint: request.sourceFingerprint,
    voiceProfileId: request.voiceProfileId,
    locale: request.locale
  });
}
