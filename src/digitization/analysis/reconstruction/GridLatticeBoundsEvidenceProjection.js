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

  return createGridLatticeFactoredBoundsEvidence({
    source: {
      type: outerLineGeometryDiagnostics.type,
      version: outerLineGeometryDiagnostics.version,
      status: outerLineGeometryDiagnostics.status ?? null
    },
    sourceId: outerLineGeometryDiagnostics.type,
    coordinateSystem: renderedCoordinateSystem(),
    providers: outerLineGeometryDiagnostics.providers.map(provider => ({
      id: provider?.id ?? null,
      description: provider?.description ?? null,
      status: provider?.status ?? null,
      reason: provider?.reason ?? null,
      regions: Array.isArray(provider?.geometryObservations)
        ? provider.geometryObservations
        : []
    }))
  });
}

export function createGridLatticeFactoredBoundsEvidence({
  source,
  sourceId,
  coordinateSystem,
  providers: sourceProviders
} = {}) {
  if (
    !source
    || typeof source !== "object"
    || typeof sourceId !== "string"
    || sourceId.length === 0
    || !coordinateSystem
    || typeof coordinateSystem !== "object"
    || !Array.isArray(sourceProviders)
  ) {
    return deepFreeze({
      type: "grid-lattice-reconstruction-bounds-evidence",
      version: VERSION,
      status: "unavailable",
      source: cloneDeterministicValue(source ?? null),
      providerCount: 0,
      boundsCandidateCount: 0,
      providers: [],
      reasons: ["outer-line-geometry-evidence-unavailable"]
    });
  }

  const providers = sourceProviders.map(provider => projectProvider({
    provider,
    sourceId,
    coordinateSystem
  }));
  const regions = providers.flatMap(provider => provider.regions);
  const boundsCandidateCount = regions.reduce(
    (count, region) => (
      count + region.combinationInventory.validBoundsCandidateCount
    ),
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
    source: cloneDeterministicValue(source),
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

function projectProvider({ provider, sourceId, coordinateSystem }) {
  const sourceRegions = Array.isArray(provider?.regions)
    ? provider.regions
    : [];
  const regions = sourceRegions.map(region => projectRegion({
    provider,
    region,
    sourceId,
    coordinateSystem
  }));
  const candidateCount = regions.reduce(
    (count, region) => (
      count + region.combinationInventory.validBoundsCandidateCount
    ),
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
      source: sourceId,
      providerId: provider?.id ?? null
    },
    regions,
    reasons: candidateCount === 0
      ? [normalizeReason(provider?.reason, "bounds-candidates-unavailable")]
      : []
  };
}

function projectRegion({ provider, region, sourceId, coordinateSystem }) {
  const observation = region?.observation;
  const base = {
    providerId: provider?.id ?? region?.providerId ?? null,
    regionId: region?.regionId ?? null,
    sourceStatus: region?.status ?? null,
    status: "unavailable",
    coordinateSystem: cloneDeterministicValue(coordinateSystem),
    sourceCoordinateSystem: cloneDeterministicValue(
      observation?.coordinateSystem ?? null
    ),
    sourceAcceptedCandidateEnvelope: cloneDeterministicValue(
      region?.sourceAcceptedCandidateEnvelope
        ?? observation?.sourceAcceptedCandidateEnvelope
        ?? null
    ),
    interpretationOrder: INTERPRETATIONS.map(value => value.id),
    interpretationInventory: [],
    edgeAlternativeInventory: {},
    combinationInventory: {
      totalCombinationCount: 0,
      validBoundsCandidateCount: 0,
      rejectedCombinationCount: 0,
      representation: "factored-axis-product"
    },
    axisBounds: {
      horizontal: [],
      vertical: []
    },
    rectangularCombinationSpace: {
      representation: "cartesian-product-by-reference",
      combinationOrder: "horizontal-major-vertical-minor",
      horizontalAxisBoundsIds: [],
      verticalAxisBoundsIds: [],
      exactCombinationCount: 0,
      materializedCombinationCount: 0
    },
    provenance: {
      source: sourceId,
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
  const rawHorizontalCount = hasEveryEdge
    ? edgeAlternatives.top.length * edgeAlternatives.bottom.length
    : 0;
  const rawVerticalCount = hasEveryEdge
    ? edgeAlternatives.left.length * edgeAlternatives.right.length
    : 0;
  base.axisBounds.horizontal = hasEveryEdge
    ? createAxisBoundsCandidates({
      axis: "horizontal",
      startEdge: "top",
      endEdge: "bottom",
      startAlternatives: edgeAlternatives.top,
      endAlternatives: edgeAlternatives.bottom,
      providerId: base.providerId,
      regionId: base.regionId,
      observation,
      sourceId,
      coordinateSystem
    })
    : [];
  base.axisBounds.vertical = hasEveryEdge
    ? createAxisBoundsCandidates({
      axis: "vertical",
      startEdge: "left",
      endEdge: "right",
      startAlternatives: edgeAlternatives.left,
      endAlternatives: edgeAlternatives.right,
      providerId: base.providerId,
      regionId: base.regionId,
      observation,
      sourceId,
      coordinateSystem
    })
    : [];

  const totalCombinationCount = rawHorizontalCount * rawVerticalCount;
  const validBoundsCandidateCount = (
    base.axisBounds.horizontal.length * base.axisBounds.vertical.length
  );
  base.combinationInventory.totalCombinationCount = totalCombinationCount;
  base.combinationInventory.validBoundsCandidateCount = validBoundsCandidateCount;
  base.combinationInventory.rejectedCombinationCount = (
    totalCombinationCount - validBoundsCandidateCount
  );
  base.rectangularCombinationSpace.horizontalAxisBoundsIds = (
    base.axisBounds.horizontal.map(value => value.id)
  );
  base.rectangularCombinationSpace.verticalAxisBoundsIds = (
    base.axisBounds.vertical.map(value => value.id)
  );
  base.rectangularCombinationSpace.exactCombinationCount = (
    validBoundsCandidateCount
  );

  base.status = validBoundsCandidateCount === 0
    ? "unavailable"
    : validBoundsCandidateCount === 1
      ? "available"
      : "ambiguous";
  base.reasons = base.status === "unavailable"
    ? ["complete-positive-bounds-candidate-unavailable"]
    : [];
  return base;
}

function createAxisBoundsCandidates({
  axis,
  startEdge,
  endEdge,
  startAlternatives,
  endAlternatives,
  providerId,
  regionId,
  observation,
  sourceId,
  coordinateSystem
}) {
  const candidates = [];
  for (const startAlternative of startAlternatives) {
    for (const endAlternative of endAlternatives) {
      if (endAlternative.position <= startAlternative.position) {
        continue;
      }
      const candidateIndex = candidates.length;
      const evidenceReference = [
        sourceId,
        safeId(providerId),
        safeId(regionId),
        axis,
        String(candidateIndex)
      ].join(":");
      candidates.push({
        id: [
          "grid-lattice-axis-bounds",
          safeId(providerId),
          safeId(regionId),
          axis,
          String(candidateIndex + 1).padStart(3, "0")
        ].join(":"),
        axis,
        startEdge,
        endEdge,
        start: startAlternative.position,
        end: endAlternative.position,
        span: endAlternative.position - startAlternative.position,
        startAlternative: cloneDeterministicValue(startAlternative),
        endAlternative: cloneDeterministicValue(endAlternative),
        coordinateSystem: cloneDeterministicValue(coordinateSystem),
        provenance: {
          source: sourceId,
          providerId,
          regionId,
          axis,
          establishment: "unconfirmed-observational-axis-envelope",
          sourceObservationProvenance: cloneDeterministicValue(
            observation?.provenance ?? null
          ),
          sourceEdgeProvenance: {
            [startEdge]: cloneDeterministicValue(
              observation?.edges?.[startEdge]?.provenance ?? null
            ),
            [endEdge]: cloneDeterministicValue(
              observation?.edges?.[endEdge]?.provenance ?? null
            )
          }
        },
        evidenceReferences: [evidenceReference]
      });
    }
  }
  return candidates;
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
