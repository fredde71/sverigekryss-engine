const ELEVENLABS_PROVIDER_ID = "elevenlabs";
const SUPPORTED_VOICE_PROFILE_ID = "sv-female-natural-v1";
const DEFAULT_MODEL_ID = "eleven_multilingual_v2";
const DEFAULT_OUTPUT_FORMAT = "mp3_44100_128";

function createElevenLabsSpeechProvider({
  apiKey = process.env.ELEVENLABS_API_KEY,
  voiceId = process.env.ELEVENLABS_SV_FEMALE_NATURAL_V1_VOICE_ID,
  modelId = process.env.ELEVENLABS_MODEL_ID || DEFAULT_MODEL_ID,
  fetchImpl = globalThis.fetch,
  baseUrl = "https://api.elevenlabs.io",
  logger = console
} = {}) {
  requireConfiguration(apiKey, "ELEVENLABS_API_KEY");
  requireConfiguration(
    voiceId,
    "ELEVENLABS_SV_FEMALE_NATURAL_V1_VOICE_ID"
  );
  requireConfiguration(modelId, "ELEVENLABS_MODEL_ID");
  if (typeof fetchImpl !== "function") {
    throw configurationError("A server-side fetch implementation is required");
  }

  return Object.freeze({
    async generateSpeech(request) {
      if (request.voiceProfileId !== SUPPORTED_VOICE_PROFILE_ID) {
        throw providerError("Unsupported product voice profile");
      }
      if (!request.locale.toLowerCase().startsWith("sv")) {
        throw providerError("The configured product voice supports Swedish only");
      }

      const response = await fetchImpl(
        `${baseUrl}/v1/text-to-speech/${encodeURIComponent(voiceId)}`
          + `?output_format=${DEFAULT_OUTPUT_FORMAT}`,
        {
          method: "POST",
          headers: {
            Accept: "audio/mpeg",
            "Content-Type": "application/json",
            "xi-api-key": apiKey
          },
          body: JSON.stringify({
            text: getSpeechText(request.contentSequence),
            model_id: modelId
          })
        }
      );

      if (!response?.ok) {
        const diagnostic = await readFailureDiagnostic(response, apiKey);
        logger.error("[speech] ElevenLabs request failed", diagnostic);
        throw providerError("ElevenLabs speech generation failed");
      }

      const audioBuffer = Buffer.from(await response.arrayBuffer());
      if (audioBuffer.length === 0) {
        throw providerError("ElevenLabs returned an empty audio asset");
      }

      return Object.freeze({
        audioBuffer,
        mediaType: "audio/mpeg",
        providerProvenance: Object.freeze({
          provider: ELEVENLABS_PROVIDER_ID,
          providerVoiceId: voiceId,
          providerModelId: modelId,
          providerOutputFormat: DEFAULT_OUTPUT_FORMAT
        })
      });
    }
  });
}

async function readFailureDiagnostic(response, apiKey) {
  const diagnostic = {
    httpStatus: Number.isInteger(response?.status) ? response.status : null,
    httpStatusText: normalizeDiagnosticText(response?.statusText, apiKey)
  };

  if (typeof response?.text !== "function") return diagnostic;

  try {
    const body = JSON.parse(await response.text());
    const detail = body && typeof body === "object" ? body.detail : null;
    if (typeof detail === "string") {
      diagnostic.providerMessage = normalizeDiagnosticText(detail, apiKey);
    } else if (detail && typeof detail === "object") {
      diagnostic.providerStatus = normalizeDiagnosticText(detail.status, apiKey);
      diagnostic.providerMessage = normalizeDiagnosticText(detail.message, apiKey);
    }
  } catch {
    diagnostic.providerBody = "unavailable-or-non-json";
  }

  return Object.fromEntries(
    Object.entries(diagnostic).filter(([, value]) => value !== null)
  );
}

function normalizeDiagnosticText(value, apiKey) {
  if (typeof value !== "string" || value.trim() === "") return null;
  let normalized = value.trim().slice(0, 500);
  if (apiKey) normalized = normalized.split(apiKey).join("[REDACTED]");
  return normalized
    .replace(/\bBearer\s+[^\s,;]+/gi, "Bearer [REDACTED]")
    .replace(/\bsk_[A-Za-z0-9_-]{8,}\b/g, "[REDACTED]");
}

function getSpeechText(contentSequence) {
  const texts = contentSequence.map((entry, index) => {
    if (entry.type !== "text" || typeof entry.text !== "string") {
      throw providerError(
        `Unsupported speech content at contentSequence[${index}]`
      );
    }
    const text = (
      typeof entry.speechText === "string" ? entry.speechText : entry.text
    ).trim();
    if (!text) {
      throw providerError(`Empty speech content at contentSequence[${index}]`);
    }
    return text;
  });

  return texts.join("\n\n");
}

function requireConfiguration(value, name) {
  if (typeof value !== "string" || value.trim() === "") {
    throw configurationError(`Missing required server environment variable ${name}`);
  }
}

function configurationError(message) {
  const error = new Error(message);
  error.code = "SPEECH_PROVIDER_CONFIGURATION_ERROR";
  return error;
}

function providerError(message) {
  const error = new Error(message);
  error.code = "SPEECH_PROVIDER_ERROR";
  return error;
}

module.exports = {
  DEFAULT_MODEL_ID,
  ELEVENLABS_PROVIDER_ID,
  SUPPORTED_VOICE_PROFILE_ID,
  createElevenLabsSpeechProvider
};
