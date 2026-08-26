import {
  cloneDeterministicValue,
  deepFreeze,
  rejectEvaluationFields,
  validateArtifactBase,
  validateDeterministicArray,
  validateDeterministicObject,
  validateEvidenceReferences,
  validateNonEmptyString,
  validateStatus
} from "./GridLatticeModelSupport";

const VERSION = 1;
const ASSESSMENT_STATUSES = new Set(["available", "unavailable"]);
const RELATIONS = new Set(["supports", "contradicts", "neutral", "unavailable"]);

export function createGridLatticeConfidence({
  id,
  status,
  candidateId,
  assessments = [],
  evidenceReferences = [],
  provenance,
  diagnostics = [],
  reasons = []
} = {}) {
  validateArtifactBase({ id, status, provenance, diagnostics, reasons });
  validateNonEmptyString(candidateId, "candidateId");
  validateEvidenceReferences(evidenceReferences);
  validateAssessments(assessments);

  const result = {
    type: "grid-lattice-confidence",
    version: VERSION,
    id,
    status,
    candidateId,
    assessments: cloneDeterministicValue(assessments),
    evidenceReferences: cloneDeterministicValue(evidenceReferences),
    provenance: cloneDeterministicValue(provenance),
    diagnostics: cloneDeterministicValue(diagnostics),
    reasons: cloneDeterministicValue(reasons)
  };

  rejectEvaluationFields(result, "gridLatticeConfidence");
  return deepFreeze(result);
}

function validateAssessments(assessments) {
  validateDeterministicArray(assessments, "assessments");
  const ids = new Set();
  assessments.forEach((assessment, index) => {
    const path = `assessments[${index}]`;
    validateDeterministicObject(assessment, path);
    validateNonEmptyString(assessment.id, `${path}.id`);
    if (ids.has(assessment.id)) {
      throw new Error("assessments must have unique ids");
    }
    ids.add(assessment.id);
    validateStatus(assessment.status, ASSESSMENT_STATUSES, `${path}.status`);
    validateStatus(assessment.relation, RELATIONS, `${path}.relation`);
    validateEvidenceReferences(
      assessment.evidenceReferences,
      `${path}.evidenceReferences`
    );
    validateDeterministicObject(assessment.observation, `${path}.observation`);
    validateDeterministicArray(assessment.diagnostics, `${path}.diagnostics`);
    if (
      assessment.status === "unavailable"
      && assessment.relation !== "unavailable"
    ) {
      throw new Error(`${path}.relation must be unavailable when status is unavailable`);
    }
  });
}
