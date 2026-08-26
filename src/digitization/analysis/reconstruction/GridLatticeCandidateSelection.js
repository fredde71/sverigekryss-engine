import {
  cloneDeterministicValue,
  deepFreeze,
  validateDeterministicObject
} from "./GridLatticeModelSupport";

const VERSION = 1;
const REQUIRED_ASSESSMENT_IDS = [
  "outer-bounds-consistency",
  "observed-line-anchor-residuals",
  "primitive-period-consistency",
  "lattice-interval-consistency"
];
const COMPARISON_FIELDS = [
  "contradictionCount",
  "outsideExtentAnchorCount",
  "outerBoundsTotalAbsoluteDelta",
  "anchorMaximumAbsoluteResidual",
  "anchorRmsResidual",
  "primitivePeriodTotalAbsoluteDelta",
  "intervalMaximumAbsoluteResidual",
  "intervalRmsResidual"
];

export function selectGridLatticeCandidate({
  candidateGeneration,
  evidenceFusion
} = {}) {
  validateInputs(candidateGeneration, evidenceFusion);

  const candidateEvaluations = candidateGeneration.candidates.map(candidate => {
    const confidence = evidenceFusion.confidences.find(value => (
      value.candidateId === candidate.id
    ));
    return createCandidateEvaluation(candidate, confidence);
  });
  const comparable = candidateEvaluations.filter(value => (
    value.status === "comparable"
  ));
  const minimum = comparable.reduce((current, value) => (
    current === null || compareVectors(value.comparisonVector, current) < 0
      ? value.comparisonVector
      : current
  ), null);
  const matchingMinimum = minimum === null
    ? []
    : comparable.filter(value => (
      compareVectors(value.comparisonVector, minimum) === 0
    ));
  const status = matchingMinimum.length === 0
    ? "unavailable"
    : matchingMinimum.length === 1
      ? "selected"
      : "ambiguous";
  const selectedCandidateId = status === "selected"
    ? matchingMinimum[0].candidateId
    : null;
  const selectedCandidate = selectedCandidateId === null
    ? null
    : candidateGeneration.candidates.find(value => value.id === selectedCandidateId);
  const competingCandidates = Object.freeze(
    candidateGeneration.candidates.filter(value => value.id !== selectedCandidateId)
  );
  const reasons = status === "unavailable"
    ? [candidateGeneration.candidates.length === 0
      ? "grid-lattice-candidates-unavailable"
      : "comparable-grid-lattice-confidence-unavailable"]
    : status === "ambiguous"
      ? ["multiple-candidates-have-identical-evidence-observations"]
      : [];

  return Object.freeze({
    type: "grid-lattice-candidate-selection",
    version: VERSION,
    status,
    selectedCandidateId,
    selectedCandidate,
    competingCandidates,
    candidateEvaluations: deepFreeze(candidateEvaluations),
    ambiguousCandidateIds: status === "ambiguous"
      ? Object.freeze(matchingMinimum.map(value => value.candidateId))
      : Object.freeze([]),
    decisionPolicy: deepFreeze({
      id: "exact-fused-geometric-evidence-lexicographic-v1",
      eligibleConfidenceStatus: "available",
      comparison: "ascending-lexicographic",
      comparisonFields: COMPARISON_FIELDS.slice(),
      tieBehavior: "ambiguous",
      candidateOrderTieBreaker: "none",
      tolerance: "none"
    }),
    decisionProvenance: deepFreeze({
      candidateGeneration: {
        type: candidateGeneration.type,
        version: candidateGeneration.version,
        status: candidateGeneration.status,
        evidenceId: candidateGeneration.evidenceId,
        primitivePeriodEvidenceId:
          candidateGeneration.primitivePeriodEvidenceId,
        provenance: cloneDeterministicValue(candidateGeneration.provenance)
      },
      evidenceFusion: {
        type: evidenceFusion.type,
        version: evidenceFusion.version,
        status: evidenceFusion.status,
        evidenceId: evidenceFusion.evidenceId,
        primitivePeriodEvidenceId: evidenceFusion.primitivePeriodEvidenceId,
        provenance: cloneDeterministicValue(evidenceFusion.provenance)
      },
      confidenceArtifactIds: evidenceFusion.confidences.map(value => value.id)
    }),
    reasons: Object.freeze(reasons)
  });
}

function createCandidateEvaluation(candidate, confidence) {
  if (!confidence || confidence.status !== "available") {
    return {
      candidateId: candidate.id,
      confidenceArtifactId: confidence?.id ?? null,
      status: "unavailable",
      reason: confidence
        ? "grid-lattice-confidence-not-fully-available"
        : "grid-lattice-confidence-unavailable",
      unavailableAssessmentIds: confidence
        ? confidence.assessments
          .filter(value => value.status !== "available")
          .map(value => value.id)
        : REQUIRED_ASSESSMENT_IDS.slice(),
      comparisonVector: null
    };
  }

  const assessments = Object.fromEntries(confidence.assessments.map(value => (
    [value.id, value]
  )));
  const missing = REQUIRED_ASSESSMENT_IDS.filter(id => !assessments[id]);
  if (missing.length > 0) {
    return {
      candidateId: candidate.id,
      confidenceArtifactId: confidence.id,
      status: "unavailable",
      reason: "required-confidence-assessments-unavailable",
      unavailableAssessmentIds: missing,
      comparisonVector: null
    };
  }

  return {
    candidateId: candidate.id,
    confidenceArtifactId: confidence.id,
    status: "comparable",
    reason: null,
    unavailableAssessmentIds: [],
    comparisonVector: createComparisonVector(assessments)
  };
}

function createComparisonVector(assessments) {
  const bounds = assessments["outer-bounds-consistency"].observation;
  const anchors = assessments["observed-line-anchor-residuals"].observation;
  const periods = assessments["primitive-period-consistency"].observation;
  const intervals = assessments["lattice-interval-consistency"].observation;
  const anchorResiduals = readAxisValues(anchors, axis => (
    axis.assignments.map(value => value.residual)
  ));
  const intervalResiduals = readAxisValues(intervals, axis => (
    axis.intervals.map(value => value.residual)
  ));

  return {
    contradictionCount: Object.values(assessments).filter(value => (
      value.relation === "contradicts"
    )).length,
    outsideExtentAnchorCount: readAxisValues(anchors, axis => (
      axis.assignments.map(value => value.withinCandidateExtent ? 0 : 1)
    )).reduce((total, value) => total + value, 0),
    outerBoundsTotalAbsoluteDelta: readAxisValues(bounds, axis => [
      Math.abs(axis.startDelta),
      Math.abs(axis.endDelta)
    ]).reduce((total, value) => total + value, 0),
    anchorMaximumAbsoluteResidual: maximumAbsolute(anchorResiduals),
    anchorRmsResidual: rms(anchorResiduals),
    primitivePeriodTotalAbsoluteDelta: readAxisValues(periods, axis => [
      Math.abs(axis.periodDelta)
    ]).reduce((total, value) => total + value, 0),
    intervalMaximumAbsoluteResidual: maximumAbsolute(intervalResiduals),
    intervalRmsResidual: rms(intervalResiduals)
  };
}

function readAxisValues(observation, readValues) {
  return ["horizontal", "vertical"].flatMap(axis => (
    readValues(observation.axes[axis])
  ));
}

function maximumAbsolute(values) {
  return Math.max(...values.map(Math.abs));
}

function rms(values) {
  return Math.sqrt(
    values.reduce((total, value) => total + value * value, 0) / values.length
  );
}

function compareVectors(left, right) {
  for (const field of COMPARISON_FIELDS) {
    if (left[field] < right[field]) {
      return -1;
    }
    if (left[field] > right[field]) {
      return 1;
    }
  }
  return 0;
}

function validateInputs(candidateGeneration, evidenceFusion) {
  validateDeterministicObject(candidateGeneration, "candidateGeneration");
  validateDeterministicObject(evidenceFusion, "evidenceFusion");
  if (
    candidateGeneration.type !== "grid-lattice-candidate-generation"
    || candidateGeneration.version !== 1
  ) {
    throw new Error("candidateGeneration must be version 1 candidate generation");
  }
  if (
    evidenceFusion.type !== "grid-lattice-evidence-fusion"
    || evidenceFusion.version !== 1
  ) {
    throw new Error("evidenceFusion must be version 1 evidence fusion");
  }
  if (
    candidateGeneration.evidenceId !== evidenceFusion.evidenceId
    || candidateGeneration.primitivePeriodEvidenceId
      !== evidenceFusion.primitivePeriodEvidenceId
  ) {
    throw new Error("candidate generation and evidence fusion sources must match");
  }
  const candidateIds = candidateGeneration.candidates.map(value => value.id);
  if (new Set(candidateIds).size !== candidateIds.length) {
    throw new Error("candidateGeneration candidate ids must be unique");
  }
  if (
    evidenceFusion.candidateIds.length !== candidateIds.length
    || evidenceFusion.candidateIds.some((id, index) => id !== candidateIds[index])
  ) {
    throw new Error("evidenceFusion candidate order must match candidateGeneration");
  }
  const confidenceCandidateIds = evidenceFusion.confidences.map(value => (
    value.candidateId
  ));
  if (
    confidenceCandidateIds.length !== candidateIds.length
    || confidenceCandidateIds.some((id, index) => id !== candidateIds[index])
  ) {
    throw new Error("evidenceFusion confidences must match every candidate in order");
  }
  candidateGeneration.candidates.forEach((candidate, index) => {
    if (candidate.type !== "grid-lattice-candidate" || candidate.version !== 1) {
      throw new Error(`candidateGeneration.candidates[${index}] is invalid`);
    }
    if (!Object.isFrozen(candidate)) {
      throw new Error(`candidateGeneration.candidates[${index}] must be immutable`);
    }
  });
  evidenceFusion.confidences.forEach((confidence, index) => {
    if (confidence.type !== "grid-lattice-confidence" || confidence.version !== 1) {
      throw new Error(`evidenceFusion.confidences[${index}] is invalid`);
    }
  });
}
