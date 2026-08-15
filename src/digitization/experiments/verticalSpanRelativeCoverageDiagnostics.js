import {
  createHorizontalProjection,
  createVerticalProjection
} from "../analysis/Projection";
import { findLineCandidates } from "../analysis/LineCandidate";
import { createProjectionProfileSummary } from "../detection/projectionDiagnostics";

const CANDIDATE_COVERAGE_RATIO = 0.8;
const SPAN_METHOD = "outermost-horizontal-candidate-runs";

export const verticalSpanRelativeCoverageDiagnosticsExperiment = Object.freeze({
  id: "vertical-span-relative-coverage-diagnostics",
  description: "Compare full-page and horizontally observed span-relative vertical candidate coverage.",
  run(binaryImage, _context) {
    return createVerticalSpanRelativeCoverageDiagnostics(binaryImage);
  }
});

export function createVerticalSpanRelativeCoverageDiagnostics(binaryImage) {
  const stableBinaryImage = {
    width: binaryImage.width,
    height: binaryImage.height,
    data: binaryImage.data
  };
  const horizontalProjection = createHorizontalProjection(stableBinaryImage);
  const fullPageVerticalProjection = createVerticalProjection(stableBinaryImage);
  const horizontalCandidates = findLineCandidates(horizontalProjection, {
    axis: "horizontal",
    axisLength: stableBinaryImage.width,
    minCoverageRatio: CANDIDATE_COVERAGE_RATIO
  });
  const spanObservation = createSpanObservation(horizontalCandidates);
  const fullPage = createVerticalCoverageObservation({
    projection: fullPageVerticalProjection,
    denominator: {
      top: 0,
      bottom: stableBinaryImage.height - 1,
      length: stableBinaryImage.height
    }
  });

  if (spanObservation.status === "unavailable") {
    return {
      type: "vertical-span-relative-coverage-observation",
      status: "partial",
      axis: "vertical",
      parameters: {
        candidateCoverageRatio: CANDIDATE_COVERAGE_RATIO,
        spanMethod: SPAN_METHOD
      },
      spanObservation,
      fullPage,
      spanRelative: createUnavailableSpanRelativeObservation()
    };
  }

  const spanBinaryImage = createRowRestrictedBinaryImage(
    stableBinaryImage,
    spanObservation
  );
  const spanVerticalProjection = createVerticalProjection(spanBinaryImage);

  return {
    type: "vertical-span-relative-coverage-observation",
    status: "measured",
    axis: "vertical",
    parameters: {
      candidateCoverageRatio: CANDIDATE_COVERAGE_RATIO,
      spanMethod: SPAN_METHOD
    },
    spanObservation,
    fullPage,
    spanRelative: createVerticalCoverageObservation({
      projection: spanVerticalProjection,
      denominator: {
        top: spanObservation.top,
        bottom: spanObservation.bottom,
        length: spanObservation.length
      }
    })
  };
}

function createSpanObservation(horizontalCandidates) {
  const boundaryEvidence = {
    candidateCount: horizontalCandidates.length,
    candidatePositions: horizontalCandidates.map(candidate => candidate.position)
  };

  if (horizontalCandidates.length < 2) {
    return {
      status: "unavailable",
      method: SPAN_METHOD,
      reason: "fewer-than-two-horizontal-candidates",
      boundaryEvidence,
      top: null,
      bottom: null,
      length: null
    };
  }

  const firstCandidate = horizontalCandidates[0];
  const lastCandidate = horizontalCandidates[horizontalCandidates.length - 1];
  const top = firstCandidate.start;
  const bottom = lastCandidate.end;

  return {
    status: "measured",
    method: SPAN_METHOD,
    boundaryEvidence,
    top,
    bottom,
    length: bottom - top + 1
  };
}

function createRowRestrictedBinaryImage(binaryImage, spanObservation) {
  const start = spanObservation.top * binaryImage.width;
  const end = (spanObservation.bottom + 1) * binaryImage.width;

  return {
    width: binaryImage.width,
    height: spanObservation.length,
    data: binaryImage.data.subarray(start, end)
  };
}

function createVerticalCoverageObservation({
  projection,
  denominator
}) {
  const candidates = findLineCandidates(projection, {
    axis: "vertical",
    axisLength: denominator.length,
    minCoverageRatio: CANDIDATE_COVERAGE_RATIO
  });

  return {
    status: "measured",
    denominator,
    minimumStrength: Math.ceil(
      denominator.length * CANDIDATE_COVERAGE_RATIO
    ),
    profile: createProjectionProfileSummary({
      projection,
      axisLength: denominator.length
    }),
    strongestEvidence: createStrongestEvidence(projection, denominator.length),
    candidateCount: candidates.length,
    candidatePositions: candidates.map(candidate => candidate.position)
  };
}

function createStrongestEvidence(projection, denominatorLength) {
  let position = 0;
  let strength = projection[0];

  for (let index = 1; index < projection.length; index++) {
    if (projection[index] > strength) {
      position = index;
      strength = projection[index];
    }
  }

  return {
    position,
    strength,
    coverageRatio: strength / denominatorLength
  };
}

function createUnavailableSpanRelativeObservation() {
  return {
    status: "unavailable",
    reason: "observed-span-unavailable",
    denominator: null,
    minimumStrength: null,
    profile: null,
    strongestEvidence: null,
    candidateCount: null,
    candidatePositions: null
  };
}
