import fs from "fs";
import path from "path";
import {
  createGridLatticeReconstructionPipeline,
  runGridLatticeReconstruction
} from "./GridLatticeReconstructionPipeline";

test("runs the factored reconstruction chain and returns GridLatticeReconstructionResult", () => {
  const result = runGridLatticeReconstruction(createInput());

  expect(result).toMatchObject({
    type: "grid-lattice-reconstruction-result",
    version: 1,
    status: "available",
    candidateSelectionStatus: "selected"
  });
  expect(result.lattice).toMatchObject({
    type: "grid-lattice",
    status: "available",
    gridDimensions: { rows: 2, cols: 3 }
  });
  expect(result.lattice.axes.horizontal.positions).toEqual([10, 20, 30]);
  expect(result.lattice.axes.vertical.positions).toEqual([5, 15, 25, 35]);
});

test("calls every reconstruction stage once in order with normalized evidence", () => {
  const calls = [];
  const artifacts = {
    evidence: { type: "grid-lattice-evidence" },
    generation: { type: "grid-lattice-candidate-generation" },
    fusion: { type: "grid-lattice-evidence-fusion" },
    selection: { type: "grid-lattice-candidate-selection" },
    result: { type: "grid-lattice-reconstruction-result" }
  };
  const run = createGridLatticeReconstructionPipeline({
    createEvidence(input) {
      calls.push(["evidence", input]);
      return artifacts.evidence;
    },
    generateCandidates(input) {
      calls.push(["generation", input]);
      return artifacts.generation;
    },
    fuseEvidence(input) {
      calls.push(["fusion", input]);
      return artifacts.fusion;
    },
    selectCandidate(input) {
      calls.push(["selection", input]);
      return artifacts.selection;
    },
    createReconstructionResult(input) {
      calls.push(["result", input]);
      return artifacts.result;
    }
  });
  const input = {
    evidence: { id: "normalized-input" },
    primitivePeriodEvidence: { id: "periods" },
    factoredBounds: { status: "ambiguous" }
  };

  expect(run(input)).toBe(artifacts.result);
  expect(calls.map(([stage]) => stage)).toEqual([
    "evidence",
    "generation",
    "fusion",
    "selection",
    "result"
  ]);
  expect(calls[1][1]).toEqual({
    evidence: artifacts.evidence,
    primitivePeriodEvidence: input.primitivePeriodEvidence,
    factoredBounds: input.factoredBounds
  });
  expect(calls[2][1].evidence).toBe(artifacts.evidence);
  expect(calls[4][1]).toEqual({
    candidateGeneration: artifacts.generation,
    evidenceFusion: artifacts.fusion,
    candidateSelection: artifacts.selection
  });
});

test("is deterministic, immutable and independent of validation and Ground Truth", () => {
  const input = createInput();
  const before = JSON.stringify(input);
  const first = runGridLatticeReconstruction(input);
  const second = runGridLatticeReconstruction(input);
  const source = fs.readFileSync(
    path.join(
      path.dirname(require.resolve("./GridLatticeReconstructionPipeline")),
      "GridLatticeReconstructionPipeline.js"
    ),
    "utf8"
  );

  expect(second).toEqual(first);
  expect(JSON.stringify(input)).toBe(before);
  expect(Object.isFrozen(first)).toBe(true);
  expect(Object.isFrozen(first.lattice)).toBe(true);
  expect(source).not.toMatch(/GroundTruth|dataset|experiments\/|validation/i);
});

function createInput() {
  return {
    evidence: {
      id: "pipeline-evidence",
      status: "available",
      coordinateSystem: {
        space: "rendered-binary-image-pixels",
        unit: "pixel",
        origin: "top-left",
        xDirection: "right",
        yDirection: "down",
        linePosition: "visual-line-center"
      },
      axes: {
        horizontal: createAxis("horizontal", [10, 20, 30]),
        vertical: createAxis("vertical", [5, 15, 25, 35])
      },
      boundsObservation: {
        status: "available",
        semantics: "outer-line-center-envelope",
        coordinateSpace: "rendered-binary-image-pixels",
        bounds: { top: 10, left: 5, width: 30, height: 20 },
        provenance: { source: "bounds-observation" },
        evidenceReferences: ["bounds:1"]
      },
      provenance: { source: "normalized-domain-evidence" },
      evidenceReferences: ["anchors:h", "anchors:v"],
      diagnostics: [],
      reasons: []
    },
    primitivePeriodEvidence: {
      id: "pipeline-periods",
      status: "available",
      axes: {
        horizontal: createPeriodAxis("horizontal", 10),
        vertical: createPeriodAxis("vertical", 10)
      },
      evidenceReferences: ["periods:1"],
      provenance: { source: "normalized-period-evidence" }
    }
  };
}

function createAxis(axis, positions) {
  return {
    status: "available",
    axis,
    positions,
    spacingObservations: positions.slice(1).map((position, index) => ({
      fromPosition: positions[index],
      toPosition: position,
      spacing: position - positions[index]
    })),
    evidenceReferences: [`anchors:${axis}`],
    diagnostics: []
  };
}

function createPeriodAxis(axis, period) {
  return {
    axis,
    status: "available",
    candidates: [{
      id: `${axis}-period-001`,
      period,
      evidenceReferences: [`period:${axis}`],
      provenance: { source: "period-observation" }
    }],
    reasons: []
  };
}
