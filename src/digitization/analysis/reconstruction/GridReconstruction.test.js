import fs from "fs";
import { createGridReconstruction } from "./GridReconstruction";

test("creates a valid deterministic GridReconstruction result artifact", () => {
  const result = createGridReconstruction(createAvailableInput());

  expect(result).toEqual(expect.objectContaining({
    type: "grid-reconstruction",
    version: 1,
    status: "available",
    analysisRegionId: "shadow-region-001"
  }));
  expect(result.coordinateSystem).toEqual(createCoordinateSystem());
  expect(result.observations).toEqual({
    rawCandidates: createCandidateEvidenceRawCandidates(),
    candidateAcceptancePolicy: {
      parameters: { minimumCoverageRatio: 0.8 },
      source: "grid-analysis-line-candidates"
    },
    observedBounds: createObservedBounds(),
    spacingEvidence: createSpacingEvidence()
  });
  expect(result.gridHypotheses).toHaveLength(1);
  expect(result.gridHypotheses[0]).toMatchObject({
    rows: 1,
    cols: 1,
    bounds: { top: 10, left: 5, width: 10, height: 10 }
  });
});

test("accepts frozen input without mutation and deeply freezes a defensive result", () => {
  const input = deepFreeze(createAvailableInput());
  const before = JSON.stringify(input);
  const result = createGridReconstruction(input);

  expect(JSON.stringify(input)).toBe(before);
  expect(result).not.toBe(input);
  expect(result.observations.rawCandidates.horizontal)
    .not.toBe(input.candidateEvidence.horizontal);
  expect(Object.isFrozen(result)).toBe(true);
  expect(Object.isFrozen(result.observations)).toBe(true);
  expect(Object.isFrozen(result.observations.rawCandidates.horizontal[0])).toBe(true);
  expect(Object.isFrozen(result.gridHypotheses[0].lines.vertical[0])).toBe(true);
});

test("is deterministic including canonical object property ordering", () => {
  const firstInput = createUnavailableInput();
  const secondInput = createUnavailableInput();

  secondInput.spacingEvidence.horizontal[0] = {
    average: 10,
    status: "measured",
    type: "spacing-consistency"
  };
  firstInput.spacingEvidence.horizontal[0] = {
    type: "spacing-consistency",
    status: "measured",
    average: 10
  };

  const first = createGridReconstruction(firstInput);
  const second = createGridReconstruction(secondInput);

  expect(second).toEqual(first);
  expect(JSON.stringify(second)).toBe(JSON.stringify(first));
});

test("preserves exact raw candidate values and source order", () => {
  const input = createUnavailableInput();
  input.candidateEvidence.horizontal = [
    createCandidate("horizontal", 30, { sourceIndex: 7 }),
    createCandidate("horizontal", 10.5, { sourceIndex: 2 }),
    createCandidate("horizontal", 20, { sourceIndex: 5 })
  ];
  const original = input.candidateEvidence.horizontal.map(candidate => ({
    ...candidate
  }));
  const result = createGridReconstruction(input);

  expect(result.observations.rawCandidates.horizontal).toEqual(original);
  expect(result.observations.rawCandidates.horizontal.map(candidate => (
    candidate.position
  ))).toEqual([30, 10.5, 20]);

  input.candidateEvidence.horizontal[0].position = 999;
  expect(result.observations.rawCandidates.horizontal[0].position).toBe(30);
});

test.each([
  ["missing candidate array", input => { delete input.candidateEvidence.vertical; }],
  ["wrong candidate axis", input => { input.candidateEvidence.horizontal[0].axis = "vertical"; }],
  ["non-finite candidate", input => { input.candidateEvidence.vertical[0].position = NaN; }],
  ["negative candidate strength", input => { input.candidateEvidence.vertical[0].strength = -1; }],
  ["missing region id", input => { input.candidateEvidence.analysisRegionId = ""; }]
])("rejects invalid candidates: %s", (_label, mutate) => {
  const input = createUnavailableInput();
  mutate(input);

  expect(() => createGridReconstruction(input)).toThrow();
});

test.each([
  ["coordinate-space mismatch", input => { input.observedBounds.coordinateSpace = "document-pixels"; }],
  ["unsupported semantics", input => { input.observedBounds.semantics = "pixel-area"; }],
  ["non-finite component", input => { input.observedBounds.value.top = Infinity; }],
  ["non-positive width", input => { input.observedBounds.value.width = 0; }],
  ["unavailable with a value", input => {
    input.observedBounds = {
      ...createUnavailableBounds(),
      value: { top: 0, left: 0, width: 1, height: 1 }
    };
  }],
  ["partial without missing components", input => {
    input.observedBounds = { ...createObservedBounds(), status: "partial" };
  }]
])("rejects invalid bounds: %s", (_label, mutate) => {
  const input = createUnavailableInput({ availableBounds: true });
  mutate(input);

  expect(() => createGridReconstruction(input)).toThrow();
});

test("accepts explicitly partial observed bounds", () => {
  const input = createUnavailableInput();
  input.observedBounds = {
    status: "partial",
    coordinateSpace: "analysis-region-local",
    semantics: "outer-line-center-envelope",
    value: {
      top: 10,
      left: null,
      width: null,
      height: 20
    },
    components: {
      top: { status: "observed", provenance: "horizontal-image-evidence" },
      left: { status: "unavailable" }
    }
  };

  const result = createGridReconstruction(input);

  expect(result.observations.observedBounds).toEqual(input.observedBounds);
});

test("accepts an explicit accepted-candidate bounds envelope", () => {
  const input = createAvailableInput();
  input.observedBounds = {
    ...input.observedBounds,
    semantics: "accepted-candidate-envelope",
    provenance: {
      source: "phase-4-shadow-grid-geometry",
      derivation: "outermost-accepted-horizontal-and-vertical-candidate-positions"
    }
  };

  const result = createGridReconstruction(input);

  expect(result.observations.observedBounds).toEqual(input.observedBounds);
  expect(result.gridHypotheses[0].bounds).toEqual({
    top: 10,
    left: 5,
    width: 10,
    height: 10
  });
});

test.each([
  ["origin", input => { input.coordinateSystem.origin = "bottom-left"; }],
  ["x direction", input => { input.coordinateSystem.xDirection = "left"; }],
  ["line semantics", input => { input.coordinateSystem.linePosition = "line-edge"; }],
  ["non-finite offset", input => {
    input.coordinateSystem.localToBinaryImage.offsetX = NaN;
  }],
  ["non-positive scale", input => {
    input.coordinateSystem.localToBinaryImage.scaleY = 0;
  }]
])("rejects invalid coordinate declarations: %s", (_label, mutate) => {
  const input = createUnavailableInput();
  mutate(input);

  expect(() => createGridReconstruction(input)).toThrow();
});

test("preserves an explicit coordinate declaration verbatim", () => {
  const input = createUnavailableInput();
  input.coordinateSystem = {
    ...createCoordinateSystem(),
    space: "rendered-binary-image-pixels",
    localToBinaryImage: {
      offsetX: 0,
      offsetY: 0,
      scaleX: 1,
      scaleY: 1
    }
  };
  input.observedBounds.coordinateSpace = "rendered-binary-image-pixels";

  expect(createGridReconstruction(input).coordinateSystem)
    .toEqual(input.coordinateSystem);
});

test.each([
  ["empty strategy id", input => { input.parameters.strategyId = ""; }],
  ["invalid candidate minimum", input => {
    input.parameters.minimumObservedCandidatesPerAxis = 0;
  }],
  ["reversed interval range", input => {
    input.parameters.permittedIntervalCount = { minimum: 10, maximum: 2 };
  }],
  ["invalid spacing", input => {
    input.parameters.permittedCellSpacing.minimum = 0;
  }],
  ["invalid inferred fraction", input => {
    input.parameters.maximumInferredLineFraction = 1.1;
  }],
  ["invalid tolerance", input => {
    input.parameters.candidateAlignmentTolerancePx = -0.5;
  }],
  ["invalid quantum", input => { input.parameters.positionQuantum = 0; }],
  ["invalid hypothesis limit", input => {
    input.parameters.maximumHypothesisCount = 0;
  }]
])("rejects invalid explicit parameters: %s", (_label, mutate) => {
  const input = createUnavailableInput();
  mutate(input);

  expect(() => createGridReconstruction(input)).toThrow();
});

test("creates the unavailable result contract", () => {
  const result = createGridReconstruction(createUnavailableInput());

  expect(result).toMatchObject({
    status: "unavailable",
    axes: {
      horizontal: { status: "unavailable", hypotheses: [] },
      vertical: { status: "unavailable", hypotheses: [] }
    },
    gridHypotheses: [],
    reasons: ["strategy-not-run"]
  });
});

test("creates the partial result contract without inventing a grid", () => {
  const input = createUnavailableInput();
  input.status = "partial";
  input.axes.horizontal = {
    status: "available",
    hypotheses: [createAxisHypothesis("horizontal-hypothesis-001", 10)]
  };
  input.reasons = ["vertical-reconstruction-unavailable"];

  const result = createGridReconstruction(input);

  expect(result.status).toBe("partial");
  expect(result.axes.horizontal.hypotheses).toHaveLength(1);
  expect(result.axes.vertical.status).toBe("unavailable");
  expect(result.gridHypotheses).toEqual([]);
});

test("creates the ambiguous result contract without selecting a hypothesis", () => {
  const input = createUnavailableInput();
  input.status = "ambiguous";
  input.axes = {
    horizontal: {
      status: "ambiguous",
      hypotheses: [
        createAxisHypothesis("horizontal-hypothesis-001", 10),
        createAxisHypothesis("horizontal-hypothesis-002", 12)
      ]
    },
    vertical: {
      status: "available",
      hypotheses: [createAxisHypothesis("vertical-hypothesis-001", 5)]
    }
  };
  input.reasons = ["multiple-spacing-hypotheses"];

  const result = createGridReconstruction(input);

  expect(result.status).toBe("ambiguous");
  expect(result.axes.horizontal.hypotheses.map(hypothesis => hypothesis.id))
    .toEqual(["horizontal-hypothesis-001", "horizontal-hypothesis-002"]);
  expect(result.gridHypotheses).toEqual([]);
});

test("rejects inconsistent status contracts", () => {
  const unavailableWithoutReason = createUnavailableInput();
  unavailableWithoutReason.reasons = [];
  expect(() => createGridReconstruction(unavailableWithoutReason))
    .toThrow("requires at least one reason");

  const partialWithNoAxis = createUnavailableInput();
  partialWithNoAxis.status = "partial";
  partialWithNoAxis.reasons = ["incomplete"];
  expect(() => createGridReconstruction(partialWithNoAxis))
    .toThrow("exactly one available axis");

  const availableWithoutGrid = createUnavailableInput();
  availableWithoutGrid.status = "available";
  availableWithoutGrid.reasons = [];
  expect(() => createGridReconstruction(availableWithoutGrid))
    .toThrow("Available reconstruction requires");
});

test("contains no evaluation or automatic-selection fields", () => {
  const result = createGridReconstruction(createAvailableInput());
  const normalizedKeys = collectKeys(result).map(normalizeKey);

  expect(normalizedKeys).not.toEqual(expect.arrayContaining([
    "score",
    "confidence",
    "rank",
    "ranking",
    "recommendation",
    "winner",
    "selection",
    "selectedhypothesis",
    "preferredhypothesis",
    "selectedregion",
    "preferredregion"
  ]));

  for (const field of [
    "score",
    "confidence",
    "rank",
    "recommendation",
    "selection",
    "selectedHypothesis",
    "preferredHypothesis"
  ]) {
    const input = createUnavailableInput();
    input.diagnostics = [{ type: "invalid-evaluation", [field]: 1 }];
    expect(() => createGridReconstruction(input)).toThrow("is not allowed");
  }
});

test("has no runtime dependency on annotation artifacts or detection", () => {
  const source = fs.readFileSync(require.resolve("./GridReconstruction"), "utf8");

  expect(source).not.toMatch(/groundTruth|grid-ground-truth/i);
  expect(source).not.toMatch(
    /from\s+["'][^"']*BinaryImage|findLineCandidates|buildGridGeometry/
  );
});

function createAvailableInput() {
  const horizontal = createAxisHypothesis("horizontal-hypothesis-001", 10);
  const vertical = createAxisHypothesis("vertical-hypothesis-001", 5);

  return {
    ...createBaseInput(),
    status: "available",
    assumptions: [
      { id: "uniform-orthogonal-lattice", status: "applied" }
    ],
    axes: {
      horizontal: { status: "available", hypotheses: [horizontal] },
      vertical: { status: "available", hypotheses: [vertical] }
    },
    gridHypotheses: [createGridHypothesis(horizontal, vertical)],
    diagnostics: [
      { type: "grid-reconstruction-contract", status: "available" }
    ],
    reasons: []
  };
}

function createUnavailableInput({ availableBounds = false } = {}) {
  return {
    ...createBaseInput(),
    observedBounds: availableBounds
      ? createObservedBounds()
      : createUnavailableBounds(),
    status: "unavailable",
    assumptions: [],
    axes: {
      horizontal: { status: "unavailable", hypotheses: [] },
      vertical: { status: "unavailable", hypotheses: [] }
    },
    gridHypotheses: [],
    diagnostics: [
      { type: "grid-reconstruction-contract", status: "unavailable" }
    ],
    reasons: ["strategy-not-run"]
  };
}

function createBaseInput() {
  return {
    candidateEvidence: {
      analysisRegionId: "shadow-region-001",
      acceptancePolicy: {
        source: "grid-analysis-line-candidates",
        parameters: { minimumCoverageRatio: 0.8 }
      },
      horizontal: [
        createCandidate("horizontal", 10),
        createCandidate("horizontal", 20)
      ],
      vertical: [
        createCandidate("vertical", 5),
        createCandidate("vertical", 15)
      ]
    },
    observedBounds: createObservedBounds(),
    spacingEvidence: createSpacingEvidence(),
    coordinateSystem: createCoordinateSystem(),
    parameters: createParameters()
  };
}

function createCandidate(axis, position, extra = {}) {
  return {
    axis,
    start: position,
    end: position,
    position,
    thickness: 1,
    strength: 80,
    averageStrength: 80,
    ...extra
  };
}

function createCandidateEvidenceRawCandidates() {
  const evidence = createBaseInput().candidateEvidence;
  return {
    horizontal: evidence.horizontal,
    vertical: evidence.vertical
  };
}

function createObservedBounds() {
  return {
    status: "available",
    coordinateSpace: "analysis-region-local",
    semantics: "outer-line-center-envelope",
    value: { top: 10, left: 5, width: 10, height: 10 },
    components: {
      top: { status: "observed", provenance: "candidate-envelope" },
      left: { status: "observed", provenance: "candidate-envelope" },
      width: { status: "observed", provenance: "candidate-envelope" },
      height: { status: "observed", provenance: "candidate-envelope" }
    }
  };
}

function createUnavailableBounds() {
  return {
    status: "unavailable",
    coordinateSpace: "analysis-region-local",
    semantics: "outer-line-center-envelope",
    value: null,
    reason: "observed-bounds-unavailable"
  };
}

function createSpacingEvidence() {
  return {
    horizontal: [
      { type: "spacing-consistency", status: "measured", average: 10 }
    ],
    vertical: [
      { type: "spacing-consistency", status: "measured", average: 10 }
    ]
  };
}

function createCoordinateSystem() {
  return {
    space: "analysis-region-local",
    origin: "top-left",
    xDirection: "right",
    yDirection: "down",
    linePosition: "visual-line-center",
    localToBinaryImage: {
      offsetX: 20,
      offsetY: 30,
      scaleX: 1,
      scaleY: 1
    }
  };
}

function createParameters() {
  return {
    strategyId: "uniform-orthogonal-lattice",
    minimumObservedCandidatesPerAxis: 2,
    permittedIntervalCount: { minimum: 1, maximum: 100 },
    permittedCellSpacing: { minimum: 1, maximum: 200 },
    maximumSkippedIntervalsBetweenCandidates: 10,
    maximumConsecutiveInferredLines: 20,
    maximumInferredLineFraction: 0.9,
    candidateAlignmentTolerancePx: 1,
    boundsAlignmentTolerancePx: 1,
    positionQuantum: 0.5,
    maximumHypothesisCount: 100
  };
}

function createAxisHypothesis(id, origin) {
  return {
    id,
    intervalCount: 1,
    origin,
    spacing: 10,
    lines: [
      createReconstructedLine(0, origin, 0),
      createReconstructedLine(1, origin + 10, 1)
    ],
    candidateAssignments: [
      { candidateIndex: 0, lineIndex: 0, delta: 0 },
      { candidateIndex: 1, lineIndex: 1, delta: 0 }
    ],
    diagnostics: [
      { type: "axis-reconstruction-contract", intervalCount: 1 }
    ]
  };
}

function createReconstructedLine(index, position, candidateIndex) {
  return {
    index,
    position,
    evidence: {
      status: "observed-aligned",
      candidateIndex,
      observedPosition: position,
      delta: 0
    }
  };
}

function createGridHypothesis(horizontal, vertical) {
  return {
    id: "grid-hypothesis-001",
    horizontalHypothesisId: horizontal.id,
    verticalHypothesisId: vertical.id,
    rows: 1,
    cols: 1,
    bounds: { top: 10, left: 5, width: 10, height: 10 },
    lines: {
      horizontal: horizontal.lines,
      vertical: vertical.lines
    },
    candidateAssignments: {
      horizontal: horizontal.candidateAssignments,
      vertical: vertical.candidateAssignments
    },
    diagnostics: [
      { type: "grid-hypothesis-contract", rows: 1, cols: 1 }
    ]
  };
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
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

function normalizeKey(key) {
  return key.replace(/[-_]/g, "").toLowerCase();
}
