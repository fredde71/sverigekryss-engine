import { createVerticalProjection } from "../analysis/Projection";
import { findLineCandidates } from "../analysis/LineCandidate";
import { createProjectionProfileSummary } from "../detection/projectionDiagnostics";
import { createVerticalContinuityEvidence } from "./verticalContinuityDiagnostics";
import { createVerticalProjectionVisualization } from "./visualization/verticalProjectionVisualization";

export const VERTICAL_CANDIDATE_COVERAGE_RATIOS = Object.freeze([
  0.7,
  0.75,
  0.8,
  0.85,
  0.9
]);

export const verticalCandidateCoverageThresholdDiagnosticsExperiment = Object.freeze({
  id: "vertical-candidate-coverage-threshold-diagnostics",
  description: "Observe vertical candidate counts and positions across fixed coverage ratios.",
  run(binaryImage, _context) {
    return createVerticalCandidateCoverageThresholdDiagnostics(binaryImage);
  }
});

export function createVerticalCandidateCoverageThresholdDiagnostics(binaryImage) {
  const stableBinaryImage = {
    width: binaryImage.width,
    height: binaryImage.height,
    data: binaryImage.data
  };
  const rawProjection = createVerticalProjection(stableBinaryImage);
  const continuityEvidence = createVerticalContinuityEvidence(stableBinaryImage);
  const continuityProjection = createVerticalProjection(continuityEvidence.mask);

  return {
    type: "vertical-candidate-coverage-threshold-observation",
    status: "measured",
    axis: "vertical",
    parameters: {
      candidateCoverageRatios: VERTICAL_CANDIDATE_COVERAGE_RATIOS.slice(),
      continuity: {
        ...continuityEvidence.parameters
      }
    },
    evidence: {
      raw: {
        profile: createProjectionProfileSummary({
          projection: rawProjection,
          axisLength: stableBinaryImage.height
        })
      },
      continuity: {
        profile: createProjectionProfileSummary({
          projection: continuityProjection,
          axisLength: stableBinaryImage.height
        })
      }
    },
    observations: VERTICAL_CANDIDATE_COVERAGE_RATIOS.map(
      candidateCoverageRatio => createThresholdObservation({
        candidateCoverageRatio,
        axisLength: stableBinaryImage.height,
        rawProjection,
        continuityProjection
      })
    ),
    visualizations: [
      createVerticalProjectionVisualization({
        id: "vertical-candidate-threshold-projections",
        title: "Vertical Candidate Threshold Evidence",
        axisLength: stableBinaryImage.height,
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

function createThresholdObservation({
  candidateCoverageRatio,
  axisLength,
  rawProjection,
  continuityProjection
}) {
  const candidateOptions = {
    axis: "vertical",
    axisLength,
    minCoverageRatio: candidateCoverageRatio
  };
  const rawCandidates = findLineCandidates(rawProjection, candidateOptions);
  const continuityCandidates = findLineCandidates(
    continuityProjection,
    candidateOptions
  );

  return {
    candidateCoverageRatio,
    minimumStrength: Math.ceil(axisLength * candidateCoverageRatio),
    raw: {
      candidateCount: rawCandidates.length,
      candidatePositions: rawCandidates.map(candidate => candidate.position)
    },
    continuity: {
      candidateCount: continuityCandidates.length,
      candidatePositions: continuityCandidates.map(candidate => candidate.position)
    }
  };
}
