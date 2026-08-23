const GRID_BOUNDS_OBSERVATION_VERSION = 1;
const RESULT_STATUSES = new Set([
  "available",
  "partial",
  "ambiguous",
  "unavailable"
]);
const SOURCE_STATUSES = new Set(["available", "partial", "unavailable"]);
const OBSERVATION_STATUSES = new Set(["available", "partial"]);
const FORBIDDEN_FIELD_NAMES = new Set([
  "score",
  "confidence",
  "rank",
  "ranking",
  "recommendation",
  "winner",
  "selection",
  "selectedobservation",
  "preferredobservation"
]);

export function createGridBoundsObservation({
  analysisRegionId,
  status,
  sourceAcceptedCandidateEnvelope,
  coordinateSystem,
  provenance,
  observations = [],
  reasons = [],
  diagnostics = []
} = {}) {
  validateNonEmptyString(analysisRegionId, "analysisRegionId");
  validateStatus(status, RESULT_STATUSES, "status");
  validateCoordinateSystem(coordinateSystem);
  validateSourceEnvelope(
    sourceAcceptedCandidateEnvelope,
    coordinateSystem.space
  );
  validateDeterministicObject(provenance, "provenance");
  validateObservations(observations, coordinateSystem.space);
  validateDeterministicArray(reasons, "reasons");
  validateDeterministicArray(diagnostics, "diagnostics");
  validateResultState(status, observations, reasons);

  const result = {
    type: "grid-bounds-observation",
    version: GRID_BOUNDS_OBSERVATION_VERSION,
    analysisRegionId,
    status,
    coordinateSystem: cloneDeterministicValue(coordinateSystem),
    provenance: cloneDeterministicValue(provenance),
    sourceAcceptedCandidateEnvelope: cloneDeterministicValue(
      sourceAcceptedCandidateEnvelope
    ),
    observations: cloneDeterministicValue(observations),
    reasons: cloneDeterministicValue(reasons),
    diagnostics: cloneDeterministicValue(diagnostics)
  };

  rejectForbiddenFields(result, "gridBoundsObservation");
  return deepFreeze(result);
}

function validateCoordinateSystem(coordinateSystem) {
  validateDeterministicObject(coordinateSystem, "coordinateSystem");
  validateNonEmptyString(coordinateSystem.space, "coordinateSystem.space");

  if (coordinateSystem.origin !== "top-left") {
    throw new Error("coordinateSystem.origin must equal top-left");
  }

  if (coordinateSystem.xDirection !== "right") {
    throw new Error("coordinateSystem.xDirection must equal right");
  }

  if (coordinateSystem.yDirection !== "down") {
    throw new Error("coordinateSystem.yDirection must equal down");
  }

  if (coordinateSystem.linePosition !== "visual-line-center") {
    throw new Error(
      "coordinateSystem.linePosition must equal visual-line-center"
    );
  }

  const transform = coordinateSystem.localToBinaryImage;

  validateDeterministicObject(
    transform,
    "coordinateSystem.localToBinaryImage"
  );
  validateFiniteNumber(
    transform.offsetX,
    "coordinateSystem.localToBinaryImage.offsetX"
  );
  validateFiniteNumber(
    transform.offsetY,
    "coordinateSystem.localToBinaryImage.offsetY"
  );
  validatePositiveNumber(
    transform.scaleX,
    "coordinateSystem.localToBinaryImage.scaleX"
  );
  validatePositiveNumber(
    transform.scaleY,
    "coordinateSystem.localToBinaryImage.scaleY"
  );
}

function validateSourceEnvelope(envelope, coordinateSpace) {
  validateDeterministicObject(
    envelope,
    "sourceAcceptedCandidateEnvelope"
  );
  validateStatus(
    envelope.status,
    SOURCE_STATUSES,
    "sourceAcceptedCandidateEnvelope.status"
  );

  if (envelope.semantics !== "accepted-candidate-envelope") {
    throw new Error(
      "sourceAcceptedCandidateEnvelope.semantics must equal accepted-candidate-envelope"
    );
  }

  if (envelope.coordinateSpace !== coordinateSpace) {
    throw new Error(
      "sourceAcceptedCandidateEnvelope.coordinateSpace must match coordinateSystem.space"
    );
  }

  validateDeterministicObject(
    envelope.provenance,
    "sourceAcceptedCandidateEnvelope.provenance"
  );

  if (envelope.status === "unavailable") {
    if (envelope.bounds !== null) {
      throw new Error(
        "Unavailable sourceAcceptedCandidateEnvelope.bounds must be null"
      );
    }

    validateNonEmptyString(
      envelope.reason,
      "sourceAcceptedCandidateEnvelope.reason"
    );
    return;
  }

  validateBounds(
    envelope.bounds,
    envelope.status,
    "sourceAcceptedCandidateEnvelope.bounds"
  );
}

function validateObservations(observations, coordinateSpace) {
  if (!Array.isArray(observations)) {
    throw new Error("observations must be an array");
  }

  const ids = new Set();

  observations.forEach((observation, index) => {
    const path = `observations[${index}]`;

    validateDeterministicObject(observation, path);
    validateNonEmptyString(observation.id, `${path}.id`);

    if (ids.has(observation.id)) {
      throw new Error(`Duplicate observation id: ${observation.id}`);
    }

    ids.add(observation.id);
    validateStatus(observation.status, OBSERVATION_STATUSES, `${path}.status`);

    if (observation.semantics !== "outer-grid-line-center-envelope") {
      throw new Error(
        `${path}.semantics must equal outer-grid-line-center-envelope`
      );
    }

    if (observation.coordinateSpace !== coordinateSpace) {
      throw new Error(
        `${path}.coordinateSpace must match coordinateSystem.space`
      );
    }

    validateBounds(observation.bounds, observation.status, `${path}.bounds`);
    validateDeterministicObject(observation.provenance, `${path}.provenance`);
    validateDeterministicArray(
      observation.evidenceReferences,
      `${path}.evidenceReferences`
    );
    validateDeterministicArray(observation.assumptions, `${path}.assumptions`);
    validateDeterministicArray(observation.reasons, `${path}.reasons`);
    validateDeterministicArray(observation.diagnostics, `${path}.diagnostics`);
  });
}

function validateBounds(bounds, status, path) {
  validateDeterministicObject(bounds, path);
  let finiteCount = 0;

  for (const component of ["top", "left", "width", "height"]) {
    const value = bounds[component];

    if (value === null && status === "partial") {
      continue;
    }

    validateFiniteNumber(value, `${path}.${component}`);

    if ((component === "width" || component === "height") && value <= 0) {
      throw new Error(`${path}.${component} must be greater than zero`);
    }

    finiteCount += 1;
  }

  if (status === "available" && finiteCount !== 4) {
    throw new Error(`${path} must be complete when status is available`);
  }

  if (status === "partial" && (finiteCount === 0 || finiteCount === 4)) {
    throw new Error(`${path} must be incomplete when status is partial`);
  }
}

function validateResultState(status, observations, reasons) {
  if (status === "unavailable") {
    if (observations.length !== 0) {
      throw new Error("Unavailable result must not contain observations");
    }

    if (reasons.length === 0) {
      throw new Error("Unavailable result must contain at least one reason");
    }

    return;
  }

  if (status === "available") {
    if (
      observations.length !== 1
      || observations[0].status !== "available"
    ) {
      throw new Error(
        "Available result must contain exactly one available observation"
      );
    }

    return;
  }

  if (status === "partial") {
    if (
      observations.length !== 1
      || observations[0].status !== "partial"
    ) {
      throw new Error(
        "Partial result must contain exactly one partial observation"
      );
    }

    return;
  }

  if (observations.length < 2) {
    throw new Error("Ambiguous result must contain multiple observations");
  }
}

function validateStatus(value, allowed, path) {
  if (!allowed.has(value)) {
    throw new Error(`${path} is invalid`);
  }
}

function validateDeterministicObject(value, path) {
  if (!isPlainObject(value)) {
    throw new Error(`${path} must be an object`);
  }

  validateDeterministicValue(value, path);
  rejectForbiddenFields(value, path);
}

function validateDeterministicArray(value, path) {
  if (!Array.isArray(value)) {
    throw new Error(`${path} must be an array`);
  }

  validateDeterministicValue(value, path);
  rejectForbiddenFields(value, path);
}

function validateDeterministicValue(value, path) {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return;
  }

  if (typeof value === "number") {
    validateFiniteNumber(value, path);
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) => (
      validateDeterministicValue(entry, `${path}[${index}]`)
    ));
    return;
  }

  if (!isPlainObject(value)) {
    throw new Error(`${path} must contain deterministic plain values`);
  }

  Object.entries(value).forEach(([key, nested]) => (
    validateDeterministicValue(nested, `${path}.${key}`)
  ));
}

function rejectForbiddenFields(value, path) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => (
      rejectForbiddenFields(entry, `${path}[${index}]`)
    ));
    return;
  }

  if (!isPlainObject(value)) {
    return;
  }

  Object.entries(value).forEach(([key, nested]) => {
    const normalized = key.replace(/[-_]/g, "").toLowerCase();

    if (FORBIDDEN_FIELD_NAMES.has(normalized)) {
      throw new Error(`${path}.${key} is not allowed`);
    }

    rejectForbiddenFields(nested, `${path}.${key}`);
  });
}

function cloneDeterministicValue(value) {
  if (Array.isArray(value)) {
    return value.map(cloneDeterministicValue);
  }

  if (!isPlainObject(value)) {
    return value;
  }

  return Object.keys(value).sort().reduce((clone, key) => {
    clone[key] = cloneDeterministicValue(value[key]);
    return clone;
  }, {});
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function validateNonEmptyString(value, path) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${path} must be a non-empty string`);
  }
}

function validateFiniteNumber(value, path) {
  if (!Number.isFinite(value)) {
    throw new Error(`${path} must be finite`);
  }
}

function validatePositiveNumber(value, path) {
  validateFiniteNumber(value, path);

  if (value <= 0) {
    throw new Error(`${path} must be greater than zero`);
  }
}
