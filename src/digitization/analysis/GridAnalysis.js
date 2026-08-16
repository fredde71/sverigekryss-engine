import {
  createHorizontalProjection,
  createVerticalProjection
} from "./Projection";
import { findLineCandidates } from "./LineCandidate";
import { buildGridGeometry } from "./GridGeometry";
import { createVerticalProjectionDiagnostics } from "../detection/projectionDiagnostics";
import { validateAnalysisRegion } from "./AnalysisRegion";

const GRID_ANALYSIS_VERSION = 1;

export async function createGridAnalysis({
  analysisRegion,
  options = {}
} = {}) {
  validateAnalysisRegion(analysisRegion);

  const binaryImage = analysisRegion.binaryImage;
  const projections = {
    horizontal: createHorizontalProjection(binaryImage),
    vertical: createVerticalProjection(binaryImage)
  };
  const verticalProjectionDiagnostics = createVerticalProjectionDiagnostics({
    projection: projections.vertical,
    axisLength: binaryImage.height
  });
  const experimentalDiagnostics = await createExperimentalDiagnostics({
    binaryImage,
    projections,
    options
  });
  const lineCandidates = {
    horizontal: findLineCandidates(projections.horizontal, {
      axis: "horizontal",
      axisLength: binaryImage.width,
      minCoverageRatio: options.minLineCoverageRatio
    }),
    vertical: findLineCandidates(projections.vertical, {
      axis: "vertical",
      axisLength: binaryImage.height,
      minCoverageRatio: options.minLineCoverageRatio
    })
  };
  const candidateDiagnostics = createCandidateDiagnostics({
    projections,
    lineCandidates,
    axisLengths: {
      horizontal: binaryImage.width,
      vertical: binaryImage.height
    },
    minLineCoverageRatio: options.minLineCoverageRatio
  });
  const gridGeometry = buildGridGeometry({
    horizontalCandidates: lineCandidates.horizontal,
    verticalCandidates: lineCandidates.vertical
  });
  const detectedBounds = gridGeometry?.bounds
    || createDetectedBoundsFromCandidates(lineCandidates);
  const diagnostics = [
    verticalProjectionDiagnostics,
    ...experimentalDiagnostics,
    ...candidateDiagnostics,
    ...createSpacingDiagnostics(lineCandidates),
    createBoundsDiagnostic(detectedBounds),
    ...createRejectionDiagnostics({
      horizontalCandidateCount: lineCandidates.horizontal.length,
      verticalCandidateCount: lineCandidates.vertical.length,
      gridGeometry
    }),
    createAcceptanceStatusDiagnostic(Boolean(gridGeometry))
  ];

  return {
    type: "grid-analysis",
    version: GRID_ANALYSIS_VERSION,
    status: "measured",
    analysisRegionId: analysisRegion.id,
    analysisDimensions: {
      width: binaryImage.width,
      height: binaryImage.height
    },
    projections,
    lineCandidates,
    gridGeometry,
    diagnostics
  };
}

async function createExperimentalDiagnostics({
  binaryImage,
  projections,
  options
}) {
  if (options.experimentalDiagnostics?.verticalLineMask !== true) {
    return [];
  }

  const {
    createVerticalLineMaskProjectionComparison
  } = await import("../experiments/verticalLineMaskDiagnostics");

  return [
    createVerticalLineMaskProjectionComparison({
      binaryImage,
      rawVerticalProjection: projections.vertical
    })
  ];
}

function createCandidateDiagnostics({
  projections,
  lineCandidates,
  axisLengths,
  minLineCoverageRatio
}) {
  const horizontalRejected = countRejectedProjectionRuns(projections.horizontal, {
    axisLength: axisLengths.horizontal,
    minCoverageRatio: minLineCoverageRatio
  });
  const verticalRejected = countRejectedProjectionRuns(projections.vertical, {
    axisLength: axisLengths.vertical,
    minCoverageRatio: minLineCoverageRatio
  });

  return [
    createCandidateCountDiagnostic({
      axis: "horizontal",
      acceptedCount: lineCandidates.horizontal.length,
      rejectedCount: horizontalRejected
    }),
    createCandidateCountDiagnostic({
      axis: "vertical",
      acceptedCount: lineCandidates.vertical.length,
      rejectedCount: verticalRejected
    })
  ];
}

function createCandidateCountDiagnostic({
  axis,
  acceptedCount,
  rejectedCount
}) {
  return {
    type: "candidate-counts",
    axis,
    acceptedCount,
    rejectedCount,
    totalCount: acceptedCount + rejectedCount
  };
}

function countRejectedProjectionRuns(projection, {
  axisLength,
  minCoverageRatio
}) {
  const minimumStrength = Math.max(
    1,
    Math.ceil(axisLength * (minCoverageRatio ?? 0.8))
  );
  let rejectedRuns = 0;
  let inRejectedRun = false;

  for (let index = 0; index <= projection.length; index++) {
    const strength = projection[index] || 0;
    const isRejectedPixel = strength > 0 && strength < minimumStrength;

    if (isRejectedPixel && !inRejectedRun) {
      rejectedRuns += 1;
      inRejectedRun = true;
    }

    if (!isRejectedPixel) {
      inRejectedRun = false;
    }
  }

  return rejectedRuns;
}

function createSpacingDiagnostics(lineCandidates) {
  return [
    createAxisSpacingDiagnostic("Horizontal", lineCandidates.horizontal),
    createAxisSpacingDiagnostic("Vertical", lineCandidates.vertical)
  ];
}

function createAxisSpacingDiagnostic(label, candidates) {
  if (candidates.length < 2) {
    return {
      type: "spacing-consistency",
      axis: label.toLowerCase(),
      status: "insufficient-candidates"
    };
  }

  const spacings = [];

  for (let index = 1; index < candidates.length; index++) {
    spacings.push(candidates[index].position - candidates[index - 1].position);
  }

  const min = Math.min(...spacings);
  const max = Math.max(...spacings);
  const average = spacings.reduce((sum, spacing) => sum + spacing, 0)
    / spacings.length;
  const maxDeviation = Math.max(...spacings.map(
    spacing => Math.abs(spacing - average)
  ));
  const consistency = average === 0
    ? 0
    : Math.max(0, 1 - (maxDeviation / Math.abs(average)));

  return {
    type: "spacing-consistency",
    axis: label.toLowerCase(),
    status: "measured",
    consistency,
    min,
    max,
    average
  };
}

function createDetectedBoundsFromCandidates(lineCandidates) {
  if (
    lineCandidates.horizontal.length === 0
    || lineCandidates.vertical.length === 0
  ) {
    return null;
  }

  const horizontalPositions = lineCandidates.horizontal.map(
    candidate => candidate.position
  );
  const verticalPositions = lineCandidates.vertical.map(
    candidate => candidate.position
  );
  const top = Math.min(...horizontalPositions);
  const bottom = Math.max(...horizontalPositions);
  const left = Math.min(...verticalPositions);
  const right = Math.max(...verticalPositions);

  return {
    top,
    left,
    width: right - left,
    height: bottom - top
  };
}

function createBoundsDiagnostic(bounds) {
  return {
    type: "pre-rejection-bounds",
    bounds: bounds || null
  };
}

function createRejectionDiagnostics({
  horizontalCandidateCount,
  verticalCandidateCount,
  gridGeometry
}) {
  if (gridGeometry) {
    return [
      {
        type: "rejection-reasons",
        reasons: []
      }
    ];
  }

  const reasons = [];

  if (horizontalCandidateCount < 2) {
    reasons.push({
      code: "insufficient-candidates",
      axis: "horizontal",
      candidateCount: horizontalCandidateCount,
      minimumCount: 2
    });
  }

  if (verticalCandidateCount < 2) {
    reasons.push({
      code: "insufficient-candidates",
      axis: "vertical",
      candidateCount: verticalCandidateCount,
      minimumCount: 2
    });
  }

  if (reasons.length === 0) {
    reasons.push({
      code: "geometry-build-failed"
    });
  }

  return reasons.map(reason => ({
    type: "rejection-reason",
    ...reason
  }));
}

function createAcceptanceStatusDiagnostic(accepted) {
  return {
    type: "acceptance-status",
    accepted
  };
}
