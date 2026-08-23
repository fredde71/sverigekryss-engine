import fs from "fs";
import {
  createShadowGridLatticeEvidenceAdapter
} from "./shadowGridLatticeEvidenceAdapter";

test.each(["production", undefined, "preview"])(
  "rejects %p before reading reconstruction diagnostics",
  environment => {
    const adapt = createShadowGridLatticeEvidenceAdapter({
      readEnvironment: () => environment
    });
    const source = new Proxy({}, {
      get() {
        throw new Error("reconstruction diagnostics must not be read");
      }
    });

    expect(() => adapt(source)).toThrow(
      "Shadow grid lattice evidence is available only in development or test"
    );
  }
);

test("preserves rejected and surviving axis interpretations in exact order", () => {
  const source = createSource();
  const result = createAdapter()(source);
  const horizontal = result.providers[0].regions[0].axes.horizontal;

  expect(horizontal.interpretations.map(item => ({
    intervalCount: item.intervalCount,
    status: item.interpretationStatus
  }))).toEqual([
    { intervalCount: 2, status: "rejected" },
    { intervalCount: 4, status: "survived" }
  ]);
  expect(horizontal.interpretations[0]).toMatchObject({
    derivedSpacing: 10,
    modeledLatticePositions: [0, 10, 20],
    candidateResiduals: [{
      candidateIndex: 0,
      observedPosition: 0.5,
      modeledPosition: 0,
      residual: 0.5,
      absoluteResidual: 0.5,
      assignmentStatus: "assigned"
    }],
    candidateAssignments: [{
      candidateIndex: 0,
      candidatePosition: 0.5,
      lineIndex: 0,
      linePosition: 0,
      residual: 0.5,
      status: "assigned"
    }],
    rejectionReasons: [{ code: "candidate-alignment-failed" }],
    inferredLineDiagnostics: {
      inferredLineCount: null,
      longestInferredRun: null,
      inferredLineFraction: null,
      skippedIntervalCounts: []
    }
  });
});

test("preserves provider, region, axis and interpretation provenance", () => {
  const result = createAdapter()(createSource());
  const region = result.providers[0].regions[0];

  expect(region.coordinateProvenance).toEqual({
    source: "shadow-grid-analysis-diagnostics",
    providerId: "provider-a",
    regionId: "region-a"
  });
  expect(region.axes.horizontal.interpretations[1].provenance).toEqual({
    source: "shadow-grid-reconstruction-diagnostics",
    strategyDiagnosticType: "uniform-orthogonal-lattice-strategy",
    providerId: "provider-a",
    regionId: "region-a",
    axis: "horizontal",
    interpretationIndex: 1
  });
});

test("does not read or feed back into admitted grid hypotheses", () => {
  const source = createSource();
  Object.defineProperty(
    source.providers[0].reconstructions[0].reconstruction,
    "gridHypotheses",
    {
      enumerable: true,
      get() {
        throw new Error("gridHypotheses must not be read");
      }
    }
  );

  expect(() => createAdapter()(source)).not.toThrow();
});

test("is deterministic, immutable and leaves frozen evidence untouched", () => {
  const source = deepFreeze(createSource());
  const snapshot = JSON.stringify(source);
  const adapt = createAdapter();
  const first = adapt(source);
  const second = adapt(source);

  expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  expect(JSON.stringify(source)).toBe(snapshot);
  expect(Object.isFrozen(first)).toBe(true);
  expect(Object.isFrozen(
    first.providers[0].regions[0].axes.horizontal.interpretations[0]
  )).toBe(true);
  expect(JSON.stringify(first)).not.toMatch(
    /"(score|confidence|rank|ranking|recommendation|selected|preferred)"\s*:/i
  );
});

test("has no runtime image, Ground Truth, reconstruction or production dependency", () => {
  const source = fs.readFileSync(
    require.resolve("./shadowGridLatticeEvidenceAdapter"),
    "utf8"
  );

  expect(source).not.toMatch(/BinaryImage|imageData|groundTruth/i);
  expect(source).not.toMatch(/reconstructUniform|detectGrid|analyzeGrid/);
});

function createAdapter() {
  return createShadowGridLatticeEvidenceAdapter({
    readEnvironment: () => "test"
  });
}

function createSource() {
  return {
    type: "shadow-grid-reconstruction-diagnostics",
    version: 1,
    status: "complete",
    providers: [{
      id: "provider-a",
      description: "Provider A",
      status: "available",
      regionCount: 1,
      reason: null,
      reconstructions: [{
        providerId: "provider-a",
        regionId: "region-a",
        status: "completed",
        reconstructionStatus: "unavailable",
        coordinateProvenance: {
          source: "shadow-grid-analysis-diagnostics",
          providerId: "provider-a",
          regionId: "region-a"
        },
        reconstruction: {
          parameters: {
            maximumConsecutiveInferredLines: 1,
            maximumInferredLineFraction: 1
          },
          diagnostics: [{
            type: "uniform-orthogonal-lattice-strategy",
            status: "unavailable",
            axes: {
              horizontal: createAxisDiagnostic([2, 4]),
              vertical: createAxisDiagnostic([2])
            }
          }]
        },
        error: null
      }]
    }]
  };
}

function createAxisDiagnostic(intervalCounts) {
  return {
    status: "unavailable",
    candidatePositions: [0.5, 20],
    candidateGaps: [19.5],
    observedBounds: { start: 0, end: 20 },
    interpretations: intervalCounts.map((intervalCount, index) => ({
      intervalCount,
      derivedSpacing: 20 / intervalCount,
      status: index === 0 ? "rejected" : "survived",
      quantumCompatibility: {
        representations: Array.from(
          { length: intervalCount + 1 },
          (_value, lineIndex) => ({
            lineIndex,
            modeledPosition: lineIndex * (20 / intervalCount),
            quantizedPosition: lineIndex * (20 / intervalCount),
            residual: 0,
            status: "compatible"
          })
        )
      },
      candidateResiduals: [{
        candidateIndex: 0,
        observedPosition: 0.5,
        modeledPosition: 0,
        residual: 0.5,
        absoluteResidual: 0.5,
        assignmentStatus: "assigned"
      }],
      candidateAssignmentAttempts: [{
        candidateIndex: 0,
        candidatePosition: 0.5,
        lineIndex: 0,
        linePosition: 0,
        residual: 0.5,
        status: "assigned"
      }],
      rejectionReasons: index === 0
        ? [{ code: "candidate-alignment-failed" }]
        : [],
      inferredLineCount: index === 0 ? null : 1,
      longestInferredRun: index === 0 ? null : 1,
      inferredLineFraction: index === 0 ? null : 0.2,
      skippedIntervalCounts: []
    }))
  };
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
