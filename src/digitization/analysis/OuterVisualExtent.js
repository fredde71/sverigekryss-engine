import {
  cloneDeterministicValue,
  deepFreeze,
  rejectEvaluationFields,
  validateCoordinateSystem
} from "./reconstruction/GridLatticeModelSupport";

const VERSION = 1;
const EDGE_DEFINITIONS = Object.freeze({
  top: "firstStrongOrFullContinuityPosition",
  bottom: "lastStrongOrFullContinuityPosition",
  left: "firstStrongOrFullContinuityPosition",
  right: "lastStrongOrFullContinuityPosition"
});
const EDGE_ORDER = Object.freeze(["top", "bottom", "left", "right"]);

export function createOuterVisualExtent({
  outerLineGeometryObservation
} = {}) {
  if (
    outerLineGeometryObservation?.type
      !== "outer-line-center-geometry-observation"
    || outerLineGeometryObservation?.version !== 1
    || !outerLineGeometryObservation.coordinateSystem
    || !outerLineGeometryObservation.edges
  ) {
    return createUnavailableResult(
      outerLineGeometryObservation,
      "outer-line-geometry-observation-unavailable"
    );
  }

  try {
    validateCoordinateSystem(outerLineGeometryObservation.coordinateSystem);
  } catch (_error) {
    return createUnavailableResult(
      outerLineGeometryObservation,
      "outer-line-geometry-coordinate-system-unavailable"
    );
  }

  const edges = Object.fromEntries(EDGE_ORDER.map(edge => [
    edge,
    createEdgeObservation(
      edge,
      outerLineGeometryObservation.edges[edge]
    )
  ]));
  const missingEdges = EDGE_ORDER.filter(edge => (
    edges[edge].status === "unavailable"
  ));

  if (missingEdges.length > 0) {
    return createResult({
      source: outerLineGeometryObservation,
      status: "unavailable",
      edges,
      bounds: null,
      reasons: missingEdges.map(edge => `${edge}-visual-edge-unavailable`)
    });
  }

  const bounds = {
    top: edges.top.position,
    left: edges.left.position,
    width: edges.right.position - edges.left.position,
    height: edges.bottom.position - edges.top.position
  };
  if (bounds.width <= 0 || bounds.height <= 0) {
    return createResult({
      source: outerLineGeometryObservation,
      status: "unavailable",
      edges,
      bounds: null,
      reasons: ["outer-visual-extent-ordering-invalid"]
    });
  }

  const status = EDGE_ORDER.some(edge => edges[edge].status === "ambiguous")
    ? "ambiguous"
    : EDGE_ORDER.some(edge => edges[edge].status === "partial")
      ? "partial"
      : "available";

  return createResult({
    source: outerLineGeometryObservation,
    status,
    edges,
    bounds,
    reasons: status === "available"
      ? []
      : [`outer-visual-extent-${status}`]
  });
}

function createEdgeObservation(edge, sourceEdge) {
  const definition = EDGE_DEFINITIONS[edge];
  const position = sourceEdge?.geometry?.[definition]?.position;
  const sourceStatus = readSourceEdgeStatus(sourceEdge);
  const available = Number.isFinite(position) && sourceStatus !== "unavailable";

  return {
    edge,
    status: available ? sourceStatus : "unavailable",
    position: available ? position : null,
    definition,
    evidenceReferences: cloneDeterministicValue(
      sourceEdge?.candidateRunProvenance?.evidenceReferences ?? []
    ),
    provenance: cloneDeterministicValue(sourceEdge?.provenance ?? null),
    reasons: available
      ? []
      : [`${definition}-unavailable`]
  };
}

function readSourceEdgeStatus(edge) {
  if (edge?.status === "unavailable" || edge?.geometryStatus === "unavailable") {
    return "unavailable";
  }
  if (edge?.status === "ambiguous" || edge?.geometryStatus === "ambiguous") {
    return "ambiguous";
  }
  if (edge?.status === "partial" || edge?.geometryStatus === "partial") {
    return "partial";
  }
  return "available";
}

function createUnavailableResult(source, reason) {
  return createResult({
    source,
    status: "unavailable",
    edges: Object.fromEntries(EDGE_ORDER.map(edge => [edge, {
      edge,
      status: "unavailable",
      position: null,
      definition: EDGE_DEFINITIONS[edge],
      evidenceReferences: [],
      provenance: null,
      reasons: [reason]
    }])),
    bounds: null,
    reasons: [reason]
  });
}

function createResult({ source, status, edges, bounds, reasons }) {
  const result = {
    type: "outer-visual-extent",
    version: VERSION,
    id: `outer-visual-extent:${source?.analysisRegionId ?? "unavailable"}`,
    status,
    coordinateSystem: cloneDeterministicValue(
      source?.coordinateSystem ?? null
    ),
    coordinateSpace: source?.coordinateSystem?.space ?? null,
    semantics: "observed-visible-outer-footprint",
    bounds: cloneDeterministicValue(bounds),
    edgeOrder: EDGE_ORDER.slice(),
    edges: cloneDeterministicValue(edges),
    provenance: {
      sourceArtifactType: source?.type ?? null,
      sourceArtifactVersion: source?.version ?? null,
      sourceAnalysisRegionId: source?.analysisRegionId ?? null,
      source: cloneDeterministicValue(source?.provenance ?? null),
      derivation: "outermost-factual-qualifying-continuity-positions"
    },
    evidenceReferences: cloneDeterministicValue(
      source?.evidenceReferences ?? []
    ),
    diagnostics: [{
      type: "outer-visual-extent-observation",
      edgeDefinitions: cloneDeterministicValue(EDGE_DEFINITIONS)
    }],
    reasons: reasons.slice()
  };

  rejectEvaluationFields(result, "outerVisualExtent");
  return deepFreeze(result);
}
