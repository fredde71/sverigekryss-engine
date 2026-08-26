import { createGridLattice } from "./GridLattice";
import {
  cloneDeterministicValue,
  deepFreeze,
  validateDeterministicObject
} from "./GridLatticeModelSupport";

const VERSION = 1;

export function createGridLatticeReconstructionResult({
  candidateGeneration,
  evidenceFusion,
  candidateSelection
} = {}) {
  validateInputs(candidateGeneration, evidenceFusion, candidateSelection);

  const sourceCandidate = candidateSelection.status === "selected"
    ? candidateSelection.selectedCandidate
    : null;
  const lattice = sourceCandidate
    ? materializeLattice({
      candidate: sourceCandidate,
      candidateGeneration,
      evidenceFusion,
      candidateSelection
    })
    : null;
  const status = candidateSelection.status === "selected"
    ? "available"
    : candidateSelection.status;

  return Object.freeze({
    type: "grid-lattice-reconstruction-result",
    version: VERSION,
    status,
    lattice,
    sourceCandidateId: sourceCandidate?.id ?? null,
    sourceCandidate,
    competingCandidates: candidateSelection.competingCandidates,
    candidateSelectionStatus: candidateSelection.status,
    reconstructionProvenance: deepFreeze({
      materializer: "grid-lattice-reconstruction-result-v1",
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
        provenance: cloneDeterministicValue(evidenceFusion.provenance)
      },
      candidateDecision: {
        status: candidateSelection.status,
        selectedCandidateId: candidateSelection.selectedCandidateId,
        decisionPolicy: cloneDeterministicValue(candidateSelection.decisionPolicy),
        decisionProvenance: cloneDeterministicValue(
          candidateSelection.decisionProvenance
        )
      }
    }),
    reasons: Object.freeze(candidateSelection.reasons.slice())
  });
}

function materializeLattice({
  candidate,
  candidateGeneration,
  evidenceFusion,
  candidateSelection
}) {
  const confidence = evidenceFusion.confidences.find(value => (
    value.candidateId === candidate.id
  ));
  const horizontal = materializeAxis(candidate.axes.horizontal);
  const vertical = materializeAxis(candidate.axes.vertical);

  return createGridLattice({
    id: `grid-lattice-${candidate.id}`,
    status: "available",
    sourceCandidateId: candidate.id,
    coordinateSystem: candidate.coordinateSystem,
    axes: { horizontal, vertical },
    gridDimensions: candidate.gridDimensions,
    extent: {
      status: "available",
      semantics: "modeled-outer-line-center-envelope",
      coordinateSpace: candidate.coordinateSystem.space,
      bounds: {
        top: horizontal.origin,
        left: vertical.origin,
        width: vertical.positions[vertical.positions.length - 1] - vertical.origin,
        height:
          horizontal.positions[horizontal.positions.length - 1]
          - horizontal.origin
      }
    },
    assumptions: candidate.assumptions,
    provenance: {
      materializer: "grid-lattice-reconstruction-result-v1",
      sourceCandidate: cloneDeterministicValue(candidate.provenance),
      candidateGeneration: cloneDeterministicValue(
        candidateGeneration.provenance
      ),
      evidenceFusion: cloneDeterministicValue(evidenceFusion.provenance),
      candidateDecisionPolicy: cloneDeterministicValue(
        candidateSelection.decisionPolicy
      ),
      confidenceArtifactId: confidence.id
    },
    diagnostics: [{
      code: "selected-candidate-materialized-as-grid-lattice",
      horizontalLineCount: horizontal.lineCount,
      verticalLineCount: vertical.lineCount,
      rowCount: candidate.gridDimensions.rows,
      columnCount: candidate.gridDimensions.cols
    }],
    reasons: []
  });
}

function materializeAxis(candidateAxis) {
  return {
    status: "available",
    axis: candidateAxis.axis,
    origin: candidateAxis.origin,
    period: candidateAxis.period,
    intervalCount: candidateAxis.intervalCount,
    lineCount: candidateAxis.lineCount,
    positions: Array.from(
      { length: candidateAxis.lineCount },
      (_value, index) => candidateAxis.origin + index * candidateAxis.period
    ),
    diagnostics: [{
      code: "positions-materialized-from-candidate-origin-and-period",
      sourceBoundsStart: candidateAxis.boundsStart,
      sourceBoundsEnd: candidateAxis.boundsEnd,
      sourceModeledEnd: candidateAxis.modeledEnd,
      sourceBoundsResidual: candidateAxis.boundsResidual
    }]
  };
}

function validateInputs(candidateGeneration, evidenceFusion, candidateSelection) {
  validateDeterministicObject(candidateGeneration, "candidateGeneration");
  validateDeterministicObject(evidenceFusion, "evidenceFusion");
  validateDeterministicObject(candidateSelection, "candidateSelection");
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
    candidateSelection.type !== "grid-lattice-candidate-selection"
    || candidateSelection.version !== 1
  ) {
    throw new Error("candidateSelection must be version 1 candidate selection");
  }
  if (
    candidateGeneration.evidenceId !== evidenceFusion.evidenceId
    || candidateGeneration.primitivePeriodEvidenceId
      !== evidenceFusion.primitivePeriodEvidenceId
  ) {
    throw new Error("candidate generation and evidence fusion sources must match");
  }
  const candidateIds = candidateGeneration.candidates.map(value => value.id);
  if (
    evidenceFusion.candidateIds.length !== candidateIds.length
    || evidenceFusion.candidateIds.some((id, index) => id !== candidateIds[index])
  ) {
    throw new Error("evidence fusion candidate order must match generation");
  }
  const confidenceCandidateIds = evidenceFusion.confidences.map(value => (
    value.candidateId
  ));
  if (
    confidenceCandidateIds.length !== candidateIds.length
    || confidenceCandidateIds.some((id, index) => id !== candidateIds[index])
  ) {
    throw new Error("evidence fusion confidences must match candidates in order");
  }
  if (candidateSelection.status === "selected") {
    const selected = candidateGeneration.candidates.find(value => (
      value.id === candidateSelection.selectedCandidateId
    ));
    if (!selected || candidateSelection.selectedCandidate !== selected) {
      throw new Error("selected candidate must be the exact generated candidate");
    }
    if (!selected.gridDimensions) {
      throw new Error("selected candidate gridDimensions are required");
    }
    const confidence = evidenceFusion.confidences.find(value => (
      value.candidateId === selected.id
    ));
    if (!confidence || confidence.status !== "available") {
      throw new Error("selected candidate requires available fused confidence");
    }
  } else if (
    candidateSelection.status === "ambiguous"
    || candidateSelection.status === "unavailable"
  ) {
    if (
      candidateSelection.selectedCandidateId !== null
      || candidateSelection.selectedCandidate !== null
    ) {
      throw new Error("non-selected decisions must not contain a selected candidate");
    }
  } else {
    throw new Error("candidateSelection status is invalid");
  }
  const expectedCompetingIds = candidateIds.filter(id => (
    id !== candidateSelection.selectedCandidateId
  ));
  if (
    candidateSelection.competingCandidates.length !== expectedCompetingIds.length
    || candidateSelection.competingCandidates.some((candidate, index) => (
      candidate !== candidateGeneration.candidates.find(value => (
        value.id === expectedCompetingIds[index]
      ))
    ))
  ) {
    throw new Error("candidateSelection must preserve all competing candidates");
  }
}
