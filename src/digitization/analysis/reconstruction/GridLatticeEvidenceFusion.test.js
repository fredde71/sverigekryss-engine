import fs from "fs";
import path from "path";
import { createGridLatticeEvidence } from "./GridLatticeEvidence";
import {
  generateGridLatticeCandidates
} from "./GridLatticeCandidateGeneration";
import {
  fuseGridLatticeCandidateEvidence
} from "./GridLatticeEvidenceFusion";

test("creates one factual GridLatticeConfidence artifact per candidate", () => {
  const { evidence, periods, generation } = createPipelineInputs();
  const result = fuseGridLatticeCandidateEvidence({
    candidateGeneration: generation,
    evidence,
    primitivePeriodEvidence: periods
  });

  expect(result).toMatchObject({
    type: "grid-lattice-evidence-fusion",
    version: 1,
    status: "available",
    evidenceId: "evidence-001",
    primitivePeriodEvidenceId: "primitive-period-evidence-001",
    candidateIds: ["grid-lattice-candidate-001"]
  });
  expect(result.confidences).toHaveLength(1);
  expect(result.confidences[0]).toMatchObject({
    type: "grid-lattice-confidence",
    version: 1,
    status: "available",
    candidateId: "grid-lattice-candidate-001"
  });
  expect(result.confidences[0].assessments.map(value => [
    value.id,
    value.status,
    value.relation
  ])).toEqual([
    ["outer-bounds-consistency", "available", "supports"],
    ["observed-line-anchor-residuals", "available", "supports"],
    ["primitive-period-consistency", "available", "supports"],
    ["lattice-interval-consistency", "available", "supports"]
  ]);
});

test("reports exact bounds observations independently for each axis", () => {
  const { evidence, periods, generation } = createPipelineInputs({ height: 25 });
  const result = fuseGridLatticeCandidateEvidence({
    candidateGeneration: generation,
    evidence,
    primitivePeriodEvidence: periods
  });

  expect(result.confidences).toHaveLength(2);
  const first = findAssessment(result.confidences[0], "outer-bounds-consistency");
  const second = findAssessment(result.confidences[1], "outer-bounds-consistency");
  expect(first.relation).toBe("contradicts");
  expect(first.observation.axes.horizontal).toMatchObject({
    expectedStart: 10,
    expectedEnd: 35,
    candidateStart: 10,
    candidateModeledEnd: 30,
    startDelta: 0,
    endDelta: -5,
    exactMatch: false
  });
  expect(second.observation.axes.horizontal.endDelta).toBe(5);
  expect(first.observation.axes.vertical.exactMatch).toBe(true);
});

test("evaluates ambiguous factored bounds independently by axis", () => {
  const input = createEvidenceInput();
  input.boundsObservation = createUnavailableBoundsObservation();
  const factoredBounds = createFactoredBounds({
    horizontal: [[10, 30], [11, 31]],
    vertical: [[5, 35], [7, 37]]
  });
  const { evidence, periods, generation } = createPipelineInputs({
    input,
    factoredBounds
  });

  const result = fuseGridLatticeCandidateEvidence({
    candidateGeneration: generation,
    evidence,
    primitivePeriodEvidence: periods
  });

  expect(result.status).toBe("available");
  expect(result.boundsSpace).toEqual(generation.boundsSpace);
  expect(result.axisEvidence.horizontal.map(value => (
    value.assessments["outer-bounds-consistency"].observation
  ))).toEqual([
    expect.objectContaining({
      sourceAxisBoundsId: "horizontal-bounds-001",
      expectedStart: 10,
      expectedEnd: 30,
      candidateStart: 10,
      candidateModeledEnd: 30,
      startDelta: 0,
      endDelta: 0,
      exactMatch: true
    }),
    expect.objectContaining({
      sourceAxisBoundsId: "horizontal-bounds-002",
      expectedStart: 11,
      expectedEnd: 31,
      candidateStart: 11,
      candidateModeledEnd: 31,
      startDelta: 0,
      endDelta: 0,
      exactMatch: true
    })
  ]);
  expect(result.axisEvidence.vertical.map(value => (
    value.assessments["outer-bounds-consistency"].observation
      .sourceAxisBoundsId
  ))).toEqual(["vertical-bounds-001", "vertical-bounds-002"]);
  expect(result.confidenceSpace).toMatchObject({
    horizontalAxisBoundsIds: [
      "horizontal-bounds-001",
      "horizontal-bounds-002"
    ],
    verticalAxisBoundsIds: [
      "vertical-bounds-001",
      "vertical-bounds-002"
    ],
    exactBoundsCombinationCount: 4,
    exactConfidenceCount: 4,
    eagerlyMaterializedConfidenceArtifactCount: 0
  });
});

test("preserves factored bounds provenance without Cartesian evaluation", () => {
  const input = createEvidenceInput();
  input.boundsObservation = createUnavailableBoundsObservation();
  const factoredBounds = createFactoredBounds({
    horizontal: [[10, 30], [11, 31]],
    vertical: [[5, 35], [7, 37], [9, 39]]
  });
  const { evidence, periods, generation } = createPipelineInputs({
    input,
    factoredBounds
  });
  const guardedGeneration = new Proxy(generation, {
    get(target, property, receiver) {
      if (property === "candidates") {
        throw new Error("Cartesian candidates must not be read");
      }
      return Reflect.get(target, property, receiver);
    }
  });

  const result = fuseGridLatticeCandidateEvidence({
    candidateGeneration: guardedGeneration,
    evidence,
    primitivePeriodEvidence: periods
  });

  expect(result.axisEvidence.horizontal).toHaveLength(2);
  expect(result.axisEvidence.vertical).toHaveLength(3);
  expect(result.confidenceSpace.exactBoundsCombinationCount).toBe(6);
  expect(result.confidenceSpace.exactConfidenceCount).toBe(6);
  expect(result.axisEvidence.horizontal[1]).toMatchObject({
    axisBoundsId: "horizontal-bounds-002",
    provenance: {
      axisBounds: {
        source: "synthetic-factored-bounds",
        axis: "horizontal",
        sourceOrder: 1
      }
    },
    assessments: {
      "outer-bounds-consistency": {
        observation: {
          evidenceReferences: ["bounds:horizontal:1"],
          provenance: {
            source: "synthetic-factored-bounds",
            axis: "horizontal",
            sourceOrder: 1
          }
        }
      }
    }
  });
  expect(result.confidenceSpace.eagerlyMaterializedConfidenceArtifactCount)
    .toBe(0);
});

test("reports anchor residual statistics without tolerance or candidate removal", () => {
  const input = createEvidenceInput();
  input.axes.horizontal.positions = [10.5, 19, 30];
  const { evidence, periods, generation } = createPipelineInputs({ input });
  const result = fuseGridLatticeCandidateEvidence({
    candidateGeneration: generation,
    evidence,
    primitivePeriodEvidence: periods
  });
  const assessment = findAssessment(
    result.confidences[0],
    "observed-line-anchor-residuals"
  );

  expect(result.confidences).toHaveLength(generation.candidates.length);
  expect(assessment.relation).toBe("contradicts");
  expect(assessment.observation.axes.horizontal.assignments.map(value => (
    value.residual
  ))).toEqual([0.5, -1, 0]);
  expect(assessment.observation.axes.horizontal.residualStatistics).toEqual({
    count: 3,
    maximumAbsoluteResidual: 1,
    averageAbsoluteResidual: 0.5,
    medianAbsoluteResidual: 0.5,
    rmsResidual: Math.sqrt(1.25 / 3)
  });
  expect(assessment.observation.axes.horizontal.exactResidualCount).toBe(1);
  expect(assessment.observation.axes.horizontal.nonExactResidualCount).toBe(2);
});

test("reports primitive-period consistency with source evidence provenance", () => {
  const { evidence, periods, generation } = createPipelineInputs();
  const result = fuseGridLatticeCandidateEvidence({
    candidateGeneration: generation,
    evidence,
    primitivePeriodEvidence: periods
  });
  const assessment = findAssessment(
    result.confidences[0],
    "primitive-period-consistency"
  );

  expect(assessment.observation.axes.horizontal).toEqual({
    axis: "horizontal",
    status: "available",
    primitivePeriodCandidateId: "horizontal-period-001",
    candidatePeriod: 10,
    evidencePeriod: 10,
    periodDelta: 0,
    exactMatch: true,
    evidenceReferences: ["periodicity:horizontal:1"],
    provenance: {
      source: "primitive-period-observation",
      sourceOrder: 0
    }
  });
  expect(assessment.relation).toBe("supports");
});

test("reports adjacent anchor-to-lattice interval residuals factually", () => {
  const input = createEvidenceInput();
  input.axes.horizontal.positions = [10.5, 19, 30];
  const { evidence, periods, generation } = createPipelineInputs({ input });
  const result = fuseGridLatticeCandidateEvidence({
    candidateGeneration: generation,
    evidence,
    primitivePeriodEvidence: periods
  });
  const assessment = findAssessment(
    result.confidences[0],
    "lattice-interval-consistency"
  );

  expect(assessment.relation).toBe("contradicts");
  expect(assessment.observation.axes.horizontal.intervals).toEqual([
    {
      fromAnchorOrder: 0,
      toAnchorOrder: 1,
      observedGap: 8.5,
      latticeIntervalCount: 1,
      modeledGap: 10,
      residual: -1.5,
      absoluteResidual: 1.5,
      exactMatch: false
    },
    {
      fromAnchorOrder: 1,
      toAnchorOrder: 2,
      observedGap: 11,
      latticeIntervalCount: 1,
      modeledGap: 10,
      residual: 1,
      absoluteResidual: 1,
      exactMatch: false
    }
  ]);
});

test("evaluates ambiguous candidates independently and preserves candidate order", () => {
  const periods = createPrimitivePeriodEvidence();
  periods.status = "ambiguous";
  periods.axes.horizontal = createPeriodAxis("horizontal", [10, 5]);
  periods.axes.vertical = createPeriodAxis("vertical", [10, 15]);
  const { evidence, generation } = createPipelineInputs({ periods });
  const result = fuseGridLatticeCandidateEvidence({
    candidateGeneration: generation,
    evidence,
    primitivePeriodEvidence: periods
  });

  expect(generation.status).toBe("ambiguous");
  expect(result.axisEvidence.horizontal.map(value => value.axisCandidateId)).toEqual(
    generation.axisCandidates.horizontal.map(value => value.id)
  );
  expect(result.axisEvidence.vertical.map(value => value.axisCandidateId)).toEqual(
    generation.axisCandidates.vertical.map(value => value.id)
  );
  expect(result.confidenceSpace.exactConfidenceCount).toBe(4);
  expect(result.confidenceSpace.eagerlyMaterializedConfidenceArtifactCount).toBe(0);
  expect(result.confidences).toHaveLength(4);
  expect(result.confidences.map(value => value.candidateId)).toEqual(
    generation.candidates.map(value => value.id)
  );
  expect(result.candidateIds).toEqual(generation.candidates.map(value => value.id));
  expect(result.diagnostics[0]).toMatchObject({
    candidateCount: 4,
    evaluatedCandidateCount: 0,
    horizontalAxisCandidateCount: 2,
    verticalAxisCandidateCount: 2,
    evaluatedAxisCandidateCount: 4,
    rectangularConfidenceRepresentation: "factored-axis-product"
  });
});

test("fuses axis evidence without reading the Cartesian compatibility view", () => {
  const { evidence, periods, generation } = createPipelineInputs();
  const guardedGeneration = new Proxy(generation, {
    get(target, property, receiver) {
      if (property === "candidates") {
        throw new Error("Cartesian candidates must not be read");
      }
      return Reflect.get(target, property, receiver);
    }
  });

  const result = fuseGridLatticeCandidateEvidence({
    candidateGeneration: guardedGeneration,
    evidence,
    primitivePeriodEvidence: periods
  });

  expect(result.axisEvidence.horizontal).toHaveLength(1);
  expect(result.axisEvidence.vertical).toHaveLength(1);
  expect(result.confidenceSpace).toEqual({
    representation: "cartesian-product-by-reference",
    combinationOrder: "horizontal-major-vertical-minor",
    horizontalAxisEvidenceIds: [
      "grid-lattice-axis-evidence-horizontal-period-001-intervals-2"
    ],
    verticalAxisEvidenceIds: [
      "grid-lattice-axis-evidence-vertical-period-001-intervals-3"
    ],
    horizontalAxisBoundsIds: ["horizontal-bounds-001"],
    verticalAxisBoundsIds: ["vertical-bounds-001"],
    exactBoundsCombinationCount: 1,
    exactConfidenceCount: 1,
    eagerlyMaterializedConfidenceArtifactCount: 0
  });
  expect(Object.getOwnPropertyDescriptor(result, "confidences").get)
    .toEqual(expect.any(Function));
});

test("preserves unavailable evidence as a partial confidence observation", () => {
  const { evidence, periods, generation } = createPipelineInputs();
  const missingPeriodSource = clone(periods);
  missingPeriodSource.axes.horizontal.candidates[0].id = "different-period-id";

  const result = fuseGridLatticeCandidateEvidence({
    candidateGeneration: generation,
    evidence,
    primitivePeriodEvidence: missingPeriodSource
  });
  const confidence = result.confidences[0];
  const primitive = findAssessment(confidence, "primitive-period-consistency");

  expect(result.status).toBe("partial");
  expect(confidence.status).toBe("partial");
  expect(primitive).toMatchObject({
    status: "unavailable",
    relation: "unavailable",
    observation: {
      reason: "primitive-period-candidate-unavailable"
    }
  });
  expect(confidence.assessments).toHaveLength(4);
});

test("returns unavailable when candidate generation contains no candidates", () => {
  const input = createEvidenceInput();
  input.axes.vertical.status = "unavailable";
  input.axes.vertical.positions = [];
  const { evidence, periods, generation } = createPipelineInputs({ input });

  const result = fuseGridLatticeCandidateEvidence({
    candidateGeneration: generation,
    evidence,
    primitivePeriodEvidence: periods
  });

  expect(result).toMatchObject({
    status: "unavailable",
    candidateIds: [],
    confidences: [],
    reasons: ["grid-lattice-candidates-unavailable"]
  });
});

test("preserves provenance and exact source references in every confidence artifact", () => {
  const { evidence, periods, generation } = createPipelineInputs();
  const result = fuseGridLatticeCandidateEvidence({
    candidateGeneration: generation,
    evidence,
    primitivePeriodEvidence: periods
  });
  const confidence = result.confidences[0];

  expect(confidence.provenance).toEqual({
    fusion: "grid-lattice-evidence-fusion-v1",
    candidate: generation.candidates[0].provenance,
    gridLatticeEvidence: evidence.provenance,
    primitivePeriodEvidence: periods.provenance
  });
  expect(confidence.evidenceReferences).toEqual([
    "anchors:horizontal",
    "anchors:vertical",
    "periodicity:horizontal:1",
    "bounds:001",
    "periodicity:vertical:1",
    "periodicity:001"
  ]);
});

test("is deterministic, immutable and accepts frozen inputs", () => {
  const values = createPipelineInputs();
  deepFreeze(values.periods);
  const before = JSON.stringify(values);

  const first = fuseGridLatticeCandidateEvidence({
    candidateGeneration: values.generation,
    evidence: values.evidence,
    primitivePeriodEvidence: values.periods
  });
  const second = fuseGridLatticeCandidateEvidence({
    candidateGeneration: values.generation,
    evidence: values.evidence,
    primitivePeriodEvidence: values.periods
  });

  expect(JSON.stringify(values)).toBe(before);
  expect(second).toEqual(first);
  expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  expect(Object.isFrozen(first)).toBe(true);
  expect(Object.isFrozen(first.axisEvidence.horizontal[0])).toBe(true);
  expect(Object.isFrozen(first.confidenceSpace)).toBe(true);
  expect(Object.isFrozen(first.confidences[0])).toBe(true);
  expect(Object.isFrozen(first.confidences[0].assessments[0].observation)).toBe(true);
});

test.each([
  ["candidate generation version", values => {
    values.generation.version = 2;
  }],
  ["evidence association", values => {
    values.generation.evidenceId = "other-evidence";
  }],
  ["primitive-period association", values => {
    values.generation.primitivePeriodEvidenceId = "other-period-evidence";
  }],
  ["axis candidate evidence association", values => {
    values.generation.axisCandidates.horizontal[0]
      .provenance.gridLatticeEvidenceId = "other-evidence";
  }],
  ["axis bounds association", values => {
    values.generation.axisCandidates.horizontal[0].axisBoundsId =
      "missing-horizontal-bounds";
  }],
  ["bounds cardinality", values => {
    values.generation.boundsSpace.exactBoundsCombinationCount += 1;
  }]
])("rejects mismatched fusion input: %s", (_label, mutate) => {
  const source = createPipelineInputs();
  const values = {
    evidence: clone(source.evidence),
    periods: clone(source.periods),
    generation: clone(source.generation)
  };
  mutate(values);

  expect(() => fuseGridLatticeCandidateEvidence({
    candidateGeneration: values.generation,
    evidence: values.evidence,
    primitivePeriodEvidence: values.periods
  })).toThrow();
});

test("has no grid-size, crossword-type, Ground Truth or selection policy", () => {
  const { evidence, periods, generation } = createPipelineInputs({
    width: 49,
    height: 21,
    horizontalPeriod: 7,
    verticalPeriod: 7
  });
  const result = fuseGridLatticeCandidateEvidence({
    candidateGeneration: generation,
    evidence,
    primitivePeriodEvidence: periods
  });
  const forbiddenKeys = [
    "score",
    "rank",
    "ranking",
    "recommendation",
    "selection",
    "selectedCandidate",
    "preferredCandidate",
    "groundTruth",
    "crosswordType"
  ];

  expect(generation.candidates[0].gridDimensions).toEqual({ rows: 3, cols: 7 });
  expect(collectKeys(result)).not.toEqual(expect.arrayContaining(forbiddenKeys));
  const source = fs.readFileSync(
    path.join(
      path.dirname(require.resolve("./GridLatticeEvidenceFusion")),
      "GridLatticeEvidenceFusion.js"
    ),
    "utf8"
  );
  expect(source).not.toMatch(/GroundTruth|detectGrid|GridAnalysis|experiments\//);
  expect(source).not.toMatch(/candidateGeneration\.candidates/);
});

function findAssessment(confidence, id) {
  return confidence.assessments.find(value => value.id === id);
}

function createPipelineInputs({
  input = createEvidenceInput(),
  periods = null,
  factoredBounds = null,
  width,
  height,
  horizontalPeriod = 10,
  verticalPeriod = 10
} = {}) {
  if (width !== undefined) {
    input.boundsObservation.bounds.width = width;
  }
  if (height !== undefined) {
    input.boundsObservation.bounds.height = height;
  }
  if (!periods) {
    periods = createPrimitivePeriodEvidence(horizontalPeriod, verticalPeriod);
  }
  const evidence = createGridLatticeEvidence(input);
  const generation = generateGridLatticeCandidates({
    evidence,
    primitivePeriodEvidence: periods,
    factoredBounds
  });
  return { evidence, periods, generation };
}

function createEvidenceInput() {
  return {
    id: "evidence-001",
    status: "available",
    coordinateSystem: {
      space: "analysis-region-local",
      unit: "pixel",
      origin: "top-left",
      xDirection: "right",
      yDirection: "down",
      linePosition: "visual-line-center"
    },
    axes: {
      horizontal: createEvidenceAxis("horizontal", [10, 20, 30]),
      vertical: createEvidenceAxis("vertical", [5, 15, 25, 35])
    },
    boundsObservation: {
      status: "available",
      semantics: "outer-line-center-envelope",
      coordinateSpace: "analysis-region-local",
      bounds: { top: 10, left: 5, width: 30, height: 20 },
      provenance: { source: "outer-bounds-observation" },
      evidenceReferences: ["bounds:001"]
    },
    provenance: { source: "synthetic-grid-evidence" },
    evidenceReferences: ["anchors:horizontal", "anchors:vertical"],
    diagnostics: [],
    reasons: []
  };
}

function createEvidenceAxis(axis, positions) {
  return {
    status: "available",
    axis,
    positions,
    spacingObservations: [],
    evidenceReferences: [`anchors:${axis}`],
    diagnostics: []
  };
}

function createUnavailableBoundsObservation() {
  return {
    status: "unavailable",
    semantics: "outer-line-center-envelope",
    coordinateSpace: "analysis-region-local",
    bounds: null,
    provenance: { source: "single-bounds-unavailable" },
    evidenceReferences: []
  };
}

function createFactoredBounds({ horizontal, vertical }) {
  const axisBounds = {
    horizontal: horizontal.map((bounds, index) => (
      createAxisBounds("horizontal", bounds, index)
    )),
    vertical: vertical.map((bounds, index) => (
      createAxisBounds("vertical", bounds, index)
    ))
  };
  const exactCombinationCount = horizontal.length * vertical.length;
  return {
    status: exactCombinationCount === 1 ? "available" : "ambiguous",
    coordinateSystem: createEvidenceInput().coordinateSystem,
    axisBounds,
    rectangularCombinationSpace: {
      representation: "cartesian-product-by-reference",
      combinationOrder: "horizontal-major-vertical-minor",
      horizontalAxisBoundsIds: axisBounds.horizontal.map(value => value.id),
      verticalAxisBoundsIds: axisBounds.vertical.map(value => value.id),
      exactCombinationCount,
      materializedCombinationCount: 0
    },
    provenance: { source: "synthetic-factored-bounds" },
    reasons: []
  };
}

function createAxisBounds(axis, [start, end], index) {
  return {
    id: `${axis}-bounds-${String(index + 1).padStart(3, "0")}`,
    axis,
    start,
    end,
    coordinateSystem: createEvidenceInput().coordinateSystem,
    evidenceReferences: [`bounds:${axis}:${index}`],
    provenance: {
      source: "synthetic-factored-bounds",
      axis,
      sourceOrder: index
    }
  };
}

function createPrimitivePeriodEvidence(horizontal = 10, vertical = 10) {
  return {
    id: "primitive-period-evidence-001",
    status: "available",
    axes: {
      horizontal: createPeriodAxis("horizontal", [horizontal]),
      vertical: createPeriodAxis("vertical", [vertical])
    },
    evidenceReferences: ["periodicity:001"],
    provenance: { source: "synthetic-period-evidence" }
  };
}

function createPeriodAxis(axis, periods) {
  return {
    axis,
    status: periods.length === 1 ? "available" : "ambiguous",
    candidates: periods.map((period, index) => ({
      id: `${axis}-period-${String(index + 1).padStart(3, "0")}`,
      period,
      evidenceReferences: [`periodicity:${axis}:${index + 1}`],
      provenance: {
        source: "primitive-period-observation",
        sourceOrder: index
      }
    })),
    reasons: []
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function collectKeys(value, keys = []) {
  if (Array.isArray(value)) {
    value.forEach(entry => collectKeys(entry, keys));
  } else if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, entry]) => {
      keys.push(key);
      collectKeys(entry, keys);
    });
  }
  return keys;
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
