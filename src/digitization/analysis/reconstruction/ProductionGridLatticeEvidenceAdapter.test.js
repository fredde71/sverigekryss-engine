import { createAnalysisContext } from "../AnalysisContext";
import {
  createProductionGridLatticeEvidence
} from "./ProductionGridLatticeEvidenceAdapter";

test("normalizes accepted production anchors and axis spacing evidence", () => {
  const context = createProductionContext();
  const result = createProductionGridLatticeEvidence({
    analysisContext: context,
    evidenceId: "production-evidence:test"
  });

  expect(result).toMatchObject({
    type: "grid-lattice-evidence",
    version: 1,
    id: "production-evidence:test",
    status: "partial"
  });
  expect(result.axes.horizontal).toMatchObject({
    status: "available",
    axis: "horizontal",
    positions: [10.5, 20.5, 30.5],
    spacingObservations: [
      { fromPosition: 10.5, toPosition: 20.5, spacing: 10 },
      { fromPosition: 20.5, toPosition: 30.5, spacing: 10 }
    ]
  });
  expect(result.axes.vertical.positions).toEqual([5, 15, 25, 35]);
  expect(result.axes.vertical.spacingObservations).toEqual([
    { fromPosition: 5, toPosition: 15, spacing: 10 },
    { fromPosition: 15, toPosition: 25, spacing: 10 },
    { fromPosition: 25, toPosition: 35, spacing: 10 }
  ]);
  expect(result.boundsObservation).toMatchObject({
    status: "unavailable",
    bounds: null,
    provenance: {
      sourceCandidateEnvelopeStatus: "available",
      sourceAcceptedCandidateEnvelope: {
        top: 10.5,
        left: 5,
        width: 30,
        height: 20
      }
    }
  });
});

test("preserves candidate runs, projection samples and measured spacing diagnostics", () => {
  const result = createProductionGridLatticeEvidence({
    analysisContext: createProductionContext()
  });
  const horizontal = result.axes.horizontal.diagnostics[0];

  expect(horizontal).toMatchObject({
    projectionStatus: "available",
    projectionLength: 40,
    spacingDiagnosticStatus: "available",
    spacingDiagnostic: {
      type: "spacing-consistency",
      axis: "horizontal",
      status: "measured",
      min: 10,
      max: 10,
      average: 10,
      consistency: 1
    }
  });
  expect(horizontal.acceptedCandidates[0]).toEqual({
    sourceIndex: 0,
    position: 10.5,
    runStart: 10,
    runEnd: 11,
    thickness: 2,
    maximumProjectionStrength: 80,
    averageProjectionStrength: 75,
    projectionSamples: [70, 80]
  });
});

test("preserves production coordinate provenance and transform values", () => {
  const context = createProductionContext();
  const result = createProductionGridLatticeEvidence({
    analysisContext: context
  });

  expect(result.coordinateSystem).toEqual({
    space: "analysis-region-local",
    unit: "pixel",
    origin: "top-left",
    xDirection: "right",
    yDirection: "down",
    linePosition: "visual-line-center",
    localToBinaryImage: {
      offsetX: 7,
      offsetY: 11,
      scaleX: 1,
      scaleY: 1
    },
    binaryImageToDocument: {
      scaleX: 0.5,
      scaleY: 0.25
    }
  });
  expect(result.provenance).toMatchObject({
    source: "production-digitization-analysis",
    analysisRegionId: "compatibility-full-binary-image",
    analysisRegionType: "compatibility",
    coordinateProvenance: context.coordinateProvenance,
    binaryImageDimensions: { width: 40, height: 50 }
  });
});

test("represents missing optional evidence explicitly without fabricating it", () => {
  const context = createAnalysisContext({
    binaryImage: { width: 40, height: 50 },
    lineCandidates: {
      horizontal: [createCandidate("horizontal", 10, 10, 10)],
      vertical: []
    },
    projections: null,
    gridDetection: { diagnostics: [] },
    coordinateProvenance: null
  });
  const result = createProductionGridLatticeEvidence({
    analysisContext: context
  });

  expect(result.status).toBe("partial");
  expect(result.axes.horizontal.diagnostics[0]).toMatchObject({
    projectionStatus: "unavailable",
    projectionLength: null,
    spacingDiagnosticStatus: "unavailable",
    spacingDiagnostic: null
  });
  expect(
    result.axes.horizontal.diagnostics[0].acceptedCandidates[0]
      .projectionSamples
  ).toBeNull();
  expect(result.axes.vertical).toMatchObject({
    status: "unavailable",
    positions: [],
    spacingObservations: []
  });
  expect(result.coordinateSystem).toMatchObject({
    localToBinaryImage: null,
    binaryImageToDocument: null
  });
  expect(result.boundsObservation).toEqual({
    status: "unavailable",
    semantics: "outer-line-center-envelope",
    coordinateSpace: "analysis-region-local",
    bounds: null,
    provenance: {
      source: "production-grid-lattice-evidence-adapter",
      sourceCandidateEnvelopeStatus: "unavailable",
      sourceAcceptedCandidateEnvelope: null,
      reason: "outer-line-center-bounds-evidence-not-yet-available"
    },
    evidenceReferences: []
  });
  expect(result.reasons).toContain(
    "vertical-accepted-line-candidates-unavailable"
  );
});

test("is deterministic, immutable and does not mutate production input artifacts", () => {
  const context = createProductionContext();
  const before = JSON.stringify(context);

  const first = createProductionGridLatticeEvidence({ analysisContext: context });
  const second = createProductionGridLatticeEvidence({ analysisContext: context });

  expect(second).toEqual(first);
  expect(JSON.stringify(context)).toBe(before);
  expect(Object.isFrozen(first)).toBe(true);
  expect(Object.isFrozen(first.axes.horizontal)).toBe(true);
  expect(Object.isFrozen(first.coordinateSystem.localToBinaryImage)).toBe(true);
});

function createProductionContext() {
  const horizontalProjection = Array(40).fill(0);
  horizontalProjection[10] = 70;
  horizontalProjection[11] = 80;
  const verticalProjection = Array(40).fill(0);
  verticalProjection[5] = 50;

  return createAnalysisContext({
    binaryImage: { width: 40, height: 50 },
    lineCandidates: {
      horizontal: [
        createCandidate("horizontal", 10, 11, 10.5, 80, 75),
        createCandidate("horizontal", 20, 21, 20.5, 82, 76),
        createCandidate("horizontal", 30, 31, 30.5, 84, 77)
      ],
      vertical: [
        createCandidate("vertical", 5, 5, 5, 50, 50),
        createCandidate("vertical", 15, 15, 15, 51, 51),
        createCandidate("vertical", 25, 25, 25, 52, 52),
        createCandidate("vertical", 35, 35, 35, 53, 53)
      ]
    },
    projections: {
      horizontal: horizontalProjection,
      vertical: verticalProjection
    },
    gridDetection: {
      diagnostics: [
        createSpacingDiagnostic("horizontal"),
        createSpacingDiagnostic("vertical"),
        {
          type: "pre-rejection-bounds",
          bounds: { top: 10.5, left: 5, width: 30, height: 20 }
        }
      ]
    },
    coordinateProvenance: {
      type: "digitization-coordinate-provenance",
      version: 1,
      spaces: {
        local: "analysis-region-local",
        binaryImage: "binary-image-pixels",
        document: "document"
      },
      analysisRegion: {
        id: "compatibility-full-binary-image",
        regionType: "compatibility",
        relationshipType: "identity",
        localToBinaryImage: {
          offsetX: 7,
          offsetY: 11,
          scaleX: 1,
          scaleY: 1
        },
        owner: "analysis-region"
      },
      documentAnalysis: {
        type: "document-analysis",
        version: 1,
        relationshipType: "axis-aligned-scale",
        binaryImageToDocument: { scaleX: 0.5, scaleY: 0.25 },
        owner: "document-analysis"
      }
    }
  });
}

function createCandidate(
  axis,
  start,
  end,
  position,
  strength = 10,
  averageStrength = 10
) {
  return {
    axis,
    start,
    end,
    position,
    thickness: end - start + 1,
    strength,
    averageStrength
  };
}

function createSpacingDiagnostic(axis) {
  return {
    type: "spacing-consistency",
    axis,
    status: "measured",
    consistency: 1,
    min: 10,
    max: 10,
    average: 10
  };
}
