import {
  cloneDeterministicValue,
  deepFreeze,
  rejectEvaluationFields
} from "./GridLatticeModelSupport";

const VERSION = 1;
const SOURCE_TYPE = "shadow-outer-line-center-geometry-diagnostics";
const EDGE_ORDER = Object.freeze(["top", "bottom", "left", "right"]);
const INTERPRETATIONS = Object.freeze([
  Object.freeze({
    id: "accepted-candidate-center",
    read: edge => finiteValues([edge?.acceptedCenterInParentBinaryImage])
  }),
  Object.freeze({
    id: "strong-or-full-run-midpoint",
    read: edge => readDerivedPositions(
      edge?.geometry?.contiguousStrongOrFullLineRuns,
      "midpoint"
    )
  }),
  Object.freeze({
    id: "maximum-projection-plateau-midpoint",
    read: edge => readDerivedPositions(
      edge?.geometry?.maximumProjectionPlateaus,
      "midpoint"
    )
  }),
  Object.freeze({
    id: "projection-weighted-centroid",
    read: edge => finiteValues([
      edge?.geometry?.projectionWeightedCentroid?.position
    ])
  }),
  Object.freeze({
    id: "first-strong-or-full-continuity-position",
    read: edge => finiteValues([
      edge?.geometry?.firstStrongOrFullContinuityPosition?.position
    ])
  }),
  Object.freeze({
    id: "last-strong-or-full-continuity-position",
    read: edge => finiteValues([
      edge?.geometry?.lastStrongOrFullContinuityPosition?.position
    ])
  })
]);

export function createGridLatticeBoundsEvidenceProjection({
  outerLineGeometryDiagnostics
} = {}) {
  if (
    outerLineGeometryDiagnostics?.type !== SOURCE_TYPE
    || outerLineGeometryDiagnostics?.version !== 1
    || !Array.isArray(outerLineGeometryDiagnostics?.providers)
  ) {
    return deepFreeze({
      type: "grid-lattice-reconstruction-bounds-evidence",
      version: VERSION,
      status: "unavailable",
      source: {
        type: SOURCE_TYPE,
        version: 1
      },
      providerCount: 0,
      boundsCandidateCount: 0,
      providers: [],
      reasons: ["outer-line-center-geometry-diagnostics-unavailable"]
    });
  }

  const providers = outerLineGeometryDiagnostics.providers.map(projectProvider);
  const regions = providers.flatMap(provider => provider.regions);
  const boundsCandidateCount = regions.reduce(
    (count, region) => count + region.boundsCandidates.length,
    0
  );
  const status = boundsCandidateCount === 0
    ? "unavailable"
    : regions.some(region => region.status === "ambiguous")
      ? "ambiguous"
      : "available";
  const result = {
    type: "grid-lattice-reconstruction-bounds-evidence",
    version: VERSION,
    status,
    source: {
      type: outerLineGeometryDiagnostics.type,
      version: outerLineGeometryDiagnostics.version,
      status: outerLineGeometryDiagnostics.status ?? null
    },
    providerCount: providers.length,
    boundsCandidateCount,
    providers,
    reasons: status === "unavailable"
      ? ["complete-outer-line-center-interpretation-unavailable"]
      : []
  };

  rejectEvaluationFields(result, "gridLatticeBoundsEvidenceProjection");
  return deepFreeze(result);
}

function projectProvider(provider) {
  const sourceRegions = Array.isArray(provider?.geometryObservations)
    ? provider.geometryObservations
    : [];
  const regions = sourceRegions.map(region => projectRegion(provider, region));
  const candidateCount = regions.reduce(
    (count, region) => count + region.boundsCandidates.length,
    0
  );

  return {
    providerId: provider?.id ?? null,
    description: provider?.description ?? null,
    sourceStatus: provider?.status ?? null,
    status: candidateCount === 0
      ? "unavailable"
      : regions.some(region => region.status === "ambiguous")
        ? "ambiguous"
        : "available",
    regionCount: regions.length,
    boundsCandidateCount: candidateCount,
    provenance: {
      source: SOURCE_TYPE,
      providerId: provider?.id ?? null
    },
    regions,
    reasons: candidateCount === 0
      ? [normalizeReason(provider?.reason, "bounds-candidates-unavailable")]
      : []
  };
}

function projectRegion(provider, region) {
  const observation = region?.observation;
  const base = {
    providerId: provider?.id ?? region?.providerId ?? null,
    regionId: region?.regionId ?? null,
    sourceStatus: region?.status ?? null,
    status: "unavailable",
    coordinateSystem: renderedCoordinateSystem(),
    sourceCoordinateSystem: cloneDeterministicValue(
      observation?.coordinateSystem ?? null
    ),
    interpretationOrder: INTERPRETATIONS.map(value => value.id),
    interpretationInventory: [],
    edgeAlternativeInventory: {},
    combinationInventory: {
      totalCombinationCount: 0,
      validBoundsCandidateCount: 0,
      rejectedCombinationCount: 0
    },
    boundsCandidates: [],
    provenance: {
      source: SOURCE_TYPE,
      providerId: provider?.id ?? region?.providerId ?? null,
      regionId: region?.regionId ?? null,
      sourceObservationType: observation?.type ?? null,
      sourceObservationVersion: observation?.version ?? null
    },
    reasons: []
  };

  if (region?.status !== "completed" || !observation?.edges) {
    base.reasons.push(normalizeReason(
      region?.error ?? region?.reason,
      "outer-line-center-geometry-observation-unavailable"
    ));
    return base;
  }

  const edgeAlternatives = Object.fromEntries(EDGE_ORDER.map(edge => [edge, []]));

  for (const interpretation of INTERPRETATIONS) {
    const edgePositions = Object.fromEntries(EDGE_ORDER.map(edge => [
      edge,
      interpretation.read(observation.edges[edge])
    ]));
    EDGE_ORDER.forEach(edge => {
      edgePositions[edge].forEach((position, sourceIndex) => {
        edgeAlternatives[edge].push({
          interpretationId: interpretation.id,
          sourceIndex,
          position
        });
      });
    });
    base.interpretationInventory.push({
      interpretationId: interpretation.id,
      status: EDGE_ORDER.some(edge => edgePositions[edge].length > 0)
        ? "available"
        : "unavailable",
      edgePositionCounts: Object.fromEntries(EDGE_ORDER.map(edge => [
        edge,
        edgePositions[edge].length
      ])),
      reasons: []
    });
  }

  base.edgeAlternativeInventory = Object.fromEntries(EDGE_ORDER.map(edge => [
    edge,
    {
      edge,
      alternativeCount: edgeAlternatives[edge].length,
      alternatives: cloneDeterministicValue(edgeAlternatives[edge])
    }
  ]));
  const hasEveryEdge = EDGE_ORDER.every(edge => edgeAlternatives[edge].length > 0);
  const combinations = hasEveryEdge
    ? enumerateCombinations(edgeAlternatives)
    : [];
  base.combinationInventory.totalCombinationCount = combinations.length;

  for (const combination of combinations) {
    if (
      combination.bottom.position <= combination.top.position
      || combination.right.position <= combination.left.position
    ) {
      base.combinationInventory.rejectedCombinationCount += 1;
      continue;
    }
    const candidateIndex = base.boundsCandidates.length;
    base.boundsCandidates.push(createBoundsCandidate({
      providerId: base.providerId,
      regionId: base.regionId,
      candidateIndex,
      combination,
      observation
    }));
    base.combinationInventory.validBoundsCandidateCount += 1;
  }

  base.status = base.boundsCandidates.length === 0
    ? "unavailable"
    : base.boundsCandidates.length === 1
      ? "available"
      : "ambiguous";
  base.reasons = base.status === "unavailable"
    ? ["complete-positive-bounds-candidate-unavailable"]
    : [];
  return base;
}

function createBoundsCandidate({
  providerId,
  regionId,
  candidateIndex,
  combination,
  observation
}) {
  const id = [
    "grid-lattice-bounds",
    safeId(providerId),
    safeId(regionId),
    String(candidateIndex + 1).padStart(3, "0")
  ].join(":");
  const edgeInterpretations = Object.fromEntries(EDGE_ORDER.map(edge => [
    edge,
    cloneDeterministicValue(combination[edge])
  ]));
  const interpretationIds = EDGE_ORDER.map(edge => (
    combination[edge].interpretationId
  ));
  const interpretationId = interpretationIds.every(value => (
    value === interpretationIds[0]
  ))
    ? interpretationIds[0]
    : "mixed-edge-geometric-descriptions";
  const evidenceReference = [
    SOURCE_TYPE,
    safeId(providerId),
    safeId(regionId),
    interpretationId,
    String(candidateIndex)
  ].join(":");
  const provenance = {
    source: SOURCE_TYPE,
    providerId,
    regionId,
    interpretationId,
    establishment: "unconfirmed-observational-outer-line-envelope",
    sourceObservationProvenance: cloneDeterministicValue(
      observation?.provenance ?? null
    ),
    sourceEdgeProvenance: Object.fromEntries(EDGE_ORDER.map(edge => [
      edge,
      cloneDeterministicValue(observation.edges[edge]?.provenance ?? null)
    ]))
  };
  const bounds = {
    top: combination.top.position,
    left: combination.left.position,
    width: combination.right.position - combination.left.position,
    height: combination.bottom.position - combination.top.position
  };

  return {
    id,
    status: "available",
    confirmationStatus: "unconfirmed-observation",
    interpretationId,
    edgeInterpretations,
    coordinateSystem: renderedCoordinateSystem(),
    edgePositions: Object.fromEntries(EDGE_ORDER.map(edge => [
      edge,
      combination[edge].position
    ])),
    bounds: cloneDeterministicValue(bounds),
    boundsObservation: {
      status: "available",
      semantics: "outer-line-center-envelope",
      coordinateSpace: "rendered-binary-image-pixels",
      bounds: cloneDeterministicValue(bounds),
      provenance: cloneDeterministicValue(provenance),
      evidenceReferences: [evidenceReference]
    },
    provenance,
    evidenceReferences: [evidenceReference],
    assumptions: [{
      code: "outer-edge-geometric-observations-combined-without-selection",
      edgeInterpretations: cloneDeterministicValue(edgeInterpretations)
    }],
    diagnostics: [{
      code: "outer-edge-positions-projected-as-unconfirmed-bounds-evidence",
      edgeOrder: EDGE_ORDER.slice()
    }],
    reasons: []
  };
}

function enumerateCombinations(edgePositions) {
  const combinations = [];
  for (const top of edgePositions.top) {
    for (const bottom of edgePositions.bottom) {
      for (const left of edgePositions.left) {
        for (const right of edgePositions.right) {
          combinations.push({ top, bottom, left, right });
        }
      }
    }
  }
  return combinations;
}

function readDerivedPositions(values, field) {
  if (!Array.isArray(values)) {
    return [];
  }
  return finiteValues(values.map(value => value?.[field]?.position));
}

function finiteValues(values) {
  return values.filter(Number.isFinite);
}

function renderedCoordinateSystem() {
  return {
    space: "rendered-binary-image-pixels",
    unit: "pixel",
    origin: "top-left",
    xDirection: "right",
    yDirection: "down",
    linePosition: "visual-line-center"
  };
}

function normalizeReason(value, fallback) {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }
  if (typeof value?.message === "string" && value.message.length > 0) {
    return value.message;
  }
  return fallback;
}

function safeId(value) {
  return typeof value === "string" && value.length > 0 ? value : "unknown";
}
