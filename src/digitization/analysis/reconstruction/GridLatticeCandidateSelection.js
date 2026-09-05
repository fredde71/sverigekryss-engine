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
  "intervalRmsResidual",
  "alignmentQualifiedOneXSupportMissing"
];

export function selectGridLatticeCandidate({
  candidateGeneration,
  evidenceFusion
} = {}) {
  validateInputs(candidateGeneration, evidenceFusion);

  const search = findMinimumFactoredCandidate(evidenceFusion.axisEvidence);
  const status = search.matchingCandidateCount === 0
    ? "unavailable"
    : search.matchingCandidateCount === 1
      ? "selected"
      : "ambiguous";
  const selectedCandidateId = status === "selected"
    ? search.firstMatchingReference.candidateId
    : null;
  const selectedCandidateReference = status === "selected"
    ? deepFreeze({ ...search.firstMatchingReference })
    : null;
  const totalCandidateCount = candidateGeneration.candidateSpace
    .exactCandidateCount;
  const reasons = status === "unavailable"
    ? [totalCandidateCount === 0
      ? "grid-lattice-candidates-unavailable"
      : "comparable-grid-lattice-confidence-unavailable"]
    : status === "ambiguous"
      ? ["multiple-candidates-have-identical-evidence-observations"]
      : [];
  let compatibilityCandidates = null;
  let candidateEvaluations = null;
  let ambiguousCandidateIds = null;
  let selectedCandidate = undefined;
  let competingCandidates = null;
  const readCompatibilityCandidates = () => {
    if (compatibilityCandidates === null) {
      compatibilityCandidates = candidateGeneration["candidates"];
    }
    return compatibilityCandidates;
  };
  const decisionProvenance = createDecisionProvenance({
    candidateGeneration,
    evidenceFusion
  });
  const result = {
    type: "grid-lattice-candidate-selection",
    version: VERSION,
    status,
    selectedCandidateId,
    selectedCandidateReference,
    globallyTiedCandidateSpace: createGloballyTiedCandidateSpace(search, status),
    get selectedCandidate() {
      if (selectedCandidate === undefined) {
        selectedCandidate = selectedCandidateReference === null
          ? null
          : readCompatibilityCandidates()[
            selectedCandidateReference.candidateIndex
          ];
      }
      return selectedCandidate;
    },
    competingCandidateSpace: deepFreeze({
      representation: "cartesian-product-by-reference",
      combinationOrder: "horizontal-major-vertical-minor",
      horizontalAxisCandidateIds:
        candidateGeneration.candidateSpace.horizontalAxisCandidateIds.slice(),
      verticalAxisCandidateIds:
        candidateGeneration.candidateSpace.verticalAxisCandidateIds.slice(),
      exactCandidateCount: totalCandidateCount - (status === "selected" ? 1 : 0),
      excludedCandidateReference: selectedCandidateReference,
      eagerlyMaterializedCandidateCount: 0
    }),
    get competingCandidates() {
      if (competingCandidates === null) {
        competingCandidates = Object.freeze(readCompatibilityCandidates().filter(
          value => value.id !== selectedCandidateId
        ));
      }
      return competingCandidates;
    },
    candidateEvaluationSpace: deepFreeze({
      representation: "factored-axis-evidence-product",
      combinationOrder: "horizontal-major-vertical-minor",
      horizontalAxisEvidenceIds:
        evidenceFusion.confidenceSpace.horizontalAxisEvidenceIds.slice(),
      verticalAxisEvidenceIds:
        evidenceFusion.confidenceSpace.verticalAxisEvidenceIds.slice(),
      exactEvaluationCount: totalCandidateCount,
      horizontalAxisEvaluationCount: search.horizontalAxisEvaluationCount,
      verticalAxisEvaluationCount: search.verticalAxisEvaluationCount,
      exactFactoredEvaluationCount:
        search.horizontalAxisEvaluationCount + search.verticalAxisEvaluationCount,
      eagerlyMaterializedEvaluationCount: 0
    }),
    get candidateEvaluations() {
      if (candidateEvaluations === null) {
        candidateEvaluations = deepFreeze(createFactoredCandidateEvaluations(
          evidenceFusion.axisEvidence
        ));
      }
      return candidateEvaluations;
    },
    get ambiguousCandidateIds() {
      if (ambiguousCandidateIds === null) {
        ambiguousCandidateIds = Object.freeze(status === "ambiguous"
          ? materializeGloballyTiedCandidateIds(
            search.factorGroups,
            evidenceFusion.axisEvidence.vertical.length
          )
          : []);
      }
      return ambiguousCandidateIds;
    },
    decisionPolicy: deepFreeze({
      id: "exact-fused-geometric-evidence-lexicographic-v1",
      eligibleConfidenceStatus: "available",
      comparison: "ascending-lexicographic",
      comparisonFields: COMPARISON_FIELDS.slice(),
      tieBehavior: "ambiguous",
      candidateOrderTieBreaker: "none",
      tolerance: "none"
    }),
    decisionProvenance,
    reasons: Object.freeze(reasons)
  };

  return Object.freeze(result);
}

function findMinimumFactoredCandidate(axisEvidence) {
  const horizontal = createAxisSelectionRecords(axisEvidence.horizontal);
  const vertical = createAxisSelectionRecords(axisEvidence.vertical);
  if (horizontal.length === 0 || vertical.length === 0) {
    return {
      minimumVector: null,
      matchingCandidateCount: 0,
      firstMatchingReference: null,
      factorGroups: [],
      horizontalAxisEvaluationCount: axisEvidence.horizontal.length,
      verticalAxisEvaluationCount: axisEvidence.vertical.length
    };
  }

  let factorGroups = createMinimumContradictionFactorGroups(
    horizontal,
    vertical
  );
  for (const descriptor of createRemainingFieldDescriptors()) {
    factorGroups = reduceFactorGroups(factorGroups, descriptor);
  }
  const verticalCandidateCount = axisEvidence.vertical.length;
  const firstPair = findFirstFactoredPair(
    factorGroups,
    verticalCandidateCount
  );
  const firstMatchingReference = createCandidateReference({
    horizontal: firstPair.horizontal.value,
    vertical: firstPair.vertical.value,
    candidateIndex: firstPair.candidateIndex
  });
  const minimumVector = createComparisonVector(
    firstPair.horizontal.value,
    firstPair.vertical.value
  );
  const matchingCandidateCount = factorGroups.reduce(
    (total, group) => (
      total + group.horizontal.length * group.vertical.length
    ),
    0
  );

  return {
    minimumVector,
    matchingCandidateCount,
    firstMatchingReference,
    factorGroups,
    horizontalAxisEvaluationCount: axisEvidence.horizontal.length,
    verticalAxisEvaluationCount: axisEvidence.vertical.length
  };
}

function createAxisSelectionRecords(values) {
  return values.flatMap((value, index) => {
    if (findUnavailableAssessmentIds(value).length > 0) {
      return [];
    }
    const anchors = value.assessments[
      "observed-line-anchor-residuals"
    ].observation;
    const bounds = value.assessments["outer-bounds-consistency"].observation;
    const period = value.assessments[
      "primitive-period-consistency"
    ].observation;
    const intervals = value.assessments[
      "lattice-interval-consistency"
    ].observation;
    const anchorResiduals = anchors.assignments.map(item => item.residual);
    const intervalResiduals = intervals.intervals.map(item => item.residual);

    return [{
      value,
      index,
      contradictionMask: REQUIRED_ASSESSMENT_IDS.reduce(
        (mask, id, bit) => (
          readAxisAssessmentExact(value.assessments[id], id)
            ? mask
            : mask | (1 << bit)
        ),
        0
      ),
      anchorCount: anchorResiduals.length,
      intervalCount: intervalResiduals.length,
      fields: {
        outsideExtentAnchorCount: anchors.assignments.reduce(
          (total, item) => total + (item.withinCandidateExtent ? 0 : 1),
          0
        ),
        outerBoundsTotalAbsoluteDelta:
          Math.abs(bounds.startDelta) + Math.abs(bounds.endDelta),
        anchorMaximumAbsoluteResidual: maximumAbsolute(anchorResiduals),
        anchorSquaredResidualTotal: squaredTotal(anchorResiduals),
        primitivePeriodTotalAbsoluteDelta: Math.abs(period.periodDelta),
        intervalMaximumAbsoluteResidual: maximumAbsolute(intervalResiduals),
        intervalSquaredResidualTotal: squaredTotal(intervalResiduals),
        alignmentQualifiedOneXSupportMissing:
          readAlignmentQualifiedOneXSupport(period) > 0 ? 0 : 1
      }
    }];
  });
}

function createMinimumContradictionFactorGroups(horizontal, vertical) {
  const horizontalGroups = groupAxisRecords(horizontal);
  const verticalGroups = groupAxisRecords(vertical);
  let minimum = null;
  const groups = [];

  for (const horizontalGroup of horizontalGroups) {
    for (const verticalGroup of verticalGroups) {
      const value = bitCount(
        horizontalGroup.contradictionMask
        | verticalGroup.contradictionMask
      );
      const factorGroup = {
        horizontal: horizontalGroup.records,
        vertical: verticalGroup.records
      };
      if (minimum === null || value < minimum) {
        minimum = value;
        groups.length = 0;
        groups.push(factorGroup);
      } else if (value === minimum) {
        groups.push(factorGroup);
      }
    }
  }
  return groups;
}

function groupAxisRecords(records) {
  const groups = new Map();
  for (const record of records) {
    const key = [
      record.contradictionMask,
      record.anchorCount,
      record.intervalCount
    ].join(":");
    if (!groups.has(key)) {
      groups.set(key, {
        contradictionMask: record.contradictionMask,
        records: []
      });
    }
    groups.get(key).records.push(record);
  }
  return [...groups.values()];
}

function createRemainingFieldDescriptors() {
  return [
    sumDescriptor("outsideExtentAnchorCount"),
    sumDescriptor("outerBoundsTotalAbsoluteDelta"),
    maximumDescriptor("anchorMaximumAbsoluteResidual"),
    rmsDescriptor("anchorSquaredResidualTotal", "anchorCount"),
    sumDescriptor("primitivePeriodTotalAbsoluteDelta"),
    maximumDescriptor("intervalMaximumAbsoluteResidual"),
    rmsDescriptor("intervalSquaredResidualTotal", "intervalCount"),
    sumDescriptor("alignmentQualifiedOneXSupportMissing")
  ];
}

function sumDescriptor(field) {
  return {
    read: record => record.fields[field],
    combine: (horizontal, vertical) => horizontal + vertical,
    retain: (value, minimum) => value === minimum
  };
}

function maximumDescriptor(field) {
  return {
    read: record => record.fields[field],
    combine: (horizontal, vertical) => Math.max(horizontal, vertical),
    retain: (value, minimum) => value <= minimum
  };
}

function rmsDescriptor(field, countField) {
  return {
    read: record => record.fields[field],
    combine(horizontal, vertical, group) {
      const sampleCount = (
        group.horizontal[0][countField]
        + group.vertical[0][countField]
      );
      return Math.sqrt((horizontal + vertical) / sampleCount);
    },
    retain: (value, minimum) => value === minimum
  };
}

function reduceFactorGroups(groups, descriptor) {
  let globalMinimum = null;
  const reduced = [];
  for (const group of groups) {
    const horizontalMinimum = minimumAxisValue(group.horizontal, descriptor);
    const verticalMinimum = minimumAxisValue(group.vertical, descriptor);
    const combined = descriptor.combine(
      horizontalMinimum,
      verticalMinimum,
      group
    );
    const next = {
      horizontal: group.horizontal.filter(record => (
        descriptor.retain(descriptor.read(record), horizontalMinimum)
      )),
      vertical: group.vertical.filter(record => (
        descriptor.retain(descriptor.read(record), verticalMinimum)
      ))
    };
    if (globalMinimum === null || combined < globalMinimum) {
      globalMinimum = combined;
      reduced.length = 0;
      reduced.push(next);
    } else if (combined === globalMinimum) {
      reduced.push(next);
    }
  }
  return reduced;
}

function minimumAxisValue(records, descriptor) {
  return records.reduce((minimum, record) => (
    Math.min(minimum, descriptor.read(record))
  ), Infinity);
}

function findFirstFactoredPair(groups, verticalCandidateCount) {
  let first = null;
  for (const group of groups) {
    const horizontal = group.horizontal[0];
    const vertical = group.vertical[0];
    const candidateIndex = (
      horizontal.index * verticalCandidateCount + vertical.index
    );
    if (first === null || candidateIndex < first.candidateIndex) {
      first = { horizontal, vertical, candidateIndex };
    }
  }
  return first;
}

function createGloballyTiedCandidateSpace(search, status) {
  const groups = search.factorGroups.map(group => ({
    horizontalAxisCandidateIds: group.horizontal.map(
      record => record.value.axisCandidateId
    ),
    horizontalAxisEvidenceIds: group.horizontal.map(record => record.value.id),
    verticalAxisCandidateIds: group.vertical.map(
      record => record.value.axisCandidateId
    ),
    verticalAxisEvidenceIds: group.vertical.map(record => record.value.id),
    exactCandidateCount: group.horizontal.length * group.vertical.length
  }));
  return deepFreeze({
    representation: "ordered-union-of-axis-products-by-reference",
    combinationOrder: "candidate-index-ascending",
    groups,
    exactCandidateCount: search.matchingCandidateCount,
    exactCompetitorCount: status === "selected"
      ? Math.max(0, search.matchingCandidateCount - 1)
      : search.matchingCandidateCount,
    eagerlyMaterializedCandidateCount: 0
  });
}

function materializeGloballyTiedCandidateIds(groups, verticalCandidateCount) {
  const references = [];
  for (const group of groups) {
    for (const horizontal of group.horizontal) {
      for (const vertical of group.vertical) {
        const candidateIndex = (
          horizontal.index * verticalCandidateCount + vertical.index
        );
        references.push({
          candidateIndex,
          candidateId: createCandidateId(candidateIndex)
        });
      }
    }
  }
  references.sort((left, right) => left.candidateIndex - right.candidateIndex);
  return references.map(reference => reference.candidateId);
}

function createFactoredCandidateEvaluations(axisEvidence) {
  const evaluations = [];
  visitFactoredCandidates(axisEvidence, evaluation => {
    evaluations.push(evaluation);
  });
  return evaluations;
}

function visitFactoredCandidates(axisEvidence, visit) {
  let candidateIndex = 0;
  for (const horizontal of axisEvidence.horizontal) {
    for (const vertical of axisEvidence.vertical) {
      visit(createFactoredCandidateEvaluation({
        horizontal,
        vertical,
        candidateIndex
      }));
      candidateIndex += 1;
    }
  }
}

function createFactoredCandidateEvaluation({
  horizontal,
  vertical,
  candidateIndex
}) {
  const candidateId = createCandidateId(candidateIndex);
  const unavailableAssessmentIds = Array.from(new Set([
    ...findUnavailableAssessmentIds(horizontal),
    ...findUnavailableAssessmentIds(vertical)
  ]));
  const candidateReference = createCandidateReference({
    horizontal,
    vertical,
    candidateIndex,
  });
  if (unavailableAssessmentIds.length > 0) {
    return {
      candidateId,
      candidateReference,
      confidenceArtifactId: `grid-lattice-confidence-${candidateId}`,
      status: "unavailable",
      reason: "grid-lattice-confidence-not-fully-available",
      unavailableAssessmentIds,
      comparisonVector: null
    };
  }

  return {
    candidateId,
    candidateReference,
    confidenceArtifactId: `grid-lattice-confidence-${candidateId}`,
    status: "comparable",
    reason: null,
    unavailableAssessmentIds: [],
    comparisonVector: createComparisonVector(horizontal, vertical)
  };
}

function findUnavailableAssessmentIds(axisEvidence) {
  return REQUIRED_ASSESSMENT_IDS.filter(id => (
    !isCompleteAssessment(axisEvidence.assessments[id], id)
  ));
}

function isCompleteAssessment(assessment, id) {
  if (
    assessment?.status !== "available"
    || !assessment.observation
    || typeof assessment.observation !== "object"
  ) {
    return false;
  }

  const observation = assessment.observation;
  if (id === "outer-bounds-consistency") {
    return allFinite([
      observation.expectedStart,
      observation.expectedEnd,
      observation.candidateStart,
      observation.candidateModeledEnd,
      observation.startDelta,
      observation.endDelta
    ]) && typeof observation.exactMatch === "boolean";
  }
  if (id === "observed-line-anchor-residuals") {
    return Array.isArray(observation.assignments)
      && observation.assignments.length > 0
      && observation.assignments.every(assignment => (
        Number.isFinite(assignment.residual)
        && typeof assignment.withinCandidateExtent === "boolean"
      ));
  }
  if (id === "primitive-period-consistency") {
    return allFinite([
      observation.candidatePeriod,
      observation.evidencePeriod,
      observation.periodDelta
    ])
      && typeof observation.exactMatch === "boolean"
      && isPrimitiveInterpretationAssessed(observation.provenance)
      && readAlignmentQualifiedOneXSupport(observation) !== null;
  }
  return Array.isArray(observation.intervals)
    && observation.intervals.length > 0
    && observation.intervals.every(interval => Number.isFinite(interval.residual));
}

function readAlignmentQualifiedOneXSupport(observation) {
  const provenance = observation?.provenance;
  const source = provenance?.sourceInterpretation
    ? provenance.sourceInterpretation.alignmentQualifiedOneXSupport
    : provenance?.alignmentQualifiedOneXSupport;

  return source?.status === "available"
    && Number.isInteger(source.count)
    && source.count >= 0
    ? source.count
    : null;
}

function isPrimitiveInterpretationAssessed(provenance) {
  const interpretation = provenance?.sourceInterpretation;

  if (!interpretation) {
    return true;
  }

  return ["admitted", "rejected"].includes(
    interpretation.admission?.status
  )
    && interpretation.oneXSupport?.status === "available"
    && interpretation.alignmentQualifiedOneXSupport?.status === "available"
    && Number.isFinite(interpretation.assignedCandidateCount)
    && Number.isFinite(interpretation.rejectedCandidateCount)
    && Number.isFinite(interpretation.maximumAbsoluteResidual)
    && Number.isFinite(interpretation.RMSResidual)
    && Number.isFinite(interpretation.inferredLineCount)
    && Number.isFinite(interpretation.longestInferredRun)
    && Number.isFinite(interpretation.inferredLineFraction)
    && Array.isArray(interpretation.skippedIntervalCounts);
}

function allFinite(values) {
  return values.every(Number.isFinite);
}

function createCandidateReference({ horizontal, vertical, candidateIndex }) {
  return {
    candidateId: createCandidateId(candidateIndex),
    candidateIndex,
    horizontalAxisCandidateId: horizontal.axisCandidateId,
    verticalAxisCandidateId: vertical.axisCandidateId,
    horizontalAxisEvidenceId: horizontal.id,
    verticalAxisEvidenceId: vertical.id
  };
}

function createComparisonVector(horizontal, vertical) {
  const axisValues = [horizontal, vertical];
  const bounds = axisValues.map(value => (
    value.assessments["outer-bounds-consistency"].observation
  ));
  const anchors = axisValues.map(value => (
    value.assessments["observed-line-anchor-residuals"].observation
  ));
  const periods = axisValues.map(value => (
    value.assessments["primitive-period-consistency"].observation
  ));
  const intervals = axisValues.map(value => (
    value.assessments["lattice-interval-consistency"].observation
  ));
  const anchorResiduals = anchors.flatMap(axis => (
    axis.assignments.map(value => value.residual)
  ));
  const intervalResiduals = intervals.flatMap(axis => (
    axis.intervals.map(value => value.residual)
  ));

  return {
    contradictionCount: REQUIRED_ASSESSMENT_IDS.filter(id => (
      !readAxisAssessmentExact(horizontal.assessments[id], id)
      || !readAxisAssessmentExact(vertical.assessments[id], id)
    )).length,
    outsideExtentAnchorCount: anchors.flatMap(axis => (
      axis.assignments.map(value => value.withinCandidateExtent ? 0 : 1)
    )).reduce((total, value) => total + value, 0),
    outerBoundsTotalAbsoluteDelta: bounds.flatMap(axis => [
      Math.abs(axis.startDelta),
      Math.abs(axis.endDelta)
    ]).reduce((total, value) => total + value, 0),
    anchorMaximumAbsoluteResidual: maximumAbsolute(anchorResiduals),
    anchorRmsResidual: rms(anchorResiduals),
    primitivePeriodTotalAbsoluteDelta: periods.flatMap(axis => [
      Math.abs(axis.periodDelta)
    ]).reduce((total, value) => total + value, 0),
    intervalMaximumAbsoluteResidual: maximumAbsolute(intervalResiduals),
    intervalRmsResidual: rms(intervalResiduals),
    alignmentQualifiedOneXSupportMissing: periods.reduce(
      (total, period) => (
        total + (readAlignmentQualifiedOneXSupport(period) > 0 ? 0 : 1)
      ),
      0
    )
  };
}

function readAxisAssessmentExact(assessment, id) {
  const observation = assessment.observation;
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

function maximumAbsolute(values) {
  return Math.max(...values.map(Math.abs));
}

function rms(values) {
  return Math.sqrt(
    values.reduce((total, value) => total + value * value, 0) / values.length
  );
}

function squaredTotal(values) {
  return values.reduce((total, value) => total + value * value, 0);
}

function bitCount(value) {
  let remaining = value;
  let count = 0;
  while (remaining !== 0) {
    count += remaining & 1;
    remaining >>>= 1;
  }
  return count;
}

function createCandidateId(candidateIndex) {
  return `grid-lattice-candidate-${String(candidateIndex + 1).padStart(3, "0")}`;
}

function createDecisionProvenance({ candidateGeneration, evidenceFusion }) {
  let confidenceArtifactIds = null;
  const exactCandidateCount = candidateGeneration.candidateSpace
    .exactCandidateCount;
  const value = {
    candidateGeneration: deepFreeze({
      type: candidateGeneration.type,
      version: candidateGeneration.version,
      status: candidateGeneration.status,
      evidenceId: candidateGeneration.evidenceId,
      primitivePeriodEvidenceId:
        candidateGeneration.primitivePeriodEvidenceId,
      provenance: cloneDeterministicValue(candidateGeneration.provenance)
    }),
    evidenceFusion: deepFreeze({
      type: evidenceFusion.type,
      version: evidenceFusion.version,
      status: evidenceFusion.status,
      evidenceId: evidenceFusion.evidenceId,
      primitivePeriodEvidenceId: evidenceFusion.primitivePeriodEvidenceId,
      provenance: cloneDeterministicValue(evidenceFusion.provenance)
    }),
    confidenceSpace: deepFreeze({
      representation: evidenceFusion.confidenceSpace.representation,
      combinationOrder: evidenceFusion.confidenceSpace.combinationOrder,
      horizontalAxisEvidenceIds:
        evidenceFusion.confidenceSpace.horizontalAxisEvidenceIds.slice(),
      verticalAxisEvidenceIds:
        evidenceFusion.confidenceSpace.verticalAxisEvidenceIds.slice(),
      exactConfidenceCount: evidenceFusion.confidenceSpace.exactConfidenceCount
    }),
    referenceLookup: "horizontal-major-index-plus-vertical-index",
    get confidenceArtifactIds() {
      if (confidenceArtifactIds === null) {
        confidenceArtifactIds = Object.freeze(Array.from(
          { length: exactCandidateCount },
          (_value, index) => (
            `grid-lattice-confidence-${createCandidateId(index)}`
          )
        ));
      }
      return confidenceArtifactIds;
    }
  };
  return Object.freeze(value);
}

function validateInputs(candidateGeneration, evidenceFusion) {
  if (
    !candidateGeneration
    || typeof candidateGeneration !== "object"
    || Array.isArray(candidateGeneration)
  ) {
    throw new Error("candidateGeneration must be an object");
  }
  if (
    !evidenceFusion
    || typeof evidenceFusion !== "object"
    || Array.isArray(evidenceFusion)
  ) {
    throw new Error("evidenceFusion must be an object");
  }
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
  validateFactoredReferences(candidateGeneration, evidenceFusion);
}

function validateFactoredReferences(candidateGeneration, evidenceFusion) {
  validateDeterministicObject(
    candidateGeneration.axisCandidates,
    "candidateGeneration.axisCandidates"
  );
  validateDeterministicObject(
    candidateGeneration.candidateSpace,
    "candidateGeneration.candidateSpace"
  );
  validateDeterministicObject(
    evidenceFusion.axisEvidence,
    "evidenceFusion.axisEvidence"
  );
  validateDeterministicObject(
    evidenceFusion.confidenceSpace,
    "evidenceFusion.confidenceSpace"
  );
  if (
    candidateGeneration.candidateSpace.representation
      !== "cartesian-product-by-reference"
    || evidenceFusion.confidenceSpace.representation
      !== "cartesian-product-by-reference"
    || candidateGeneration.candidateSpace.combinationOrder
      !== "horizontal-major-vertical-minor"
    || evidenceFusion.confidenceSpace.combinationOrder
      !== "horizontal-major-vertical-minor"
  ) {
    throw new Error("candidate and confidence spaces must be factored");
  }

  for (const axis of ["horizontal", "vertical"]) {
    const candidateField = axis === "horizontal"
      ? "horizontalAxisCandidateIds"
      : "verticalAxisCandidateIds";
    const evidenceField = axis === "horizontal"
      ? "horizontalAxisEvidenceIds"
      : "verticalAxisEvidenceIds";
    const candidateIds = candidateGeneration.candidateSpace[candidateField];
    const generatedAxisCandidates = candidateGeneration.axisCandidates[axis];
    const axisValues = evidenceFusion.axisEvidence[axis];
    const evidenceIds = evidenceFusion.confidenceSpace[evidenceField];
    if (
      !Array.isArray(candidateIds)
      || !Array.isArray(generatedAxisCandidates)
      || !Array.isArray(axisValues)
      || !Array.isArray(evidenceIds)
      || generatedAxisCandidates.length !== candidateIds.length
      || axisValues.length !== candidateIds.length
      || evidenceIds.length !== axisValues.length
      || generatedAxisCandidates.some((value, index) => (
        value.id !== candidateIds[index] || value.axis !== axis
      ))
      || axisValues.some((value, index) => (
        value.axisCandidateId !== candidateIds[index]
        || value.id !== evidenceIds[index]
        || value.axis !== axis
      ))
    ) {
      throw new Error(`factored ${axis} candidate evidence mismatch`);
    }
    if (
      new Set(candidateIds).size !== candidateIds.length
      || new Set(evidenceIds).size !== evidenceIds.length
    ) {
      throw new Error(`factored ${axis} references must be unique`);
    }
  }

  const exactCount = (
    evidenceFusion.axisEvidence.horizontal.length
    * evidenceFusion.axisEvidence.vertical.length
  );
  if (
    candidateGeneration.candidateSpace.exactCandidateCount !== exactCount
    || evidenceFusion.confidenceSpace.exactConfidenceCount !== exactCount
  ) {
    throw new Error("factored candidate and confidence counts must match");
  }
}
