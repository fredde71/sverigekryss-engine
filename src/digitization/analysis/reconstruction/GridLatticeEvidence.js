import {
  cloneDeterministicValue,
  deepFreeze,
  rejectEvaluationFields,
  validateArtifactBase,
  validateComponentStatus,
  validateCoordinateSystem,
  validateDeterministicArray,
  validateDeterministicObject,
  validateEvidenceReferences,
  validateAxisPair,
  validateStrictlyIncreasingFiniteNumbers
} from "./GridLatticeModelSupport";

const VERSION = 1;

export function createGridLatticeEvidence({
  id,
  status,
  coordinateSystem,
  axes,
  boundsObservation,
  provenance,
  evidenceReferences = [],
  diagnostics = [],
  reasons = []
} = {}) {
  validateArtifactBase({ id, status, provenance, diagnostics, reasons });
  validateCoordinateSystem(coordinateSystem);
  validateAxisPair(axes, validateAxisEvidence);
  validateBoundsObservation(boundsObservation, coordinateSystem.space);
  validateEvidenceReferences(evidenceReferences);

  const result = {
    type: "grid-lattice-evidence",
    version: VERSION,
    id,
    status,
    coordinateSystem: cloneDeterministicValue(coordinateSystem),
    axes: cloneDeterministicValue(axes),
    boundsObservation: cloneDeterministicValue(boundsObservation),
    provenance: cloneDeterministicValue(provenance),
    evidenceReferences: cloneDeterministicValue(evidenceReferences),
    diagnostics: cloneDeterministicValue(diagnostics),
    reasons: cloneDeterministicValue(reasons)
  };

  rejectEvaluationFields(result, "gridLatticeEvidence");
  return deepFreeze(result);
}

function validateAxisEvidence(value, axis, path) {
  validateComponentStatus(value, path);
  if (value.axis !== axis) {
    throw new Error(`${path}.axis must equal ${axis}`);
  }
  validateStrictlyIncreasingFiniteNumbers(value.positions, `${path}.positions`);
  validateDeterministicArray(value.spacingObservations, `${path}.spacingObservations`);
  validateEvidenceReferences(value.evidenceReferences, `${path}.evidenceReferences`);
  validateDeterministicArray(value.diagnostics, `${path}.diagnostics`);

  if (value.status === "unavailable" && value.positions.length !== 0) {
    throw new Error(`${path}.positions must be empty when unavailable`);
  }
}

function validateBoundsObservation(value, coordinateSpace) {
  validateComponentStatus(value, "boundsObservation");
  if (value.semantics !== "outer-line-center-envelope") {
    throw new Error(
      "boundsObservation.semantics must equal outer-line-center-envelope"
    );
  }
  if (value.coordinateSpace !== coordinateSpace) {
    throw new Error("boundsObservation.coordinateSpace must match coordinateSystem.space");
  }
  validateDeterministicObject(value.provenance, "boundsObservation.provenance");
  validateEvidenceReferences(
    value.evidenceReferences,
    "boundsObservation.evidenceReferences"
  );
  if (value.status === "unavailable" && value.bounds !== null) {
    throw new Error("Unavailable boundsObservation.bounds must be null");
  }
  if (value.status !== "unavailable") {
    validateDeterministicObject(value.bounds, "boundsObservation.bounds");
    for (const component of ["top", "left", "width", "height"]) {
      if (!Number.isFinite(value.bounds[component])) {
        throw new Error(`boundsObservation.bounds.${component} must be finite`);
      }
    }
    if (value.bounds.width <= 0 || value.bounds.height <= 0) {
      throw new Error("boundsObservation bounds dimensions must be greater than zero");
    }
  }
}
