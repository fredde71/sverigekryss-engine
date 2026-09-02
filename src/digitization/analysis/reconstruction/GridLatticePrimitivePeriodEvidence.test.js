import fs from "fs";
import path from "path";
import {
  createGridLatticePrimitivePeriodEvidence
} from "./GridLatticePrimitivePeriodEvidence";

test("converts lattice interpretations into the established period artifact", () => {
  const result = createGridLatticePrimitivePeriodEvidence(createInput());

  expect(result).toMatchObject({
    id: "primitive-period-evidence:production-region",
    status: "ambiguous",
    axes: {
      horizontal: {
        axis: "horizontal",
        status: "ambiguous",
        candidates: [
          { id: "horizontal-period-001", period: 20 },
          { id: "horizontal-period-002", period: 10 }
        ]
      },
      vertical: {
        axis: "vertical",
        status: "available",
        candidates: [{ id: "vertical-period-001", period: 15 }]
      }
    }
  });
  expect(result.evidenceReferences).toEqual(["lattice-strategy:region"]);
  expect(result.provenance).toEqual({
    source: "production-lattice-interpretation-diagnostics",
    evidence: "pre-admission-axis-interpretation-derived-spacing"
  });
});

test("keeps horizontal and vertical scaling and evidence independent", () => {
  const input = createInput();
  const result = createGridLatticePrimitivePeriodEvidence(input);

  expect(result.axes.horizontal.candidates.map(value => value.period)).toEqual([
    20, 10
  ]);
  expect(result.axes.vertical.candidates.map(value => value.period)).toEqual([
    15
  ]);
  expect(result.axes.horizontal.candidates[0].evidenceReferences).toEqual([
    "horizontal-interpretation:0"
  ]);
  expect(result.axes.vertical.candidates[0].evidenceReferences).toEqual([
    "vertical-interpretation:0"
  ]);
});

test("preserves admission, rejection, raw 1x and alignment-qualified evidence", () => {
  const input = createInput();
  const interpretation = input.interpretationDiagnostics.horizontal
    .interpretations[0];
  const candidate = createGridLatticePrimitivePeriodEvidence(input)
    .axes.horizontal.candidates[0];

  expect(candidate.provenance).toMatchObject({
    interpretationStatus: "survived",
    rejectionReasons: [{
      code: "candidate-alignment-failed",
      absoluteResidual: 1.1,
      tolerance: 1
    }],
    admission: interpretation.admission,
    oneXSupport: interpretation.oneXSupport,
    alignmentQualifiedOneXSupport:
      interpretation.alignmentQualifiedOneXSupport,
    candidateResiduals: interpretation.candidateResiduals,
    candidateAssignmentAttempts: interpretation.candidateAssignmentAttempts,
    alignmentResidualDiagnostics:
      interpretation.alignmentResidualDiagnostics,
    skippedIntervalCounts: [1, 0],
    inferredLineCount: 2,
    longestInferredRun: 1,
    inferredLineFraction: 0.2,
    sourceInterpretation: interpretation
  });
});

test("keeps missing interpretation evidence explicitly unavailable", () => {
  const input = createInput();
  input.interpretationDiagnostics.vertical = null;

  const result = createGridLatticePrimitivePeriodEvidence(input);

  expect(result.status).toBe("unavailable");
  expect(result.axes.vertical).toEqual({
    axis: "vertical",
    status: "unavailable",
    candidates: [],
    reasons: ["primitive-period-evidence-unavailable"]
  });
  expect(result.axes.horizontal.candidates).toHaveLength(2);
});

test("is deterministic, immutable, non-mutating and source-neutral", () => {
  const input = createInput();
  const before = JSON.stringify(input);
  const first = createGridLatticePrimitivePeriodEvidence(input);
  const second = createGridLatticePrimitivePeriodEvidence(input);
  const source = fs.readFileSync(
    path.join(
      path.dirname(require.resolve("./GridLatticePrimitivePeriodEvidence")),
      "GridLatticePrimitivePeriodEvidence.js"
    ),
    "utf8"
  );

  expect(second).toEqual(first);
  expect(JSON.stringify(input)).toBe(before);
  expect(Object.isFrozen(first)).toBe(true);
  expect(Object.isFrozen(first.axes.horizontal.candidates[0].provenance)).toBe(
    true
  );
  expect(source).not.toMatch(
    /dataset|shadow|experimentId|GroundTruth|validation|report/i
  );
});

function createInput() {
  return {
    id: "primitive-period-evidence:production-region",
    interpretationDiagnostics: {
      horizontal: {
        interpretations: [
          createInterpretation({ derivedSpacing: 10 }),
          createInterpretation({
            derivedSpacing: 5,
            status: "rejected",
            rejectionReasons: [{ code: "inferred-fraction-limit-exceeded" }]
          }),
          createInterpretation({ derivedSpacing: 10 })
        ]
      },
      vertical: {
        interpretations: [createInterpretation({ derivedSpacing: 10 })]
      }
    },
    coordinateScaleByAxis: {
      horizontal: 2,
      vertical: 1.5
    },
    evidenceReferences: ["lattice-strategy:region"],
    interpretationEvidenceReferences: {
      horizontal: [
        ["horizontal-interpretation:0"],
        ["horizontal-interpretation:1"],
        ["horizontal-interpretation:2"]
      ],
      vertical: [["vertical-interpretation:0"]]
    },
    provenance: {
      source: "production-lattice-interpretation-diagnostics",
      evidence: "pre-admission-axis-interpretation-derived-spacing"
    }
  };
}

function createInterpretation({
  derivedSpacing,
  status = "survived",
  rejectionReasons = [{
    code: "candidate-alignment-failed",
    absoluteResidual: 1.1,
    tolerance: 1
  }]
}) {
  return {
    intervalCount: 25,
    derivedSpacing,
    status,
    rejectionReasons,
    admission: {
      status,
      reason: "complete-evidence-with-alignment-qualified-observed-one-x-support"
    },
    oneXSupport: {
      status: "measured",
      count: 2,
      observedPairCount: 3,
      observations: [{ fromCandidateIndex: 0, toCandidateIndex: 1 }]
    },
    alignmentQualifiedOneXSupport: {
      status: "measured",
      count: 1,
      observedPairCount: 3,
      observations: [{ fromCandidateIndex: 1, toCandidateIndex: 2 }]
    },
    candidateResiduals: [0, 1.1, -0.25],
    candidateAssignmentAttempts: [{
      candidateIndex: 1,
      assignmentStatus: "rejected"
    }],
    alignmentResidualDiagnostics: {
      assignedCandidateCount: 2,
      rejectedCandidateCount: 1,
      maximumAbsoluteResidual: 1.1,
      rmsResidual: 0.65
    },
    skippedIntervalCounts: [1, 0],
    inferredLineCount: 2,
    longestInferredRun: 1,
    inferredLineFraction: 0.2
  };
}
