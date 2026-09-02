import { createGridLatticeEvidence } from "./GridLatticeEvidence";

const DEFAULT_EVIDENCE_ID = "production-grid-lattice-evidence";
const AXES = Object.freeze(["horizontal", "vertical"]);

export function createProductionGridLatticeEvidence({
  analysisContext,
  evidenceId = DEFAULT_EVIDENCE_ID
} = {}) {
  if (!analysisContext || typeof analysisContext !== "object") {
    throw new Error("Production AnalysisContext is required");
  }

  const coordinateProvenance = analysisContext.coordinateProvenance ?? null;
  const axes = Object.fromEntries(AXES.map(axis => [
    axis,
    createAxisEvidence({
      axis,
      candidates: readCandidates(analysisContext, axis),
      projection: readProjection(analysisContext, axis),
      spacingDiagnostic: readSpacingDiagnostic(analysisContext, axis)
    })
  ]));
  const unavailableAxes = AXES.filter(axis => (
    axes[axis].status === "unavailable"
  ));
  const sourceCandidateEnvelope = readCandidateEnvelope(analysisContext);
  const status = unavailableAxes.length === AXES.length
    ? "unavailable"
    : "partial";
  const reasons = ["outer-line-center-bounds-evidence-unavailable"];
  unavailableAxes.forEach(axis => {
    reasons.push(`${axis}-accepted-line-candidates-unavailable`);
  });
  const coordinateSpace = readLocalCoordinateSpace(coordinateProvenance);

  return createGridLatticeEvidence({
    id: evidenceId,
    status,
    coordinateSystem: {
      space: coordinateSpace,
      unit: "pixel",
      origin: "top-left",
      xDirection: "right",
      yDirection: "down",
      linePosition: "visual-line-center",
      localToBinaryImage:
        coordinateProvenance?.analysisRegion?.localToBinaryImage ?? null,
      binaryImageToDocument:
        coordinateProvenance?.documentAnalysis?.binaryImageToDocument ?? null
    },
    axes,
    boundsObservation: {
      status: "unavailable",
      semantics: "outer-line-center-envelope",
      coordinateSpace,
      bounds: null,
      provenance: {
        source: "production-grid-lattice-evidence-adapter",
        sourceCandidateEnvelopeStatus: sourceCandidateEnvelope
          ? "available"
          : "unavailable",
        sourceAcceptedCandidateEnvelope: sourceCandidateEnvelope,
        reason: "outer-line-center-bounds-evidence-not-yet-available"
      },
      evidenceReferences: []
    },
    provenance: {
      source: "production-digitization-analysis",
      adapter: "production-grid-lattice-evidence-adapter-v1",
      analysisRegionId:
        coordinateProvenance?.analysisRegion?.id ?? null,
      analysisRegionType:
        coordinateProvenance?.analysisRegion?.regionType ?? null,
      coordinateProvenance,
      binaryImageDimensions: readBinaryImageDimensions(analysisContext)
    },
    evidenceReferences: AXES.flatMap(axis => axes[axis].evidenceReferences),
    diagnostics: [{
      code: "production-grid-lattice-evidence-inventory",
      horizontalAcceptedCandidateCount: axes.horizontal.positions.length,
      verticalAcceptedCandidateCount: axes.vertical.positions.length,
      coordinateProvenanceStatus: coordinateProvenance
        ? "available"
        : "unavailable",
      outerLineCenterBoundsStatus: "unavailable"
    }],
    reasons
  });
}

function createAxisEvidence({
  axis,
  candidates,
  projection,
  spacingDiagnostic
}) {
  const positions = candidates.map(candidate => candidate.position);
  const projectionAvailable = projection !== null;
  const evidenceReferences = [
    `production-analysis-context:line-candidates:${axis}`
  ];
  if (projectionAvailable) {
    evidenceReferences.push(`production-analysis-context:projection:${axis}`);
  }
  if (spacingDiagnostic !== null) {
    evidenceReferences.push(
      `production-grid-detection-diagnostic:spacing-consistency:${axis}`
    );
  }

  return {
    status: positions.length === 0 ? "unavailable" : "available",
    axis,
    positions,
    spacingObservations: positions.slice(1).map((position, index) => ({
      fromPosition: positions[index],
      toPosition: position,
      spacing: position - positions[index]
    })),
    evidenceReferences,
    diagnostics: [{
      code: "production-axis-source-evidence",
      acceptedCandidateCount: candidates.length,
      acceptedCandidates: candidates.map((candidate, sourceIndex) => ({
        sourceIndex,
        position: finiteOrNull(candidate.position),
        runStart: finiteOrNull(candidate.start),
        runEnd: finiteOrNull(candidate.end),
        thickness: finiteOrNull(candidate.thickness),
        maximumProjectionStrength: finiteOrNull(candidate.strength),
        averageProjectionStrength: finiteOrNull(candidate.averageStrength),
        projectionSamples: readCandidateProjectionSamples(
          projection,
          candidate
        )
      })),
      projectionStatus: projectionAvailable ? "available" : "unavailable",
      projectionLength: projectionAvailable ? projection.length : null,
      spacingDiagnosticStatus: spacingDiagnostic === null
        ? "unavailable"
        : "available",
      spacingDiagnostic
    }]
  };
}

function readCandidates(analysisContext, axis) {
  const candidates = analysisContext.lineCandidates?.[axis];
  return Array.isArray(candidates) ? candidates : [];
}

function readProjection(analysisContext, axis) {
  const projection = analysisContext.projections?.[axis];
  if (!projection || typeof projection.length !== "number") {
    return null;
  }
  return Array.from(projection);
}

function readSpacingDiagnostic(analysisContext, axis) {
  const diagnostics = analysisContext.gridDetection?.diagnostics;
  if (!Array.isArray(diagnostics)) {
    return null;
  }
  const diagnostic = diagnostics.find(value => (
    value?.type === "spacing-consistency" && value?.axis === axis
  ));
  return diagnostic ? cloneJsonValue(diagnostic) : null;
}

function readCandidateProjectionSamples(projection, candidate) {
  if (
    projection === null
    || !Number.isInteger(candidate.start)
    || !Number.isInteger(candidate.end)
    || candidate.start < 0
    || candidate.end < candidate.start
    || candidate.end >= projection.length
  ) {
    return null;
  }
  return projection.slice(candidate.start, candidate.end + 1);
}

function readLocalCoordinateSpace(coordinateProvenance) {
  const space = coordinateProvenance?.spaces?.local;
  return typeof space === "string" && space.trim() !== ""
    ? space
    : "analysis-region-local";
}

function readBinaryImageDimensions(analysisContext) {
  const width = analysisContext.binaryImage?.width;
  const height = analysisContext.binaryImage?.height;
  return {
    width: Number.isFinite(width) ? width : null,
    height: Number.isFinite(height) ? height : null
  };
}

function readCandidateEnvelope(analysisContext) {
  const diagnostic = analysisContext.gridDetection?.diagnostics?.find?.(
    value => value?.type === "pre-rejection-bounds"
  );
  return diagnostic?.bounds ? cloneJsonValue(diagnostic.bounds) : null;
}

function finiteOrNull(value) {
  return Number.isFinite(value) ? value : null;
}

function cloneJsonValue(value) {
  if (Array.isArray(value)) {
    return value.map(cloneJsonValue);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, cloneJsonValue(entry)])
    );
  }
  return value;
}
