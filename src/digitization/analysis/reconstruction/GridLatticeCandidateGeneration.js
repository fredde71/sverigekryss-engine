import { createGridLatticeCandidate } from "./GridLatticeCandidate";
import {
  cloneDeterministicValue,
  deepFreeze,
  rejectEvaluationFields,
  validateCoordinateSystem,
  validateDeterministicArray,
  validateDeterministicObject,
  validateEvidenceReferences,
  validateNonEmptyString,
  validatePositiveNumber,
  validateStatus
} from "./GridLatticeModelSupport";

const VERSION = 1;
const EVIDENCE_STATUSES = new Set([
  "available",
  "partial",
  "ambiguous",
  "unavailable"
]);
const PERIOD_AXIS_STATUSES = new Set([
  "available",
  "ambiguous",
  "unavailable"
]);

export function generateGridLatticeCandidates({
  evidence,
  primitivePeriodEvidence,
  factoredBounds = null
} = {}) {
  validateEvidence(evidence);
  validatePrimitivePeriodEvidence(primitivePeriodEvidence);
  validateFactoredBounds(factoredBounds, evidence.coordinateSystem);
  rejectEvaluationFields(evidence, "evidence");
  rejectEvaluationFields(
    primitivePeriodEvidence,
    "primitivePeriodEvidence"
  );
  rejectEvaluationFields(factoredBounds, "factoredBounds");

  const boundsSpace = createBoundsSpace(evidence, factoredBounds);

  const unavailableReason = findUnavailableReason(
    evidence,
    primitivePeriodEvidence,
    boundsSpace
  );
  const axisCandidates = unavailableReason
    ? { horizontal: [], vertical: [] }
    : {
      horizontal: createAxisCandidates({
        axis: "horizontal",
        evidence,
        primitivePeriodEvidence,
        boundsSpace
      }),
      vertical: createAxisCandidates({
        axis: "vertical",
        evidence,
        primitivePeriodEvidence,
        boundsSpace
      })
    };
  const rectangularCandidateCount = (
    axisCandidates.horizontal.length * axisCandidates.vertical.length
  );
  const reasons = unavailableReason
    ? [unavailableReason]
    : rectangularCandidateCount === 0
      ? createAxisAvailabilityReasons(axisCandidates)
      : [];
  const status = rectangularCandidateCount === 0
    ? "unavailable"
    : rectangularCandidateCount === 1
      ? "available"
      : "ambiguous";
  const storedAxisCandidates = deepFreeze(
    cloneDeterministicValue(axisCandidates)
  );
  const candidateMaterializationContext = deepFreeze({
    evidenceId: evidence.id,
    coordinateSystem: cloneDeterministicValue(evidence.coordinateSystem),
    evidenceReferences: evidence.evidenceReferences.slice(),
    boundsObservationStatus: boundsSpace.metadata.status,
    primitivePeriodEvidenceId: primitivePeriodEvidence.id,
    gridLatticeEvidenceProvenance: cloneDeterministicValue(evidence.provenance),
    primitivePeriodEvidenceProvenance: cloneDeterministicValue(
      primitivePeriodEvidence.provenance
    )
  });
  let materializedCandidates = null;
  const result = {
    type: "grid-lattice-candidate-generation",
    version: VERSION,
    status,
    evidenceId: evidence.id,
    primitivePeriodEvidenceId: primitivePeriodEvidence.id,
    coordinateSystem: deepFreeze(
      cloneDeterministicValue(evidence.coordinateSystem)
    ),
    boundsSpace: deepFreeze(cloneDeterministicValue(boundsSpace.metadata)),
    axisCandidates: storedAxisCandidates,
    candidateSpace: deepFreeze({
      representation: "cartesian-product-by-reference",
      combinationOrder: "horizontal-major-vertical-minor",
      horizontalAxisCandidateIds: storedAxisCandidates.horizontal.map(
        candidate => candidate.id
      ),
      verticalAxisCandidateIds: storedAxisCandidates.vertical.map(
        candidate => candidate.id
      ),
      exactCandidateCount: rectangularCandidateCount,
      eagerlyMaterializedCandidateCount: 0
    }),
    get candidates() {
      if (materializedCandidates === null) {
        materializedCandidates = Object.freeze(materializeAxisCandidates({
          context: candidateMaterializationContext,
          axisCandidates: storedAxisCandidates
        }));
      }
      return materializedCandidates;
    },
    provenance: deepFreeze(cloneDeterministicValue({
      generator: "grid-lattice-candidate-generation-v1",
      gridLatticeEvidence: evidence.provenance,
      primitivePeriodEvidence: primitivePeriodEvidence.provenance
    })),
    diagnostics: deepFreeze([{
      code: "candidate-generation-inventory",
      horizontalAxisCandidateCount: axisCandidates.horizontal.length,
      verticalAxisCandidateCount: axisCandidates.vertical.length,
      rectangularCandidateCount,
      rectangularCandidateRepresentation: "factored-axis-product",
      horizontalAxisBoundsCount: boundsSpace.axes.horizontal.length,
      verticalAxisBoundsCount: boundsSpace.axes.vertical.length,
      exactBoundsCombinationCount:
        boundsSpace.metadata.exactBoundsCombinationCount
    }]),
    reasons: deepFreeze(reasons.slice())
  };

  return Object.freeze(result);
}

function createAxisCandidates({
  axis,
  evidence,
  primitivePeriodEvidence,
  boundsSpace
}) {
  const axisEvidence = evidence.axes[axis];
  const periodAxis = primitivePeriodEvidence.axes[axis];
  if (
    axisEvidence.status === "unavailable"
    || axisEvidence.positions.length === 0
    || periodAxis.status === "unavailable"
  ) {
    return [];
  }

  return boundsSpace.axes[axis].flatMap((axisBounds, boundsOrder) => (
    periodAxis.candidates.flatMap((periodEvidence, periodOrder) => {
      const span = axisBounds.end - axisBounds.start;
      const intervalCounts = enumerateAdjacentIntervalCounts(
        span,
        periodEvidence.period
      );
      return intervalCounts.map(intervalCount => {
        const start = axisBounds.start;
        const end = axisBounds.end;
        const modeledEnd = start + intervalCount * periodEvidence.period;
        const id = createAxisCandidateId({
          axis,
          boundsOrder,
          periodOrder,
          intervalCount,
          compatibilitySingleBounds: boundsSpace.compatibilitySingleBounds
        });

        return {
          id,
          status: "available",
          axis,
          origin: start,
          period: periodEvidence.period,
          intervalCount,
          lineCount: intervalCount + 1,
          boundsStart: start,
          boundsEnd: end,
          modeledEnd,
          boundsResidual: modeledEnd - end,
          axisBoundsId: axisBounds.id,
          assignments: axisEvidence.positions.map(
            (observedPosition, anchorOrder) => {
              const latticeIndex = Math.round(
                (observedPosition - start) / periodEvidence.period
              );
              const modeledPosition = (
                start + latticeIndex * periodEvidence.period
              );
              return {
                anchorOrder,
                observedPosition,
                latticeIndex,
                modeledPosition,
                residual: observedPosition - modeledPosition,
                withinCandidateExtent:
                  latticeIndex >= 0 && latticeIndex <= intervalCount
              };
            }
          ),
          evidenceReferences: mergeReferences(
            axisEvidence.evidenceReferences,
            periodEvidence.evidenceReferences,
            axisBounds.evidenceReferences
          ),
          provenance: {
            gridLatticeEvidenceId: evidence.id,
            primitivePeriodEvidenceId: primitivePeriodEvidence.id,
            primitivePeriodCandidateId: periodEvidence.id,
            axisBoundsId: axisBounds.id,
            axisBoundsOrder: boundsOrder,
            axisBounds: cloneDeterministicValue(axisBounds.provenance),
            source: cloneDeterministicValue(periodEvidence.provenance)
          },
          diagnostics: [{
            code: "interval-count-derived-from-bounds-and-period",
            span,
            spanToPeriodRatio: span / periodEvidence.period
          }]
        };
      });
    })
  ));
}

function materializeAxisCandidates({
  context,
  axisCandidates
}) {
  const candidates = [];
  for (const horizontal of axisCandidates.horizontal) {
    for (const vertical of axisCandidates.vertical) {
      const candidateNumber = candidates.length + 1;
      candidates.push(createGridLatticeCandidate({
        id: `grid-lattice-candidate-${String(candidateNumber).padStart(3, "0")}`,
        status: "available",
        evidenceId: context.evidenceId,
        coordinateSystem: context.coordinateSystem,
        axes: {
          horizontal: createCandidateAxis(horizontal),
          vertical: createCandidateAxis(vertical)
        },
        gridDimensions: {
          rows: horizontal.intervalCount,
          cols: vertical.intervalCount
        },
        evidenceReferences: mergeReferences(
          context.evidenceReferences,
          horizontal.evidenceReferences,
          vertical.evidenceReferences
        ),
        assumptions: [
          {
            code: "outer-bounds-represent-outer-line-centers",
            boundsObservationStatus: context.boundsObservationStatus
          },
          {
            code: "axis-periods-are-primitive-period-evidence",
            primitivePeriodEvidenceId: context.primitivePeriodEvidenceId
          },
          {
            code: "orthogonal-rectangular-lattice"
          }
        ],
        provenance: {
          generator: "grid-lattice-candidate-generation-v1",
          gridLatticeEvidence: cloneDeterministicValue(
            context.gridLatticeEvidenceProvenance
          ),
          primitivePeriodEvidence: cloneDeterministicValue(
            context.primitivePeriodEvidenceProvenance
          ),
          horizontalAxisCandidate: cloneDeterministicValue(horizontal.provenance),
          verticalAxisCandidate: cloneDeterministicValue(vertical.provenance)
        },
        diagnostics: [{
          code: "rectangular-axis-candidate-combination",
          horizontalAxisCandidateId: horizontal.id,
          verticalAxisCandidateId: vertical.id
        }],
        reasons: []
      }));
    }
  }
  return candidates;
}

function createCandidateAxis(axisCandidate) {
  return {
    status: "available",
    axis: axisCandidate.axis,
    origin: axisCandidate.origin,
    period: axisCandidate.period,
    intervalCount: axisCandidate.intervalCount,
    lineCount: axisCandidate.lineCount,
    boundsStart: axisCandidate.boundsStart,
    boundsEnd: axisCandidate.boundsEnd,
    modeledEnd: axisCandidate.modeledEnd,
    boundsResidual: axisCandidate.boundsResidual,
    assignments: cloneDeterministicValue(axisCandidate.assignments),
    evidenceReferences: axisCandidate.evidenceReferences.slice(),
    diagnostics: cloneDeterministicValue(axisCandidate.diagnostics)
  };
}

function createBoundsSpace(evidence, factoredBounds) {
  if (factoredBounds) {
    const axes = {
      horizontal: factoredBounds.axisBounds.horizontal.map(cloneAxisBounds),
      vertical: factoredBounds.axisBounds.vertical.map(cloneAxisBounds)
    };
    return {
      compatibilitySingleBounds: false,
      axes,
      metadata: {
        representation: "factored-axis-bounds",
        source: "factored-bounds-evidence",
        status: factoredBounds.status,
        combinationOrder: factoredBounds.rectangularCombinationSpace
          .combinationOrder,
        horizontalAxisBoundsIds: axes.horizontal.map(value => value.id),
        verticalAxisBoundsIds: axes.vertical.map(value => value.id),
        axisBounds: cloneDeterministicValue(axes),
        exactBoundsCombinationCount:
          factoredBounds.rectangularCombinationSpace.exactCombinationCount,
        eagerlyMaterializedRectangularBoundsCount: 0,
        provenance: cloneDeterministicValue(factoredBounds.provenance),
        reasons: cloneDeterministicValue(factoredBounds.reasons)
      }
    };
  }

  const available = evidence.boundsObservation.status === "available";
  const horizontal = available
    ? [createCompatibilityAxisBounds(evidence, "horizontal")]
    : [];
  const vertical = available
    ? [createCompatibilityAxisBounds(evidence, "vertical")]
    : [];
  return {
    compatibilitySingleBounds: true,
    axes: { horizontal, vertical },
    metadata: {
      representation: "factored-axis-bounds",
      source: "grid-lattice-evidence-bounds-observation",
      status: available ? "available" : "unavailable",
      combinationOrder: "horizontal-major-vertical-minor",
      horizontalAxisBoundsIds: horizontal.map(value => value.id),
      verticalAxisBoundsIds: vertical.map(value => value.id),
      axisBounds: cloneDeterministicValue({ horizontal, vertical }),
      exactBoundsCombinationCount: available ? 1 : 0,
      eagerlyMaterializedRectangularBoundsCount: 0,
      provenance: cloneDeterministicValue(
        evidence.boundsObservation.provenance
      ),
      reasons: available ? [] : ["outer-bounds-unavailable"]
    }
  };
}

function createCompatibilityAxisBounds(evidence, axis) {
  const { start, end } = readAxisBounds(
    evidence.boundsObservation.bounds,
    axis
  );
  return {
    id: `${axis}-bounds-001`,
    axis,
    start,
    end,
    evidenceReferences:
      evidence.boundsObservation.evidenceReferences.slice(),
    provenance: cloneDeterministicValue(
      evidence.boundsObservation.provenance
    )
  };
}

function cloneAxisBounds(value) {
  return cloneDeterministicValue(value);
}

function createAxisCandidateId({
  axis,
  boundsOrder,
  periodOrder,
  intervalCount,
  compatibilitySingleBounds
}) {
  const parts = [axis];
  if (!compatibilitySingleBounds) {
    parts.push(`bounds-${String(boundsOrder + 1).padStart(3, "0")}`);
  }
  parts.push(
    `period-${String(periodOrder + 1).padStart(3, "0")}`,
    `intervals-${intervalCount}`
  );
  return parts.join("-");
}

function enumerateAdjacentIntervalCounts(span, period) {
  const ratio = span / period;
  const lower = Math.floor(ratio);
  const upper = Math.ceil(ratio);
  return [...new Set([lower, upper])].filter(value => value > 0);
}

function readAxisBounds(bounds, axis) {
  if (axis === "horizontal") {
    return { start: bounds.top, end: bounds.top + bounds.height };
  }
  return { start: bounds.left, end: bounds.left + bounds.width };
}

function findUnavailableReason(evidence, primitivePeriodEvidence, boundsSpace) {
  if (evidence.status === "unavailable") {
    return "grid-lattice-evidence-unavailable";
  }
  if (
    boundsSpace.axes.horizontal.length === 0
    || boundsSpace.axes.vertical.length === 0
  ) {
    return "outer-bounds-unavailable";
  }
  if (primitivePeriodEvidence.status === "unavailable") {
    return "primitive-period-evidence-unavailable";
  }
  return null;
}

function createAxisAvailabilityReasons(axisCandidates) {
  const reasons = [];
  if (axisCandidates.horizontal.length === 0) {
    reasons.push("horizontal-axis-candidates-unavailable");
  }
  if (axisCandidates.vertical.length === 0) {
    reasons.push("vertical-axis-candidates-unavailable");
  }
  return reasons;
}

function validateEvidence(evidence) {
  validateDeterministicObject(evidence, "evidence");
  if (evidence.type !== "grid-lattice-evidence" || evidence.version !== 1) {
    throw new Error("evidence must be a GridLatticeEvidence version 1 artifact");
  }
  validateNonEmptyString(evidence.id, "evidence.id");
  validateStatus(evidence.status, EVIDENCE_STATUSES, "evidence.status");
  validateCoordinateSystem(evidence.coordinateSystem);
  for (const axis of ["horizontal", "vertical"]) {
    validateDeterministicObject(evidence.axes[axis], `evidence.axes.${axis}`);
    if (evidence.axes[axis].axis !== axis) {
      throw new Error(`evidence.axes.${axis}.axis must equal ${axis}`);
    }
  }
  validateDeterministicObject(evidence.boundsObservation, "evidence.boundsObservation");
  validateDeterministicObject(evidence.provenance, "evidence.provenance");
}

function validatePrimitivePeriodEvidence(value) {
  validateDeterministicObject(value, "primitivePeriodEvidence");
  validateNonEmptyString(value.id, "primitivePeriodEvidence.id");
  validateStatus(value.status, EVIDENCE_STATUSES, "primitivePeriodEvidence.status");
  validateDeterministicObject(value.provenance, "primitivePeriodEvidence.provenance");
  validateEvidenceReferences(
    value.evidenceReferences,
    "primitivePeriodEvidence.evidenceReferences"
  );
  validateDeterministicObject(value.axes, "primitivePeriodEvidence.axes");
  for (const axis of ["horizontal", "vertical"]) {
    validatePrimitivePeriodAxis(value.axes[axis], axis);
  }
}

function validatePrimitivePeriodAxis(value, axis) {
  const path = `primitivePeriodEvidence.axes.${axis}`;
  validateDeterministicObject(value, path);
  if (value.axis !== axis) {
    throw new Error(`${path}.axis must equal ${axis}`);
  }
  validateStatus(value.status, PERIOD_AXIS_STATUSES, `${path}.status`);
  validateDeterministicArray(value.candidates, `${path}.candidates`);
  validateDeterministicArray(value.reasons, `${path}.reasons`);
  const ids = new Set();
  value.candidates.forEach((candidate, index) => {
    const candidatePath = `${path}.candidates[${index}]`;
    validateDeterministicObject(candidate, candidatePath);
    validateNonEmptyString(candidate.id, `${candidatePath}.id`);
    if (ids.has(candidate.id)) {
      throw new Error(`${path}.candidates must have unique ids`);
    }
    ids.add(candidate.id);
    validatePositiveNumber(candidate.period, `${candidatePath}.period`);
    validateDeterministicObject(candidate.provenance, `${candidatePath}.provenance`);
    validateEvidenceReferences(
      candidate.evidenceReferences,
      `${candidatePath}.evidenceReferences`
    );
  });
  if (value.status === "available" && value.candidates.length !== 1) {
    throw new Error(`${path} available status requires exactly one candidate`);
  }
  if (value.status === "ambiguous" && value.candidates.length < 2) {
    throw new Error(`${path} ambiguous status requires multiple candidates`);
  }
  if (value.status === "unavailable" && value.candidates.length !== 0) {
    throw new Error(`${path} unavailable status requires no candidates`);
  }
}

function validateFactoredBounds(value, coordinateSystem) {
  if (value === null) {
    return;
  }
  validateDeterministicObject(value, "factoredBounds");
  if (!new Set(["available", "ambiguous", "unavailable"]).has(value.status)) {
    throw new Error("factoredBounds.status is invalid");
  }
  validateCoordinateSystem(value.coordinateSystem);
  if (value.coordinateSystem.space !== coordinateSystem.space) {
    throw new Error("factoredBounds coordinate space must match evidence");
  }
  validateDeterministicObject(value.axisBounds, "factoredBounds.axisBounds");
  validateDeterministicObject(
    value.rectangularCombinationSpace,
    "factoredBounds.rectangularCombinationSpace"
  );
  validateDeterministicObject(value.provenance, "factoredBounds.provenance");
  validateDeterministicArray(value.reasons, "factoredBounds.reasons");

  for (const axis of ["horizontal", "vertical"]) {
    const values = value.axisBounds[axis];
    if (!Array.isArray(values)) {
      throw new Error(`factoredBounds.axisBounds.${axis} must be an array`);
    }
    const ids = new Set();
    values.forEach((axisBounds, index) => {
      const path = `factoredBounds.axisBounds.${axis}[${index}]`;
      validateDeterministicObject(axisBounds, path);
      validateNonEmptyString(axisBounds.id, `${path}.id`);
      if (ids.has(axisBounds.id)) {
        throw new Error(`factoredBounds ${axis} ids must be unique`);
      }
      ids.add(axisBounds.id);
      if (axisBounds.axis !== axis) {
        throw new Error(`${path}.axis must equal ${axis}`);
      }
      if (
        !Number.isFinite(axisBounds.start)
        || !Number.isFinite(axisBounds.end)
        || axisBounds.end <= axisBounds.start
      ) {
        throw new Error(`${path} must have finite increasing bounds`);
      }
      validateEvidenceReferences(
        axisBounds.evidenceReferences,
        `${path}.evidenceReferences`
      );
      validateDeterministicObject(axisBounds.provenance, `${path}.provenance`);
      if (
        axisBounds.coordinateSystem
        && axisBounds.coordinateSystem.space !== coordinateSystem.space
      ) {
        throw new Error(`${path} coordinate space must match evidence`);
      }
    });
  }

  const space = value.rectangularCombinationSpace;
  const horizontalIds = value.axisBounds.horizontal.map(bounds => bounds.id);
  const verticalIds = value.axisBounds.vertical.map(bounds => bounds.id);
  if (
    space.representation !== "cartesian-product-by-reference"
    || space.combinationOrder !== "horizontal-major-vertical-minor"
    || !sameValues(space.horizontalAxisBoundsIds, horizontalIds)
    || !sameValues(space.verticalAxisBoundsIds, verticalIds)
    || space.exactCombinationCount
      !== horizontalIds.length * verticalIds.length
    || space.materializedCombinationCount !== 0
  ) {
    throw new Error("factoredBounds rectangular combination space is invalid");
  }
  if (
    (value.status === "available" && space.exactCombinationCount !== 1)
    || (value.status === "ambiguous" && space.exactCombinationCount < 2)
    || (value.status === "unavailable" && space.exactCombinationCount !== 0)
  ) {
    throw new Error("factoredBounds status does not match its combination count");
  }
}

function sameValues(left, right) {
  return Array.isArray(left)
    && left.length === right.length
    && left.every((value, index) => value === right[index]);
}

function mergeReferences(...groups) {
  const references = [];
  const seen = new Set();
  groups.flat().forEach(reference => {
    if (!seen.has(reference)) {
      references.push(reference);
      seen.add(reference);
    }
  });
  return references;
}
