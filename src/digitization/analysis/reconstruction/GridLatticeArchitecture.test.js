import fs from "fs";
import path from "path";
import { createGridLattice } from "./GridLattice";
import { createGridLatticeCandidate } from "./GridLatticeCandidate";
import { createGridLatticeConfidence } from "./GridLatticeConfidence";
import { createGridLatticeEvidence } from "./GridLatticeEvidence";

test("creates the four production-independent Grid Lattice artifacts", () => {
  const evidence = createGridLatticeEvidence(createEvidenceInput());
  const candidate = createGridLatticeCandidate(createCandidateInput());
  const lattice = createGridLattice(createLatticeInput());
  const confidence = createGridLatticeConfidence(createConfidenceInput());

  expect(evidence).toEqual(expect.objectContaining({
    type: "grid-lattice-evidence",
    version: 1,
    id: "evidence-001",
    status: "available"
  }));
  expect(candidate).toEqual(expect.objectContaining({
    type: "grid-lattice-candidate",
    version: 1,
    evidenceId: "evidence-001"
  }));
  expect(lattice).toEqual(expect.objectContaining({
    type: "grid-lattice",
    version: 1,
    sourceCandidateId: "candidate-001"
  }));
  expect(confidence).toEqual(expect.objectContaining({
    type: "grid-lattice-confidence",
    version: 1,
    candidateId: "candidate-001"
  }));
});

test("preserves evidence, candidate and assessment order without selecting among them", () => {
  const evidenceInput = createEvidenceInput();
  evidenceInput.axes.horizontal.positions = [2.5, 8, 19.5];
  evidenceInput.evidenceReferences = ["run:z", "run:a"];
  const candidateInput = createCandidateInput();
  candidateInput.axes.horizontal.assignments = [
    { evidenceReference: "run:z", latticeIndex: 0, residual: 0.5 },
    { evidenceReference: "run:a", latticeIndex: 2, residual: -0.5 }
  ];
  const confidenceInput = createConfidenceInput();
  confidenceInput.assessments = [
    createAssessment("spacing-support", "supports"),
    createAssessment("bounds-contradiction", "contradicts")
  ];

  const evidence = createGridLatticeEvidence(evidenceInput);
  const candidate = createGridLatticeCandidate(candidateInput);
  const confidence = createGridLatticeConfidence(confidenceInput);

  expect(evidence.axes.horizontal.positions).toEqual([2.5, 8, 19.5]);
  expect(evidence.evidenceReferences).toEqual(["run:z", "run:a"]);
  expect(candidate.axes.horizontal.assignments.map(value => value.evidenceReference))
    .toEqual(["run:z", "run:a"]);
  expect(confidence.assessments.map(value => value.id))
    .toEqual(["spacing-support", "bounds-contradiction"]);
  expect(collectKeys([evidence, candidate, confidence])).not.toEqual(
    expect.arrayContaining(["selection", "selectedCandidate", "preferredCandidate"])
  );
});

test("accepts frozen inputs, does not mutate them and deeply freezes defensive copies", () => {
  const inputs = [
    createEvidenceInput(),
    createCandidateInput(),
    createLatticeInput(),
    createConfidenceInput()
  ].map(deepFreeze);
  const before = inputs.map(value => JSON.stringify(value));
  const results = [
    createGridLatticeEvidence(inputs[0]),
    createGridLatticeCandidate(inputs[1]),
    createGridLattice(inputs[2]),
    createGridLatticeConfidence(inputs[3])
  ];

  expect(inputs.map(value => JSON.stringify(value))).toEqual(before);
  results.forEach((result, index) => {
    expect(result).not.toBe(inputs[index]);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.provenance)).toBe(true);
  });
  expect(Object.isFrozen(results[0].axes.horizontal.positions)).toBe(true);
  expect(Object.isFrozen(results[1].axes.horizontal.assignments[0])).toBe(true);
  expect(Object.isFrozen(results[2].extent.bounds)).toBe(true);
  expect(Object.isFrozen(results[3].assessments[0].observation)).toBe(true);
});

test("canonicalizes object properties deterministically while preserving array order", () => {
  const first = createEvidenceInput();
  const second = createEvidenceInput();
  first.provenance = { source: "fixture", phase: "13.1" };
  second.provenance = { phase: "13.1", source: "fixture" };
  first.diagnostics = [{ z: 1, a: 2 }];
  second.diagnostics = [{ a: 2, z: 1 }];

  const firstResult = createGridLatticeEvidence(first);
  const secondResult = createGridLatticeEvidence(second);

  expect(secondResult).toEqual(firstResult);
  expect(JSON.stringify(secondResult)).toBe(JSON.stringify(firstResult));
});

test.each([
  ["evidence axis mismatch", createGridLatticeEvidence, createEvidenceInput, input => {
    input.axes.horizontal.axis = "vertical";
  }],
  ["unsorted evidence positions", createGridLatticeEvidence, createEvidenceInput, input => {
    input.axes.horizontal.positions = [10, 5];
  }],
  ["invalid evidence bounds", createGridLatticeEvidence, createEvidenceInput, input => {
    input.boundsObservation.bounds.width = 0;
  }],
  ["candidate coordinate system", createGridLatticeCandidate, createCandidateInput, input => {
    input.coordinateSystem.origin = "bottom-left";
  }],
  ["candidate period", createGridLatticeCandidate, createCandidateInput, input => {
    input.axes.vertical.period = 0;
  }],
  ["lattice extent coordinate space", createGridLattice, createLatticeInput, input => {
    input.extent.coordinateSpace = "document-pixels";
  }],
  ["lattice extent dimensions", createGridLattice, createLatticeInput, input => {
    input.extent.bounds.height = -1;
  }],
  ["duplicate assessment ids", createGridLatticeConfidence, createConfidenceInput, input => {
    input.assessments.push(createAssessment("candidate-alignment", "neutral"));
  }],
  ["unavailable assessment relation", createGridLatticeConfidence, createConfidenceInput, input => {
    input.assessments[0].status = "unavailable";
  }]
])("rejects invalid contract input: %s", (_label, creator, fixture, mutate) => {
  const input = fixture();
  mutate(input);
  expect(() => creator(input)).toThrow();
});

test.each(["partial", "ambiguous", "unavailable"])(
  "preserves the explicit %s artifact state without inventing reconstruction",
  status => {
    const input = createEvidenceInput();
    input.status = status;
    input.reasons = status === "unavailable" ? ["evidence-not-observed"] : [];
    if (status === "unavailable") {
      input.axes.horizontal = createUnavailableEvidenceAxis("horizontal");
      input.axes.vertical = createUnavailableEvidenceAxis("vertical");
      input.boundsObservation = createUnavailableBoundsObservation();
    }

    const result = createGridLatticeEvidence(input);
    expect(result.status).toBe(status);
    expect(result.reasons).toEqual(input.reasons);
  }
);

test("represents unavailable candidate and lattice axes without inferred values", () => {
  const candidateInput = createCandidateInput();
  candidateInput.status = "partial";
  candidateInput.axes.vertical = createUnavailableModeledAxis("vertical", true);
  const latticeInput = createLatticeInput();
  latticeInput.status = "partial";
  latticeInput.axes.vertical = createUnavailableModeledAxis("vertical", false);
  latticeInput.extent = {
    status: "unavailable",
    coordinateSpace: "analysis-region-local",
    bounds: null
  };

  expect(createGridLatticeCandidate(candidateInput).axes.vertical).toMatchObject({
    status: "unavailable",
    origin: null,
    period: null
  });
  expect(createGridLattice(latticeInput).extent.bounds).toBeNull();
});

test.each([
  "score",
  "confidence",
  "rank",
  "ranking",
  "recommendation",
  "selection",
  "selectedCandidate",
  "preferred_candidate"
])("rejects forbidden evaluation field %s recursively", field => {
  const input = createCandidateInput();
  input.diagnostics[0][field] = "forbidden";

  expect(() => createGridLatticeCandidate(input)).toThrow(`${field} is not allowed`);
});

test("remains independent of dimensions, crossword type, algorithms and validation", () => {
  const artifacts = [
    createGridLatticeEvidence(createEvidenceInput()),
    createGridLatticeCandidate(createCandidateInput()),
    createGridLattice(createLatticeInput()),
    createGridLatticeConfidence(createConfidenceInput())
  ];
  const forbiddenArchitectureKeys = [
    "rows",
    "cols",
    "crosswordType",
    "algorithm",
    "validation",
    "groundTruth"
  ];

  expect(collectKeys(artifacts)).not.toEqual(
    expect.arrayContaining(forbiddenArchitectureKeys)
  );

  const moduleDirectory = path.dirname(require.resolve("./GridLattice"));
  const sources = [
    "GridLattice.js",
    "GridLatticeCandidate.js",
    "GridLatticeConfidence.js",
    "GridLatticeEvidence.js",
    "GridLatticeModelSupport.js"
  ].map(filename => fs.readFileSync(path.join(moduleDirectory, filename), "utf8"));
  expect(sources.join("\n")).not.toMatch(
    /GroundTruth|detectGrid|GridAnalysis|UniformOrthogonalLatticeStrategy|experiments\//
  );
});

function createCoordinateSystem() {
  return {
    space: "analysis-region-local",
    unit: "pixel",
    origin: "top-left",
    xDirection: "right",
    yDirection: "down",
    linePosition: "visual-line-center"
  };
}

function createEvidenceInput() {
  return {
    id: "evidence-001",
    status: "available",
    coordinateSystem: createCoordinateSystem(),
    axes: {
      horizontal: createEvidenceAxis("horizontal", [10.5, 20.5]),
      vertical: createEvidenceAxis("vertical", [5, 15])
    },
    boundsObservation: {
      status: "available",
      semantics: "outer-line-center-envelope",
      coordinateSpace: "analysis-region-local",
      bounds: { top: 10.5, left: 5, width: 10, height: 10 },
      provenance: { source: "synthetic-candidate-envelope" },
      evidenceReferences: ["bounds:accepted-candidates"]
    },
    provenance: { source: "synthetic-fixture" },
    evidenceReferences: ["projection:horizontal", "projection:vertical"],
    diagnostics: [{ code: "evidence-preserved" }],
    reasons: []
  };
}

function createEvidenceAxis(axis, positions) {
  return {
    status: "available",
    axis,
    positions,
    spacingObservations: [{ from: positions[0], to: positions[1], difference: 10 }],
    evidenceReferences: [`projection:${axis}`],
    diagnostics: []
  };
}

function createUnavailableEvidenceAxis(axis) {
  return {
    status: "unavailable",
    axis,
    positions: [],
    spacingObservations: [],
    evidenceReferences: [],
    diagnostics: []
  };
}

function createUnavailableBoundsObservation() {
  return {
    status: "unavailable",
    semantics: "outer-line-center-envelope",
    coordinateSpace: "analysis-region-local",
    bounds: null,
    provenance: { source: "not-observed" },
    evidenceReferences: []
  };
}

function createCandidateInput() {
  return {
    id: "candidate-001",
    status: "available",
    evidenceId: "evidence-001",
    coordinateSystem: createCoordinateSystem(),
    axes: {
      horizontal: createCandidateAxis("horizontal", 10.5, 10),
      vertical: createCandidateAxis("vertical", 5, 10)
    },
    evidenceReferences: ["evidence-001"],
    assumptions: [{ code: "uniform-axis-period" }],
    provenance: { source: "synthetic-candidate-generator" },
    diagnostics: [{ code: "candidate-preserved" }],
    reasons: []
  };
}

function createCandidateAxis(axis, origin, period) {
  return {
    status: "available",
    axis,
    origin,
    period,
    assignments: [{ evidenceReference: `projection:${axis}`, latticeIndex: 0, residual: 0 }],
    evidenceReferences: [`projection:${axis}`],
    diagnostics: []
  };
}

function createLatticeInput() {
  return {
    id: "lattice-001",
    status: "available",
    sourceCandidateId: "candidate-001",
    coordinateSystem: createCoordinateSystem(),
    axes: {
      horizontal: createLatticeAxis("horizontal", 10.5, 10),
      vertical: createLatticeAxis("vertical", 5, 10)
    },
    extent: {
      status: "available",
      coordinateSpace: "analysis-region-local",
      bounds: { top: 10.5, left: 5, width: 10, height: 10 }
    },
    assumptions: [{ code: "orthogonal-lattice" }],
    provenance: { source: "synthetic-domain-fixture" },
    diagnostics: [],
    reasons: []
  };
}

function createLatticeAxis(axis, origin, period) {
  return { status: "available", axis, origin, period, diagnostics: [] };
}

function createUnavailableModeledAxis(axis, includeCandidateFields) {
  return {
    status: "unavailable",
    axis,
    origin: null,
    period: null,
    ...(includeCandidateFields ? {
      assignments: [],
      evidenceReferences: []
    } : {}),
    diagnostics: []
  };
}

function createConfidenceInput() {
  return {
    id: "confidence-observations-001",
    status: "available",
    candidateId: "candidate-001",
    assessments: [createAssessment("candidate-alignment", "supports")],
    evidenceReferences: ["evidence-001"],
    provenance: { source: "synthetic-assessment" },
    diagnostics: [],
    reasons: []
  };
}

function createAssessment(id, relation) {
  return {
    id,
    status: "available",
    relation,
    evidenceReferences: ["evidence-001"],
    observation: { relationOnly: true },
    diagnostics: []
  };
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
