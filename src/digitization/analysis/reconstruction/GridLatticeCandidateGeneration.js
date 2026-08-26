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
  primitivePeriodEvidence
} = {}) {
  validateEvidence(evidence);
  validatePrimitivePeriodEvidence(primitivePeriodEvidence);
  rejectEvaluationFields(evidence, "evidence");
  rejectEvaluationFields(
    primitivePeriodEvidence,
    "primitivePeriodEvidence"
  );

  const unavailableReason = findUnavailableReason(
    evidence,
    primitivePeriodEvidence
  );
  const axisCandidates = unavailableReason
    ? { horizontal: [], vertical: [] }
    : {
      horizontal: createAxisCandidates({
        axis: "horizontal",
        evidence,
        primitivePeriodEvidence
      }),
      vertical: createAxisCandidates({
        axis: "vertical",
        evidence,
        primitivePeriodEvidence
      })
    };
  const candidates = combineAxisCandidates({
    evidence,
    primitivePeriodEvidence,
    axisCandidates
  });
  const reasons = unavailableReason
    ? [unavailableReason]
    : candidates.length === 0
      ? createAxisAvailabilityReasons(axisCandidates)
      : [];
  const status = candidates.length === 0
    ? "unavailable"
    : candidates.length === 1
      ? "available"
      : "ambiguous";

  return deepFreeze({
    type: "grid-lattice-candidate-generation",
    version: VERSION,
    status,
    evidenceId: evidence.id,
    primitivePeriodEvidenceId: primitivePeriodEvidence.id,
    coordinateSystem: cloneDeterministicValue(evidence.coordinateSystem),
    axisCandidates: cloneDeterministicValue(axisCandidates),
    candidates,
    provenance: cloneDeterministicValue({
      generator: "grid-lattice-candidate-generation-v1",
      gridLatticeEvidence: evidence.provenance,
      primitivePeriodEvidence: primitivePeriodEvidence.provenance
    }),
    diagnostics: [{
      code: "candidate-generation-inventory",
      horizontalAxisCandidateCount: axisCandidates.horizontal.length,
      verticalAxisCandidateCount: axisCandidates.vertical.length,
      rectangularCandidateCount: candidates.length
    }],
    reasons
  });
}

function createAxisCandidates({ axis, evidence, primitivePeriodEvidence }) {
  const axisEvidence = evidence.axes[axis];
  const periodAxis = primitivePeriodEvidence.axes[axis];
  if (
    axisEvidence.status === "unavailable"
    || axisEvidence.positions.length === 0
    || periodAxis.status === "unavailable"
  ) {
    return [];
  }

  const { start, end } = readAxisBounds(evidence.boundsObservation.bounds, axis);
  const span = end - start;

  return periodAxis.candidates.flatMap((periodEvidence, periodOrder) => {
    const intervalCounts = enumerateAdjacentIntervalCounts(
      span,
      periodEvidence.period
    );
    return intervalCounts.map(intervalCount => {
      const modeledEnd = start + intervalCount * periodEvidence.period;
      const id = [
        axis,
        `period-${String(periodOrder + 1).padStart(3, "0")}`,
        `intervals-${intervalCount}`
      ].join("-");

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
        assignments: axisEvidence.positions.map((observedPosition, anchorOrder) => {
          const latticeIndex = Math.round(
            (observedPosition - start) / periodEvidence.period
          );
          const modeledPosition = start + latticeIndex * periodEvidence.period;
          return {
            anchorOrder,
            observedPosition,
            latticeIndex,
            modeledPosition,
            residual: observedPosition - modeledPosition,
            withinCandidateExtent:
              latticeIndex >= 0 && latticeIndex <= intervalCount
          };
        }),
        evidenceReferences: mergeReferences(
          axisEvidence.evidenceReferences,
          periodEvidence.evidenceReferences,
          evidence.boundsObservation.evidenceReferences
        ),
        provenance: {
          gridLatticeEvidenceId: evidence.id,
          primitivePeriodEvidenceId: primitivePeriodEvidence.id,
          primitivePeriodCandidateId: periodEvidence.id,
          source: cloneDeterministicValue(periodEvidence.provenance)
        },
        diagnostics: [{
          code: "interval-count-derived-from-bounds-and-period",
          span,
          spanToPeriodRatio: span / periodEvidence.period
        }]
      };
    });
  });
}

function combineAxisCandidates({
  evidence,
  primitivePeriodEvidence,
  axisCandidates
}) {
  const candidates = [];
  for (const horizontal of axisCandidates.horizontal) {
    for (const vertical of axisCandidates.vertical) {
      const candidateNumber = candidates.length + 1;
      candidates.push(createGridLatticeCandidate({
        id: `grid-lattice-candidate-${String(candidateNumber).padStart(3, "0")}`,
        status: "available",
        evidenceId: evidence.id,
        coordinateSystem: evidence.coordinateSystem,
        axes: {
          horizontal: createCandidateAxis(horizontal),
          vertical: createCandidateAxis(vertical)
        },
        gridDimensions: {
          rows: horizontal.intervalCount,
          cols: vertical.intervalCount
        },
        evidenceReferences: mergeReferences(
          evidence.evidenceReferences,
          horizontal.evidenceReferences,
          vertical.evidenceReferences
        ),
        assumptions: [
          {
            code: "outer-bounds-represent-outer-line-centers",
            boundsObservationStatus: evidence.boundsObservation.status
          },
          {
            code: "axis-periods-are-primitive-period-evidence",
            primitivePeriodEvidenceId: primitivePeriodEvidence.id
          },
          {
            code: "orthogonal-rectangular-lattice"
          }
        ],
        provenance: {
          generator: "grid-lattice-candidate-generation-v1",
          gridLatticeEvidence: cloneDeterministicValue(evidence.provenance),
          primitivePeriodEvidence: cloneDeterministicValue(
            primitivePeriodEvidence.provenance
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

function findUnavailableReason(evidence, primitivePeriodEvidence) {
  if (evidence.status === "unavailable") {
    return "grid-lattice-evidence-unavailable";
  }
  if (evidence.boundsObservation.status !== "available") {
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
