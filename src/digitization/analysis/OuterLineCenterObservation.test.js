import fs from "fs";
import {
  createOuterLineCenterObservation
} from "./OuterLineCenterObservation";

test("creates a versioned observation with deterministic edge order", () => {
  const input = createInput();
  input.edges = {
    right: input.edges.right,
    left: input.edges.left,
    bottom: input.edges.bottom,
    top: input.edges.top
  };
  const result = createOuterLineCenterObservation(input);

  expect(result).toEqual({
    type: "outer-line-center-observation",
    version: 1,
    analysisRegionId: "shadow-region-001",
    coordinateSystem: input.coordinateSystem,
    edges: {
      top: input.edges.top,
      bottom: input.edges.bottom,
      left: input.edges.left,
      right: input.edges.right
    },
    provenance: input.provenance,
    assumptions: input.assumptions,
    diagnostics: input.diagnostics,
    evidenceReferences: input.evidenceReferences
  });
  expect(Object.keys(result.edges)).toEqual(["top", "bottom", "left", "right"]);
});

test("preserves all required evidence without interpretation", () => {
  const input = createInput();
  const top = createOuterLineCenterObservation(input).edges.top;

  expect(top).toEqual(input.edges.top);
  expect(top).toMatchObject({
    acceptedCandidateCenter: 2.5,
    candidateRunGeometry: {
      axis: "horizontal",
      start: 2,
      end: 3,
      thickness: 2
    },
    projectionEvidence: {
      axis: "horizontal",
      samples: [
        { position: 1.5, value: 91 },
        { position: 2.5, value: 120 }
      ]
    },
    continuityObservations: [
      { position: 2, continuousPixelCount: 115 },
      { position: 3, continuousPixelCount: 117 }
    ],
    neighborhoodObservationExtent: {
      coordinateSpace: "analysis-region-local",
      axis: "horizontal",
      start: -2,
      end: 7
    }
  });
});

test.each([
  ["available", edge => edge],
  ["partial", edge => ({
    ...edge,
    status: "partial",
    projectionEvidence: null,
    reasons: [{ code: "projection-evidence-unavailable" }]
  })],
  ["ambiguous", edge => ({
    ...edge,
    status: "ambiguous",
    reasons: [{ code: "multiple-local-evidence-peaks" }]
  })],
  ["unavailable", edge => ({
    ...edge,
    status: "unavailable",
    acceptedCandidateCenter: null,
    candidateRunGeometry: null,
    projectionEvidence: null,
    continuityObservations: [],
    neighborhoodObservationExtent: null,
    reasons: [{ code: "outer-candidate-unavailable" }]
  })]
])("supports an independently %s edge", (status, update) => {
  const input = createInput();
  input.edges.right = update(input.edges.right);
  const result = createOuterLineCenterObservation(input);

  expect(result.edges.right.status).toBe(status);
});

test("preserves array order throughout edge and artifact evidence", () => {
  const input = createInput();
  input.edges.top.continuityObservations = [
    { id: "z", position: 3 },
    { id: "a", position: 2 }
  ];
  input.edges.top.evidenceReferences = [
    { id: "candidate-z" },
    { id: "projection-a" }
  ];
  input.diagnostics = [{ id: "diagnostic-z" }, { id: "diagnostic-a" }];
  const result = createOuterLineCenterObservation(input);

  expect(result.edges.top.continuityObservations.map(item => item.id))
    .toEqual(["z", "a"]);
  expect(result.edges.top.evidenceReferences.map(item => item.id))
    .toEqual(["candidate-z", "projection-a"]);
  expect(result.diagnostics.map(item => item.id))
    .toEqual(["diagnostic-z", "diagnostic-a"]);
});

test.each([
  ["missing edge", input => { delete input.edges.left; }],
  ["additional edge", input => { input.edges.center = input.edges.left; }],
  ["mismatched edge identity", input => { input.edges.top.edge = "bottom"; }],
  ["invalid status", input => { input.edges.top.status = "measured"; }],
  ["non-finite center", input => {
    input.edges.top.acceptedCandidateCenter = Number.NaN;
  }],
  ["non-deterministic projection", input => {
    input.edges.top.projectionEvidence.read = () => 1;
  }],
  ["available evidence is incomplete", input => {
    input.edges.top.continuityObservations = [];
  }],
  ["partial evidence is empty", input => {
    input.edges.top = createUnavailableEdge("top");
    input.edges.top.status = "partial";
  }],
  ["ambiguous edge lacks center", input => {
    input.edges.top.status = "ambiguous";
    input.edges.top.acceptedCandidateCenter = null;
    input.edges.top.reasons = [{ code: "ambiguous" }];
  }],
  ["unavailable edge lacks reason", input => {
    input.edges.top = createUnavailableEdge("top");
    input.edges.top.reasons = [];
  }],
  ["invalid coordinate transform", input => {
    input.coordinateSystem.localToBinaryImage.scaleY = 0;
  }]
])("rejects invalid contract input: %s", (_label, mutate) => {
  const input = createInput();
  mutate(input);

  expect(() => createOuterLineCenterObservation(input)).toThrow();
});

test("accepts frozen input without mutation and deeply freezes its output", () => {
  const input = deepFreeze(createInput());
  const before = JSON.stringify(input);
  const result = createOuterLineCenterObservation(input);

  expect(JSON.stringify(input)).toBe(before);
  expect(result).not.toBe(input);
  expect(Object.isFrozen(result)).toBe(true);
  expect(Object.isFrozen(result.edges.top)).toBe(true);
  expect(Object.isFrozen(result.edges.top.projectionEvidence.samples)).toBe(true);
  expect(Object.isFrozen(result.edges.right.diagnostics[0])).toBe(true);
});

test("is deterministic including canonical nested object ordering", () => {
  const first = createInput();
  const second = createInput();

  first.provenance = { source: "outer-line-lab", method: "fixture" };
  second.provenance = { method: "fixture", source: "outer-line-lab" };
  second.edges.top.projectionEvidence = {
    samples: second.edges.top.projectionEvidence.samples,
    axis: "horizontal"
  };

  const firstResult = createOuterLineCenterObservation(first);
  const secondResult = createOuterLineCenterObservation(second);

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
  input.edges.bottom.diagnostics[0].nested = { [field]: "forbidden" };

  expect(() => createOuterLineCenterObservation(input))
    .toThrow(`${field} is not allowed`);
});

test("is dependency-free and has no Ground Truth or runtime-image access", () => {
  const source = fs.readFileSync(
    require.resolve("./OuterLineCenterObservation"),
    "utf8"
  );

  expect(source).not.toMatch(/^import /m);
  expect(source).not.toMatch(/groundTruth|grid-ground-truth/i);
  expect(source).not.toMatch(/\bbinaryImage\b|ImageData|\bcanvas\b|pdfjs/i);
});

function createInput() {
  return {
    analysisRegionId: "shadow-region-001",
    coordinateSystem: {
      space: "analysis-region-local",
      origin: "top-left",
      xDirection: "right",
      yDirection: "down",
      linePosition: "visual-line-center",
      localToBinaryImage: {
        offsetX: 50,
        offsetY: 287,
        scaleX: 1,
        scaleY: 1
      },
      provenance: { source: "analysis-region" }
    },
    edges: {
      top: createAvailableEdge("top", 2.5),
      bottom: createAvailableEdge("bottom", 401.5),
      left: createAvailableEdge("left", 1),
      right: createAvailableEdge("right", 303)
    },
    provenance: {
      source: "outer-line-center-observation-fixture",
      providerId: "provider-a"
    },
    assumptions: [{
      id: "accepted-candidate-represents-outer-grid-line",
      status: "observed-only"
    }],
    diagnostics: [{
      type: "outer-line-center-observation-fixture",
      status: "measured"
    }],
    evidenceReferences: [{
      type: "accepted-candidate-envelope",
      providerId: "provider-a"
    }]
  };
}

function createAvailableEdge(edge, center) {
  const horizontal = edge === "top" || edge === "bottom";

  return {
    edge,
    status: "available",
    acceptedCandidateCenter: center,
    candidateRunGeometry: {
      axis: horizontal ? "horizontal" : "vertical",
      start: Math.floor(center),
      end: Math.ceil(center),
      thickness: Math.ceil(center) - Math.floor(center) + 1
    },
    projectionEvidence: {
      axis: horizontal ? "horizontal" : "vertical",
      samples: [
        { position: center - 1, value: 91 },
        { position: center, value: 120 }
      ]
    },
    continuityObservations: [
      { position: Math.floor(center), continuousPixelCount: 115 },
      { position: Math.ceil(center), continuousPixelCount: 117 }
    ],
    neighborhoodObservationExtent: {
      coordinateSpace: "analysis-region-local",
      axis: horizontal ? "horizontal" : "vertical",
      start: center - 4.5,
      end: center + 4.5
    },
    provenance: { source: "fixture", edge },
    assumptions: [{ id: "no-center-refinement", status: "applied" }],
    diagnostics: [{ type: "edge-evidence", edge }],
    evidenceReferences: [{ type: "line-candidate", edge }],
    reasons: []
  };
}

function createUnavailableEdge(edge) {
  return {
    edge,
    status: "unavailable",
    acceptedCandidateCenter: null,
    candidateRunGeometry: null,
    projectionEvidence: null,
    continuityObservations: [],
    neighborhoodObservationExtent: null,
    provenance: { source: "fixture", edge },
    assumptions: [],
    diagnostics: [],
    evidenceReferences: [],
    reasons: [{ code: "outer-candidate-unavailable" }]
  };
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
