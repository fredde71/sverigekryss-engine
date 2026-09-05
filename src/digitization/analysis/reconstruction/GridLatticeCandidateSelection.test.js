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
  expect(result.globallyTiedCandidateSpace).toEqual({
    representation: "ordered-union-of-axis-products-by-reference",
    combinationOrder: "candidate-index-ascending",
    groups: [{
      horizontalAxisCandidateIds: [
        "horizontal-period-001-intervals-2",
        "horizontal-period-001-intervals-3"
      ],
      horizontalAxisEvidenceIds: [
        "grid-lattice-axis-evidence-horizontal-period-001-intervals-2",
        "grid-lattice-axis-evidence-horizontal-period-001-intervals-3"
      ],
      verticalAxisCandidateIds: ["vertical-period-001-intervals-3"],
      verticalAxisEvidenceIds: [
        "grid-lattice-axis-evidence-vertical-period-001-intervals-3"
      ],
      exactCandidateCount: 2
    }],
    exactCandidateCount: 2,
    exactCompetitorCount: 2,
    eagerlyMaterializedCandidateCount: 0
  });
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

test("does not interpret null selection observations as numeric zero", () => {
  const pipeline = createPipeline({ height: 25 });
  const fusion = clone(pipeline.fusion);
  fusion.axisEvidence.horizontal[0].assessments[
    "primitive-period-consistency"
  ].observation.periodDelta = null;

  const result = selectGridLatticeCandidate({
    candidateGeneration: pipeline.generation,
    evidenceFusion: fusion
  });

  expect(result.status).toBe("selected");
  expect(result.selectedCandidateReference.horizontalAxisCandidateId).toBe(
    pipeline.generation.axisCandidates.horizontal[1].id
  );
  expect(result.candidateEvaluations[0]).toMatchObject({
    status: "unavailable",
    unavailableAssessmentIds: ["primitive-period-consistency"],
    comparisonVector: null
  });
});

test("preserves an unassessed spacing rejection without letting it compete", () => {
  const periods = createPrimitivePeriodEvidence();
  periods.status = "ambiguous";
  periods.axes.horizontal = createPeriodAxis("horizontal", [10, 5]);
  periods.axes.horizontal.candidates[1].provenance.sourceInterpretation = {
    status: "rejected",
    admission: { status: "not-assessed" },
    oneXSupport: { status: "not-assessed" },
    alignmentQualifiedOneXSupport: { status: "not-assessed" },
    assignedCandidateCount: 0,
    rejectedCandidateCount: 0,
    maximumAbsoluteResidual: null,
    RMSResidual: null,
    inferredLineCount: null,
    longestInferredRun: null,
    inferredLineFraction: null,
    skippedIntervalCounts: [],
    rejectionReasons: [{ code: "spacing-out-of-range" }]
  };
  const pipeline = createPipeline({ periods, height: 20 });
  const rejectedCandidate = pipeline.generation.axisCandidates.horizontal.find(
    candidate => candidate.provenance.primitivePeriodCandidateId
      === "horizontal-period-002"
      && candidate.intervalCount === 4
  );

  const result = selectGridLatticeCandidate({
    candidateGeneration: pipeline.generation,
    evidenceFusion: pipeline.fusion
  });

  expect(rejectedCandidate).toBeDefined();
  expect(rejectedCandidate.provenance.source.sourceInterpretation).toMatchObject({
    status: "rejected",
    rejectionReasons: [{ code: "spacing-out-of-range" }]
  });
  expect(result.status).toBe("selected");
  expect(result.selectedCandidateReference.horizontalAxisCandidateId).not.toBe(
    rejectedCandidate.id
  );
  const rejectedEvidence = pipeline.fusion.axisEvidence.horizontal.find(
    value => value.axisCandidateId === rejectedCandidate.id
  );
  const rejectedEvaluation = result.candidateEvaluations.find(value => (
    value.candidateReference.horizontalAxisEvidenceId === rejectedEvidence.id
  ));
  expect(rejectedEvaluation).toMatchObject({
    status: "unavailable",
    unavailableAssessmentIds: ["primitive-period-consistency"],
    comparisonVector: null
  });
});

test("retains lexicographic behavior for fully assessed candidates", () => {
  const pipeline = createPipeline({ height: 24 });
  const first = selectGridLatticeCandidate({
    candidateGeneration: pipeline.generation,
    evidenceFusion: pipeline.fusion
  });
  const second = selectGridLatticeCandidate({
    candidateGeneration: pipeline.generation,
    evidenceFusion: pipeline.fusion
  });

  expect(first.status).toBe("selected");
  expect(first.selectedCandidateId).toBe("grid-lattice-candidate-001");
  expect(second).toEqual(first);
});

test("keeps the existing eight fields ahead of qualified 1x support", () => {
  const pipeline = createPipeline({ height: 24 });
  const fusion = clone(pipeline.fusion);
  setQualifiedOneXSupport(fusion.axisEvidence.horizontal[0], 0);
  setQualifiedOneXSupport(fusion.axisEvidence.horizontal[1], 1);

  const result = selectGridLatticeCandidate({
    candidateGeneration: pipeline.generation,
    evidenceFusion: fusion
  });

  expect(result.status).toBe("selected");
  expect(result.selectedCandidateReference.horizontalAxisCandidateId).toBe(
    pipeline.generation.axisCandidates.horizontal[0].id
  );
  expect(result.candidateEvaluations.map(value => (
    value.comparisonVector.alignmentQualifiedOneXSupportMissing
  ))).toEqual([1, 0]);
});

test("qualified 1x presence resolves only an otherwise exact tie", () => {
  const pipeline = createPipeline({ height: 25 });
  const fusion = clone(pipeline.fusion);
  setQualifiedOneXSupport(fusion.axisEvidence.horizontal[0], 1);
  setQualifiedOneXSupport(fusion.axisEvidence.horizontal[1], 0);

  const first = selectGridLatticeCandidate({
    candidateGeneration: pipeline.generation,
    evidenceFusion: fusion
  });
  const second = selectGridLatticeCandidate({
    candidateGeneration: pipeline.generation,
    evidenceFusion: fusion
  });

  expect(first.status).toBe("selected");
  expect(first.selectedCandidateReference.horizontalAxisCandidateId).toBe(
    pipeline.generation.axisCandidates.horizontal[0].id
  );
  expect(second).toEqual(first);
});

test("multiple qualified 1x candidates remain ambiguous", () => {
  const pipeline = createPipeline({ height: 25 });
  const fusion = clone(pipeline.fusion);
  fusion.axisEvidence.horizontal.forEach(value => (
    setQualifiedOneXSupport(value, 1)
  ));

  const result = selectGridLatticeCandidate({
    candidateGeneration: pipeline.generation,
    evidenceFusion: fusion
  });

  expect(result.status).toBe("ambiguous");
  expect(result.globallyTiedCandidateSpace.exactCandidateCount).toBe(2);
});

test("zero qualified 1x support preserves ambiguity", () => {
  const pipeline = createPipeline({ height: 25 });
  const fusion = clone(pipeline.fusion);
  fusion.axisEvidence.horizontal.forEach(value => (
    setQualifiedOneXSupport(value, 0)
  ));

  const result = selectGridLatticeCandidate({
    candidateGeneration: pipeline.generation,
    evidenceFusion: fusion
  });

  expect(result.status).toBe("ambiguous");
  expect(result.globallyTiedCandidateSpace.exactCandidateCount).toBe(2);
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
      "intervalRmsResidual",
      "alignmentQualifiedOneXSupportMissing"
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
    confidenceSpace: {
      representation: "cartesian-product-by-reference",
      combinationOrder: "horizontal-major-vertical-minor",
      horizontalAxisEvidenceIds:
        pipeline.fusion.confidenceSpace.horizontalAxisEvidenceIds,
      verticalAxisEvidenceIds:
        pipeline.fusion.confidenceSpace.verticalAxisEvidenceIds,
      exactConfidenceCount: 2
    },
    referenceLookup: "horizontal-major-index-plus-vertical-index",
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
    values.generation.candidateSpace.horizontalAxisCandidateIds.reverse();
  }],
  ["confidence order", values => {
    values.fusion.confidenceSpace.horizontalAxisEvidenceIds.reverse();
  }],
  ["candidate evidence artifact", values => {
    values.generation.axisCandidates.horizontal[0].id = "other-candidate";
  }],
  ["confidence artifact", values => {
    values.fusion.axisEvidence.horizontal[0].id = "other-confidence";
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

test("selects directly from factored evidence without reading Cartesian views", () => {
  const pipeline = createPipeline({ height: 24 });
  const generation = new Proxy(pipeline.generation, {
    get(target, property, receiver) {
      if (property === "candidates") {
        throw new Error("Cartesian candidates must not be read");
      }
      return Reflect.get(target, property, receiver);
    }
  });
  const fusion = new Proxy(pipeline.fusion, {
    get(target, property, receiver) {
      if (property === "confidences" || property === "candidateIds") {
        throw new Error("Cartesian confidence views must not be read");
      }
      return Reflect.get(target, property, receiver);
    }
  });

  const result = selectGridLatticeCandidate({
    candidateGeneration: generation,
    evidenceFusion: fusion
  });

  expect(result.status).toBe("selected");
  expect(result.selectedCandidateReference).toEqual({
    candidateId: "grid-lattice-candidate-001",
    candidateIndex: 0,
    horizontalAxisCandidateId: "horizontal-period-001-intervals-2",
    verticalAxisCandidateId: "vertical-period-001-intervals-3",
    horizontalAxisEvidenceId:
      "grid-lattice-axis-evidence-horizontal-period-001-intervals-2",
    verticalAxisEvidenceId:
      "grid-lattice-axis-evidence-vertical-period-001-intervals-3"
  });
  expect(result.competingCandidateSpace).toMatchObject({
    representation: "cartesian-product-by-reference",
    exactCandidateCount: 1,
    eagerlyMaterializedCandidateCount: 0
  });
  expect(result.candidateEvaluationSpace).toMatchObject({
    representation: "factored-axis-evidence-product",
    exactEvaluationCount: 2,
    horizontalAxisEvaluationCount: 2,
    verticalAxisEvaluationCount: 1,
    exactFactoredEvaluationCount: 3,
    eagerlyMaterializedEvaluationCount: 0
  });
});

test("is exhaustively equivalent to Cartesian selection on bounded fixtures", () => {
  const periodFixtures = [
    [[10], [10]],
    [[10, 5], [10]],
    [[10], [10, 5]],
    [[10, 5], [10, 5]]
  ];
  let fixtureCount = 0;

  for (const height of [19, 20, 21, 24, 25]) {
    for (const width of [29, 30, 31, 34, 35]) {
      for (const [horizontalPeriods, verticalPeriods] of periodFixtures) {
        const periods = createPrimitivePeriodEvidence();
        periods.status = horizontalPeriods.length > 1
          || verticalPeriods.length > 1
          ? "ambiguous"
          : "available";
        periods.axes.horizontal = createPeriodAxis(
          "horizontal",
          horizontalPeriods
        );
        periods.axes.vertical = createPeriodAxis(
          "vertical",
          verticalPeriods
        );
        const pipeline = createPipeline({ height, width, periods });
        const result = selectGridLatticeCandidate({
          candidateGeneration: pipeline.generation,
          evidenceFusion: pipeline.fusion
        });
        const oracle = selectCartesianReference(result.candidateEvaluations);

        expect({
          status: result.status,
          selectedCandidateId: result.selectedCandidateId,
          globallyTiedCandidateCount:
            result.globallyTiedCandidateSpace.exactCandidateCount,
          globallyTiedCandidateIds: result.status === "ambiguous"
            ? result.ambiguousCandidateIds
            : result.selectedCandidateId === null
              ? []
              : [result.selectedCandidateId]
        }).toEqual(oracle);
        fixtureCount += 1;
      }
    }
  }

  expect(fixtureCount).toBe(100);
});

test("selects a realistic factored cardinality without Cartesian evaluation", () => {
  const pipeline = createPipeline();
  const horizontalCount = 1200;
  const verticalCount = 1100;
  const reads = { horizontal: 0, vertical: 0 };
  const generation = clone(pipeline.generation);
  const fusion = clone(pipeline.fusion);
  generation.axisCandidates.horizontal = createRepeatedAxisCandidates(
    generation.axisCandidates.horizontal[0],
    "horizontal",
    horizontalCount
  );
  generation.axisCandidates.vertical = createRepeatedAxisCandidates(
    generation.axisCandidates.vertical[0],
    "vertical",
    verticalCount
  );
  fusion.axisEvidence.horizontal = createRepeatedAxisEvidence(
    fusion.axisEvidence.horizontal[0],
    "horizontal",
    horizontalCount,
    reads
  );
  fusion.axisEvidence.vertical = createRepeatedAxisEvidence(
    fusion.axisEvidence.vertical[0],
    "vertical",
    verticalCount,
    reads
  );
  generation.candidateSpace.horizontalAxisCandidateIds =
    generation.axisCandidates.horizontal.map(value => value.id);
  generation.candidateSpace.verticalAxisCandidateIds =
    generation.axisCandidates.vertical.map(value => value.id);
  generation.candidateSpace.exactCandidateCount =
    horizontalCount * verticalCount;
  fusion.confidenceSpace.horizontalAxisEvidenceIds =
    fusion.axisEvidence.horizontal.map(value => value.id);
  fusion.confidenceSpace.verticalAxisEvidenceIds =
    fusion.axisEvidence.vertical.map(value => value.id);
  fusion.confidenceSpace.exactConfidenceCount = horizontalCount * verticalCount;

  const result = selectGridLatticeCandidate({
    candidateGeneration: generation,
    evidenceFusion: fusion
  });

  expect(result.status).toBe("ambiguous");
  expect(result.candidateEvaluationSpace).toMatchObject({
    exactEvaluationCount: 1320000,
    horizontalAxisEvaluationCount: horizontalCount,
    verticalAxisEvaluationCount: verticalCount,
    exactFactoredEvaluationCount: horizontalCount + verticalCount,
    eagerlyMaterializedEvaluationCount: 0
  });
  expect(result.globallyTiedCandidateSpace).toMatchObject({
    exactCandidateCount: 1320000,
    exactCompetitorCount: 1320000,
    eagerlyMaterializedCandidateCount: 0
  });
  expect(reads.horizontal + reads.vertical).toBeLessThan(
    50 * (horizontalCount + verticalCount)
  );
  expect(Object.getOwnPropertyDescriptor(result, "candidateEvaluations").get)
    .toEqual(expect.any(Function));
  expect(Object.getOwnPropertyDescriptor(result, "ambiguousCandidateIds").get)
    .toEqual(expect.any(Function));
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
        sourceOrder: index,
        alignmentQualifiedOneXSupport: {
          status: "available",
          count: 1
        }
      }
    })),
    reasons: []
  };
}

function selectCartesianReference(evaluations) {
  let minimumVector = null;
  let matching = [];
  for (const evaluation of evaluations) {
    if (evaluation.status !== "comparable") {
      continue;
    }
    const comparison = minimumVector === null
      ? -1
      : compareReferenceVectors(evaluation.comparisonVector, minimumVector);
    if (comparison < 0) {
      minimumVector = evaluation.comparisonVector;
      matching = [evaluation.candidateId];
    } else if (comparison === 0) {
      matching.push(evaluation.candidateId);
    }
  }
  return {
    status: matching.length === 0
      ? "unavailable"
      : matching.length === 1
        ? "selected"
        : "ambiguous",
    selectedCandidateId: matching.length === 1 ? matching[0] : null,
    globallyTiedCandidateCount: matching.length,
    globallyTiedCandidateIds: matching
  };
}

function compareReferenceVectors(left, right) {
  for (const field of [
    "contradictionCount",
    "outsideExtentAnchorCount",
    "outerBoundsTotalAbsoluteDelta",
    "anchorMaximumAbsoluteResidual",
    "anchorRmsResidual",
    "primitivePeriodTotalAbsoluteDelta",
    "intervalMaximumAbsoluteResidual",
    "intervalRmsResidual",
    "alignmentQualifiedOneXSupportMissing"
  ]) {
    if (left[field] < right[field]) {
      return -1;
    }
    if (left[field] > right[field]) {
      return 1;
    }
  }
  return 0;
}

function setQualifiedOneXSupport(axisEvidence, count) {
  axisEvidence.assessments[
    "primitive-period-consistency"
  ].observation.provenance.alignmentQualifiedOneXSupport = {
    status: "available",
    count
  };
}

function createRepeatedAxisCandidates(source, axis, count) {
  return Array.from({ length: count }, (_value, index) => ({
    ...clone(source),
    id: `${axis}-candidate-${String(index + 1).padStart(4, "0")}`,
    axis
  }));
}

function createRepeatedAxisEvidence(source, axis, count, reads) {
  return Array.from({ length: count }, (_value, index) => {
    const value = clone(source);
    const assessments = value.assessments;
    delete value.assessments;
    value.id = `${axis}-evidence-${String(index + 1).padStart(4, "0")}`;
    value.axisCandidateId = `${axis}-candidate-${String(index + 1).padStart(4, "0")}`;
    Object.defineProperty(value, "assessments", {
      enumerable: true,
      configurable: true,
      get() {
        reads[axis] += 1;
        return assessments;
      }
    });
    return value;
  });
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
