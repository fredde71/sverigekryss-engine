const OUTER_LINE_CENTER_OBSERVATION_VERSION = 1;
const EDGE_ORDER = Object.freeze(["top", "bottom", "left", "right"]);
const EDGE_STATUSES = new Set([
  "available",
  "partial",
  "ambiguous",
  "unavailable"
]);
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

export function createOuterLineCenterObservation({
  analysisRegionId,
  coordinateSystem,
  edges,
  provenance,
  assumptions = [],
  diagnostics = [],
  evidenceReferences = []
} = {}) {
  validateNonEmptyString(analysisRegionId, "analysisRegionId");
  validateCoordinateSystem(coordinateSystem);
  validateEdges(edges);
  validateDeterministicObject(provenance, "provenance");
  validateDeterministicArray(assumptions, "assumptions");
  validateDeterministicArray(diagnostics, "diagnostics");
  validateDeterministicArray(evidenceReferences, "evidenceReferences");

  const result = {
    type: "outer-line-center-observation",
    version: OUTER_LINE_CENTER_OBSERVATION_VERSION,
    analysisRegionId,
    coordinateSystem: cloneDeterministicValue(coordinateSystem),
    edges: EDGE_ORDER.reduce((ordered, edge) => {
      ordered[edge] = cloneDeterministicValue(edges[edge]);
      return ordered;
    }, {}),
    provenance: cloneDeterministicValue(provenance),
    assumptions: cloneDeterministicValue(assumptions),
    diagnostics: cloneDeterministicValue(diagnostics),
    evidenceReferences: cloneDeterministicValue(evidenceReferences)
  };

  rejectForbiddenFields(result, "outerLineCenterObservation");
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

function validateEdges(edges) {
  validateDeterministicObject(edges, "edges");
  const keys = Object.keys(edges);

  if (
    keys.length !== EDGE_ORDER.length
    || EDGE_ORDER.some(edge => !Object.prototype.hasOwnProperty.call(edges, edge))
  ) {
    throw new Error("edges must contain exactly top, bottom, left and right");
  }

  EDGE_ORDER.forEach(edge => validateEdge(edges[edge], edge));
}

function validateEdge(observation, edge) {
  const path = `edges.${edge}`;

  validateDeterministicObject(observation, path);

  if (observation.edge !== edge) {
    throw new Error(`${path}.edge must equal ${edge}`);
  }

  validateStatus(observation.status, EDGE_STATUSES, `${path}.status`);
  validateOptionalFiniteNumber(
    observation.acceptedCandidateCenter,
    `${path}.acceptedCandidateCenter`
  );
  validateOptionalObject(
    observation.candidateRunGeometry,
    `${path}.candidateRunGeometry`
  );
  validateOptionalObject(
    observation.projectionEvidence,
    `${path}.projectionEvidence`
  );
  validateDeterministicArray(
    observation.continuityObservations,
    `${path}.continuityObservations`
  );
  validateOptionalObject(
    observation.neighborhoodObservationExtent,
    `${path}.neighborhoodObservationExtent`
  );
  validateDeterministicObject(observation.provenance, `${path}.provenance`);
  validateDeterministicArray(observation.assumptions, `${path}.assumptions`);
  validateDeterministicArray(observation.diagnostics, `${path}.diagnostics`);
  validateDeterministicArray(
    observation.evidenceReferences,
    `${path}.evidenceReferences`
  );
  validateDeterministicArray(observation.reasons, `${path}.reasons`);
  validateEdgeState(observation, path);
}

function validateEdgeState(observation, path) {
  const completeEvidence = Number.isFinite(observation.acceptedCandidateCenter)
    && observation.candidateRunGeometry !== null
    && observation.projectionEvidence !== null
    && observation.continuityObservations.length > 0
    && observation.neighborhoodObservationExtent !== null;
  const hasAnyEvidence = Number.isFinite(observation.acceptedCandidateCenter)
    || observation.candidateRunGeometry !== null
    || observation.projectionEvidence !== null
    || observation.continuityObservations.length > 0
    || observation.neighborhoodObservationExtent !== null;

  if (observation.status === "available") {
    if (!completeEvidence) {
      throw new Error(`${path} must contain complete available evidence`);
    }

    return;
  }

  if (observation.reasons.length === 0) {
    throw new Error(`${path} must contain a reason when not available`);
  }

  if (observation.status === "partial" && !hasAnyEvidence) {
    throw new Error(`${path} must contain evidence when partial`);
  }

  if (
    observation.status === "ambiguous"
    && (!Number.isFinite(observation.acceptedCandidateCenter)
      || observation.neighborhoodObservationExtent === null)
  ) {
    throw new Error(
      `${path} must preserve its candidate center and extent when ambiguous`
    );
  }
}

function validateOptionalFiniteNumber(value, path) {
  if (value === null) {
    return;
  }

  validateFiniteNumber(value, path);
}

function validateOptionalObject(value, path) {
  if (value === null) {
    return;
  }

  validateDeterministicObject(value, path);
}

function validateStatus(value, allowed, path) {
  if (!allowed.has(value)) {
    throw new Error(`${path} is invalid`);
  }
}

function validateNonEmptyString(value, path) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${path} must be a non-empty string`);
  }
}

function validateFiniteNumber(value, path) {
  if (!Number.isFinite(value)) {
    throw new Error(`${path} must be a finite number`);
  }
}

function validatePositiveNumber(value, path) {
  validateFiniteNumber(value, path);

  if (value <= 0) {
    throw new Error(`${path} must be greater than zero`);
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
  if (
    value === null
    || typeof value === "string"
    || typeof value === "boolean"
  ) {
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
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");

    if (FORBIDDEN_FIELD_NAMES.has(normalizedKey)) {
      throw new Error(`${key} is not allowed at ${path}`);
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
