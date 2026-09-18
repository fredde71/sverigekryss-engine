const fs = require("fs");
const path = require("path");
const { createPublication } = require("./publicationModel");
const {
  normalizePublicationId,
  getPublicationIdValidationError
} = require("./publicationIdValidation");
const { createPublicationId } = require("./publicationIdGenerator");
const { createHelpAccessToken } = require("./helpAccessToken");
const {
  hasCompleteTemplateSolutions
} = require("./templateSolutionCompleteness");

const DEFAULT_PUBLICATION_STORAGE_DIR =
  process.env.PUBLICATION_STORAGE_DIR || path.join(__dirname, "publications");

function getPublicationFilePath(publicationId, {
  pathModule = path,
  publicationStorageDir = DEFAULT_PUBLICATION_STORAGE_DIR
} = {}) {
  const validationError = getPublicationIdValidationError(publicationId);

  if (validationError) {
    throw new Error(validationError);
  }

  return pathModule.join(
    publicationStorageDir,
    `${normalizePublicationId(publicationId)}.json`
  );
}

function readPublication(publicationId, {
  fsModule = fs,
  pathModule = path,
  publicationStorageDir = DEFAULT_PUBLICATION_STORAGE_DIR
} = {}) {
  const filePath = getPublicationFilePath(publicationId, {
    pathModule,
    publicationStorageDir
  });

  if (!fsModule.existsSync(filePath)) {
    return null;
  }

  const fileData = fsModule.readFileSync(filePath, "utf8");

  return createPublication(JSON.parse(fileData));
}

function listPublicationsByCrosswordId(crosswordId, {
  fsModule = fs,
  pathModule = path,
  publicationStorageDir = DEFAULT_PUBLICATION_STORAGE_DIR
} = {}) {
  if (!fsModule.existsSync(publicationStorageDir)) {
    return [];
  }

  return fsModule
    .readdirSync(publicationStorageDir)
    .filter(fileName => fileName.endsWith(".json"))
    .map(fileName => readPublicationFile(fileName, {
      fsModule,
      pathModule,
      publicationStorageDir
    }))
    .filter(Boolean)
    .filter(publication => publication.crosswordId === crosswordId)
    .sort(comparePublications);
}

function writePublication(publication, {
  fsModule = fs,
  pathModule = path,
  publicationStorageDir = DEFAULT_PUBLICATION_STORAGE_DIR,
  generatePublicationId = createPublicationId,
  generateHelpAccessToken = createHelpAccessToken
} = {}) {
  const ensuredPublication = ensurePublicationId(
    publication,
    generatePublicationId
  );
  const normalizedPublication = createPublication({
    ...ensuredPublication,
    helpAccessToken: undefined,
    helpAccessStatus: undefined
  });
  const filePath = getPublicationFilePath(normalizedPublication.publicationId, {
    pathModule,
    publicationStorageDir
  });
  const publicationToWrite = preserveImmutablePublicationCapabilities({
    publication: normalizedPublication,
    filePath,
    fsModule,
    generateHelpAccessToken
  });

  fsModule.mkdirSync(publicationStorageDir, { recursive: true });
  fsModule.writeFileSync(
    filePath,
    JSON.stringify(publicationToWrite, null, 2)
  );

  return publicationToWrite;
}

function preserveImmutablePublicationCapabilities({
  publication,
  filePath,
  fsModule,
  generateHelpAccessToken
}) {
  if (
    typeof fsModule.existsSync !== "function"
    || !fsModule.existsSync(filePath)
  ) {
    return withGeneratedHelpCapability(publication, generateHelpAccessToken);
  }

  const existing = createPublication(JSON.parse(
    fsModule.readFileSync(filePath, "utf8")
  ));
  if (!existing.crosswordSnapshot) {
    return withGeneratedHelpCapability(publication, generateHelpAccessToken);
  }

  if (
    publication.crosswordSnapshot
    && JSON.stringify(publication.crosswordSnapshot)
      !== JSON.stringify(existing.crosswordSnapshot)
  ) {
    throw new Error("Publication crosswordSnapshot is immutable");
  }

  const preservedPublication = {
    ...publication,
    crosswordSnapshot: existing.crosswordSnapshot,
    ...(existing.helpAccessToken ? {
      helpAccessToken: existing.helpAccessToken,
      helpAccessStatus: existing.helpAccessStatus || "inactive"
    } : {})
  };

  return existing.helpAccessToken
    ? preservedPublication
    : withGeneratedHelpCapability(
      preservedPublication,
      generateHelpAccessToken
    );
}

function withGeneratedHelpCapability(publication, generateHelpAccessToken) {
  const template = publication.crosswordSnapshot?.template;
  if (!template || !hasCompleteTemplateSolutions(template)) return publication;

  return createPublication({
    ...publication,
    helpAccessToken: generateHelpAccessToken(),
    helpAccessStatus: "inactive"
  });
}

function publishPublicationHelpAccess(publicationId, {
  fsModule = fs,
  pathModule = path,
  publicationStorageDir = DEFAULT_PUBLICATION_STORAGE_DIR
} = {}) {
  const publication = readPublication(publicationId, {
    fsModule,
    pathModule,
    publicationStorageDir
  });
  if (!publication) return null;

  if (
    !publication.helpAccessToken
    || !hasCompleteTemplateSolutions(publication.crosswordSnapshot?.template)
  ) {
    const error = new Error("Complete valid solutions are required");
    error.code = "HELP_ACCESS_NOT_READY";
    throw error;
  }

  const activated = createPublication({
    ...publication,
    helpAccessStatus: "active"
  });
  const filePath = getPublicationFilePath(publicationId, {
    pathModule,
    publicationStorageDir
  });
  fsModule.writeFileSync(filePath, JSON.stringify(activated, null, 2));
  return activated;
}

function ensurePublicationId(publication, generatePublicationId) {
  if (typeof publication.publicationId === "string"
    && publication.publicationId.trim()) {
    return publication;
  }

  const publicationId = generatePublicationId();

  return {
    ...publication,
    publicationId,
    url: getPublicationUrlWithPublicationId(publication.url, publicationId)
  };
}

function getPublicationUrlWithPublicationId(url, publicationId) {
  if (typeof url !== "string" || !url.trim()) {
    return url;
  }

  return url.replace(
    /\/play\/[^/?#]+(?=([?#]|$))/,
    `/play/${publicationId}`
  );
}

function readPublicationFile(fileName, {
  fsModule,
  pathModule,
  publicationStorageDir
}) {
  try {
    const filePath = pathModule.join(publicationStorageDir, fileName);
    const fileData = fsModule.readFileSync(filePath, "utf8");

    return createPublication(JSON.parse(fileData));
  } catch (err) {
    return null;
  }
}

function comparePublications(a, b) {
  if (a.publishDate && b.publishDate && a.publishDate !== b.publishDate) {
    return a.publishDate.localeCompare(b.publishDate);
  }

  if (a.publishDate && !b.publishDate) {
    return -1;
  }

  if (!a.publishDate && b.publishDate) {
    return 1;
  }

  return a.publicationId.localeCompare(b.publicationId);
}

module.exports = {
  DEFAULT_PUBLICATION_STORAGE_DIR,
  getPublicationFilePath,
  listPublicationsByCrosswordId,
  publishPublicationHelpAccess,
  readPublication,
  writePublication
};
