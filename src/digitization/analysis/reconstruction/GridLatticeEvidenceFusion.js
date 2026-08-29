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
const ASSESSMENT_IDS = [
  "outer-bounds-consistency",
  "observed-line-anchor-residuals",
  "primitive-period-consistency",
  "lattice-interval-consistency"
];

export function fuseGridLatticeCandidateEvidence({
  candidateGeneration,
  evidence,
  primitivePeriodEvidence
} = {}) {
  validateInputs({ candidateGeneration, evidence, primitivePeriodEvidence });
  rejectEvaluationFields(
    candidateGeneration.axisCandidates,
    "candidateGeneration.axisCandidates"
  );
  rejectEvaluationFields(
    candidateGeneration.candidateSpace,
    "candidateGeneration.candidateSpace"
  );
  rejectEvaluationFields(
    candidateGeneration.boundsSpace,
    "candidateGeneration.boundsSpace"
  );
  rejectEvaluationFields(
    candidateGeneration.provenance,
    "candidateGeneration.provenance"
  );
  rejectEvaluationFields(
    candidateGeneration.diagnostics,
    "candidateGeneration.diagnostics"
  );
  rejectEvaluationFields(evidence, "evidence");
  rejectEvaluationFields(primitivePeriodEvidence, "primitivePeriodEvidence");

  const axisEvidence = deepFreeze(Object.fromEntries(AXES.map(axis => [
    axis,
    candidateGeneration.axisCandidates[axis].map(axisCandidate => (
      createAxisCandidateEvidence({
        axis,
        axisCandidate,
        axisBounds: findAxisBounds(
          candidateGeneration.boundsSpace.axisBounds[axis],
          axisCandidate.axisBoundsId
        ),
        evidence,
        primitivePeriodEvidence
      })
    ))
  ])));
  const exactConfidenceCount = candidateGeneration.candidateSpace
    .exactCandidateCount;
  const confidenceStatusCounts = countFactoredConfidenceStatuses(axisEvidence);
  const reasons = exactConfidenceCount === 0
    ? ["grid-lattice-candidates-unavailable"]
    : [];
  const compatibilityContext = deepFreeze({
    evidenceId: evidence.id,
    evidenceReferences: evidence.evidenceReferences.slice(),
    evidenceAxisReferences: Object.fromEntries(AXES.map(axis => [
      axis,
      evidence.axes[axis].evidenceReferences.slice()
    ])),
    boundsEvidenceReferences:
      evidence.boundsObservation.evidenceReferences.slice(),
    primitivePeriodEvidenceId: primitivePeriodEvidence.id,
    primitivePeriodEvidenceReferences:
      primitivePeriodEvidence.evidenceReferences.slice(),
    gridLatticeEvidenceProvenance: cloneDeterministicValue(evidence.provenance),
    primitivePeriodEvidenceProvenance: cloneDeterministicValue(
      primitivePeriodEvidence.provenance
    )
  });
  let candidateIds = null;
  let confidences = null;
  const result = {
    type: "grid-lattice-evidence-fusion",
    version: VERSION,
    status: exactConfidenceCount === 0
      ? "unavailable"
      : confidenceStatusCounts.available === exactConfidenceCount
        ? "available"
        : "partial",
    evidenceId: evidence.id,
    primitivePeriodEvidenceId: primitivePeriodEvidence.id,
    candidateGenerationStatus: candidateGeneration.status,
    boundsSpace: deepFreeze(
      cloneDeterministicValue(candidateGeneration.boundsSpace)
    ),
    axisEvidence,
    confidenceSpace: deepFreeze({
      representation: "cartesian-product-by-reference",
      combinationOrder: "horizontal-major-vertical-minor",
      horizontalAxisEvidenceIds: axisEvidence.horizontal.map(value => value.id),
      verticalAxisEvidenceIds: axisEvidence.vertical.map(value => value.id),
      horizontalAxisBoundsIds:
        candidateGeneration.boundsSpace.horizontalAxisBoundsIds.slice(),
      verticalAxisBoundsIds:
        candidateGeneration.boundsSpace.verticalAxisBoundsIds.slice(),
      exactBoundsCombinationCount:
        candidateGeneration.boundsSpace.exactBoundsCombinationCount,
      exactConfidenceCount,
      eagerlyMaterializedConfidenceArtifactCount: 0
    }),
    get candidateIds() {
      if (candidateIds === null) {
        candidateIds = Object.freeze(createCandidateIds(axisEvidence));
      }
      return candidateIds;
    },
    get confidences() {
      if (confidences === null) {
        confidences = Object.freeze(materializeConfidences({
          axisEvidence,
          context: compatibilityContext
        }));
      }
      return confidences;
    },
    provenance: deepFreeze(cloneDeterministicValue({
      fusion: "grid-lattice-evidence-fusion-v1",
      gridLatticeEvidence: evidence.provenance,
      primitivePeriodEvidence: primitivePeriodEvidence.provenance,
      candidateGeneration: candidateGeneration.provenance
    })),
    diagnostics: deepFreeze([{
      code: "candidate-evidence-fusion-inventory",
      candidateCount: exactConfidenceCount,
      evaluatedCandidateCount: 0,
      horizontalAxisCandidateCount: axisEvidence.horizontal.length,
      verticalAxisCandidateCount: axisEvidence.vertical.length,
      evaluatedAxisCandidateCount:
        axisEvidence.horizontal.length + axisEvidence.vertical.length,
      availableConfidenceArtifactCount: confidenceStatusCounts.available,
      partialConfidenceArtifactCount: confidenceStatusCounts.partial,
      unavailableConfidenceArtifactCount: confidenceStatusCounts.unavailable,
      rectangularConfidenceRepresentation: "factored-axis-product",
      exactBoundsCombinationCount:
        candidateGeneration.boundsSpace.exactBoundsCombinationCount
    }]),
    reasons: deepFreeze(reasons)
  };

  return Object.freeze(result);
}

function createAxisCandidateEvidence({
  axis,
  axisCandidate,
  axisBounds,
  evidence,
  primitivePeriodEvidence
}) {
  const assessments = {
    "outer-bounds-consistency": createOuterBoundsAxisObservation(
      axisCandidate,
      axisBounds
    ),
    "observed-line-anchor-residuals": createAnchorResidualAxisObservation(
      axisCandidate
    ),
    "primitive-period-consistency": createPrimitivePeriodAxisObservation(
      axisCandidate,
      primitivePeriodEvidence
    ),
    "lattice-interval-consistency": createLatticeIntervalAxisObservation(
      axisCandidate
    )
  };
  const availableAssessmentCount = Object.values(assessments).filter(
    value => value.status === "available"
  ).length;

  return {
    id: `grid-lattice-axis-evidence-${axisCandidate.id}`,
    axis,
    axisCandidateId: axisCandidate.id,
    axisBoundsId: axisBounds.id,
    status: availableAssessmentCount === 4
      ? "available"
      : availableAssessmentCount === 0
        ? "unavailable"
        : "partial",
    assessments,
    axisCandidateProvenance: cloneDeterministicValue(axisCandidate.provenance),
    axisCandidateEvidenceReferences: axisCandidate.evidenceReferences.slice(),
    provenance: {
      fusion: "grid-lattice-evidence-fusion-v1",
      axis,
      axisCandidate: cloneDeterministicValue(axisCandidate.provenance),
      axisBounds: cloneDeterministicValue(axisBounds.provenance),
      gridLatticeEvidence: cloneDeterministicValue(evidence.provenance),
      primitivePeriodEvidence: cloneDeterministicValue(
        primitivePeriodEvidence.provenance
      )
    }
  };
}

function materializeConfidences({ axisEvidence, context }) {
  const confidences = [];
  for (const horizontal of axisEvidence.horizontal) {
    for (const vertical of axisEvidence.vertical) {
      const candidateId = createCandidateId(confidences.length);
      confidences.push(createCandidateConfidence({
        candidateId,
        horizontal,
        vertical,
        context
      }));
    }
  }
  return confidences;
}

function createCandidateConfidence({
  candidateId,
  horizontal,
  vertical,
  context
}) {
  const assessments = ASSESSMENT_IDS.map(id => combineAxisAssessment({
    id,
    horizontal,
    vertical,
    context
  }));
  const unavailableAssessmentIds = assessments
    .filter(assessment => assessment.status === "unavailable")
    .map(assessment => assessment.id);
  const status = unavailableAssessmentIds.length === 0
    ? "available"
    : unavailableAssessmentIds.length === assessments.length
      ? "unavailable"
      : "partial";

  return createGridLatticeConfidence({
    id: `grid-lattice-confidence-${candidateId}`,
    status,
    candidateId,
    assessments,
    evidenceReferences: mergeReferences(
      context.evidenceReferences,
      horizontal.axisCandidateEvidenceReferences,
      vertical.axisCandidateEvidenceReferences,
      context.primitivePeriodEvidenceReferences
    ),
    provenance: {
      fusion: "grid-lattice-evidence-fusion-v1",
      candidate: createCandidateProvenance(horizontal, vertical, context),
      gridLatticeEvidence: cloneDeterministicValue(
        context.gridLatticeEvidenceProvenance
      ),
      primitivePeriodEvidence: cloneDeterministicValue(
        context.primitivePeriodEvidenceProvenance
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

function createOuterBoundsAxisObservation(axisCandidate, axisBounds) {
  const expected = { start: axisBounds.start, end: axisBounds.end };
  const startDelta = axisCandidate.boundsStart - expected.start;
  const endDelta = axisCandidate.modeledEnd - expected.end;
  return {
    status: "available",
    observation: {
      expectedStart: expected.start,
      expectedEnd: expected.end,
      sourceAxisBoundsId: axisBounds.id,
      sourceAxisBoundsOrder: axisCandidate.provenance.axisBoundsOrder,
      evidenceReferences: axisBounds.evidenceReferences.slice(),
      provenance: cloneDeterministicValue(axisBounds.provenance),
      candidateStart: axisCandidate.boundsStart,
      candidateModeledEnd: axisCandidate.modeledEnd,
      startDelta,
      endDelta,
      startExactMatch: startDelta === 0,
      endExactMatch: endDelta === 0,
      exactMatch: startDelta === 0 && endDelta === 0
    }
  };
}

function createAnchorResidualAxisObservation(axisCandidate) {
  const assignments = axisCandidate.assignments;
  if (assignments.length === 0) {
    return {
      status: "unavailable",
      observation: {
        axis: axisCandidate.axis,
        status: "unavailable",
        reason: "observed-line-anchors-unavailable",
        assignments: [],
        residualStatistics: null
      }
    };
  }
  const residuals = assignments.map(assignment => assignment.residual);
  return {
    status: "available",
    observation: {
      axis: axisCandidate.axis,
      status: "available",
      assignments: cloneDeterministicValue(assignments),
      residualStatistics: createResidualStatistics(residuals),
      exactResidualCount: residuals.filter(residual => residual === 0).length,
      nonExactResidualCount: residuals.filter(residual => residual !== 0).length
    }
  };
}

function createPrimitivePeriodAxisObservation(
  axisCandidate,
  primitivePeriodEvidence
) {
  const axis = axisCandidate.axis;
  const sourceId = axisCandidate.provenance?.primitivePeriodCandidateId;
  const source = primitivePeriodEvidence.axes[axis].candidates.find(value => (
    value.id === sourceId
  ));
  if (!source) {
    return {
      status: "unavailable",
      observation: {
        axis,
        status: "unavailable",
        primitivePeriodCandidateId: sourceId ?? null,
        reason: "primitive-period-candidate-unavailable"
      }
    };
  }
  const periodDelta = axisCandidate.period - source.period;
  return {
    status: "available",
    observation: {
      axis,
      status: "available",
      primitivePeriodCandidateId: source.id,
      candidatePeriod: axisCandidate.period,
      evidencePeriod: source.period,
      periodDelta,
      exactMatch: periodDelta === 0,
      evidenceReferences: source.evidenceReferences.slice(),
      provenance: cloneDeterministicValue(source.provenance)
    }
  };
}

function createLatticeIntervalAxisObservation(axisCandidate) {
  const assignments = axisCandidate.assignments;
  if (assignments.length < 2) {
    return {
      status: "unavailable",
      observation: {
        axis: axisCandidate.axis,
        status: "unavailable",
        reason: "adjacent-anchor-pairs-unavailable",
        intervals: [],
        residualStatistics: null
      }
    };
  }
  const intervals = assignments.slice(1).map((assignment, index) => {
    const previous = assignments[index];
    const observedGap = assignment.observedPosition - previous.observedPosition;
    const latticeIntervalCount = assignment.latticeIndex - previous.latticeIndex;
    const modeledGap = latticeIntervalCount * axisCandidate.period;
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
  return {
    status: "available",
    observation: {
      axis: axisCandidate.axis,
      status: "available",
      intervals,
      residualStatistics: createResidualStatistics(
        intervals.map(interval => interval.residual)
      ),
      exactIntervalCount: intervals.filter(interval => interval.exactMatch).length,
      nonExactIntervalCount: intervals.filter(interval => !interval.exactMatch).length
    }
  };
}

function combineAxisAssessment({ id, horizontal, vertical, context }) {
  const horizontalAssessment = horizontal.assessments[id];
  const verticalAssessment = vertical.assessments[id];
  const axes = {
    horizontal: cloneDeterministicValue(horizontalAssessment.observation),
    vertical: cloneDeterministicValue(verticalAssessment.observation)
  };
  const unavailable = (
    horizontalAssessment.status !== "available"
    || verticalAssessment.status !== "available"
  );
  if (unavailable) {
    return createUnavailableAssessment(
      id,
      readUnavailableReason(id),
      readUnavailableEvidenceReferences(id, context),
      id === "outer-bounds-consistency" ? {} : { axes }
    );
  }

  const exactMatch = readAxisExactMatch(id, axes.horizontal)
    && readAxisExactMatch(id, axes.vertical);
  return createAvailableAssessment({
    id,
    relation: exactMatch ? "supports" : "contradicts",
    evidenceReferences: readAvailableEvidenceReferences(
      id,
      horizontal,
      vertical,
      context,
      axes
    ),
    observation: {
      comparison: readComparison(id),
      axes,
      exactMatch
    }
  });
}

function readAxisExactMatch(id, observation) {
  if (
    id === "outer-bounds-consistency"
    || id === "primitive-period-consistency"
  ) {
    return observation.exactMatch;
  }
  if (id === "observed-line-anchor-residuals") {
    return observation.nonExactResidualCount === 0;
  }
  return observation.nonExactIntervalCount === 0;
}

function readComparison(id) {
  return {
    "outer-bounds-consistency": "exact-numeric-equality",
    "observed-line-anchor-residuals": "exact-numeric-residual",
    "primitive-period-consistency": "exact-numeric-equality",
    "lattice-interval-consistency": "exact-adjacent-anchor-gap-residual"
  }[id];
}

function readUnavailableReason(id) {
  return {
    "outer-bounds-consistency": "outer-bounds-unavailable",
    "observed-line-anchor-residuals": "observed-line-anchors-unavailable",
    "primitive-period-consistency": "primitive-period-candidate-unavailable",
    "lattice-interval-consistency": "adjacent-anchor-pairs-unavailable"
  }[id];
}

function readUnavailableEvidenceReferences(id, context) {
  if (id === "outer-bounds-consistency") {
    return context.boundsEvidenceReferences;
  }
  if (id === "primitive-period-consistency") {
    return context.primitivePeriodEvidenceReferences;
  }
  return mergeReferences(
    context.evidenceAxisReferences.horizontal,
    context.evidenceAxisReferences.vertical
  );
}

function readAvailableEvidenceReferences(
  id,
  horizontal,
  vertical,
  context,
  axes
) {
  if (id === "outer-bounds-consistency") {
    return mergeReferences(
      context.boundsEvidenceReferences,
      horizontal.axisCandidateEvidenceReferences,
      vertical.axisCandidateEvidenceReferences
    );
  }
  if (id === "primitive-period-consistency") {
    return mergeReferences(
      context.primitivePeriodEvidenceReferences,
      axes.horizontal.evidenceReferences,
      axes.vertical.evidenceReferences
    );
  }
  return mergeReferences(
    context.evidenceAxisReferences.horizontal,
    context.evidenceAxisReferences.vertical,
    horizontal.axisCandidateEvidenceReferences,
    vertical.axisCandidateEvidenceReferences
  );
}

function createCandidateProvenance(horizontal, vertical, context) {
  return {
    generator: "grid-lattice-candidate-generation-v1",
    gridLatticeEvidence: cloneDeterministicValue(
      context.gridLatticeEvidenceProvenance
    ),
    primitivePeriodEvidence: cloneDeterministicValue(
      context.primitivePeriodEvidenceProvenance
    ),
    horizontalAxisCandidate: cloneDeterministicValue(
      horizontal.axisCandidateProvenance
    ),
    verticalAxisCandidate: cloneDeterministicValue(
      vertical.axisCandidateProvenance
    )
  };
}

function createCandidateIds(axisEvidence) {
  return Array.from(
    {
      length: axisEvidence.horizontal.length * axisEvidence.vertical.length
    },
    (_value, index) => createCandidateId(index)
  );
}

function createCandidateId(zeroBasedIndex) {
  return `grid-lattice-candidate-${String(zeroBasedIndex + 1).padStart(3, "0")}`;
}

function countFactoredConfidenceStatuses(axisEvidence) {
  const horizontalMasks = countAssessmentMasks(axisEvidence.horizontal);
  const verticalMasks = countAssessmentMasks(axisEvidence.vertical);
  const counts = { available: 0, partial: 0, unavailable: 0 };

  for (const [horizontalMask, horizontalCount] of horizontalMasks) {
    for (const [verticalMask, verticalCount] of verticalMasks) {
      const combinedMask = horizontalMask & verticalMask;
      const count = horizontalCount * verticalCount;
      if (combinedMask === 15) {
        counts.available += count;
      } else if (combinedMask === 0) {
        counts.unavailable += count;
      } else {
        counts.partial += count;
      }
    }
  }
  return counts;
}

function countAssessmentMasks(values) {
  const counts = new Map();
  values.forEach(value => {
    const mask = ASSESSMENT_IDS.reduce((result, id, index) => (
      value.assessments[id].status === "available"
        ? result | (1 << index)
        : result
    ), 0);
    counts.set(mask, (counts.get(mask) ?? 0) + 1);
  });
  return counts;
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

function findAxisBounds(values, id) {
  const axisBounds = values.find(value => value.id === id);
  if (!axisBounds) {
    throw new Error(`axis bounds ${id} are unavailable`);
  }
  return axisBounds;
}

function validateInputs({ candidateGeneration, evidence, primitivePeriodEvidence }) {
  if (
    !candidateGeneration
    || typeof candidateGeneration !== "object"
    || Array.isArray(candidateGeneration)
  ) {
    throw new Error("candidateGeneration must be an object");
  }
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
  validateFactoredCandidateGeneration(candidateGeneration, evidence.id);
}

function validateFactoredCandidateGeneration(candidateGeneration, evidenceId) {
  validateDeterministicObject(
    candidateGeneration.axisCandidates,
    "candidateGeneration.axisCandidates"
  );
  validateDeterministicObject(
    candidateGeneration.candidateSpace,
    "candidateGeneration.candidateSpace"
  );
  validateDeterministicObject(
    candidateGeneration.boundsSpace,
    "candidateGeneration.boundsSpace"
  );
  if (
    candidateGeneration.candidateSpace.representation
      !== "cartesian-product-by-reference"
    || candidateGeneration.candidateSpace.combinationOrder
      !== "horizontal-major-vertical-minor"
  ) {
    throw new Error("candidateGeneration candidateSpace is incompatible");
  }

  for (const axis of AXES) {
    const candidates = candidateGeneration.axisCandidates[axis];
    const bounds = candidateGeneration.boundsSpace.axisBounds?.[axis];
    if (!Array.isArray(candidates)) {
      throw new Error(`candidateGeneration.axisCandidates.${axis} must be an array`);
    }
    if (!Array.isArray(bounds)) {
      throw new Error(`candidateGeneration.boundsSpace.axisBounds.${axis} must be an array`);
    }
    const boundsIds = bounds.map(value => value.id);
    const boundsReferenceField = axis === "horizontal"
      ? "horizontalAxisBoundsIds"
      : "verticalAxisBoundsIds";
    if (
      candidateGeneration.boundsSpace[boundsReferenceField]?.length
        !== boundsIds.length
      || candidateGeneration.boundsSpace[boundsReferenceField].some(
        (id, index) => id !== boundsIds[index]
      )
    ) {
      throw new Error(
        `candidateGeneration.boundsSpace.${boundsReferenceField} mismatch`
      );
    }
    candidates.forEach((candidate, index) => {
      if (candidate.axis !== axis || typeof candidate.id !== "string") {
        throw new Error(
          `candidateGeneration.axisCandidates.${axis}[${index}] is invalid`
        );
      }
      if (candidate.provenance?.gridLatticeEvidenceId !== evidenceId) {
        throw new Error(
          `candidateGeneration.axisCandidates.${axis}[${index}] evidenceId mismatch`
        );
      }
      if (!boundsIds.includes(candidate.axisBoundsId)) {
        throw new Error(
          `candidateGeneration.axisCandidates.${axis}[${index}] bounds mismatch`
        );
      }
    });
    const referenceField = axis === "horizontal"
      ? "horizontalAxisCandidateIds"
      : "verticalAxisCandidateIds";
    const references = candidateGeneration.candidateSpace[referenceField];
    if (
      !Array.isArray(references)
      || references.length !== candidates.length
      || references.some((id, index) => id !== candidates[index].id)
    ) {
      throw new Error(`candidateGeneration.candidateSpace.${referenceField} mismatch`);
    }
  }

  const exactCandidateCount = (
    candidateGeneration.axisCandidates.horizontal.length
    * candidateGeneration.axisCandidates.vertical.length
  );
  if (candidateGeneration.candidateSpace.exactCandidateCount !== exactCandidateCount) {
    throw new Error("candidateGeneration candidateSpace count mismatch");
  }
  const exactBoundsCombinationCount = (
    candidateGeneration.boundsSpace.axisBounds.horizontal.length
    * candidateGeneration.boundsSpace.axisBounds.vertical.length
  );
  if (
    candidateGeneration.boundsSpace.exactBoundsCombinationCount
      !== exactBoundsCombinationCount
    || candidateGeneration.boundsSpace.eagerlyMaterializedRectangularBoundsCount
      !== 0
  ) {
    throw new Error("candidateGeneration boundsSpace count mismatch");
  }
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
