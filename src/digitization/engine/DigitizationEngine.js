import { freezeAnalysisValue } from "../analysis/AnalysisContext";
import { createOuterVisualExtent } from "../analysis/OuterVisualExtent";
import {
  createGridLatticeFactoredBoundsEvidence
} from "../analysis/reconstruction/GridLatticeFactoredBoundsEvidence";
import {
  createGridLatticePrimitivePeriodEvidence
} from "../analysis/reconstruction/GridLatticePrimitivePeriodEvidence";
import {
  runGridLatticeReconstruction
} from "../analysis/reconstruction/GridLatticeReconstructionPipeline";
import {
  createProductionGridLatticeEvidence
} from "../analysis/reconstruction/ProductionGridLatticeEvidenceAdapter";
import {
  createOuterLineGeometryObservation
} from "../analysis/reconstruction/OuterLineGeometryObservation";
import {
  reconstructUniformOrthogonalLattice
} from "../analysis/reconstruction/UniformOrthogonalLatticeStrategy";
import { detectGridFromImageSource } from "../detection/imageGridDetectionEngine";

const PRODUCTION_RECONSTRUCTION_PARAMETERS = Object.freeze({
  strategyId: "uniform-orthogonal-lattice",
  minimumObservedCandidatesPerAxis: 2,
  permittedIntervalCount: Object.freeze({ minimum: 1, maximum: 100 }),
  permittedCellSpacing: Object.freeze({ minimum: 1, maximum: 500 }),
  maximumSkippedIntervalsBetweenCandidates: 25,
  maximumConsecutiveInferredLines: 25,
  maximumInferredLineFraction: 0.9,
  candidateAlignmentTolerancePx: 1,
  boundsAlignmentTolerancePx: 1,
  positionQuantum: 0.5,
  maximumHypothesisCount: 100
});

export function createDigitizationEngine({
  detectGrid = detectGridFromImageSource,
  createEvidence = createProductionGridLatticeEvidence,
  createPrimitivePeriodEvidence = createGridLatticePrimitivePeriodEvidence,
  createFactoredBoundsEvidence = createGridLatticeFactoredBoundsEvidence,
  createVisualExtent = createOuterVisualExtent,
  createLatticeInterpretations = createProductionLatticeInterpretations,
  reconstructGridLattice = runGridLatticeReconstruction
} = {}) {
  [
    [detectGrid, "detectGrid"],
    [createEvidence, "createEvidence"],
    [createPrimitivePeriodEvidence, "createPrimitivePeriodEvidence"],
    [createFactoredBoundsEvidence, "createFactoredBoundsEvidence"],
    [createVisualExtent, "createVisualExtent"],
    [createLatticeInterpretations, "createLatticeInterpretations"],
    [reconstructGridLattice, "reconstructGridLattice"]
  ].forEach(([dependency, name]) => {
    if (typeof dependency !== "function") {
      throw new Error(`${name} must be a function`);
    }
  });

  return async function executeDigitizationJob({
    job,
    readImageData,
    options = {}
  }) {
    if (!job?.source) {
      throw new Error("DigitizationJob source is required");
    }

    const effectiveOptions = {
      ...(job.options || {}),
      ...options
    };
    const detectionResult = await detectGrid({
      source: job.source,
      options: effectiveOptions,
      readImageData
    });
    const evidence = createEvidence({
      analysisContext: detectionResult.context
    });
    const latticeInterpretations = createLatticeInterpretations({
      analysisContext: detectionResult.context,
      evidence
    });
    const primitivePeriodEvidence = createPrimitivePeriodEvidence({
      id: "production-grid-lattice-primitive-period-evidence",
      interpretationDiagnostics: latticeInterpretations.axes,
      coordinateScaleByAxis: {
        horizontal: 1,
        vertical: 1
      },
      evidenceReferences: latticeInterpretations.evidenceReferences,
      interpretationEvidenceReferences:
        latticeInterpretations.interpretationEvidenceReferences,
      interpretationProvenance:
        latticeInterpretations.interpretationProvenance,
      provenance: latticeInterpretations.provenance
    });
    const boundsEvidenceInput = createProductionBoundsEvidenceInput({
      analysisContext: detectionResult.context,
      evidence
    });
    const outerLineGeometryObservation =
      boundsEvidenceInput.providers[0]?.regions[0]?.observation ?? null;
    const outerVisualExtent = createVisualExtent({
      outerLineGeometryObservation
    });
    const boundsProjection = createFactoredBoundsEvidence(boundsEvidenceInput);
    const factoredBounds = boundsProjection.providers[0]?.regions[0] ?? null;
    const gridLatticeReconstructionResult = reconstructGridLattice({
      evidence,
      primitivePeriodEvidence,
      factoredBounds
    });
    const productionResult = freezeAnalysisValue({
      jobId: job.jobId,
      sourceId: job.source.id,
      status: "completed",
      context: detectionResult.context,
      gridDetection: detectionResult.gridDetection,
      suggestions: detectionResult.suggestions,
      diagnostics: detectionResult.diagnostics
    });

    return Object.freeze({
      ...productionResult,
      gridLatticeReconstructionResult,
      outerVisualExtent
    });
  };
}

export const runDigitizationJob = createDigitizationEngine();

function createProductionLatticeInterpretations({ analysisContext }) {
  const candidateEnvelope = readCandidateEnvelope(analysisContext);
  const reconstruction = reconstructUniformOrthogonalLattice({
    candidateEvidence: {
      analysisRegionId:
        analysisContext.coordinateProvenance?.analysisRegion?.id ?? null,
      acceptancePolicy: {
        source: "production-grid-analysis",
        parameters: {}
      },
      horizontal: readCandidates(analysisContext, "horizontal"),
      vertical: readCandidates(analysisContext, "vertical")
    },
    observedBounds: createCandidateEnvelopeObservation(candidateEnvelope),
    spacingEvidence: {
      horizontal: readSpacingDiagnostics(analysisContext, "horizontal"),
      vertical: readSpacingDiagnostics(analysisContext, "vertical"),
      unassigned: []
    },
    coordinateSystem: createProductionCoordinateSystem(analysisContext),
    parameters: PRODUCTION_RECONSTRUCTION_PARAMETERS
  });
  const strategy = reconstruction.diagnostics.find(
    diagnostic => diagnostic?.type === "uniform-orthogonal-lattice-strategy"
  );
  const axes = {
    horizontal: strategy?.axes?.horizontal ?? null,
    vertical: strategy?.axes?.vertical ?? null
  };

  return {
    axes,
    evidenceReferences: ["production-grid-analysis:lattice-interpretations"],
    interpretationEvidenceReferences: Object.fromEntries(
      ["horizontal", "vertical"].map(axis => [
        axis,
        (axes[axis]?.interpretations ?? []).map((_value, index) => [
          `production-grid-analysis:lattice-interpretation:${axis}:${index}`
        ])
      ])
    ),
    interpretationProvenance: Object.fromEntries(
      ["horizontal", "vertical"].map(axis => [
        axis,
        (axes[axis]?.interpretations ?? []).map((_value, index) => ({
          source: "production-grid-analysis",
          axis,
          interpretationIndex: index
        }))
      ])
    ),
    provenance: {
      source: "production-grid-analysis",
      strategy: "uniform-orthogonal-lattice",
      boundsSemantics: "accepted-candidate-envelope"
    }
  };
}

function createProductionBoundsEvidenceInput({ analysisContext, evidence }) {
  const horizontalCandidates = readCandidates(analysisContext, "horizontal");
  const verticalCandidates = readCandidates(analysisContext, "vertical");
  const candidateEnvelope = readCandidateEnvelope(analysisContext);
  const regionId = analysisContext.coordinateProvenance?.analysisRegion?.id
    ?? "production-analysis-region";
  const hasOuterCandidates = horizontalCandidates.length >= 2
    && verticalCandidates.length >= 2;
  const hasParentBinaryImage = Boolean(analysisContext.documentBinaryImage);
  const geometryAvailable = hasOuterCandidates && hasParentBinaryImage;
  const unavailableReason = hasOuterCandidates
    ? "parent-binary-image-neighborhood-unavailable"
    : "accepted-outer-line-candidates-unavailable";
  const observation = geometryAvailable
    ? createOuterLineGeometryObservation({
      parentBinaryImage: analysisContext.documentBinaryImage,
      analysisRegion: createProductionAnalysisRegionEvidence(analysisContext),
      lineCandidates: {
        horizontal: horizontalCandidates,
        vertical: verticalCandidates
      },
      coordinateSystem: evidence.coordinateSystem,
      provenance: {
        source: "production-outer-line-geometry-evidence",
        regionId,
        establishment: "observed-parent-binary-image-neighborhood"
      }
    })
    : null;

  return {
    source: {
      type: "production-outer-line-geometry-evidence",
      version: 1,
      status: geometryAvailable ? "available" : "unavailable"
    },
    sourceId: "production-outer-line-geometry-evidence",
    coordinateSystem: evidence.coordinateSystem,
    providers: [{
      id: "production-grid-analysis",
      description: "Production accepted outer-line candidate observations",
      status: geometryAvailable ? "available" : "unavailable",
      reason: geometryAvailable ? null : unavailableReason,
      regions: [{
        providerId: "production-grid-analysis",
        regionId,
        status: geometryAvailable ? "completed" : "unavailable",
        reason: geometryAvailable ? null : unavailableReason,
        sourceAcceptedCandidateEnvelope: candidateEnvelope,
        observation
      }]
    }]
  };
}

function createProductionAnalysisRegionEvidence(analysisContext) {
  const provenance = analysisContext.coordinateProvenance.analysisRegion;
  const transform = provenance.localToBinaryImage;
  const binaryImage = analysisContext.binaryImage;

  return {
    type: "analysis-region",
    version: 1,
    id: provenance.id,
    status: "measured",
    bounds: {
      top: transform.offsetY,
      left: transform.offsetX,
      width: binaryImage.width * transform.scaleX,
      height: binaryImage.height * transform.scaleY
    },
    coordinateRelationship: {
      type: provenance.relationshipType,
      localToBinaryImage: transform
    }
  };
}

function createCandidateEnvelopeObservation(bounds) {
  return bounds
    ? {
      status: "available",
      coordinateSpace: "analysis-region-local",
      semantics: "accepted-candidate-envelope",
      value: bounds,
      provenance: {
        source: "production-grid-analysis",
        derivation: "outermost-accepted-candidate-positions"
      }
    }
    : {
      status: "unavailable",
      coordinateSpace: "analysis-region-local",
      semantics: "accepted-candidate-envelope",
      value: null,
      reason: "accepted-candidate-envelope-unavailable",
      provenance: {
        source: "production-grid-analysis",
        derivation: "outermost-accepted-candidate-positions"
      }
    };
}

function createProductionCoordinateSystem(analysisContext) {
  return {
    space: analysisContext.coordinateProvenance?.spaces?.local
      ?? "analysis-region-local",
    unit: "pixel",
    origin: "top-left",
    xDirection: "right",
    yDirection: "down",
    linePosition: "visual-line-center",
    localToBinaryImage:
      analysisContext.coordinateProvenance?.analysisRegion?.localToBinaryImage
        ?? null,
    binaryImageToDocument:
      analysisContext.coordinateProvenance?.documentAnalysis
        ?.binaryImageToDocument ?? null
  };
}

function readCandidates(analysisContext, axis) {
  const candidates = analysisContext.lineCandidates?.[axis];
  return Array.isArray(candidates) ? candidates : [];
}

function readCandidateEnvelope(analysisContext) {
  return analysisContext.gridDetection?.diagnostics?.find?.(
    diagnostic => diagnostic?.type === "pre-rejection-bounds"
  )?.bounds ?? null;
}

function readSpacingDiagnostics(analysisContext, axis) {
  return (analysisContext.gridDetection?.diagnostics ?? []).filter(
    diagnostic => (
      diagnostic?.type === "spacing-consistency"
      && diagnostic?.axis === axis
    )
  );
}
