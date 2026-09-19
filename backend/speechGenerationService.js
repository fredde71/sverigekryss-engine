const { createElevenLabsSpeechProvider } = require("./elevenLabsSpeechProvider");
const { createSpeechAudioStorage } = require("./speechAudioStorage");
const {
  validateSpeechGenerationRequest
} = require("./speechGenerationContract");

function createSpeechGenerationService({ provider, audioStorage }) {
  if (!provider || typeof provider.generateSpeech !== "function") {
    throw new TypeError("SpeechGenerationService requires a provider adapter");
  }
  if (
    !audioStorage
    || typeof audioStorage.getExistingReference !== "function"
    || typeof audioStorage.persistGeneratedAudio !== "function"
  ) {
    throw new TypeError("SpeechGenerationService requires audio storage");
  }

  async function generate(input, expectedSourceType) {
    const request = validateSpeechGenerationRequest(input);
    if (request.sourceRef.type !== expectedSourceType) {
      const error = new TypeError(
        `Speech source must be ${expectedSourceType}`
      );
      error.code = "SPEECH_SOURCE_UNSUPPORTED";
      throw error;
    }

    const existingReference = audioStorage.getExistingReference(request);
    if (existingReference) return existingReference;

    const generated = await provider.generateSpeech(request);
    return audioStorage.persistGeneratedAudio({
      request,
      audioBuffer: generated.audioBuffer,
      mediaType: generated.mediaType,
      providerProvenance: generated.providerProvenance
    });
  }

  return Object.freeze({
    generateMusikkryssIntro(input) {
      return generate(input, "musikkryss-intro");
    },
    generateMusikkryssAnswer(input) {
      return generate(input, "musikkryss-answer");
    }
  });
}

function createDefaultSpeechGenerationService({
  env = process.env,
  fetchImpl = globalThis.fetch,
  fsModule,
  pathModule,
  audioStorageDir,
  provenanceStorageDir,
  publicBackendBaseUrl
}) {
  const provider = createElevenLabsSpeechProvider({
    apiKey: env.ELEVENLABS_API_KEY,
    voiceId: env.ELEVENLABS_SV_FEMALE_NATURAL_V1_VOICE_ID,
    modelId: env.ELEVENLABS_MODEL_ID,
    fetchImpl
  });
  const audioStorage = createSpeechAudioStorage({
    fsModule,
    pathModule,
    audioStorageDir,
    provenanceStorageDir,
    publicBackendBaseUrl
  });
  return createSpeechGenerationService({ provider, audioStorage });
}

module.exports = {
  createDefaultSpeechGenerationService,
  createSpeechGenerationService
};
