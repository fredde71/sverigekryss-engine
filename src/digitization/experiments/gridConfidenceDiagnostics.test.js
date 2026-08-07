import {
  createGridConfidenceDiagnostics,
  gridConfidenceDiagnosticsExperiment
} from "./gridConfidenceDiagnostics";

test("measures a perfect regular grid with the approved diagnostic shape", () => {
  const gridDetection = createGridDetection();

  const result = createGridConfidenceDiagnostics({ gridDetection });

  expect(result).toEqual({
    type: "grid-confidence-diagnostics",
    status: "measured",
    score: 1,
    scoreMeaning: "experimental-structural-score-not-calibrated-probability",
    coverage: {
      requiredFactorCount: 3,
      measuredRequiredFactorCount: 3,
      ratio: 1
    },
    factors: [
      {
        id: "geometry-integrity",
        status: "measured",
        score: 1,
        includedInOverall: true,
        measurements: {
          passedCheckCount: 7,
          totalCheckCount: 7,
          checks: [
            { id: "horizontal-lines-increasing", passed: true },
            { id: "vertical-lines-increasing", passed: true },
            { id: "row-count-agreement", passed: true },
            { id: "column-count-agreement", passed: true },
            { id: "positive-bounds", passed: true },
            { id: "horizontal-bounds-agreement", passed: true },
            { id: "vertical-bounds-agreement", passed: true }
          ]
        }
      },
      {
        id: "spacing-consistency",
        status: "measured",
        score: 1,
        includedInOverall: true,
        measurements: {
          horizontal: 1,
          vertical: 1,
          combination: "geometric-mean"
        }
      },
      {
        id: "cell-aspect-observation",
        status: "measured",
        score: 1,
        includedInOverall: true,
        measurements: {
          horizontalAverageSpacing: 20,
          verticalAverageSpacing: 20,
          ratio: 1
        }
      },
      {
        id: "candidate-selectivity",
        status: "measured",
        score: 1,
        includedInOverall: false,
        measurements: {
          horizontal: {
            acceptedCount: 6,
            rejectedCount: 0,
            totalCount: 6,
            acceptedRatio: 1
          },
          vertical: {
            acceptedCount: 6,
            rejectedCount: 0,
            totalCount: 6,
            acceptedRatio: 1
          },
          combination: "geometric-mean"
        }
      }
    ],
    observations: {
      productionConfidence: "detected",
      acceptance: true,
      rejectionReasons: [],
      geometry: {
        rows: 5,
        cols: 5,
        bounds: {
          top: 0,
          left: 0,
          width: 100,
          height: 100
        },
        horizontalLineCount: 6,
        verticalLineCount: 6
      },
      preRejectionBounds: {
        top: 0,
        left: 0,
        width: 100,
        height: 100
      }
    }
  });
});

test("combines unequal axis spacing consistency with a geometric mean", () => {
  const gridDetection = createGridDetection({
    horizontalConsistency: 1,
    verticalConsistency: 0.49
  });

  const result = createGridConfidenceDiagnostics({ gridDetection });

  expect(getFactor(result, "spacing-consistency")).toEqual({
    id: "spacing-consistency",
    status: "measured",
    score: 0.7,
    includedInOverall: true,
    measurements: {
      horizontal: 1,
      vertical: 0.49,
      combination: "geometric-mean"
    }
  });
  expect(result.score).toBeCloseTo((1 + 0.7 + 1) / 3);
});

test("reports regular rectangular cells as a distinct cell aspect observation", () => {
  const gridDetection = createGridDetection({
    verticalLines: [0, 10, 20, 30, 40, 50],
    verticalAverage: 10
  });

  const result = createGridConfidenceDiagnostics({ gridDetection });

  expect(getFactor(result, "spacing-consistency").score).toBe(1);
  expect(getFactor(result, "cell-aspect-observation")).toEqual({
    id: "cell-aspect-observation",
    status: "measured",
    score: 0.5,
    includedInOverall: true,
    measurements: {
      horizontalAverageSpacing: 20,
      verticalAverageSpacing: 10,
      ratio: 0.5
    }
  });
});

test("reports publisher-like candidate clutter without including it in overall score", () => {
  const gridDetection = createGridDetection({
    horizontalCandidateCounts: {
      acceptedCount: 12,
      rejectedCount: 12,
      totalCount: 24
    },
    verticalCandidateCounts: {
      acceptedCount: 10,
      rejectedCount: 30,
      totalCount: 40
    }
  });

  const result = createGridConfidenceDiagnostics({ gridDetection });
  const selectivity = getFactor(result, "candidate-selectivity");

  expect(selectivity.score).toBeCloseTo(Math.sqrt(0.5 * 0.25));
  expect(selectivity.includedInOverall).toBe(false);
  expect(result.score).toBe(1);
});

test("scores observed geometry inconsistencies without guessing replacement geometry", () => {
  const gridDetection = createGridDetection();
  gridDetection.geometry.rows = 4;
  gridDetection.geometry.bounds.width = 90;

  const result = createGridConfidenceDiagnostics({ gridDetection });
  const geometry = getFactor(result, "geometry-integrity");

  expect(geometry.measurements.passedCheckCount).toBe(5);
  expect(geometry.score).toBe(5 / 7);
  expect(geometry.measurements.checks).toEqual(expect.arrayContaining([
    { id: "row-count-agreement", passed: false },
    { id: "vertical-bounds-agreement", passed: false }
  ]));
});

test("leaves spacing and cell aspect unavailable when a spacing axis is missing", () => {
  const gridDetection = createGridDetection();
  gridDetection.diagnostics = gridDetection.diagnostics.filter(diagnostic => !(
    diagnostic.type === "spacing-consistency" && diagnostic.axis === "vertical"
  ));

  const result = createGridConfidenceDiagnostics({ gridDetection });

  expect(getFactor(result, "spacing-consistency")).toEqual({
    id: "spacing-consistency",
    status: "unavailable",
    score: null,
    includedInOverall: true,
    reason: "vertical-spacing-consistency-diagnostic-unavailable",
    measurements: null
  });
  expect(getFactor(result, "cell-aspect-observation").status).toBe("unavailable");
  expect(result).toMatchObject({
    status: "partial",
    score: null,
    coverage: {
      requiredFactorCount: 3,
      measuredRequiredFactorCount: 1,
      ratio: 1 / 3
    }
  });
});

test("does not reinterpret insufficient-candidate spacing as a measured factor", () => {
  const gridDetection = createGridDetection();
  const verticalSpacing = gridDetection.diagnostics.find(diagnostic => (
    diagnostic.type === "spacing-consistency" && diagnostic.axis === "vertical"
  ));
  delete verticalSpacing.consistency;
  delete verticalSpacing.average;
  verticalSpacing.status = "insufficient-candidates";

  const result = createGridConfidenceDiagnostics({ gridDetection });

  expect(getFactor(result, "spacing-consistency").status).toBe("unavailable");
  expect(getFactor(result, "cell-aspect-observation").status).toBe("unavailable");
  expect(result.status).toBe("partial");
  expect(result.score).toBeNull();
});

test("keeps candidate selectivity unavailable without invalidating core confidence", () => {
  const gridDetection = createGridDetection();
  gridDetection.diagnostics = gridDetection.diagnostics.filter(diagnostic => (
    diagnostic.type !== "candidate-counts"
  ));

  const result = createGridConfidenceDiagnostics({ gridDetection });

  expect(getFactor(result, "candidate-selectivity")).toEqual({
    id: "candidate-selectivity",
    status: "unavailable",
    score: null,
    includedInOverall: false,
    reason: "horizontal-candidate-counts-diagnostic-unavailable",
    measurements: null
  });
  expect(result.status).toBe("measured");
  expect(result.score).toBe(1);
});

test("returns unavailable for rejected production geometry and preserves rejection observations", () => {
  const rejectionReason = {
    type: "rejection-reason",
    code: "insufficient-candidates",
    axis: "horizontal",
    candidateCount: 1,
    minimumCount: 2
  };
  const gridDetection = {
    geometry: null,
    confidence: "missing-grid-geometry",
    diagnostics: [
      rejectionReason,
      {
        type: "pre-rejection-bounds",
        bounds: {
          top: 0,
          left: 0,
          width: 200,
          height: 0
        }
      },
      {
        type: "acceptance-status",
        accepted: false
      }
    ]
  };

  const result = createGridConfidenceDiagnostics({ gridDetection });

  expect(result).toMatchObject({
    type: "grid-confidence-diagnostics",
    status: "unavailable",
    score: null,
    coverage: {
      requiredFactorCount: 3,
      measuredRequiredFactorCount: 0,
      ratio: 0
    },
    observations: {
      productionConfidence: "missing-grid-geometry",
      acceptance: false,
      rejectionReasons: [
        {
          code: "insufficient-candidates",
          axis: "horizontal",
          candidateCount: 1,
          minimumCount: 2
        }
      ],
      geometry: null,
      preRejectionBounds: {
        top: 0,
        left: 0,
        width: 200,
        height: 0
      }
    }
  });
  expect(result.factors.every(factor => factor.status === "unavailable")).toBe(true);
});

test("reports pre-rejection bounds without comparing their coordinate system", () => {
  const gridDetection = createGridDetection({
    preRejectionBounds: {
      top: 0,
      left: 0,
      width: 50,
      height: 50
    }
  });

  const result = createGridConfidenceDiagnostics({ gridDetection });

  expect(result.score).toBe(1);
  expect(result.observations.geometry.bounds).toEqual({
    top: 0,
    left: 0,
    width: 100,
    height: 100
  });
  expect(result.observations.preRejectionBounds).toEqual({
    top: 0,
    left: 0,
    width: 50,
    height: 50
  });
});

test("is deterministic, preserves frozen input and keeps production confidence exact", () => {
  const gridDetection = deepFreeze(createGridDetection({
    confidence: "publisher-confidence-token"
  }));
  const snapshot = JSON.stringify(gridDetection);

  const first = createGridConfidenceDiagnostics({ gridDetection });
  const second = createGridConfidenceDiagnostics({ gridDetection });

  expect(second).toEqual(first);
  expect(first.observations.productionConfidence).toBe(gridDetection.confidence);
  expect(JSON.stringify(gridDetection)).toBe(snapshot);
  expect(Object.isFrozen(gridDetection)).toBe(true);
  expect(Object.isFrozen(gridDetection.geometry)).toBe(true);
  expect(Object.isFrozen(gridDetection.diagnostics)).toBe(true);
});

test("registered experiment never accesses BinaryImage", () => {
  const binaryImage = new Proxy({}, {
    get() {
      throw new Error("BinaryImage was accessed");
    }
  });
  const context = {
    gridDetection: deepFreeze(createGridDetection())
  };

  expect(() => gridConfidenceDiagnosticsExperiment.run(
    binaryImage,
    context
  )).not.toThrow();
  expect(gridConfidenceDiagnosticsExperiment.run(binaryImage, context).score).toBe(1);
});

function createGridDetection({
  horizontalLines = [0, 20, 40, 60, 80, 100],
  verticalLines = [0, 20, 40, 60, 80, 100],
  horizontalConsistency = 1,
  verticalConsistency = 1,
  horizontalAverage = 20,
  verticalAverage = 20,
  horizontalCandidateCounts = {
    acceptedCount: horizontalLines.length,
    rejectedCount: 0,
    totalCount: horizontalLines.length
  },
  verticalCandidateCounts = {
    acceptedCount: verticalLines.length,
    rejectedCount: 0,
    totalCount: verticalLines.length
  },
  preRejectionBounds,
  confidence = "detected"
} = {}) {
  const bounds = {
    top: horizontalLines[0],
    left: verticalLines[0],
    width: verticalLines[verticalLines.length - 1] - verticalLines[0],
    height: horizontalLines[horizontalLines.length - 1] - horizontalLines[0]
  };

  return {
    geometry: {
      bounds,
      horizontalLines: horizontalLines.slice(),
      verticalLines: verticalLines.slice(),
      rows: horizontalLines.length - 1,
      cols: verticalLines.length - 1
    },
    confidence,
    diagnostics: [
      {
        type: "spacing-consistency",
        axis: "horizontal",
        status: "measured",
        consistency: horizontalConsistency,
        average: horizontalAverage
      },
      {
        type: "spacing-consistency",
        axis: "vertical",
        status: "measured",
        consistency: verticalConsistency,
        average: verticalAverage
      },
      {
        type: "candidate-counts",
        axis: "horizontal",
        ...horizontalCandidateCounts
      },
      {
        type: "candidate-counts",
        axis: "vertical",
        ...verticalCandidateCounts
      },
      {
        type: "pre-rejection-bounds",
        bounds: preRejectionBounds || { ...bounds }
      },
      {
        type: "rejection-reasons",
        reasons: []
      },
      {
        type: "acceptance-status",
        accepted: true
      }
    ]
  };
}

function getFactor(result, id) {
  return result.factors.find(factor => factor.id === id);
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
