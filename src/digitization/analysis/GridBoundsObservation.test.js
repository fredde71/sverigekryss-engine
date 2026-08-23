import fs from "fs";
import { createGridBoundsObservation } from "./GridBoundsObservation";

test("creates an available grid-bounds observation artifact", () => {
  const input = createInput();
  const result = createGridBoundsObservation(input);

  expect(result).toEqual({
    type: "grid-bounds-observation",
    version: 1,
    analysisRegionId: "shadow-region-001",
    status: "available",
    coordinateSystem: input.coordinateSystem,
    provenance: input.provenance,
    sourceAcceptedCandidateEnvelope: input.sourceAcceptedCandidateEnvelope,
    observations: input.observations,
    reasons: [],
    diagnostics: input.diagnostics
  });
});

test("preserves source bounds, coordinate declarations and provenance exactly", () => {
  const input = createInput();
  const result = createGridBoundsObservation(input);

  expect(result.sourceAcceptedCandidateEnvelope.bounds).toEqual({
    top: 10.5,
    left: 20,
    width: 300.5,
    height: 400
  });
  expect(result.coordinateSystem).toEqual(input.coordinateSystem);
  expect(result.provenance).toEqual(input.provenance);
  expect(result.observations[0].provenance)
    .toEqual(input.observations[0].provenance);
  expect(result.observations[0].evidenceReferences)
    .toEqual(input.observations[0].evidenceReferences);
  expect(result.observations[0].assumptions)
    .toEqual(input.observations[0].assumptions);
  expect(result.observations[0].reasons)
    .toEqual(input.observations[0].reasons);
  expect(result.observations[0].diagnostics)
    .toEqual(input.observations[0].diagnostics);
});

test("creates a partial result with one incomplete observation", () => {
  const input = createInput();
  input.status = "partial";
  input.observations = [createObservation({
    id: "partial-envelope",
    status: "partial",
    bounds: { top: 8, left: null, width: null, height: 405 }
  })];
  const result = createGridBoundsObservation(input);

  expect(result.status).toBe("partial");
  expect(result.observations).toEqual(input.observations);
});

test("creates an ambiguous result and preserves observation order", () => {
  const input = createInput();
  input.status = "ambiguous";
  input.observations = [
    createObservation({ id: "envelope-z" }),
    createObservation({
      id: "envelope-a",
      bounds: { top: 9, left: 19.5, width: 302, height: 402 }
    })
  ];
  const result = createGridBoundsObservation(input);

  expect(result.status).toBe("ambiguous");
  expect(result.observations.map(observation => observation.id))
    .toEqual(["envelope-z", "envelope-a"]);
});

test("creates an unavailable result with no proposed observations", () => {
  const input = createInput();
  input.status = "unavailable";
  input.observations = [];
  input.reasons = [{ code: "outer-grid-envelope-not-observed" }];
  const result = createGridBoundsObservation(input);

  expect(result).toMatchObject({
    status: "unavailable",
    observations: [],
    reasons: [{ code: "outer-grid-envelope-not-observed" }]
  });
  expect(result.sourceAcceptedCandidateEnvelope.bounds)
    .toEqual(input.sourceAcceptedCandidateEnvelope.bounds);
});

test.each([
  ["available without exactly one complete observation", input => {
    input.observations = [];
  }],
  ["partial without exactly one partial observation", input => {
    input.status = "partial";
  }],
  ["ambiguous without multiple observations", input => {
    input.status = "ambiguous";
  }],
  ["unavailable with an observation", input => {
    input.status = "unavailable";
    input.reasons = [{ code: "unavailable" }];
  }],
  ["unavailable without a reason", input => {
    input.status = "unavailable";
    input.observations = [];
  }]
])("rejects inconsistent result status: %s", (_label, mutate) => {
  const input = createInput();
  mutate(input);

  expect(() => createGridBoundsObservation(input)).toThrow();
});

test.each([
  ["empty analysis region id", input => { input.analysisRegionId = ""; }],
  ["wrong source semantics", input => {
    input.sourceAcceptedCandidateEnvelope.semantics = "outer-line-center-envelope";
  }],
  ["source coordinate mismatch", input => {
    input.sourceAcceptedCandidateEnvelope.coordinateSpace = "document-pixels";
  }],
  ["invalid source bounds", input => {
    input.sourceAcceptedCandidateEnvelope.bounds.width = 0;
  }],
  ["invalid source unavailable state", input => {
    input.sourceAcceptedCandidateEnvelope.status = "unavailable";
  }],
  ["duplicate observation ids", input => {
    input.status = "ambiguous";
    input.observations.push(createObservation({ id: "outer-envelope-001" }));
  }],
  ["wrong observation semantics", input => {
    input.observations[0].semantics = "accepted-candidate-envelope";
  }],
  ["observation coordinate mismatch", input => {
    input.observations[0].coordinateSpace = "document-pixels";
  }],
  ["non-finite observation bounds", input => {
    input.observations[0].bounds.top = Number.NaN;
  }],
  ["complete partial bounds", input => {
    input.status = "partial";
    input.observations[0].status = "partial";
  }],
  ["missing evidence references", input => {
    delete input.observations[0].evidenceReferences;
  }]
])("rejects invalid contract input: %s", (_label, mutate) => {
  const input = createInput();
  mutate(input);

  expect(() => createGridBoundsObservation(input)).toThrow();
});

test("accepts an unavailable source candidate envelope", () => {
  const input = createInput();
  input.status = "unavailable";
  input.observations = [];
  input.reasons = [{ code: "bounds-evidence-unavailable" }];
  input.sourceAcceptedCandidateEnvelope = {
    status: "unavailable",
    semantics: "accepted-candidate-envelope",
    coordinateSpace: "analysis-region-local",
    bounds: null,
    reason: "accepted-candidate-envelope-unavailable",
    provenance: { source: "phase-4-grid-analysis" }
  };

  expect(createGridBoundsObservation(input).sourceAcceptedCandidateEnvelope)
    .toEqual(input.sourceAcceptedCandidateEnvelope);
});

test("accepts frozen input without mutation and deeply freezes its result", () => {
  const input = deepFreeze(createInput());
  const before = JSON.stringify(input);
  const result = createGridBoundsObservation(input);

  expect(JSON.stringify(input)).toBe(before);
  expect(result).not.toBe(input);
  expect(Object.isFrozen(result)).toBe(true);
  expect(Object.isFrozen(result.sourceAcceptedCandidateEnvelope.bounds)).toBe(true);
  expect(Object.isFrozen(result.observations[0].evidenceReferences)).toBe(true);
  expect(Object.isFrozen(result.observations[0].diagnostics[0])).toBe(true);
});

test("is deterministic including canonical object property ordering", () => {
  const first = createInput();
  const second = createInput();
  first.provenance = { source: "grid-bounds-lab", method: "fixture" };
  second.provenance = { method: "fixture", source: "grid-bounds-lab" };

  const firstResult = createGridBoundsObservation(first);
  const secondResult = createGridBoundsObservation(second);

  expect(secondResult).toEqual(firstResult);
  expect(JSON.stringify(secondResult)).toBe(JSON.stringify(firstResult));
});

test.each([
  "score",
  "confidence",
  "rank",
  "ranking",
  "recommendation",
  "winner",
  "selection",
  "selectedObservation",
  "preferred_observation"
])("rejects forbidden evaluation field %s recursively", field => {
  const input = createInput();
  input.observations[0].diagnostics[0][field] = "forbidden";

  expect(() => createGridBoundsObservation(input))
    .toThrow(`${field} is not allowed`);
});

test("has no Ground Truth, BinaryImage or runtime-image dependency", () => {
  const source = fs.readFileSync(
    require.resolve("./GridBoundsObservation"),
    "utf8"
  );

  expect(source).not.toMatch(/groundTruth|grid-ground-truth/i);
  expect(source).not.toMatch(/\bbinaryImage\b|ImageData|\bcanvas\b|pdfjs/i);
  expect(source).not.toMatch(/^import /m);
});

function createInput() {
  return {
    analysisRegionId: "shadow-region-001",
    status: "available",
    sourceAcceptedCandidateEnvelope: {
      status: "available",
      semantics: "accepted-candidate-envelope",
      coordinateSpace: "analysis-region-local",
      bounds: { top: 10.5, left: 20, width: 300.5, height: 400 },
      provenance: {
        source: "phase-4-shadow-grid-geometry",
        derivation:
          "outermost-accepted-horizontal-and-vertical-candidate-positions"
      }
    },
    coordinateSystem: createCoordinateSystem(),
    provenance: {
      source: "grid-bounds-lab",
      method: "fixture"
    },
    observations: [createObservation()],
    reasons: [],
    diagnostics: [{
      type: "grid-bounds-observation-fixture",
      status: "measured"
    }]
  };
}

function createObservation({
  id = "outer-envelope-001",
  status = "available",
  bounds = { top: 8.5, left: 18, width: 304.5, height: 404 }
} = {}) {
  return {
    id,
    status,
    semantics: "outer-grid-line-center-envelope",
    coordinateSpace: "analysis-region-local",
    bounds,
    provenance: {
      source: "synthetic-grid-bounds-evidence",
      method: "fixture-observation"
    },
    evidenceReferences: [
      { type: "accepted-candidate-envelope", id: "phase-4-envelope" },
      { type: "spacing-evidence", id: "horizontal-spacing" }
    ],
    assumptions: [{ id: "fixture-assumption", status: "declared" }],
    reasons: [],
    diagnostics: [{ type: "fixture-diagnostic", status: "observed" }]
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
      offsetX: 100,
      offsetY: 200,
      scaleX: 1,
      scaleY: 1
    },
    provenance: { source: "analysis-region-coordinate-relationship" }
  };
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
