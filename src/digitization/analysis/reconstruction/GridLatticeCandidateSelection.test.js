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

test("selects the unique candidate with the minimum fused evidence vector", () => {
  const pipeline = createPipeline({ height: 24 });
  const result = selectGridLatticeCandidate({
    candidateGeneration: pipeline.generation,
    evidenceFusion: pipeline.fusion
  });

  expect(pipeline.generation.candidates).toHaveLength(2);
  expect(result).toMatchObject({
    type: "grid-lattice-candidate-selection",
    version: 1,
    status: "selected",
    selectedCandidateId: "grid-lattice-candidate-001",
    ambiguousCandidateIds: [],
    reasons: []
  });
  expect(result.selectedCandidate).toBe(pipeline.generation.candidates[0]);
  expect(result.selectedCandidate.gridDimensions).toEqual({ rows: 2, cols: 3 });
  expect(result.competingCandidates).toEqual([pipeline.generation.candidates[1]]);
  expect(result.competingCandidates[0]).toBe(pipeline.generation.candidates[1]);
  expect(result.candidateEvaluations.map(value => (
    value.comparisonVector.outerBoundsTotalAbsoluteDelta
  ))).toEqual([4, 6]);
});

test("returns ambiguous when candidates have identical evidence observations", () => {
  const pipeline = createPipeline({ height: 25 });
  const result = selectGridLatticeCandidate({
    candidateGeneration: pipeline.generation,
    evidenceFusion: pipeline.fusion
  });

  expect(result.status).toBe("ambiguous");
  expect(result.selectedCandidateId).toBeNull();
  expect(result.selectedCandidate).toBeNull();
  expect(result.ambiguousCandidateIds).toEqual([
    "grid-lattice-candidate-001",
    "grid-lattice-candidate-002"
  ]);
  expect(result.competingCandidates).toEqual(pipeline.generation.candidates);
  expect(result.competingCandidates[0]).toBe(pipeline.generation.candidates[0]);
  expect(result.reasons).toEqual([
    "multiple-candidates-have-identical-evidence-observations"
  ]);
});

test("does not use candidate order to break a harmonic evidence tie", () => {
  const periods = createPrimitivePeriodEvidence();
  periods.status = "ambiguous";
  periods.axes.horizontal = createPeriodAxis("horizontal", [10, 5]);
  const pipeline = createPipeline({ periods });
  const result = selectGridLatticeCandidate({
    candidateGeneration: pipeline.generation,
    evidenceFusion: pipeline.fusion
  });

  expect(result.status).toBe("ambiguous");
  expect(pipeline.generation.candidates.map(value => (
    value.axes.horizontal.period
  ))).toEqual([10, 5]);
  expect(result.ambiguousCandidateIds).toEqual(
    pipeline.generation.candidates.map(value => value.id)
  );
  expect(result.decisionPolicy.candidateOrderTieBreaker).toBe("none");
});

test("returns unavailable when candidate generation has no rectangular candidates", () => {
  const input = createEvidenceInput();
  input.axes.vertical.status = "unavailable";
  input.axes.vertical.positions = [];
  const pipeline = createPipeline({ input });
  const result = selectGridLatticeCandidate({
    candidateGeneration: pipeline.generation,
    evidenceFusion: pipeline.fusion
  });

  expect(result).toMatchObject({
    status: "unavailable",
    selectedCandidateId: null,
    selectedCandidate: null,
    competingCandidates: [],
    candidateEvaluations: [],
    reasons: ["grid-lattice-candidates-unavailable"]
  });
});

test("returns unavailable rather than selecting from partial confidence", () => {
  const source = createPipeline();
  const periodsWithoutMatchingSource = clone(source.periods);
  periodsWithoutMatchingSource.axes.horizontal.candidates[0].id = "other-period";
  const fusion = fuseGridLatticeCandidateEvidence({
    candidateGeneration: source.generation,
    evidence: source.evidence,
    primitivePeriodEvidence: periodsWithoutMatchingSource
  });

  const result = selectGridLatticeCandidate({
    candidateGeneration: source.generation,
    evidenceFusion: fusion
  });

  expect(fusion.confidences[0].status).toBe("partial");
  expect(result.status).toBe("unavailable");
  expect(result.selectedCandidate).toBeNull();
  expect(result.competingCandidates).toEqual(source.generation.candidates);
  expect(result.candidateEvaluations[0]).toMatchObject({
    status: "unavailable",
    reason: "grid-lattice-confidence-not-fully-available",
    unavailableAssessmentIds: ["primitive-period-consistency"]
  });
});

test("uses the documented factual comparison fields in deterministic order", () => {
  const pipeline = createPipeline({ height: 24 });
  const result = selectGridLatticeCandidate({
    candidateGeneration: pipeline.generation,
    evidenceFusion: pipeline.fusion
  });

  expect(result.decisionPolicy).toEqual({
    id: "exact-fused-geometric-evidence-lexicographic-v1",
    eligibleConfidenceStatus: "available",
    comparison: "ascending-lexicographic",
    comparisonFields: [
      "contradictionCount",
      "outsideExtentAnchorCount",
      "outerBoundsTotalAbsoluteDelta",
      "anchorMaximumAbsoluteResidual",
      "anchorRmsResidual",
      "primitivePeriodTotalAbsoluteDelta",
      "intervalMaximumAbsoluteResidual",
      "intervalRmsResidual"
    ],
    tieBehavior: "ambiguous",
    candidateOrderTieBreaker: "none",
    tolerance: "none"
  });
});

test("preserves complete decision provenance and confidence associations", () => {
  const pipeline = createPipeline({ height: 24 });
  const result = selectGridLatticeCandidate({
    candidateGeneration: pipeline.generation,
    evidenceFusion: pipeline.fusion
  });

  expect(result.decisionProvenance).toEqual({
    candidateGeneration: {
      type: "grid-lattice-candidate-generation",
      version: 1,
      status: pipeline.generation.status,
      evidenceId: pipeline.generation.evidenceId,
      primitivePeriodEvidenceId: pipeline.generation.primitivePeriodEvidenceId,
      provenance: pipeline.generation.provenance
    },
    evidenceFusion: {
      type: "grid-lattice-evidence-fusion",
      version: 1,
      status: pipeline.fusion.status,
      evidenceId: pipeline.fusion.evidenceId,
      primitivePeriodEvidenceId: pipeline.fusion.primitivePeriodEvidenceId,
      provenance: pipeline.fusion.provenance
    },
    confidenceArtifactIds: pipeline.fusion.confidences.map(value => value.id)
  });
  expect(result.candidateEvaluations.map(value => value.confidenceArtifactId))
    .toEqual(pipeline.fusion.confidences.map(value => value.id));
});

test("remains independent of fixed dimensions and square-grid assumptions", () => {
  const pipeline = createPipeline({
    width: 49,
    height: 21,
    horizontalPeriod: 7,
    verticalPeriod: 7
  });
  const result = selectGridLatticeCandidate({
    candidateGeneration: pipeline.generation,
    evidenceFusion: pipeline.fusion
  });

  expect(result.status).toBe("selected");
  expect(result.selectedCandidate.gridDimensions).toEqual({ rows: 3, cols: 7 });
});

test("is deterministic, input-immutable and preserves exact candidate references", () => {
  const pipeline = createPipeline({ height: 24 });
  const before = JSON.stringify(pipeline);

  const first = selectGridLatticeCandidate({
    candidateGeneration: pipeline.generation,
    evidenceFusion: pipeline.fusion
  });
  const second = selectGridLatticeCandidate({
    candidateGeneration: pipeline.generation,
    evidenceFusion: pipeline.fusion
  });

  expect(JSON.stringify(pipeline)).toBe(before);
  expect(second).toEqual(first);
  expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  expect(first.selectedCandidate).toBe(pipeline.generation.candidates[0]);
  expect(Object.isFrozen(first)).toBe(true);
  expect(Object.isFrozen(first.competingCandidates)).toBe(true);
  expect(Object.isFrozen(first.candidateEvaluations[0].comparisonVector)).toBe(true);
  expect(Object.isFrozen(first.decisionProvenance)).toBe(true);
});

test.each([
  ["candidate generation type", values => {
    values.generation.type = "other-generation";
  }],
  ["fusion source evidence", values => {
    values.fusion.evidenceId = "other-evidence";
  }],
  ["candidate order", values => {
    values.fusion.candidateIds.reverse();
  }],
  ["confidence order", values => {
    values.fusion.confidences.reverse();
  }],
  ["candidate evidence artifact", values => {
    values.generation.candidates[0].type = "other-candidate";
  }],
  ["confidence artifact", values => {
    values.fusion.confidences[0].type = "other-confidence";
  }]
])("rejects mismatched selection input: %s", (_label, mutate) => {
  const source = createPipeline({ height: 24 });
  const values = {
    generation: clone(source.generation),
    fusion: clone(source.fusion)
  };
  mutate(values);
  deepFreeze(values.generation);
  deepFreeze(values.fusion);

  expect(() => selectGridLatticeCandidate({
    candidateGeneration: values.generation,
    evidenceFusion: values.fusion
  })).toThrow();
});

test("has no Ground Truth, production or crossword-type dependency", () => {
  const source = fs.readFileSync(
    path.join(
      path.dirname(require.resolve("./GridLatticeCandidateSelection")),
      "GridLatticeCandidateSelection.js"
    ),
    "utf8"
  );

  expect(source).not.toMatch(
    /GroundTruth|detectGrid|GridAnalysis|crosswordType|experiments\//
  );
});

function createPipeline({
  input = createEvidenceInput(),
  periods = null,
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
  periods = periods ?? createPrimitivePeriodEvidence(
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
  return { evidence, periods, generation, fusion };
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

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
