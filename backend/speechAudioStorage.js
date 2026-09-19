const fs = require("fs");
const path = require("path");
const { createSpokenAudioReference } = require("./speechGenerationContract");

function createSpeechAudioStorage({
  fsModule = fs,
  pathModule = path,
  audioStorageDir,
  provenanceStorageDir,
  publicBackendBaseUrl
}) {
  if (!audioStorageDir || !provenanceStorageDir || !publicBackendBaseUrl) {
    throw new Error("Speech audio storage configuration is incomplete");
  }

  function getExistingReference(request) {
    const paths = getAssetPaths(request.sourceFingerprint, pathModule, {
      audioStorageDir,
      provenanceStorageDir
    });
    const hasAudio = fsModule.existsSync(paths.audioPath);
    const hasProvenance = fsModule.existsSync(paths.provenancePath);
    if (!hasAudio && !hasProvenance) return null;
    if (!hasAudio || !hasProvenance) {
      throw storageError("Stored speech asset is incomplete");
    }
    return createReference(request, paths, publicBackendBaseUrl);
  }

  function persistGeneratedAudio({
    request,
    audioBuffer,
    mediaType,
    providerProvenance,
    generatedAt = new Date()
  }) {
    if (mediaType !== "audio/mpeg") {
      throw storageError("Unsupported generated speech media type");
    }
    if (!Buffer.isBuffer(audioBuffer) || audioBuffer.length === 0) {
      throw storageError("Generated speech audio must be a non-empty Buffer");
    }

    const paths = getAssetPaths(request.sourceFingerprint, pathModule, {
      audioStorageDir,
      provenanceStorageDir
    });
    const existing = getExistingReference(request);
    if (existing) return existing;

    fsModule.mkdirSync(audioStorageDir, { recursive: true });
    fsModule.mkdirSync(provenanceStorageDir, { recursive: true });
    let audioWritten = false;
    try {
      fsModule.writeFileSync(paths.audioPath, audioBuffer, { flag: "wx" });
      audioWritten = true;
      fsModule.writeFileSync(
        paths.provenancePath,
        JSON.stringify({
          ...providerProvenance,
          assetId: paths.assetId,
          assetVersion: 1,
          sourceFingerprint: request.sourceFingerprint,
          generatedAt: generatedAt.toISOString()
        }, null, 2),
        { flag: "wx" }
      );
    } catch (error) {
      if (audioWritten) fsModule.unlinkSync(paths.audioPath);
      throw error;
    }

    return createReference(request, paths, publicBackendBaseUrl);
  }

  return Object.freeze({
    getExistingReference,
    persistGeneratedAudio
  });
}

function getAssetPaths(sourceFingerprint, pathModule, {
  audioStorageDir,
  provenanceStorageDir
}) {
  if (!/^speech-v1-fnv1a64-[0-9a-f]{16}$/.test(sourceFingerprint)) {
    throw storageError("Invalid speech source fingerprint");
  }
  const assetId = `audio-${sourceFingerprint}`;
  const fileName = `${assetId}-v1.mp3`;
  return {
    assetId,
    fileName,
    audioPath: pathModule.join(audioStorageDir, fileName),
    provenancePath: pathModule.join(
      provenanceStorageDir,
      `${assetId}-v1.json`
    )
  };
}

function createReference(request, paths, publicBackendBaseUrl) {
  return createSpokenAudioReference({
    assetId: paths.assetId,
    assetVersion: 1,
    mediaType: "audio/mpeg",
    publicUrl: `${publicBackendBaseUrl.replace(/\/$/, "")}`
      + `/speech-audio/${paths.fileName}`,
    sourceFingerprint: request.sourceFingerprint,
    voiceProfileId: request.voiceProfileId,
    locale: request.locale
  });
}

function storageError(message) {
  const error = new Error(message);
  error.code = "SPEECH_STORAGE_ERROR";
  return error;
}

module.exports = { createSpeechAudioStorage };
