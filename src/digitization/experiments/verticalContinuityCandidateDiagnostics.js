import { createVerticalProjection } from "../analysis/Projection";
import { findLineCandidates } from "../analysis/LineCandidate";
import { createProjectionProfileSummary } from "../detection/projectionDiagnostics";
import { createVerticalContinuityEvidence } from "./verticalContinuityDiagnostics";
import { createVerticalProjectionVisualization } from "./visualization/verticalProjectionVisualization";

const CANDIDATE_COVERAGE_RATIO = 0.8;

export const verticalContinuityCandidateDiagnosticsExperiment = Object.freeze({
  id: "vertical-continuity-candidate-diagnostics",
  description: "Compare vertical line candidates from raw and local-continuity projections at the existing coverage threshold.",
  run(binaryImage, _context) {
    return createVerticalContinuityCandidateDiagnostics(binaryImage);
  }
});

export function createVerticalContinuityCandidateDiagnostics(binaryImage) {
  const rawProjection = createVerticalProjection(binaryImage);
  const continuityEvidence = createVerticalContinuityEvidence(binaryImage);
  const continuityProjection = createVerticalProjection(continuityEvidence.mask);
  const candidateOptions = {
    axis: "vertical",
    axisLength: binaryImage.height,
    minCoverageRatio: CANDIDATE_COVERAGE_RATIO
  };
  const rawCandidates = findLineCandidates(rawProjection, candidateOptions);
  const continuityCandidates = findLineCandidates(
    continuityProjection,
    candidateOptions
  );
  const candidateCountDelta = continuityCandidates.length - rawCandidates.length;

  return {
    type: "vertical-continuity-candidate-comparison",
    status: "measured",
    axis: "vertical",
    hypothesisKey: "interrupted-vertical-rules-under-counted",
    parameters: {
      candidateCoverageRatio: CANDIDATE_COVERAGE_RATIO,
      ...continuityEvidence.parameters
    },
    raw: {
      profile: createProjectionProfileSummary({
        projection: rawProjection,
        axisLength: binaryImage.height
      }),
      candidateCount: rawCandidates.length,
      candidates: rawCandidates
    },
    continuity: {
      profile: createProjectionProfileSummary({
        projection: continuityProjection,
        axisLength: binaryImage.height
      }),
      candidateCount: continuityCandidates.length,
      candidates: continuityCandidates
    },
    comparison: {
      candidateCountDelta,
      relation: describeCandidateCountRelation(candidateCountDelta)
    },
    visualizations: [
      createVerticalProjectionVisualization({
        id: "vertical-candidate-projections",
        title: "Vertical Candidate Projections",
        axisLength: binaryImage.height,
        series: [
          {
            id: "raw",
            title: "Raw",
            values: rawProjection
          },
          {
            id: "continuity-mask",
            title: "Continuity mask",
            values: continuityProjection
          }
        ]
      })
    ]
  };
}

function describeCandidateCountRelation(candidateCountDelta) {
  if (candidateCountDelta > 0) {
    return "additional-candidates-observed";
  }

  if (candidateCountDelta < 0) {
    return "fewer-candidates-observed";
  }

  return "equal-candidate-count";
}
