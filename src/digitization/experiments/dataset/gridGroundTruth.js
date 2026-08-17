const GROUND_TRUTH_VERSION = 1;

export const GRID_GROUND_TRUTH_COORDINATE_POLICY = deepFreeze({
  space: "rendered-binary-image-pixels",
  origin: "top-left",
  xDirection: "right",
  yDirection: "down",
  pageNumber: 1,
  renderScale: 2,
  linePosition: "visual-line-center",
  bounds: "outer-line-center-envelope",
  futureCellCoordinates: "between-consecutive-confirmed-grid-lines"
});

export function createGridGroundTruth({
  datasetId,
  coordinatePolicy = GRID_GROUND_TRUTH_COORDINATE_POLICY,
  annotations = []
} = {}) {
  validateNonEmptyString(datasetId, "datasetId");
  validateCoordinatePolicy(coordinatePolicy);

  if (!Array.isArray(annotations)) {
    throw new Error("annotations must be an array");
  }

  const itemIds = new Set();
  const projectedAnnotations = annotations.map((annotation, index) => {
    const projected = createAnnotation(annotation, index);

    if (itemIds.has(projected.itemId)) {
      throw new Error(`Duplicate ground-truth itemId: ${projected.itemId}`);
    }

    itemIds.add(projected.itemId);
    return projected;
  });

  return deepFreeze({
    type: "digitization-grid-ground-truth",
    version: GROUND_TRUTH_VERSION,
    datasetId,
    coordinatePolicy: cloneValue(coordinatePolicy),
    annotations: projectedAnnotations
  });
}

export function createGridGroundTruthExport(groundTruth) {
  validateGroundTruthArtifact(groundTruth);

  return {
    fileName: `digitization-grid-ground-truth-${normalizeFileNamePart(
      groundTruth.datasetId
    )}-v${groundTruth.version}.json`,
    mimeType: "application/json",
    contents: `${JSON.stringify(groundTruth, null, 2)}\n`
  };
}

export function createGridGroundTruthDownloader({
  createExport = createGridGroundTruthExport,
  readEnvironment = () => process.env.NODE_ENV,
  documentRef = typeof document === "undefined" ? null : document,
  urlApi = typeof URL === "undefined" ? null : URL,
  BlobCtor = typeof Blob === "undefined" ? null : Blob
} = {}) {
  return function downloadGridGroundTruth(groundTruth) {
    const environment = readEnvironment();

    if (environment !== "development" && environment !== "test") {
      throw new Error("Grid ground truth downloads are development-only");
    }

    if (
      !documentRef
      || typeof documentRef.createElement !== "function"
      || !urlApi
      || typeof urlApi.createObjectURL !== "function"
      || typeof urlApi.revokeObjectURL !== "function"
      || typeof BlobCtor !== "function"
    ) {
      throw new Error("Browser download dependencies are required");
    }

    const artifact = createExport(groundTruth);
    const blob = new BlobCtor([artifact.contents], { type: artifact.mimeType });
    const objectUrl = urlApi.createObjectURL(blob);

    try {
      const anchor = documentRef.createElement("a");

      if (!anchor || typeof anchor.click !== "function") {
        throw new Error("Download anchor with click is required");
      }

      anchor.href = objectUrl;
      anchor.download = artifact.fileName;
      anchor.click();
      return artifact;
    } finally {
      urlApi.revokeObjectURL(objectUrl);
    }
  };
}

export const downloadGridGroundTruth = createGridGroundTruthDownloader();

function createAnnotation(annotation, index) {
  if (!annotation || typeof annotation !== "object") {
    throw new Error(`annotations[${index}] must be an object`);
  }

  validateNonEmptyString(annotation.itemId, `annotations[${index}].itemId`);
  validateNonEmptyString(annotation.filename, `annotations[${index}].filename`);
  validatePositiveNumber(
    annotation.document?.width,
    `annotations[${index}].document.width`
  );
  validatePositiveNumber(
    annotation.document?.height,
    `annotations[${index}].document.height`
  );
  validateLinePositions(
    annotation.horizontalLinePositions,
    `annotations[${index}].horizontalLinePositions`
  );
  validateLinePositions(
    annotation.verticalLinePositions,
    `annotations[${index}].verticalLinePositions`
  );
  validateCount(
    annotation.rows,
    annotation.horizontalLinePositions.length - 1,
    `annotations[${index}].rows`
  );
  validateCount(
    annotation.cols,
    annotation.verticalLinePositions.length - 1,
    `annotations[${index}].cols`
  );
  validateBounds(annotation.gridBounds, annotation, index);
  validateAnnotationMetadata(annotation.annotation, index);

  return {
    itemId: annotation.itemId,
    filename: annotation.filename,
    document: {
      width: annotation.document.width,
      height: annotation.document.height
    },
    gridBounds: cloneValue(annotation.gridBounds),
    horizontalLinePositions: annotation.horizontalLinePositions.slice(),
    verticalLinePositions: annotation.verticalLinePositions.slice(),
    rows: annotation.rows,
    cols: annotation.cols,
    annotation: cloneValue(annotation.annotation)
  };
}

function validateCoordinatePolicy(policy) {
  if (!policy || typeof policy !== "object" || Array.isArray(policy)) {
    throw new Error("coordinatePolicy must be an object");
  }

  validateJsonValue(policy, "coordinatePolicy");
  rejectTimestampFields(policy, "coordinatePolicy");

  for (const [key, expected] of Object.entries(
    GRID_GROUND_TRUTH_COORDINATE_POLICY
  )) {
    if (policy[key] !== expected) {
      throw new Error(
        `coordinatePolicy.${key} must equal ${String(expected)}`
      );
    }
  }
}

function validateAnnotationMetadata(metadata, index) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    throw new Error(`annotations[${index}].annotation must be an object`);
  }

  if (metadata.status !== "human-confirmed") {
    throw new Error(
      `annotations[${index}].annotation.status must be human-confirmed`
    );
  }

  validateJsonValue(metadata, `annotations[${index}].annotation`);
  rejectTimestampFields(metadata, `annotations[${index}].annotation`);
}

function validateLinePositions(positions, path) {
  if (!Array.isArray(positions) || positions.length < 2) {
    throw new Error(`${path} must contain at least two positions`);
  }

  for (let index = 0; index < positions.length; index++) {
    const position = positions[index];

    if (!isIntegerOrHalfPixel(position)) {
      throw new Error(`${path} must contain only finite integer or half-pixel positions`);
    }

    if (index > 0 && position <= positions[index - 1]) {
      throw new Error(`${path} must be strictly increasing`);
    }
  }
}

function validateBounds(bounds, annotation, index) {
  const path = `annotations[${index}].gridBounds`;

  if (!bounds || typeof bounds !== "object" || Array.isArray(bounds)) {
    throw new Error(`${path} must be an object`);
  }

  for (const component of ["top", "left", "width", "height"]) {
    if (!isIntegerOrHalfPixel(bounds[component])) {
      throw new Error(`${path}.${component} must be a finite integer or half-pixel number`);
    }
  }

  const horizontal = annotation.horizontalLinePositions;
  const vertical = annotation.verticalLinePositions;
  const expected = {
    top: horizontal[0],
    left: vertical[0],
    width: vertical[vertical.length - 1] - vertical[0],
    height: horizontal[horizontal.length - 1] - horizontal[0]
  };

  for (const component of ["top", "left", "width", "height"]) {
    if (bounds[component] !== expected[component]) {
      throw new Error(`${path} must equal the outer line-center envelope`);
    }
  }
}

function validateGroundTruthArtifact(groundTruth) {
  if (
    !groundTruth
    || groundTruth.type !== "digitization-grid-ground-truth"
    || groundTruth.version !== GROUND_TRUTH_VERSION
  ) {
    throw new Error("Version 1 digitization grid ground truth is required");
  }
}

function validateNonEmptyString(value, path) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${path} must be a non-empty string`);
  }
}

function validatePositiveNumber(value, path) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${path} must be a positive finite number`);
  }
}

function validateCount(value, expected, path) {
  if (!Number.isInteger(value) || value < 1 || value !== expected) {
    throw new Error(`${path} must equal the number of line intervals`);
  }
}

function isIntegerOrHalfPixel(value) {
  return Number.isFinite(value) && Number.isInteger(value * 2);
}

function rejectTimestampFields(value, path) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => rejectTimestampFields(entry, `${path}[${index}]`));
    return;
  }

  if (!value || typeof value !== "object") {
    return;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase().replace(/[-_]/g, "");

    if (["timestamp", "createdat", "updatedat"].includes(normalizedKey)) {
      throw new Error(`${path} must not contain timestamps`);
    }

    rejectTimestampFields(nestedValue, `${path}.${key}`);
  }
}

function validateJsonValue(value, path) {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(`${path} must contain deterministic JSON values`);
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) => validateJsonValue(entry, `${path}[${index}]`));
    return;
  }

  if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, nestedValue]) => {
      if (nestedValue === undefined) {
        throw new Error(`${path}.${key} must contain deterministic JSON values`);
      }
      validateJsonValue(nestedValue, `${path}.${key}`);
    });
    return;
  }

  throw new Error(`${path} must contain deterministic JSON values`);
}

function normalizeFileNamePart(value) {
  const normalized = String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "dataset";
}

function cloneValue(value) {
  if (Array.isArray(value)) {
    return value.map(cloneValue);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, cloneValue(nestedValue)])
    );
  }

  return value;
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
