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
    read: edge => finiteValues([
      edge?.acceptedCenterInObservationSpace
        ?? edge?.acceptedCenterInParentBinaryImage
    ])
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
      rawBoundsCandidateCount: 0,
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
      rawBoundsCandidateCount: 0,
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
      count + region.combinationInventory.canonicalBoundsCandidateCount
    ),
    0
  );
  const rawBoundsCandidateCount = regions.reduce(
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
    rawBoundsCandidateCount,
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
      count + region.combinationInventory.canonicalBoundsCandidateCount
    ),
    0
  );
  const rawCandidateCount = regions.reduce(
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
    rawBoundsCandidateCount: rawCandidateCount,
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
      canonicalBoundsCandidateCount: 0,
      rejectedCombinationCount: 0,
      representation: "factored-axis-product"
    },
    axisCombinationInventory: {
      horizontal: {
        totalCombinationCount: 0,
        validCombinationCount: 0,
        canonicalGeometryCount: 0
      },
      vertical: {
        totalCombinationCount: 0,
        validCombinationCount: 0,
        canonicalGeometryCount: 0
      }
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
      rawExactCombinationCount: 0,
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
  const horizontalProjection = hasEveryEdge
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
    : emptyAxisBoundsProjection();
  const verticalProjection = hasEveryEdge
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
    : emptyAxisBoundsProjection();
  base.axisBounds.horizontal = horizontalProjection.candidates;
  base.axisBounds.vertical = verticalProjection.candidates;
  base.axisCombinationInventory.horizontal = {
    totalCombinationCount: rawHorizontalCount,
    validCombinationCount: horizontalProjection.rawValidCombinationCount,
    canonicalGeometryCount: horizontalProjection.candidates.length
  };
  base.axisCombinationInventory.vertical = {
    totalCombinationCount: rawVerticalCount,
    validCombinationCount: verticalProjection.rawValidCombinationCount,
    canonicalGeometryCount: verticalProjection.candidates.length
  };

  const totalCombinationCount = rawHorizontalCount * rawVerticalCount;
  const rawValidBoundsCandidateCount = (
    horizontalProjection.rawValidCombinationCount
    * verticalProjection.rawValidCombinationCount
  );
  const canonicalBoundsCandidateCount = (
    base.axisBounds.horizontal.length * base.axisBounds.vertical.length
  );
  base.combinationInventory.totalCombinationCount = totalCombinationCount;
  base.combinationInventory.validBoundsCandidateCount = (
    rawValidBoundsCandidateCount
  );
  base.combinationInventory.canonicalBoundsCandidateCount = (
    canonicalBoundsCandidateCount
  );
  base.combinationInventory.rejectedCombinationCount = (
    totalCombinationCount - rawValidBoundsCandidateCount
  );
  base.rectangularCombinationSpace.horizontalAxisBoundsIds = (
    base.axisBounds.horizontal.map(value => value.id)
  );
  base.rectangularCombinationSpace.verticalAxisBoundsIds = (
    base.axisBounds.vertical.map(value => value.id)
  );
  base.rectangularCombinationSpace.exactCombinationCount = (
    canonicalBoundsCandidateCount
  );
  base.rectangularCombinationSpace.rawExactCombinationCount = (
    rawValidBoundsCandidateCount
  );

  base.status = canonicalBoundsCandidateCount === 0
    ? "unavailable"
    : canonicalBoundsCandidateCount === 1
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
  const candidatesByStart = new Map();
  let rawValidCombinationCount = 0;
  for (const startAlternative of startAlternatives) {
    for (const endAlternative of endAlternatives) {
      if (endAlternative.position <= startAlternative.position) {
        continue;
      }
      const rawCandidateIndex = rawValidCombinationCount;
      rawValidCombinationCount += 1;
      const evidenceReference = [
        sourceId,
        safeId(providerId),
        safeId(regionId),
        axis,
        String(rawCandidateIndex)
      ].join(":");
      const contribution = {
        startAlternative: cloneDeterministicValue(startAlternative),
        endAlternative: cloneDeterministicValue(endAlternative),
        evidenceReference
      };
      const existing = findCanonicalAxisBounds(
        candidatesByStart,
        startAlternative.position,
        endAlternative.position
      );

      if (existing) {
        existing.rawCombinationCount += 1;
        existing.contributingInterpretations.push(contribution);
        existing.evidenceReferences.push(evidenceReference);
        existing.provenance.canonicalization.rawCombinationCount += 1;
        continue;
      }

      const candidate = {
        id: [
          "grid-lattice-axis-bounds",
          safeId(providerId),
          safeId(regionId),
          axis,
          String(rawCandidateIndex + 1).padStart(3, "0")
        ].join(":"),
        axis,
        startEdge,
        endEdge,
        start: startAlternative.position,
        end: endAlternative.position,
        span: endAlternative.position - startAlternative.position,
        startAlternative: cloneDeterministicValue(startAlternative),
        endAlternative: cloneDeterministicValue(endAlternative),
        rawCombinationCount: 1,
        contributingInterpretations: [contribution],
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
          },
          canonicalization: {
            equality: "exact-numeric-axis-bounds",
            start: startAlternative.position,
            end: endAlternative.position,
            rawCombinationCount: 1
          }
        },
        evidenceReferences: [evidenceReference]
      };
      candidates.push(candidate);
      storeCanonicalAxisBounds(
        candidatesByStart,
        startAlternative.position,
        endAlternative.position,
        candidate
      );
    }
  }
  return { candidates, rawValidCombinationCount };
}

function emptyAxisBoundsProjection() {
  return { candidates: [], rawValidCombinationCount: 0 };
}

function findCanonicalAxisBounds(index, start, end) {
  return index.get(start)?.get(end) ?? null;
}

function storeCanonicalAxisBounds(index, start, end, candidate) {
  let byEnd = index.get(start);
  if (!byEnd) {
    byEnd = new Map();
    index.set(start, byEnd);
  }
  byEnd.set(end, candidate);
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
