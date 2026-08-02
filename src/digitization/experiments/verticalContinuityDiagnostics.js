import { createVerticalProjection } from "../analysis/Projection";
import { createProjectionProfileSummary } from "../detection/projectionDiagnostics";

const DEFAULT_HORIZONTAL_RADIUS = 1;
const DEFAULT_MIN_CONTINUITY_RATIO = 0.8;
const DEFAULT_WINDOW_HEIGHT_RATIO = 0.05;
const DEFAULT_MIN_WINDOW_HEIGHT = 9;

export const verticalContinuityDiagnosticsExperiment = Object.freeze({
  id: "vertical-continuity-diagnostics",
  description: "Compare raw vertical evidence with local vertical-continuity scores and mask projections.",
  run(binaryImage, context = {}) {
    return createVerticalContinuityProjectionComparison({
      binaryImage,
      rawVerticalProjection: resolveRawVerticalProjection(binaryImage, context),
      options: context.options ?? {}
    });
  }
});

export function createVerticalContinuityEvidence(binaryImage, options = {}) {
  validateBinaryImage(binaryImage);

  const {
    width,
    height,
    data
  } = binaryImage;
  const parameters = resolveParameters(height, options);
  const horizontalSupport = createHorizontalSupport({
    width,
    height,
    data,
    horizontalRadius: parameters.horizontalRadius
  });
  const scores = new Float32Array(width * height);
  const maskData = new Uint8Array(width * height);
  const scoreProjection = new Float64Array(width);
  let sourcePixelCount = 0;
  let evidencePixelCount = 0;

  for (let index = 0; index < data.length; index++) {
    sourcePixelCount += data[index];
  }

  for (let x = 0; x < width; x++) {
    let windowStart = 0;
    let supportedRowCount = 0;

    for (let row = 0; row < parameters.windowHeight; row++) {
      supportedRowCount += horizontalSupport[(row * width) + x];
    }

    for (let y = 0; y < height; y++) {
      const nextWindowStart = calculateWindowStart({
        y,
        height,
        windowHeight: parameters.windowHeight
      });

      while (windowStart < nextWindowStart) {
        supportedRowCount -= horizontalSupport[(windowStart * width) + x];
        supportedRowCount += horizontalSupport[
          ((windowStart + parameters.windowHeight) * width) + x
        ];
        windowStart += 1;
      }

      const score = supportedRowCount / parameters.windowHeight;
      const index = (y * width) + x;

      scores[index] = score;
      scoreProjection[x] += score;

      if (score >= parameters.minContinuityRatio) {
        maskData[index] = 1;
        evidencePixelCount += 1;
      }
    }
  }

  return {
    width,
    height,
    scores,
    mask: {
      width,
      height,
      data: maskData
    },
    scoreProjection,
    parameters,
    statistics: {
      sourcePixelCount,
      evidencePixelCount,
      evidencePixelRatio: calculateRatio(evidencePixelCount, width * height)
    }
  };
}

export function createVerticalContinuityProjectionComparison({
  binaryImage,
  rawVerticalProjection,
  options = {}
}) {
  const evidence = createVerticalContinuityEvidence(binaryImage, options);
  const maskProjection = createVerticalProjection(evidence.mask);

  return {
    type: "vertical-continuity-projection-comparison",
    axis: "vertical",
    preprocessing: {
      method: "local-vertical-continuity",
      ...evidence.parameters,
      ...evidence.statistics
    },
    raw: createProjectionProfileSummary({
      projection: rawVerticalProjection,
      axisLength: binaryImage.height
    }),
    scores: createProjectionProfileSummary({
      projection: evidence.scoreProjection,
      axisLength: binaryImage.height
    }),
    mask: createProjectionProfileSummary({
      projection: maskProjection,
      axisLength: binaryImage.height
    })
  };
}

function createHorizontalSupport({
  width,
  height,
  data,
  horizontalRadius
}) {
  const support = new Uint8Array(width * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * width;
    let darkPixelCount = 0;

    for (let x = 0; x <= Math.min(horizontalRadius, width - 1); x++) {
      darkPixelCount += data[rowOffset + x];
    }

    for (let x = 0; x < width; x++) {
      support[rowOffset + x] = darkPixelCount > 0 ? 1 : 0;

      const leavingX = x - horizontalRadius;
      const enteringX = x + horizontalRadius + 1;

      if (leavingX >= 0) {
        darkPixelCount -= data[rowOffset + leavingX];
      }

      if (enteringX < width) {
        darkPixelCount += data[rowOffset + enteringX];
      }
    }
  }

  return support;
}

function calculateWindowStart({
  y,
  height,
  windowHeight
}) {
  const halfWindow = Math.floor(windowHeight / 2);

  return Math.max(
    0,
    Math.min(y - halfWindow, height - windowHeight)
  );
}

function resolveParameters(height, options) {
  const horizontalRadius = options.horizontalRadius ?? DEFAULT_HORIZONTAL_RADIUS;
  const minContinuityRatio = options.minContinuityRatio
    ?? DEFAULT_MIN_CONTINUITY_RATIO;
  const windowHeightRatio = options.windowHeightRatio ?? DEFAULT_WINDOW_HEIGHT_RATIO;
  const minWindowHeight = options.minWindowHeight ?? DEFAULT_MIN_WINDOW_HEIGHT;

  validateNonNegativeInteger(horizontalRadius, "horizontalRadius");
  validateRatio(minContinuityRatio, "minContinuityRatio");
  validatePositiveRatio(windowHeightRatio, "windowHeightRatio");
  validatePositiveInteger(minWindowHeight, "minWindowHeight");

  let windowHeight;

  if (options.windowHeight !== undefined) {
    validatePositiveInteger(options.windowHeight, "windowHeight");
    windowHeight = options.windowHeight;
  } else {
    windowHeight = Math.max(
      minWindowHeight,
      Math.ceil(height * windowHeightRatio)
    );

    if (windowHeight % 2 === 0) {
      windowHeight += 1;
    }
  }

  return {
    windowHeight: Math.min(windowHeight, height),
    horizontalRadius,
    minContinuityRatio
  };
}

function validateBinaryImage(binaryImage) {
  const width = binaryImage?.width;
  const height = binaryImage?.height;
  const data = binaryImage?.data;

  if (!Number.isInteger(width) || width <= 0) {
    throw new Error("BinaryImage width must be a positive integer");
  }

  if (!Number.isInteger(height) || height <= 0) {
    throw new Error("BinaryImage height must be a positive integer");
  }

  if (!data || data.length !== width * height) {
    throw new Error("BinaryImage data length must equal width * height");
  }

  for (let index = 0; index < data.length; index++) {
    if (data[index] !== 0 && data[index] !== 1) {
      throw new Error("BinaryImage data must contain only binary values 0 or 1");
    }
  }
}

function validateNonNegativeInteger(value, name) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
}

function validatePositiveInteger(value, name) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
}

function validateRatio(value, name) {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${name} must be a number between 0 and 1`);
  }
}

function validatePositiveRatio(value, name) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive number`);
  }
}

function calculateRatio(value, total) {
  return total > 0 ? value / total : 0;
}

function resolveRawVerticalProjection(binaryImage, context) {
  return context.rawVerticalProjection
    ?? context.projections?.vertical
    ?? createVerticalProjection(binaryImage);
}
