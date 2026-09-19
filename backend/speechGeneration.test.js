const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const test = require("node:test");
const {
  createElevenLabsSpeechProvider
} = require("./elevenLabsSpeechProvider");
const { createSpeechAudioStorage } = require("./speechAudioStorage");
const {
  createSpeechGenerationRequest
} = require("./speechGenerationContract");
const {
  createSpeechGenerationService
} = require("./speechGenerationService");
const {
  createMusikkryssAnswerSpeechGenerationHandler,
  createMusikkryssIntroSpeechGenerationHandler
} = require("./server");

test("backend request fingerprint matches the shared browser contract", () => {
  assert.equal(
    createSpeechGenerationRequest({
      sourceRef: { type: "musikkryss-intro" },
      contentSequence: [{
        type: "text",
        text: "Välkommen\ntill Musikkrysset"
      }],
      locale: "sv-SE",
      voiceProfileId: "sv-female-natural-v1"
    }).sourceFingerprint,
    "speech-v1-fnv1a64-ee5847e462fc1e7a"
  );
});

test("ElevenLabs adapter fails clearly when the server API key is missing", () => {
  assert.throws(
    () => createElevenLabsSpeechProvider({
      apiKey: "",
      voiceId: "server-voice-id",
      fetchImpl: async () => ({ ok: true })
    }),
    error => (
      error.code === "SPEECH_PROVIDER_CONFIGURATION_ERROR"
      && /ELEVENLABS_API_KEY/.test(error.message)
    )
  );
});

test("ElevenLabs mapping remains server-side and uses a mocked provider response", async () => {
  const calls = [];
  const provider = createElevenLabsSpeechProvider({
    apiKey: "server-secret",
    voiceId: "server-voice-id",
    modelId: "server-model-id",
    fetchImpl: async (...args) => {
      calls.push(args);
      return {
        ok: true,
        async arrayBuffer() {
          return Uint8Array.from([1, 2, 3, 4]).buffer;
        }
      };
    }
  });

  const generated = await provider.generateSpeech(createIntroRequest());

  assert.equal(calls.length, 1);
  assert.match(calls[0][0], /server-voice-id/);
  assert.equal(calls[0][1].headers["xi-api-key"], "server-secret");
  assert.deepEqual(JSON.parse(calls[0][1].body), {
    text: "Välkommen till Musikkrysset",
    model_id: "server-model-id"
  });
  assert.deepEqual([...generated.audioBuffer], [1, 2, 3, 4]);
  assert.deepEqual(generated.providerProvenance, {
    provider: "elevenlabs",
    providerVoiceId: "server-voice-id",
    providerModelId: "server-model-id",
    providerOutputFormat: "mp3_44100_128"
  });
});

test("ElevenLabs speaks speechText while retaining normal authored text", async () => {
  const calls = [];
  const request = createSpeechGenerationRequest({
    sourceRef: {
      type: "musikkryss-answer",
      number: 1,
      direction: "across"
    },
    contentSequence: [{
      type: "text",
      text: "Svaret ska in på 1 vågrätt.",
      speechText: "Svaret ska in på vågrätt ett."
    }],
    locale: "sv-SE",
    voiceProfileId: "sv-female-natural-v1"
  });
  const provider = createElevenLabsSpeechProvider({
    apiKey: "server-secret",
    voiceId: "server-voice-id",
    modelId: "server-model-id",
    fetchImpl: async (...args) => {
      calls.push(args);
      return {
        ok: true,
        async arrayBuffer() {
          return Uint8Array.from([1]).buffer;
        }
      };
    }
  });

  await provider.generateSpeech(request);

  assert.equal(request.contentSequence[0].text, "Svaret ska in på 1 vågrätt.");
  assert.equal(request.contentSequence[0].speechText, "Svaret ska in på vågrätt ett.");
  assert.equal(
    JSON.parse(calls[0][1].body).text,
    "Svaret ska in på vågrätt ett."
  );
});

test("ElevenLabs failure logs safe provider diagnostics but no credentials", async () => {
  const logs = [];
  const testApiKey = ["sk", "super-secret-value"].join("_");
  const provider = createElevenLabsSpeechProvider({
    apiKey: testApiKey,
    voiceId: "server-voice-id",
    modelId: "server-model-id",
    logger: {
      error(...args) { logs.push(args); }
    },
    fetchImpl: async () => ({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      async text() {
        return JSON.stringify({
          detail: {
            status: "invalid_api_key",
            message: `Credential ${testApiKey} is invalid`
          }
        });
      }
    })
  });

  await assert.rejects(
    provider.generateSpeech(createIntroRequest()),
    error => (
      error.code === "SPEECH_PROVIDER_ERROR"
      && error.message === "ElevenLabs speech generation failed"
    )
  );

  assert.deepEqual(logs, [[
    "[speech] ElevenLabs request failed",
    {
      httpStatus: 401,
      httpStatusText: "Unauthorized",
      providerStatus: "invalid_api_key",
      providerMessage: "Credential [REDACTED] is invalid"
    }
  ]]);
  assert.equal(JSON.stringify(logs).includes(testApiKey), false);
});

test("service persists immutable audio separately and returns a neutral reference", async t => {
  const fixture = createStorageFixture(t);
  const provider = {
    calls: 0,
    async generateSpeech() {
      this.calls += 1;
      return {
        audioBuffer: Buffer.from([7, 8, 9]),
        mediaType: "audio/mpeg",
        providerProvenance: {
          provider: "elevenlabs",
          providerVoiceId: "private-voice",
          providerModelId: "private-model"
        }
      };
    }
  };
  const service = createSpeechGenerationService({
    provider,
    audioStorage: fixture.audioStorage
  });
  const request = createIntroRequest();

  const reference = await service.generateMusikkryssIntro(request);
  const reusedReference = await service.generateMusikkryssIntro(request);

  assert.deepEqual(reference, reusedReference);
  assert.equal(provider.calls, 1);
  assert.equal(reference.sourceFingerprint, request.sourceFingerprint);
  assert.equal(reference.voiceProfileId, "sv-female-natural-v1");
  assert.equal(reference.locale, "sv-SE");
  assert.equal(reference.mediaType, "audio/mpeg");
  assert.equal(reference.assetVersion, 1);
  assert.match(reference.publicUrl, /^https:\/\/audio\.example\/speech-audio\//);
  assert.equal(Object.isFrozen(reference), true);
  assert.deepEqual(fs.readdirSync(fixture.audioDir), [
    `${reference.assetId}-v1.mp3`
  ]);
  assert.deepEqual(
    [...fs.readFileSync(path.join(
      fixture.audioDir,
      `${reference.assetId}-v1.mp3`
    ))],
    [7, 8, 9]
  );

  const provenance = JSON.parse(fs.readFileSync(
    path.join(fixture.provenanceDir, `${reference.assetId}-v1.json`),
    "utf8"
  ));
  assert.equal(provenance.provider, "elevenlabs");
  assert.equal(provenance.providerVoiceId, "private-voice");
  assert.equal("provider" in reference, false);
  assert.equal("providerVoiceId" in reference, false);
  assert.equal("providerModelId" in reference, false);
});

test("intro endpoint returns only the provider-neutral SpokenAudioReference", async t => {
  const fixture = createStorageFixture(t);
  const service = createSpeechGenerationService({
    provider: {
      async generateSpeech() {
        return {
          audioBuffer: Buffer.from("mock-audio"),
          mediaType: "audio/mpeg",
          providerProvenance: {
            provider: "elevenlabs",
            providerVoiceId: "secret-provider-voice",
            providerModelId: "secret-provider-model"
          }
        };
      }
    },
    audioStorage: fixture.audioStorage
  });
  const handler = createMusikkryssIntroSpeechGenerationHandler({
    generateIntro: request => service.generateMusikkryssIntro(request)
  });
  const res = createResponse();

  await handler({ body: { request: createIntroRequest() } }, res);

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.success, true);
  assert.equal(res.body.spokenAudio.type, "spoken-audio-reference");
  assert.doesNotMatch(JSON.stringify(res.body), /elevenlabs|providerVoice|secret/);
});

test("directional answer endpoint preserves fingerprint and reuses its durable asset", async t => {
  const fixture = createStorageFixture(t);
  let providerCalls = 0;
  const service = createSpeechGenerationService({
    provider: {
      async generateSpeech() {
        providerCalls += 1;
        return {
          audioBuffer: Buffer.from("answer-audio"),
          mediaType: "audio/mpeg",
          providerProvenance: {
            provider: "elevenlabs",
            providerVoiceId: "private-answer-voice",
            providerModelId: "private-answer-model"
          }
        };
      }
    },
    audioStorage: fixture.audioStorage
  });
  const handler = createMusikkryssAnswerSpeechGenerationHandler({
    generateAnswer: request => service.generateMusikkryssAnswer(request)
  });
  const request = createAnswerRequest();
  const first = createResponse();
  const second = createResponse();

  await handler({ body: { request } }, first);
  await handler({ body: { request } }, second);

  assert.equal(first.statusCode, 201);
  assert.equal(second.statusCode, 201);
  assert.deepEqual(first.body.spokenAudio, second.body.spokenAudio);
  assert.equal(providerCalls, 1);
  assert.equal(
    first.body.spokenAudio.sourceFingerprint,
    request.sourceFingerprint
  );
  assert.doesNotMatch(
    JSON.stringify(first.body),
    /elevenlabs|providerVoice|private-answer/
  );
  assert.deepEqual(fs.readdirSync(fixture.audioDir), [
    `${first.body.spokenAudio.assetId}-v1.mp3`
  ]);
  const provenance = JSON.parse(fs.readFileSync(
    path.join(
      fixture.provenanceDir,
      `${first.body.spokenAudio.assetId}-v1.json`
    ),
    "utf8"
  ));
  assert.equal(provenance.provider, "elevenlabs");
  assert.equal(provenance.providerVoiceId, "private-answer-voice");
});

test("directional answer endpoint rejects invalid answer source references", async () => {
  let called = false;
  const handler = createMusikkryssAnswerSpeechGenerationHandler({
    generateAnswer: async () => {
      called = true;
    }
  });
  const invalidNumber = createResponse();
  const invalidDirection = createResponse();

  await handler({
    body: {
      request: {
        ...createAnswerRequest(),
        sourceRef: {
          type: "musikkryss-answer",
          number: 0,
          direction: "across"
        }
      }
    }
  }, invalidNumber);
  await handler({
    body: {
      request: {
        ...createAnswerRequest(),
        sourceRef: {
          type: "musikkryss-answer",
          number: 1,
          direction: "diagonal"
        }
      }
    }
  }, invalidDirection);

  assert.equal(invalidNumber.statusCode, 400);
  assert.match(invalidNumber.body.error, /positive integer/);
  assert.equal(invalidDirection.statusCode, 400);
  assert.match(invalidDirection.body.error, /direction is invalid/);
  assert.equal(called, false);
});

test("endpoint rejects client provider metadata and missing server configuration", async () => {
  let called = false;
  const rejectingHandler = createMusikkryssIntroSpeechGenerationHandler({
    generateIntro: async () => {
      called = true;
    }
  });
  const rejected = createResponse();

  await rejectingHandler({
    body: {
      request: createIntroRequest(),
      apiKey: "client-secret"
    }
  }, rejected);

  assert.equal(rejected.statusCode, 400);
  assert.equal(called, false);

  const rejectedRequestMetadata = createResponse();
  await rejectingHandler({
    body: {
      request: {
        ...createIntroRequest(),
        providerVoiceId: "client-provider-voice"
      }
    }
  }, rejectedRequestMetadata);
  assert.equal(rejectedRequestMetadata.statusCode, 400);
  assert.equal(called, false);

  const missingConfigurationHandler =
    createMusikkryssIntroSpeechGenerationHandler({
      env: {},
      fetchImpl: async () => {
        throw new Error("must not call provider");
      }
    });
  const missingConfiguration = createResponse();

  await missingConfigurationHandler({
    body: { request: createIntroRequest() }
  }, missingConfiguration);

  assert.equal(missingConfiguration.statusCode, 503);
  assert.match(missingConfiguration.body.error, /ELEVENLABS_API_KEY/);
});

test("provider diagnostics are never exposed by the public endpoint", async () => {
  const handler = createMusikkryssIntroSpeechGenerationHandler({
    generateIntro: async () => {
      const error = new Error("voice_not_found: private provider detail");
      error.code = "SPEECH_PROVIDER_ERROR";
      throw error;
    }
  });
  const res = createResponse();

  await handler({ body: { request: createIntroRequest() } }, res);

  assert.equal(res.statusCode, 502);
  assert.deepEqual(res.body, {
    success: false,
    error: "Speech provider generation failed"
  });
  assert.doesNotMatch(JSON.stringify(res.body), /voice_not_found|private/);
});

test("provider failure leaves Template state intact", async () => {
  let persisted = false;
  const service = createSpeechGenerationService({
    provider: {
      async generateSpeech() {
        throw Object.assign(new Error("provider unavailable"), {
          code: "SPEECH_PROVIDER_ERROR"
        });
      }
    },
    audioStorage: {
      getExistingReference() { return null; },
      persistGeneratedAudio() {
        persisted = true;
        throw new Error("must not persist");
      }
    }
  });
  const template = {
    crosswordType: "musikkryss",
    musikkryss: {
      introScript: "Välkommen",
      introSpokenAudio: {
        assetId: "existing-audio"
      }
    }
  };
  const before = JSON.stringify(template);

  await assert.rejects(
    service.generateMusikkryssIntro(createIntroRequest()),
    /provider unavailable/
  );
  assert.equal(JSON.stringify(template), before);
  assert.equal(persisted, false);
});

function createIntroRequest() {
  return createSpeechGenerationRequest({
    sourceRef: { type: "musikkryss-intro" },
    contentSequence: [{
      type: "text",
      text: "Välkommen till Musikkrysset"
    }],
    locale: "sv-SE",
    voiceProfileId: "sv-female-natural-v1"
  });
}

function createAnswerRequest() {
  return createSpeechGenerationRequest({
    sourceRef: {
      type: "musikkryss-answer",
      number: 1,
      direction: "across"
    },
    contentSequence: [{ type: "text", text: "Fråga ett" }],
    locale: "sv-SE",
    voiceProfileId: "sv-female-natural-v1"
  });
}

function createStorageFixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "speech-generation-"));
  const audioDir = path.join(root, "audio");
  const provenanceDir = path.join(root, "provenance");
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return {
    audioDir,
    provenanceDir,
    audioStorage: createSpeechAudioStorage({
      audioStorageDir: audioDir,
      provenanceStorageDir: provenanceDir,
      publicBackendBaseUrl: "https://audio.example"
    })
  };
}

function createResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
}
