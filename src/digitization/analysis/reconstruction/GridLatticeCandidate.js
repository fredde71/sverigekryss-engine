import {
  cloneDeterministicValue,
  deepFreeze,
  rejectEvaluationFields,
  validateArtifactBase,
  validateAxisPair,
  validateComponentStatus,
  validateCoordinateSystem,
  validateDeterministicArray,
  validateEvidenceReferences,
  validateFiniteNumber,
  validateNonEmptyString,
  validatePositiveNumber
} from "./GridLatticeModelSupport";

const VERSION = 1;

export function createGridLatticeCandidate({
  id,
  status,
  evidenceId,
  coordinateSystem,
  axes,
  gridDimensions = null,
  evidenceReferences = [],
  assumptions = [],
  provenance,
  diagnostics = [],
  reasons = []
} = {}) {
  validateArtifactBase({ id, status, provenance, diagnostics, reasons });
  validateNonEmptyString(evidenceId, "evidenceId");
  validateCoordinateSystem(coordinateSystem);
  validateAxisPair(axes, validateCandidateAxis);
  validateGridDimensions(gridDimensions);
  validateCandidateGeometry(axes, gridDimensions);
  validateEvidenceReferences(evidenceReferences);
  validateDeterministicArray(assumptions, "assumptions");

  const result = {
    type: "grid-lattice-candidate",
    version: VERSION,
    id,
    status,
    evidenceId,
    coordinateSystem: cloneDeterministicValue(coordinateSystem),
    axes: cloneDeterministicValue(axes),
    gridDimensions: cloneDeterministicValue(gridDimensions),
    evidenceReferences: cloneDeterministicValue(evidenceReferences),
    assumptions: cloneDeterministicValue(assumptions),
    provenance: cloneDeterministicValue(provenance),
    diagnostics: cloneDeterministicValue(diagnostics),
    reasons: cloneDeterministicValue(reasons)
  };

  rejectEvaluationFields(result, "gridLatticeCandidate");
  return deepFreeze(result);
}

function validateGridDimensions(value) {
  if (value === null) {
    return;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("gridDimensions must be an object or null");
  }
  for (const component of ["rows", "cols"]) {
    if (!Number.isInteger(value[component]) || value[component] <= 0) {
      throw new Error(`gridDimensions.${component} must be a positive integer`);
    }
  }
}

function validateCandidateGeometry(axes, gridDimensions) {
  if (gridDimensions === null) {
    return;
  }
  const dimensionsByAxis = {
    horizontal: gridDimensions.rows,
    vertical: gridDimensions.cols
  };
  for (const axis of ["horizontal", "vertical"]) {
    const value = axes[axis];
    const path = `axes.${axis}`;
    if (value.status !== "available") {
      throw new Error(`${path} must be available when gridDimensions are present`);
    }
    if (value.intervalCount !== dimensionsByAxis[axis]) {
      throw new Error(`${path}.intervalCount must match gridDimensions`);
    }
    if (value.lineCount !== value.intervalCount + 1) {
      throw new Error(`${path}.lineCount must equal intervalCount plus one`);
    }
    for (const field of [
      "boundsStart",
      "boundsEnd",
      "modeledEnd",
      "boundsResidual"
    ]) {
      validateFiniteNumber(value[field], `${path}.${field}`);
    }
    if (value.boundsEnd <= value.boundsStart) {
      throw new Error(`${path} bounds must have positive extent`);
    }
    if (value.modeledEnd !== value.origin + value.intervalCount * value.period) {
      throw new Error(`${path}.modeledEnd is inconsistent with its lattice`);
    }
    if (value.boundsResidual !== value.modeledEnd - value.boundsEnd) {
      throw new Error(`${path}.boundsResidual is inconsistent with its bounds`);
    }
  }
}

function validateCandidateAxis(value, axis, path) {
  validateComponentStatus(value, path);
  if (value.axis !== axis) {
    throw new Error(`${path}.axis must equal ${axis}`);
  }
  validateEvidenceReferences(value.evidenceReferences, `${path}.evidenceReferences`);
  validateDeterministicArray(value.assignments, `${path}.assignments`);
  validateDeterministicArray(value.diagnostics, `${path}.diagnostics`);

  if (value.status === "unavailable") {
    if (value.origin !== null || value.period !== null) {
      throw new Error(`${path} unavailable origin and period must be null`);
    }
    return;
  }

  validateFiniteNumber(value.origin, `${path}.origin`);
  validatePositiveNumber(value.period, `${path}.period`);
}
