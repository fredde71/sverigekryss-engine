import {
  createInterruptedGridLineEvidenceDiagnostics,
  interruptedGridLineEvidenceDiagnosticsExperiment
} from "./interruptedGridLineEvidenceDiagnostics";
import {
  createHorizontalProjection,
  createVerticalProjection
} from "../analysis/Projection";

test("joins accepted and interrupted observations with factual 2D evidence", () => {
  const binaryImage = createBinaryImage();
  const result = createInterruptedGridLineEvidenceDiagnostics({
    binaryImage,
    analysisContext: createAnalysisContext(binaryImage),
    continuityDiagnostics: createVerticalDiagnostics(
      "vertical-continuity-projection-comparison",
      [0, 1, 2, 3, 4, 5],
      [0, 0, 6, 0, 0, 2]
    ),
    componentDiagnostics: createVerticalDiagnostics(
      "vertical-line-mask-projection-comparison",
      null,
      [0, 0, 6, 0, 0, 1]
    ),
    readEnvironment: () => "test"
  });
  const horizontal = result.axes.horizontal.observations;
  const accepted = horizontal.find(value => value.position === 1);
  const interrupted = horizontal.find(value => value.position === 4);
  const vertical = result.axes.vertical.observations.find(
    value => value.position === 2
  );

  expect(result).toMatchObject({
    type: "interrupted-grid-line-evidence-diagnostics",
    version: 1,
    status: "complete",
    currentAdmissionPolicy: {
      type: "whole-axis-projection-coverage",
      coverageRatio: 0.8,
      behavior: "observed-not-modified"
    }
  });
  expect(accepted.wholeAxisRuleSatisfied).toBe(true);
  expect(interrupted).toMatchObject({
    position: 4,
    projectionStrength: 4,
    coverageRatio: 4 / 6,
    wholeAxisRuleSatisfied: false,
    intersectionEvidence: {
      totalCrossingCount: expect.any(Number),
      strokePresentCount: expect.any(Number),
      strokePresentRatio: expect.any(Number)
    },
    labEvidence: {
      status: "unavailable",
      reason: "existing-lab-continuity-and-component-evidence-is-vertical-only"
    }
  });
  expect(vertical.labEvidence).toEqual({
    status: "available",
    reason: null,
    verticalContinuityScores: {
      status: "available",
      samples: [2],
      maximum: 2,
      reason: null
    },
    verticalContinuityMask: {
      status: "available",
      samples: [6],
      maximum: 6,
      reason: null
    },
    verticalComponentMask: {
      status: "available",
      samples: [6],
      maximum: 6,
      reason: null
    }
  });
  expect(result.comparisonCohorts.currentRuleSatisfied).toContain(accepted.id);
  expect(result.comparisonCohorts.currentRuleNotSatisfied)
    .toContain(interrupted.id);
});

test("keeps missing optional Lab evidence explicitly unavailable", () => {
  const binaryImage = createBinaryImage();
  const result = createInterruptedGridLineEvidenceDiagnostics({
    binaryImage,
    analysisContext: createAnalysisContext(binaryImage),
    readEnvironment: () => "development"
  });
  const vertical = result.axes.vertical.observations[0];

  expect(result.sourceArtifacts.verticalContinuityDiagnostics.status)
    .toBe("unavailable");
  expect(result.sourceArtifacts.verticalComponentDiagnostics.status)
    .toBe("unavailable");
  expect(vertical.labEvidence).toMatchObject({
    status: "partial",
    reason: "one-or-more-existing-lab-profiles-unavailable",
    verticalContinuityScores: {
      status: "unavailable",
      reason: "profile-unavailable"
    },
    verticalComponentMask: {
      status: "unavailable",
      reason: "profile-unavailable"
    }
  });
});

test("is deterministic, immutable and does not mutate source evidence", () => {
  const binaryImage = createBinaryImage();
  const analysisContext = createAnalysisContext(binaryImage);
  const beforeData = Array.from(binaryImage.data);
  const beforeContext = JSON.stringify(analysisContext);
  const input = {
    binaryImage,
    analysisContext,
    readEnvironment: () => "test"
  };

  const first = createInterruptedGridLineEvidenceDiagnostics(input);
  const second = createInterruptedGridLineEvidenceDiagnostics(input);

  expect(second).toEqual(first);
  expect(Array.from(binaryImage.data)).toEqual(beforeData);
  expect(JSON.stringify(analysisContext)).toBe(beforeContext);
  expect(Object.isFrozen(first)).toBe(true);
  expect(Object.isFrozen(first.axes.horizontal.observations)).toBe(true);
  expect(Object.isFrozen(first.axes.horizontal.observations[0])).toBe(true);
  expect(JSON.stringify(first)).not.toMatch(
    /"(score|confidence|ranking|recommendation|selection)"\s*:/
  );
});

test("is guarded to development and test environments", () => {
  expect(() => createInterruptedGridLineEvidenceDiagnostics({
    binaryImage: createBinaryImage(),
    readEnvironment: () => "production"
  })).toThrow(
    "Interrupted grid-line evidence diagnostics are available only in development or test"
  );
});

test("registered experiment consumes prior Lab diagnostics by reference", () => {
  const binaryImage = createBinaryImage();
  const context = createAnalysisContext(binaryImage);
  const continuity = createVerticalDiagnostics(
    "vertical-continuity-projection-comparison",
    [0, 1, 2, 3, 4, 5],
    [0, 0, 6, 0, 0, 2]
  );
  const component = createVerticalDiagnostics(
    "vertical-line-mask-projection-comparison",
    null,
    [0, 0, 6, 0, 0, 1]
  );
  const execution = {
    getSuccessfulDiagnostics(id) {
      return id === "vertical-continuity-diagnostics"
        ? continuity
        : id === "vertical-line-mask-diagnostics" ? component : null;
    }
  };

  const result = interruptedGridLineEvidenceDiagnosticsExperiment.run(
    binaryImage,
    context,
    execution
  );

  expect(result.sourceArtifacts).toMatchObject({
    verticalContinuityDiagnostics: { status: "available" },
    verticalComponentDiagnostics: { status: "available" }
  });
});

function createBinaryImage() {
  const width = 6;
  const height = 6;
  const data = new Uint8Array(width * height);
  for (let x = 0; x < width; x++) {
    data[(1 * width) + x] = 1;
  }
  for (let y = 0; y < height; y++) {
    data[(y * width) + 2] = 1;
  }
  [0, 1, 3].forEach(x => {
    data[(4 * width) + x] = 1;
  });
  data[(2 * width) + 5] = 1;
  data[(3 * width) + 5] = 1;
  return { width, height, data };
}

function createAnalysisContext(binaryImage) {
  return {
    projections: {
      horizontal: createHorizontalProjection(binaryImage),
      vertical: createVerticalProjection(binaryImage)
    },
    coordinateProvenance: {
      analysisRegion: {
        id: "test-analysis-region",
        regionType: "observed-analysis-region",
        relationshipType: "translation",
        localToBinaryImage: {
          offsetX: 7,
          offsetY: 11,
          scaleX: 1,
          scaleY: 1
        }
      }
    }
  };
}

function createVerticalDiagnostics(type, scores, mask) {
  const series = [];
  if (scores) {
    series.push({ id: "scores", title: "Scores", values: scores });
  }
  series.push({ id: "mask", title: "Mask", values: mask });
  return {
    type,
    visualizations: [{
      id: `${type}-visualization`,
      type: "vertical-projection",
      data: { series }
    }]
  };
}
