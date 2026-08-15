import fs from "fs";
import { createVerticalProjection } from "../analysis/Projection";
import { findLineCandidates } from "../analysis/LineCandidate";
import { createProjectionProfileSummary } from "../detection/projectionDiagnostics";
import {
  createVerticalCandidateCoverageThresholdDiagnostics,
  VERTICAL_CANDIDATE_COVERAGE_RATIOS,
  verticalCandidateCoverageThresholdDiagnosticsExperiment
} from "./verticalCandidateCoverageThresholdDiagnostics";
import { createVerticalContinuityEvidence } from "./verticalContinuityDiagnostics";

const EXPECTED_RATIOS = [0.7, 0.75, 0.8, 0.85, 0.9];

test("exposes the registered experiment contract and exact fixed ratios", () => {
  expect(verticalCandidateCoverageThresholdDiagnosticsExperiment).toEqual({
    id: "vertical-candidate-coverage-threshold-diagnostics",
    description: "Observe vertical candidate counts and positions across fixed coverage ratios.",
    run: expect.any(Function)
  });
  expect(Object.isFrozen(verticalCandidateCoverageThresholdDiagnosticsExperiment)).toBe(true);
  expect(Object.isFrozen(VERTICAL_CANDIDATE_COVERAGE_RATIOS)).toBe(true);
  expect(VERTICAL_CANDIDATE_COVERAGE_RATIOS).toEqual(EXPECTED_RATIOS);
});

test("uses only BinaryImage and ignores analysis context", () => {
  const context = new Proxy({}, {
    get() {
      throw new Error("analysis context must not be read");
    }
  });

  expect(() => verticalCandidateCoverageThresholdDiagnosticsExperiment.run(
    createBinaryImage({ width: 5, height: 20 }),
    context
  )).not.toThrow();
});

test("reads accessor-backed BinaryImage data exactly once with identical diagnostics", () => {
  const plainBinaryImage = createThresholdTransitionImage();
  const accessor = createAccessorBackedBinaryImage(plainBinaryImage);

  const expected = createVerticalCandidateCoverageThresholdDiagnostics(
    plainBinaryImage
  );
  const actual = createVerticalCandidateCoverageThresholdDiagnostics(
    accessor.binaryImage
  );

  expect(accessor.getReadCount()).toBe(1);
  expect(actual).toEqual(expected);
});

test("observes exact raw candidate transitions at every fixed ratio", () => {
  const diagnostics = createVerticalCandidateCoverageThresholdDiagnostics(
    createThresholdTransitionImage()
  );

  expect(diagnostics.observations.map(observation => ({
    ratio: observation.candidateCoverageRatio,
    minimumStrength: observation.minimumStrength,
    candidateCount: observation.raw.candidateCount,
    candidatePositions: observation.raw.candidatePositions
  }))).toEqual([
    {
      ratio: 0.7,
      minimumStrength: 14,
      candidateCount: 5,
      candidatePositions: [1, 5, 9, 13, 17]
    },
    {
      ratio: 0.75,
      minimumStrength: 15,
      candidateCount: 4,
      candidatePositions: [5, 9, 13, 17]
    },
    {
      ratio: 0.8,
      minimumStrength: 16,
      candidateCount: 3,
      candidatePositions: [9, 13, 17]
    },
    {
      ratio: 0.85,
      minimumStrength: 17,
      candidateCount: 2,
      candidatePositions: [13, 17]
    },
    {
      ratio: 0.9,
      minimumStrength: 18,
      candidateCount: 1,
      candidatePositions: [17]
    }
  ]);
});

test("uses ceil threshold semantics and preserves half-pixel candidate positions", () => {
  const height = 21;
  const diagnostics = createVerticalCandidateCoverageThresholdDiagnostics(
    createBinaryImage({
      width: 7,
      height,
      darkPixels: [
        ...createVerticalPixels(2, height),
        ...createVerticalPixels(3, height)
      ]
    })
  );

  expect(diagnostics.observations.map(observation => (
    observation.minimumStrength
  ))).toEqual(EXPECTED_RATIOS.map(ratio => Math.ceil(height * ratio)));
  expect(diagnostics.observations.every(observation => (
    observation.raw.candidatePositions[0] === 2.5
  ))).toBe(true);
});

test("reuses existing projections, summaries and line-candidate semantics", () => {
  const binaryImage = createThresholdTransitionImage();
  const rawProjection = createVerticalProjection(binaryImage);
  const continuityEvidence = createVerticalContinuityEvidence(binaryImage);
  const continuityProjection = createVerticalProjection(continuityEvidence.mask);
  const diagnostics = createVerticalCandidateCoverageThresholdDiagnostics(
    binaryImage
  );

  expect(diagnostics.evidence.raw.profile).toEqual(
    createProjectionProfileSummary({ projection: rawProjection, axisLength: 20 })
  );
  expect(diagnostics.evidence.continuity.profile).toEqual(
    createProjectionProfileSummary({
      projection: continuityProjection,
      axisLength: 20
    })
  );

  diagnostics.observations.forEach((observation, index) => {
    const options = {
      axis: "vertical",
      axisLength: 20,
      minCoverageRatio: EXPECTED_RATIOS[index]
    };

    expect(observation.raw.candidatePositions).toEqual(
      findLineCandidates(rawProjection, options).map(candidate => candidate.position)
    );
    expect(observation.continuity.candidatePositions).toEqual(
      findLineCandidates(continuityProjection, options)
        .map(candidate => candidate.position)
    );
  });
});

test("returns measured zero-candidate observations for an empty image", () => {
  const diagnostics = createVerticalCandidateCoverageThresholdDiagnostics(
    createBinaryImage({ width: 7, height: 20 })
  );

  expect(diagnostics.status).toBe("measured");
  expect(diagnostics.observations).toHaveLength(5);
  diagnostics.observations.forEach(observation => {
    expect(observation.raw).toEqual({
      candidateCount: 0,
      candidatePositions: []
    });
    expect(observation.continuity).toEqual({
      candidateCount: 0,
      candidatePositions: []
    });
  });
});

test("creates one existing vertical-projection visualization in stable series order", () => {
  const binaryImage = createThresholdTransitionImage();
  const diagnostics = createVerticalCandidateCoverageThresholdDiagnostics(
    binaryImage
  );

  expect(diagnostics.visualizations).toEqual([
    {
      id: "vertical-candidate-threshold-projections",
      title: "Vertical Candidate Threshold Evidence",
      type: "vertical-projection",
      data: {
        axis: "vertical",
        axisLength: 20,
        length: 19,
        series: [
          {
            id: "raw",
            title: "Raw",
            values: Array.from(createVerticalProjection(binaryImage))
          },
          {
            id: "continuity-mask",
            title: "Continuity mask",
            values: expect.any(Array)
          }
        ]
      }
    }
  ]);
});

test("is deterministic and leaves frozen BinaryImage input untouched", () => {
  const binaryImage = createThresholdTransitionImage();
  const sourceSnapshot = new Uint8Array(binaryImage.data);
  Object.freeze(binaryImage);

  const first = createVerticalCandidateCoverageThresholdDiagnostics(binaryImage);
  const second = createVerticalCandidateCoverageThresholdDiagnostics(binaryImage);

  expect(second).toEqual(first);
  expect(binaryImage.data).toEqual(sourceSnapshot);
});

test("contains no production, geometry, scoring, selection or recommendation fields", () => {
  const diagnostics = createVerticalCandidateCoverageThresholdDiagnostics(
    createThresholdTransitionImage()
  );
  const forbidden = new Set([
    "production",
    "gridDetection",
    "geometry",
    "gridGeometry",
    "score",
    "confidence",
    "recommendation",
    "preferredRatio",
    "selectedRatio",
    "conclusion"
  ]);

  expect(collectKeys(diagnostics).filter(key => forbidden.has(key))).toEqual([]);
});

test("does not import or call production detection", () => {
  const source = fs.readFileSync(
    require.resolve("./verticalCandidateCoverageThresholdDiagnostics"),
    "utf8"
  );

  expect(source).not.toMatch(/imageGridDetectionEngine|gridDetectionEngine/);
  expect(source).not.toMatch(/detectGrid|createGridDetection|buildGridGeometry/);
});

function createThresholdTransitionImage() {
  return createBinaryImage({
    width: 19,
    height: 20,
    darkPixels: [
      ...createVerticalPixels(1, 14),
      ...createVerticalPixels(5, 15),
      ...createVerticalPixels(9, 16),
      ...createVerticalPixels(13, 17),
      ...createVerticalPixels(17, 18)
    ]
  });
}

function createBinaryImage({ width, height, darkPixels = [] }) {
  const data = new Uint8Array(width * height);

  for (const [x, y] of darkPixels) {
    data[(y * width) + x] = 1;
  }

  return { width, height, data };
}

function createVerticalPixels(x, height) {
  return Array.from({ length: height }, (_, y) => [x, y]);
}

function createAccessorBackedBinaryImage(binaryImage) {
  const snapshot = new Uint8Array(binaryImage.data);
  let readCount = 0;

  return {
    binaryImage: {
      width: binaryImage.width,
      height: binaryImage.height,
      get data() {
        readCount += 1;
        return new Uint8Array(snapshot);
      }
    },
    getReadCount: () => readCount
  };
}

function collectKeys(value) {
  if (Array.isArray(value)) {
    return value.flatMap(collectKeys);
  }

  if (!value || typeof value !== "object") {
    return [];
  }

  return Object.entries(value).flatMap(([key, nested]) => [
    key,
    ...collectKeys(nested)
  ]);
}
