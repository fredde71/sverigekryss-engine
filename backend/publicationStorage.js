const fs = require("fs");
const path = require("path");
const { createPublication } = require("./publicationModel");
const {
  normalizePublicationId,
  getPublicationIdValidationError
} = require("./publicationIdValidation");

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
  publicationStorageDir = DEFAULT_PUBLICATION_STORAGE_DIR
} = {}) {
  const normalizedPublication = createPublication(publication);
  const filePath = getPublicationFilePath(normalizedPublication.publicationId, {
    pathModule,
    publicationStorageDir
  });

  fsModule.mkdirSync(publicationStorageDir, { recursive: true });
  fsModule.writeFileSync(
    filePath,
    JSON.stringify(normalizedPublication, null, 2)
  );

  return normalizedPublication;
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
  readPublication,
  writePublication
};
