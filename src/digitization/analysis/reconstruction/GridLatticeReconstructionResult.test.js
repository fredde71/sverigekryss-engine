import fs from "fs";
import path from "path";
import { createGridLatticeEvidence } from "./GridLatticeEvidence";
import {
  generateGridLatticeCandidates
} from "./GridLatticeCandidateGeneration";
import {
  fuseGridLatticeCandidateEvidence
} from "./GridLatticeEvidenceFusion";
import {
  selectGridLatticeCandidate
} from "./GridLatticeCandidateSelection";
import {
  createGridLatticeReconstructionResult
} from "./GridLatticeReconstructionResult";

test("materializes a selected candidate as an immutable GridLattice", () => {
  const pipeline = createPipeline({ height: 24 });
  const result = createResult(pipeline);

  expect(pipeline.selection.status).toBe("selected");
  expect(result).toMatchObject({
    type: "grid-lattice-reconstruction-result",
    version: 1,
    status: "available",
    sourceCandidateId: "grid-lattice-candidate-001",
    candidateSelectionStatus: "selected",
    reasons: []
  });
  expect(result.lattice).toMatchObject({
    type: "grid-lattice",
    version: 1,
    status: "available",
    sourceCandidateId: "grid-lattice-candidate-001",
    gridDimensions: { rows: 2, cols: 3 }
  });
  expect(result.sourceCandidate).toBeNull();
  expect(result.sourceCandidateReference).toEqual(
    pipeline.selection.selectedCandidateReference
  );
});

test("preserves origins, periods, dimensions, positions and coordinate space", () => {
  const input = createEvidenceInput();
  input.coordinateSystem.space = "rendered-binary-image-pixels";
  input.boundsObservation.coordinateSpace = "rendered-binary-image-pixels";
  input.boundsObservation.bounds = {
    top: 10.5,
    left: 5.5,
    width: 30,
    height: 20
  };
  input.axes.horizontal.positions = [10.5, 20.5, 30.5];
  input.axes.vertical.positions = [5.5, 15.5, 25.5, 35.5];
  const pipeline = createPipeline({ input });
  const result = createResult(pipeline);

  expect(result.lattice.coordinateSystem).toEqual(input.coordinateSystem);
  expect(result.lattice.gridDimensions).toEqual({ rows: 2, cols: 3 });
  expect(result.lattice.axes.horizontal).toMatchObject({
    origin: 10.5,
    period: 10,
    intervalCount: 2,
    lineCount: 3,
    positions: [10.5, 20.5, 30.5]
  });
  expect(result.lattice.axes.vertical).toMatchObject({
    origin: 5.5,
    period: 10,
    intervalCount: 3,
    lineCount: 4,
    positions: [5.5, 15.5, 25.5, 35.5]
  });
  expect(result.lattice.extent).toEqual({
    status: "available",
    semantics: "modeled-outer-line-center-envelope",
    coordinateSpace: "rendered-binary-image-pixels",
    bounds: { top: 10.5, left: 5.5, width: 30, height: 20 }
  });
});

test("preserves non-square dimensions derived by candidate generation", () => {
  const pipeline = createPipeline({
    width: 49,
    height: 21,
    horizontalPeriod: 7,
    verticalPeriod: 7
  });
  const result = createResult(pipeline);

  expect(result.status).toBe("available");
  expect(result.lattice.gridDimensions).toEqual({ rows: 3, cols: 7 });
  expect(result.lattice.axes.horizontal.positions).toHaveLength(4);
  expect(result.lattice.axes.vertical.positions).toHaveLength(8);
});

test("returns ambiguous without inventing a GridLattice", () => {
  const pipeline = createPipeline({ height: 25 });
  const result = createResult(pipeline);

  expect(pipeline.selection.status).toBe("ambiguous");
  expect(result).toMatchObject({
    status: "ambiguous",
    lattice: null,
    sourceCandidateId: null,
    sourceCandidate: null,
    candidateSelectionStatus: "ambiguous",
    reasons: ["multiple-candidates-have-identical-evidence-observations"]
  });
  expect(result.competingCandidates).toBeNull();
  expect(result.competingCandidateSpace).toEqual(
    pipeline.selection.competingCandidateSpace
  );
});

test("returns unavailable without inventing a GridLattice", () => {
  const input = createEvidenceInput();
  input.axes.vertical.status = "unavailable";
  input.axes.vertical.positions = [];
  const pipeline = createPipeline({ input });
  const result = createResult(pipeline);

  expect(pipeline.selection.status).toBe("unavailable");
  expect(result).toMatchObject({
    status: "unavailable",
    lattice: null,
    sourceCandidateId: null,
    sourceCandidate: null,
    competingCandidates: null,
    candidateSelectionStatus: "unavailable",
    reasons: ["grid-lattice-candidates-unavailable"]
  });
});

test("preserves every non-selected candidate in the factored reference space", () => {
  const pipeline = createPipeline({ height: 24 });
  const result = createResult(pipeline);

  expect(result.competingCandidates).toBeNull();
  expect(result.competingCandidateSpace).toEqual(
    pipeline.selection.competingCandidateSpace
  );
  expect(result.competingCandidateSpace.exactCandidateCount).toBe(1);
  expect(result.competingCandidateSpace.eagerlyMaterializedCandidateCount).toBe(0);
});

test("preserves complete reconstruction and selected-candidate provenance", () => {
  const pipeline = createPipeline({ height: 24 });
  const result = createResult(pipeline);
  expect(result.lattice.provenance).toEqual({
    materializer: "grid-lattice-reconstruction-result-v1",
    selectedCandidateReference: pipeline.selection.selectedCandidateReference,
    horizontalAxisCandidate:
      pipeline.generation.axisCandidates.horizontal[0].provenance,
    verticalAxisCandidate:
      pipeline.generation.axisCandidates.vertical[0].provenance,
    candidateGeneration: pipeline.generation.provenance,
    evidenceFusion: pipeline.fusion.provenance,
    candidateDecisionPolicy: pipeline.selection.decisionPolicy
  });
  expect(result.reconstructionProvenance).toMatchObject({
    materializer: "grid-lattice-reconstruction-result-v1",
    candidateGeneration: {
      type: "grid-lattice-candidate-generation",
      evidenceId: pipeline.generation.evidenceId
    },
    evidenceFusion: {
      type: "grid-lattice-evidence-fusion",
      status: pipeline.fusion.status
    },
    candidateDecision: {
      status: "selected",
      selectedCandidateId: pipeline.selection.selectedCandidateId,
      decisionPolicy: pipeline.selection.decisionPolicy
    }
  });
});

test("materialization is deterministic and does not mutate prior artifacts", () => {
  const pipeline = createPipeline({ height: 24 });
  const before = JSON.stringify(pipeline);

  const first = createResult(pipeline);
  const second = createResult(pipeline);

  expect(JSON.stringify(pipeline)).toBe(before);
  expect(second).toEqual(first);
  expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  expect(Object.isFrozen(first)).toBe(true);
  expect(Object.isFrozen(first.lattice)).toBe(true);
  expect(Object.isFrozen(first.lattice.axes.horizontal.positions)).toBe(true);
  expect(Object.isFrozen(first.reconstructionProvenance)).toBe(true);
});

test.each([
  ["candidate generation type", pipeline => ({
    ...pipeline,
    generation: { ...pipeline.generation, type: "other-generation" }
  })],
  ["fusion evidence association", pipeline => ({
    ...pipeline,
    fusion: { ...pipeline.fusion, evidenceId: "other-evidence" }
  })],
  ["selection type", pipeline => ({
    ...pipeline,
    selection: { ...pipeline.selection, type: "other-selection" }
  })],
  ["selected candidate reference", pipeline => ({
    ...pipeline,
    selection: {
      ...pipeline.selection,
      selectedCandidateReference: {
        ...pipeline.selection.selectedCandidateReference,
        horizontalAxisCandidateId: "missing-horizontal-candidate"
      }
    }
  })],
  ["missing selected axis candidate", pipeline => {
    return {
      ...pipeline,
      generation: {
        ...pipeline.generation,
        axisCandidates: {
          ...pipeline.generation.axisCandidates,
          horizontal: []
        }
      }
    };
  }]
])("rejects inconsistent reconstruction input: %s", (_label, mutate) => {
  const pipeline = mutate(createPipeline({ height: 24 }));

  expect(() => createResult(pipeline)).toThrow();
});

test("does not change candidate generation, fusion or selection artifacts", () => {
  const pipeline = createPipeline({ height: 24 });
  const generationBefore = JSON.stringify(pipeline.generation);
  const fusionBefore = JSON.stringify(pipeline.fusion);
  const selectionBefore = JSON.stringify(pipeline.selection);

  createResult(pipeline);

  expect(JSON.stringify(pipeline.generation)).toBe(generationBefore);
  expect(JSON.stringify(pipeline.fusion)).toBe(fusionBefore);
  expect(JSON.stringify(pipeline.selection)).toBe(selectionBefore);
});

test("has no Ground Truth, production or crossword-type dependency", () => {
  const source = fs.readFileSync(
    path.join(
      path.dirname(require.resolve("./GridLatticeReconstructionResult")),
      "GridLatticeReconstructionResult.js"
    ),
    "utf8"
  );

  expect(source).not.toMatch(
    /GroundTruth|detectGrid|GridAnalysis|crosswordType|experiments\//
  );
});

function createResult(pipeline) {
  return createGridLatticeReconstructionResult({
    candidateGeneration: pipeline.generation,
    evidenceFusion: pipeline.fusion,
    candidateSelection: pipeline.selection
  });
}

function createPipeline({
  input = createEvidenceInput(),
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
  const periods = createPrimitivePeriodEvidence(
    horizontalPeriod,
    verticalPeriod
  );
  const evidence = createGridLatticeEvidence(input);
  const generation = generateGridLatticeCandidates({
    evidence,
    primitivePeriodEvidence: periods
  });
  const fusion = fuseGridLatticeCandidateEvidence({
    candidateGeneration: generation,
    evidence,
    primitivePeriodEvidence: periods
  });
  const selection = selectGridLatticeCandidate({
    candidateGeneration: generation,
    evidenceFusion: fusion
  });
  return { evidence, periods, generation, fusion, selection };
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

function createPrimitivePeriodEvidence(horizontal, vertical) {
  return {
    id: "primitive-period-evidence-001",
    status: "available",
    axes: {
      horizontal: createPeriodAxis("horizontal", horizontal),
      vertical: createPeriodAxis("vertical", vertical)
    },
    evidenceReferences: ["periodicity:001"],
    provenance: { source: "synthetic-period-evidence" }
  };
}

function createPeriodAxis(axis, period) {
  return {
    axis,
    status: "available",
    candidates: [{
      id: `${axis}-period-001`,
      period,
      evidenceReferences: [`periodicity:${axis}:1`],
      provenance: { source: "primitive-period-observation", sourceOrder: 0 }
    }],
    reasons: []
  };
}
