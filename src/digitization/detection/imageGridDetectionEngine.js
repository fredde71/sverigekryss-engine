import {
  createAnalysisContext,
  withBinaryImage,
  withGridGeometry,
  withImageData,
  withLineCandidates,
  withProjections
} from "../analysis/AnalysisContext";
import { thresholdRgbaImage } from "../analysis/BinaryImage";
import {
  createHorizontalProjection,
  createVerticalProjection
} from "../analysis/Projection";
import { findLineCandidates } from "../analysis/LineCandidate";
import { buildGridGeometry } from "../analysis/GridGeometry";
import { createGridDetection } from "./GridDetection";
import {
  createSuggestionFromAnalysisContext,
  detectGridFromAnalysisContext
} from "./gridDetectionEngine";

export async function detectGridFromImageSource({
  source,
  options = {},
  readImageData
}) {
  if (typeof readImageData !== "function") {
    throw new Error("readImageData is required");
  }

  const imageData = await readImageData(source);
  const binaryImage = thresholdRgbaImage(imageData, {
    threshold: options.threshold
  });
  const projections = {
    horizontal: createHorizontalProjection(binaryImage),
    vertical: createVerticalProjection(binaryImage)
  };
  const verticalProjectionDiagnostics = createVerticalProjectionDiagnostics({
    projection: projections.vertical,
    axisLength: binaryImage.height
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
  const rawGridGeometry = buildGridGeometry({
    horizontalCandidates: lineCandidates.horizontal,
    verticalCandidates: lineCandidates.vertical
  });
  const rawBounds = rawGridGeometry?.bounds || createDetectedBoundsFromCandidates(lineCandidates);
  const spacingDiagnostics = createSpacingDiagnostics(lineCandidates);
  const gridGeometry = normalizeGridGeometryForDocument(
    rawGridGeometry,
    {
      imageWidth: imageData.width,
      imageHeight: imageData.height,
      documentSize: options.documentSize
    }
  );

  const gridDiagnostics = [
    verticalProjectionDiagnostics,
    ...candidateDiagnostics,
    ...spacingDiagnostics,
    createBoundsDiagnostic(rawBounds),
    ...createRejectionDiagnostics({
      horizontalCandidateCount: lineCandidates.horizontal.length,
      verticalCandidateCount: lineCandidates.vertical.length,
      gridGeometry
    })
  ];

  if (!gridGeometry) {
    gridDiagnostics.push(createAcceptanceStatusDiagnostic(false));
  } else {
    gridDiagnostics.push(createAcceptanceStatusDiagnostic(true));
  }

  const analysisContext = withGridGeometry(
    withLineCandidates(
      withProjections(
        withBinaryImage(
          withImageData(
            createAnalysisContext(),
            imageData
          ),
          binaryImage
        ),
        projections
      ),
      lineCandidates
    ),
    gridGeometry
  );
  const detectedContext = detectGridFromAnalysisContext(analysisContext, {
    detectGrid: context => createGridDetection({
      geometry: context.gridGeometry,
      confidence: context.gridGeometry ? "detected" : "missing-grid-geometry",
      diagnostics: gridDiagnostics
    })
  });
  const suggestions = detectedContext.gridDetection.geometry
    ? [
      createSuggestionFromAnalysisContext({
        source,
        context: detectedContext
      })
    ]
    : [];

  return {
    context: detectedContext,
    gridDetection: detectedContext.gridDetection,
    suggestions,
    diagnostics: detectedContext.gridDetection.diagnostics
  };
}

function normalizeGridGeometryForDocument(gridGeometry, {
  imageWidth,
  imageHeight,
  documentSize
}) {
  if (!gridGeometry) {
    return null;
  }

  const targetWidth = getPositiveDimension(documentSize?.width, imageWidth);
  const targetHeight = getPositiveDimension(documentSize?.height, imageHeight);
  const scaleX = targetWidth / imageWidth;
  const scaleY = targetHeight / imageHeight;

  return {
    ...gridGeometry,
    bounds: {
      top: scaleCoordinate(gridGeometry.bounds.top, scaleY),
      left: scaleCoordinate(gridGeometry.bounds.left, scaleX),
      width: scaleCoordinate(gridGeometry.bounds.width, scaleX),
      height: scaleCoordinate(gridGeometry.bounds.height, scaleY)
    },
    horizontalLines: gridGeometry.horizontalLines.map(line => scaleCoordinate(line, scaleY)),
    verticalLines: gridGeometry.verticalLines.map(line => scaleCoordinate(line, scaleX))
  };
}

function getPositiveDimension(value, fallback) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function scaleCoordinate(value, scale) {
  return Number.isFinite(value) ? value * scale : value;
}

function createVerticalProjectionDiagnostics({
  projection,
  axisLength
}) {
  const values = Array.from(projection);
  const length = values.length;
  const maxStrength = length > 0 ? Math.max(...values) : 0;
  const meanStrength = length > 0
    ? values.reduce((sum, strength) => sum + strength, 0) / length
    : 0;
  const medianStrength = calculateMedian(values);
  const topPeaks = values
    .map((strength, position) => ({
      position,
      strength
    }))
    .sort((a, b) => b.strength - a.strength || a.position - b.position)
    .slice(0, 20);
  const runs = createProjectionRuns(values, axisLength);

  return {
    type: "vertical-projection-profile",
    axis: "vertical",
    length,
    maxStrength,
    meanStrength,
    medianStrength,
    topPeaks,
    runCount: runs.length,
    topRuns: runs
      .slice()
      .sort((a, b) => b.maxStrength - a.maxStrength || a.start - b.start)
      .slice(0, 20)
  };
}

function calculateMedian(values) {
  if (values.length === 0) {
    return 0;
  }

  const sortedValues = values.slice().sort((a, b) => a - b);
  const middle = Math.floor(sortedValues.length / 2);

  if (sortedValues.length % 2 === 1) {
    return sortedValues[middle];
  }

  return (sortedValues[middle - 1] + sortedValues[middle]) / 2;
}

function createProjectionRuns(values, axisLength) {
  const runs = [];
  let start = null;
  let strengths = [];

  for (let i = 0; i <= values.length; i++) {
    const strength = values[i] || 0;
    const isProjectionRun = strength > 0;

    if (isProjectionRun && start === null) {
      start = i;
      strengths = [];
    }

    if (isProjectionRun) {
      strengths.push(strength);
    }

    if ((!isProjectionRun || i === values.length) && start !== null) {
      const end = i - 1;
      const maxStrength = Math.max(...strengths);
      const meanStrength = strengths.reduce((sum, value) => sum + value, 0) / strengths.length;

      runs.push({
        start,
        end,
        position: start + ((end - start) / 2),
        length: end - start + 1,
        maxStrength,
        meanStrength,
        maxCoverage: calculateCoverage(maxStrength, axisLength),
        meanCoverage: calculateCoverage(meanStrength, axisLength)
      });

      start = null;
      strengths = [];
    }
  }

  return runs;
}

function calculateCoverage(strength, axisLength) {
  return Number.isFinite(axisLength) && axisLength > 0
    ? strength / axisLength
    : 0;
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
  const minimumStrength = Math.max(1, Math.ceil(axisLength * (minCoverageRatio ?? 0.8)));
  let rejectedRuns = 0;
  let inRejectedRun = false;

  for (let i = 0; i <= projection.length; i++) {
    const strength = projection[i] || 0;
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

  for (let i = 1; i < candidates.length; i++) {
    spacings.push(candidates[i].position - candidates[i - 1].position);
  }

  const min = Math.min(...spacings);
  const max = Math.max(...spacings);
  const average = spacings.reduce((sum, spacing) => sum + spacing, 0) / spacings.length;
  const maxDeviation = Math.max(...spacings.map(spacing => Math.abs(spacing - average)));
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
  if (lineCandidates.horizontal.length === 0 || lineCandidates.vertical.length === 0) {
    return null;
  }

  const horizontalPositions = lineCandidates.horizontal.map(candidate => candidate.position);
  const verticalPositions = lineCandidates.vertical.map(candidate => candidate.position);
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
  if (!bounds) {
    return {
      type: "pre-rejection-bounds",
      bounds: null
    };
  }

  return {
    type: "pre-rejection-bounds",
    bounds
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
