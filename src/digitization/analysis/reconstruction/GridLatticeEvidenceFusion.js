import { createGridLatticeConfidence } from "./GridLatticeConfidence";
import {
  cloneDeterministicValue,
  deepFreeze,
  rejectEvaluationFields,
  validateDeterministicObject,
  validateNonEmptyString
} from "./GridLatticeModelSupport";

const VERSION = 1;
const AXES = ["horizontal", "vertical"];

export function fuseGridLatticeCandidateEvidence({
  candidateGeneration,
  evidence,
  primitivePeriodEvidence
} = {}) {
  validateInputs({ candidateGeneration, evidence, primitivePeriodEvidence });
  rejectEvaluationFields(candidateGeneration, "candidateGeneration");
  rejectEvaluationFields(evidence, "evidence");
  rejectEvaluationFields(primitivePeriodEvidence, "primitivePeriodEvidence");

  const confidences = candidateGeneration.candidates.map(candidate => (
    createCandidateConfidence({ candidate, evidence, primitivePeriodEvidence })
  ));
  const reasons = confidences.length === 0
    ? ["grid-lattice-candidates-unavailable"]
    : [];

  return deepFreeze({
    type: "grid-lattice-evidence-fusion",
    version: VERSION,
    status: confidences.length === 0
      ? "unavailable"
      : confidences.every(value => value.status === "available")
        ? "available"
        : "partial",
    evidenceId: evidence.id,
    primitivePeriodEvidenceId: primitivePeriodEvidence.id,
    candidateGenerationStatus: candidateGeneration.status,
    candidateIds: candidateGeneration.candidates.map(candidate => candidate.id),
    confidences,
    provenance: cloneDeterministicValue({
      fusion: "grid-lattice-evidence-fusion-v1",
      gridLatticeEvidence: evidence.provenance,
      primitivePeriodEvidence: primitivePeriodEvidence.provenance,
      candidateGeneration: candidateGeneration.provenance
    }),
    diagnostics: [{
      code: "candidate-evidence-fusion-inventory",
      candidateCount: candidateGeneration.candidates.length,
      evaluatedCandidateCount: confidences.length,
      availableConfidenceArtifactCount: confidences.filter(value => (
        value.status === "available"
      )).length,
      partialConfidenceArtifactCount: confidences.filter(value => (
        value.status === "partial"
      )).length
    }],
    reasons
  });
}

function createCandidateConfidence({ candidate, evidence, primitivePeriodEvidence }) {
  const assessments = [
    createOuterBoundsAssessment(candidate, evidence),
    createAnchorResidualAssessment(candidate, evidence),
    createPrimitivePeriodAssessment(candidate, primitivePeriodEvidence),
    createLatticeIntervalAssessment(candidate, evidence)
  ];
  const unavailableAssessmentIds = assessments
    .filter(assessment => assessment.status === "unavailable")
    .map(assessment => assessment.id);
  const status = unavailableAssessmentIds.length === 0
    ? "available"
    : unavailableAssessmentIds.length === assessments.length
      ? "unavailable"
      : "partial";

  return createGridLatticeConfidence({
    id: `grid-lattice-confidence-${candidate.id}`,
    status,
    candidateId: candidate.id,
    assessments,
    evidenceReferences: mergeReferences(
      candidate.evidenceReferences,
      evidence.evidenceReferences,
      primitivePeriodEvidence.evidenceReferences
    ),
    provenance: {
      fusion: "grid-lattice-evidence-fusion-v1",
      candidate: cloneDeterministicValue(candidate.provenance),
      gridLatticeEvidence: cloneDeterministicValue(evidence.provenance),
      primitivePeriodEvidence: cloneDeterministicValue(
        primitivePeriodEvidence.provenance
      )
    },
    diagnostics: [{
      code: "candidate-assessment-inventory",
      assessmentCount: assessments.length,
      unavailableAssessmentIds
    }],
    reasons: status === "unavailable"
      ? ["candidate-geometric-evidence-unavailable"]
      : []
  });
}

function createOuterBoundsAssessment(candidate, evidence) {
  if (evidence.boundsObservation.status !== "available") {
    return createUnavailableAssessment(
      "outer-bounds-consistency",
      "outer-bounds-unavailable",
      evidence.boundsObservation.evidenceReferences
    );
  }

  const observations = Object.fromEntries(AXES.map(axis => {
    const candidateAxis = candidate.axes[axis];
    const expected = readAxisBounds(evidence.boundsObservation.bounds, axis);
    const startDelta = candidateAxis.boundsStart - expected.start;
    const endDelta = candidateAxis.modeledEnd - expected.end;
    return [axis, {
      expectedStart: expected.start,
      expectedEnd: expected.end,
      candidateStart: candidateAxis.boundsStart,
      candidateModeledEnd: candidateAxis.modeledEnd,
      startDelta,
      endDelta,
      startExactMatch: startDelta === 0,
      endExactMatch: endDelta === 0,
      exactMatch: startDelta === 0 && endDelta === 0
    }];
  }));
  const exactMatch = AXES.every(axis => observations[axis].exactMatch);

  return createAvailableAssessment({
    id: "outer-bounds-consistency",
    relation: exactMatch ? "supports" : "contradicts",
    evidenceReferences: mergeReferences(
      evidence.boundsObservation.evidenceReferences,
      ...AXES.map(axis => candidate.axes[axis].evidenceReferences)
    ),
    observation: {
      comparison: "exact-numeric-equality",
      axes: observations,
      exactMatch
    }
  });
}

function createAnchorResidualAssessment(candidate, evidence) {
  const axes = Object.fromEntries(AXES.map(axis => {
    const assignments = candidate.axes[axis].assignments;
    if (assignments.length === 0) {
      return [axis, {
        axis,
        status: "unavailable",
        reason: "observed-line-anchors-unavailable",
        assignments: [],
        residualStatistics: null
      }];
    }
    const residuals = assignments.map(assignment => assignment.residual);
    return [axis, {
      axis,
      status: "available",
      assignments: cloneDeterministicValue(assignments),
      residualStatistics: createResidualStatistics(residuals),
      exactResidualCount: residuals.filter(residual => residual === 0).length,
      nonExactResidualCount: residuals.filter(residual => residual !== 0).length
    }];
  }));
  if (AXES.some(axis => axes[axis].status === "unavailable")) {
    return createUnavailableAssessment(
      "observed-line-anchor-residuals",
      "observed-line-anchors-unavailable",
      mergeReferences(...AXES.map(axis => evidence.axes[axis].evidenceReferences)),
      { axes }
    );
  }
  const exactMatch = AXES.every(axis => (
    axes[axis].nonExactResidualCount === 0
  ));

  return createAvailableAssessment({
    id: "observed-line-anchor-residuals",
    relation: exactMatch ? "supports" : "contradicts",
    evidenceReferences: mergeReferences(
      ...AXES.map(axis => evidence.axes[axis].evidenceReferences),
      ...AXES.map(axis => candidate.axes[axis].evidenceReferences)
    ),
    observation: {
      comparison: "exact-numeric-residual",
      axes,
      exactMatch
    }
  });
}

function createPrimitivePeriodAssessment(candidate, primitivePeriodEvidence) {
  const axes = Object.fromEntries(AXES.map(axis => {
    const sourceId = candidate.provenance?.[`${axis}AxisCandidate`]
      ?.primitivePeriodCandidateId;
    const source = primitivePeriodEvidence.axes[axis].candidates.find(value => (
      value.id === sourceId
    ));
    if (!source) {
      return [axis, {
        axis,
        status: "unavailable",
        primitivePeriodCandidateId: sourceId ?? null,
        reason: "primitive-period-candidate-unavailable"
      }];
    }
    const periodDelta = candidate.axes[axis].period - source.period;
    return [axis, {
      axis,
      status: "available",
      primitivePeriodCandidateId: source.id,
      candidatePeriod: candidate.axes[axis].period,
      evidencePeriod: source.period,
      periodDelta,
      exactMatch: periodDelta === 0,
      evidenceReferences: source.evidenceReferences.slice(),
      provenance: cloneDeterministicValue(source.provenance)
    }];
  }));
  const unavailable = AXES.some(axis => axes[axis].status === "unavailable");
  if (unavailable) {
    return createUnavailableAssessment(
      "primitive-period-consistency",
      "primitive-period-candidate-unavailable",
      primitivePeriodEvidence.evidenceReferences,
      { axes }
    );
  }
  const exactMatch = AXES.every(axis => axes[axis].exactMatch);

  return createAvailableAssessment({
    id: "primitive-period-consistency",
    relation: exactMatch ? "supports" : "contradicts",
    evidenceReferences: mergeReferences(
      primitivePeriodEvidence.evidenceReferences,
      ...AXES.map(axis => axes[axis].evidenceReferences)
    ),
    observation: {
      comparison: "exact-numeric-equality",
      axes,
      exactMatch
    }
  });
}

function createLatticeIntervalAssessment(candidate, evidence) {
  const axes = Object.fromEntries(AXES.map(axis => {
    const assignments = candidate.axes[axis].assignments;
    if (assignments.length < 2) {
      return [axis, {
        axis,
        status: "unavailable",
        reason: "adjacent-anchor-pairs-unavailable",
        intervals: [],
        residualStatistics: null
      }];
    }
    const intervals = assignments.slice(1).map((assignment, index) => {
      const previous = assignments[index];
      const observedGap = assignment.observedPosition - previous.observedPosition;
      const latticeIntervalCount = assignment.latticeIndex - previous.latticeIndex;
      const modeledGap = latticeIntervalCount * candidate.axes[axis].period;
      const residual = observedGap - modeledGap;
      return {
        fromAnchorOrder: previous.anchorOrder,
        toAnchorOrder: assignment.anchorOrder,
        observedGap,
        latticeIntervalCount,
        modeledGap,
        residual,
        absoluteResidual: Math.abs(residual),
        exactMatch: residual === 0
      };
    });
    return [axis, {
      axis,
      status: "available",
      intervals,
      residualStatistics: createResidualStatistics(
        intervals.map(interval => interval.residual)
      ),
      exactIntervalCount: intervals.filter(interval => interval.exactMatch).length,
      nonExactIntervalCount: intervals.filter(interval => !interval.exactMatch).length
    }];
  }));
  if (AXES.some(axis => axes[axis].status === "unavailable")) {
    return createUnavailableAssessment(
      "lattice-interval-consistency",
      "adjacent-anchor-pairs-unavailable",
      mergeReferences(...AXES.map(axis => evidence.axes[axis].evidenceReferences)),
      { axes }
    );
  }
  const exactMatch = AXES.every(axis => axes[axis].nonExactIntervalCount === 0);

  return createAvailableAssessment({
    id: "lattice-interval-consistency",
    relation: exactMatch ? "supports" : "contradicts",
    evidenceReferences: mergeReferences(
      ...AXES.map(axis => evidence.axes[axis].evidenceReferences),
      ...AXES.map(axis => candidate.axes[axis].evidenceReferences)
    ),
    observation: {
      comparison: "exact-adjacent-anchor-gap-residual",
      axes,
      exactMatch
    }
  });
}

function createAvailableAssessment({ id, relation, evidenceReferences, observation }) {
  return {
    id,
    status: "available",
    relation,
    evidenceReferences,
    observation,
    diagnostics: []
  };
}

function createUnavailableAssessment(
  id,
  reason,
  evidenceReferences,
  observation = {}
) {
  return {
    id,
    status: "unavailable",
    relation: "unavailable",
    evidenceReferences: evidenceReferences.slice(),
    observation: {
      reason,
      ...cloneDeterministicValue(observation)
    },
    diagnostics: []
  };
}

function createResidualStatistics(residuals) {
  const absoluteResiduals = residuals.map(Math.abs).sort((a, b) => a - b);
  const totalAbsolute = absoluteResiduals.reduce((total, value) => total + value, 0);
  const totalSquared = residuals.reduce((total, value) => total + value * value, 0);
  const middle = Math.floor(absoluteResiduals.length / 2);
  const medianAbsoluteResidual = absoluteResiduals.length % 2 === 1
    ? absoluteResiduals[middle]
    : (absoluteResiduals[middle - 1] + absoluteResiduals[middle]) / 2;
  return {
    count: residuals.length,
    maximumAbsoluteResidual: absoluteResiduals[absoluteResiduals.length - 1],
    averageAbsoluteResidual: totalAbsolute / residuals.length,
    medianAbsoluteResidual,
    rmsResidual: Math.sqrt(totalSquared / residuals.length)
  };
}

function readAxisBounds(bounds, axis) {
  return axis === "horizontal"
    ? { start: bounds.top, end: bounds.top + bounds.height }
    : { start: bounds.left, end: bounds.left + bounds.width };
}

function validateInputs({ candidateGeneration, evidence, primitivePeriodEvidence }) {
  validateDeterministicObject(candidateGeneration, "candidateGeneration");
  validateDeterministicObject(evidence, "evidence");
  validateDeterministicObject(primitivePeriodEvidence, "primitivePeriodEvidence");
  if (
    candidateGeneration.type !== "grid-lattice-candidate-generation"
    || candidateGeneration.version !== 1
  ) {
    throw new Error("candidateGeneration must be version 1 candidate generation");
  }
  if (evidence.type !== "grid-lattice-evidence" || evidence.version !== 1) {
    throw new Error("evidence must be GridLatticeEvidence version 1");
  }
  validateNonEmptyString(primitivePeriodEvidence.id, "primitivePeriodEvidence.id");
  if (candidateGeneration.evidenceId !== evidence.id) {
    throw new Error("candidateGeneration evidenceId must match evidence.id");
  }
  if (
    candidateGeneration.primitivePeriodEvidenceId
    !== primitivePeriodEvidence.id
  ) {
    throw new Error(
      "candidateGeneration primitivePeriodEvidenceId must match source evidence"
    );
  }
  candidateGeneration.candidates.forEach((candidate, index) => {
    if (candidate.type !== "grid-lattice-candidate" || candidate.version !== 1) {
      throw new Error(`candidateGeneration.candidates[${index}] is invalid`);
    }
    if (candidate.evidenceId !== evidence.id) {
      throw new Error(`candidateGeneration.candidates[${index}] evidenceId mismatch`);
    }
  });
}

function mergeReferences(...groups) {
  const references = [];
  const seen = new Set();
  groups.flat().forEach(reference => {
    if (!seen.has(reference)) {
      seen.add(reference);
      references.push(reference);
    }
  });
  return references;
}
