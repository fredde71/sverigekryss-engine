import fs from "fs";
import {
  createGridLatticeBoundsEvidenceProjection
} from "./GridLatticeBoundsEvidenceProjection";

test("projects one factual geometry interpretation as available bounds evidence", () => {
  const source = createSource({ availableInterpretations: ["accepted"] });
  const result = createGridLatticeBoundsEvidenceProjection({
    outerLineGeometryDiagnostics: source
  });
  const region = result.providers[0].regions[0];
  const horizontal = region.axisBounds.horizontal[0];
  const vertical = region.axisBounds.vertical[0];

  expect(result.status).toBe("available");
  expect(region.status).toBe("available");
  expect(horizontal).toMatchObject({
    axis: "horizontal",
    startEdge: "top",
    endEdge: "bottom",
    start: 10,
    end: 30,
    span: 20
  });
  expect(vertical).toMatchObject({
    axis: "vertical",
    startEdge: "left",
    endEdge: "right",
    start: 5,
    end: 35,
    span: 30
  });
  expect(region.rectangularCombinationSpace).toEqual({
    representation: "cartesian-product-by-reference",
    combinationOrder: "horizontal-major-vertical-minor",
    horizontalAxisBoundsIds: [horizontal.id],
    verticalAxisBoundsIds: [vertical.id],
    exactCombinationCount: 1,
    rawExactCombinationCount: 1,
    materializedCombinationCount: 0
  });
  expect(region).not.toHaveProperty("boundsCandidates");
});

test("preserves alternative definitions and ambiguous runs in deterministic order", () => {
  const source = createSource({
    availableInterpretations: ["accepted", "runs", "plateau"],
    ambiguousTopRuns: true
  });
  const first = createGridLatticeBoundsEvidenceProjection({
    outerLineGeometryDiagnostics: source
  });
  const second = createGridLatticeBoundsEvidenceProjection({
    outerLineGeometryDiagnostics: source
  });
  const region = first.providers[0].regions[0];

  expect(first.status).toBe("ambiguous");
  expect(region.status).toBe("ambiguous");
  expect(region.edgeAlternativeInventory.top.alternatives).toEqual([
    {
      interpretationId: "accepted-candidate-center",
      sourceIndex: 0,
      position: 10
    },
    {
      interpretationId: "strong-or-full-run-midpoint",
      sourceIndex: 0,
      position: 9.5
    },
    {
      interpretationId: "strong-or-full-run-midpoint",
      sourceIndex: 1,
      position: 10.5
    },
    {
      interpretationId: "maximum-projection-plateau-midpoint",
      sourceIndex: 0,
      position: 10
    }
  ]);
  expect(region.edgeAlternativeInventory.bottom.alternativeCount).toBe(3);
  expect(region.edgeAlternativeInventory.left.alternativeCount).toBe(3);
  expect(region.edgeAlternativeInventory.right.alternativeCount).toBe(3);
  expect(region.combinationInventory).toEqual({
    totalCombinationCount: 108,
    validBoundsCandidateCount: 108,
    canonicalBoundsCandidateCount: 24,
    rejectedCombinationCount: 0,
    representation: "factored-axis-product"
  });
  expect(region.axisBounds.horizontal).toHaveLength(6);
  expect(region.axisBounds.vertical).toHaveLength(4);
  expect(region.rectangularCombinationSpace).toEqual({
    representation: "cartesian-product-by-reference",
    combinationOrder: "horizontal-major-vertical-minor",
    horizontalAxisBoundsIds: region.axisBounds.horizontal.map(value => value.id),
    verticalAxisBoundsIds: region.axisBounds.vertical.map(value => value.id),
    exactCombinationCount: 24,
    rawExactCombinationCount: 108,
    materializedCombinationCount: 0
  });
  expect(region.interpretationInventory[1]).toMatchObject({
    interpretationId: "strong-or-full-run-midpoint",
    status: "available",
    edgePositionCounts: { top: 2, bottom: 1, left: 1, right: 1 }
  });
  expect(second).toEqual(first);
});

test("preserves provider and region ordering and provenance", () => {
  const source = createSource({ availableInterpretations: ["accepted"] });
  const secondProvider = JSON.parse(JSON.stringify(source.providers[0]));
  secondProvider.id = "provider-b";
  secondProvider.geometryObservations[0].regionId = "region-b";
  secondProvider.geometryObservations[0].observation.provenance.providerId =
    "provider-b";
  source.providers.push(secondProvider);

  const result = createGridLatticeBoundsEvidenceProjection({
    outerLineGeometryDiagnostics: source
  });

  expect(result.providers.map(provider => provider.providerId)).toEqual([
    "provider-a",
    "provider-b"
  ]);
  expect(result.providers.map(provider => provider.regions[0].regionId)).toEqual([
    "region-a",
    "region-b"
  ]);
  expect(result.providers[1].regions[0].axisBounds.horizontal[0].provenance)
    .toMatchObject({
      source: "shadow-outer-line-center-geometry-diagnostics",
      providerId: "provider-b",
      regionId: "region-b",
      axis: "horizontal",
      sourceObservationProvenance: {
        source: "geometry-fixture",
        providerId: "provider-b",
        regionId: "region-a"
      }
    });
});

test("returns unavailable without inventing bounds from incomplete edges", () => {
  const source = createSource({ availableInterpretations: ["accepted"] });
  source.providers[0].geometryObservations[0].observation.edges.right
    .acceptedCenterInParentBinaryImage = null;

  const result = createGridLatticeBoundsEvidenceProjection({
    outerLineGeometryDiagnostics: source
  });
  const region = result.providers[0].regions[0];

  expect(result.status).toBe("unavailable");
  expect(region.status).toBe("unavailable");
  expect(region.axisBounds.horizontal).toEqual([]);
  expect(region.axisBounds.vertical).toEqual([]);
  expect(region.reasons).toEqual([
    "complete-positive-bounds-candidate-unavailable"
  ]);
});

test("records invalid edge ordering without creating a bounds candidate", () => {
  const source = createSource({ availableInterpretations: ["accepted"] });
  source.providers[0].geometryObservations[0].observation.edges.bottom
    .acceptedCenterInParentBinaryImage = 5;

  const result = createGridLatticeBoundsEvidenceProjection({
    outerLineGeometryDiagnostics: source
  });
  const inventory = result.providers[0].regions[0].combinationInventory;

  expect(result.status).toBe("unavailable");
  expect(inventory).toEqual({
    totalCombinationCount: 1,
    validBoundsCandidateCount: 0,
    canonicalBoundsCandidateCount: 0,
    rejectedCombinationCount: 1,
    representation: "factored-axis-product"
  });
});

test("preserves the unique rectangular search space by axis reference", () => {
  const projection = createGridLatticeBoundsEvidenceProjection({
    outerLineGeometryDiagnostics: createSource({
      availableInterpretations: ["accepted"]
    })
  });
  const region = projection.providers[0].regions[0];

  expect(region.rectangularCombinationSpace).toEqual({
    representation: "cartesian-product-by-reference",
    combinationOrder: "horizontal-major-vertical-minor",
    horizontalAxisBoundsIds: [region.axisBounds.horizontal[0].id],
    verticalAxisBoundsIds: [region.axisBounds.vertical[0].id],
    exactCombinationCount: 1,
    rawExactCombinationCount: 1,
    materializedCombinationCount: 0
  });
  expect(region).not.toHaveProperty("boundsCandidates");
});

test("is deeply immutable without mutating source observations", () => {
  const source = deepFreeze(createSource({
    availableInterpretations: ["accepted", "centroid"]
  }));
  const before = JSON.stringify(source);
  const result = createGridLatticeBoundsEvidenceProjection({
    outerLineGeometryDiagnostics: source
  });

  expect(JSON.stringify(source)).toBe(before);
  expect(Object.isFrozen(result)).toBe(true);
  expect(Object.isFrozen(result.providers[0].regions[0].axisBounds.horizontal[0]))
    .toBe(true);
  expect(Object.isFrozen(
    result.providers[0].regions[0].rectangularCombinationSpace
      .horizontalAxisBoundsIds
  )).toBe(true);
  expect(() => {
    result.providers[0].regions[0].axisBounds.horizontal[0].start = 99;
  }).toThrow();
});

test("reports realistic four-edge cardinality without materializing rectangles", () => {
  const result = createGridLatticeBoundsEvidenceProjection({
    outerLineGeometryDiagnostics: createSource({
      availableInterpretations: [
        "accepted",
        "runs",
        "plateau",
        "centroid",
        "first",
        "last"
      ]
    })
  });
  const region = result.providers[0].regions[0];

  expect(Object.fromEntries(Object.entries(region.edgeAlternativeInventory).map(
    ([edge, inventory]) => [edge, inventory.alternativeCount]
  ))).toEqual({ top: 6, bottom: 6, left: 6, right: 6 });
  expect(region.axisBounds.horizontal).toHaveLength(25);
  expect(region.axisBounds.vertical).toHaveLength(25);
  expect(region.combinationInventory.validBoundsCandidateCount).toBe(1296);
  expect(region.combinationInventory.canonicalBoundsCandidateCount).toBe(625);
  expect(region.rectangularCombinationSpace.exactCombinationCount).toBe(625);
  expect(region.rectangularCombinationSpace.rawExactCombinationCount).toBe(1296);
  expect(region.rectangularCombinationSpace.materializedCombinationCount).toBe(0);
  expect(region).not.toHaveProperty("boundsCandidates");
});

test("contains no Ground Truth, reconstruction, ranking, scoring or selection", () => {
  const result = createGridLatticeBoundsEvidenceProjection({
    outerLineGeometryDiagnostics: createSource({
      availableInterpretations: ["accepted", "runs"]
    })
  });
  const keys = collectKeys(result);
  const source = fs.readFileSync(
    require.resolve("./GridLatticeBoundsEvidenceProjection"),
    "utf8"
  );

  expect(keys).not.toEqual(expect.arrayContaining([
    "score",
    "confidence",
    "rank",
    "ranking",
    "recommendation",
    "selectedBounds",
    "preferredBounds"
  ]));
  expect(source).not.toMatch(/groundTruth|grid-ground-truth/i);
  expect(source).not.toMatch(/generateGridLattice|selectGridLattice|createGridLattice\(/);
  expect(source).not.toMatch(/enumerateCombinations/);
});

test("returns explicit unavailable output for missing source diagnostics", () => {
  expect(createGridLatticeBoundsEvidenceProjection()).toEqual({
    type: "grid-lattice-reconstruction-bounds-evidence",
    version: 1,
    status: "unavailable",
    source: {
      type: "shadow-outer-line-center-geometry-diagnostics",
      version: 1
    },
    providerCount: 0,
    boundsCandidateCount: 0,
    rawBoundsCandidateCount: 0,
    providers: [],
    reasons: ["outer-line-center-geometry-diagnostics-unavailable"]
  });
});

function createSource({
  availableInterpretations,
  ambiguousTopRuns = false
}) {
  const edges = {
    top: createEdge("top", 10, availableInterpretations),
    bottom: createEdge("bottom", 30, availableInterpretations),
    left: createEdge("left", 5, availableInterpretations),
    right: createEdge("right", 35, availableInterpretations)
  };
  if (ambiguousTopRuns) {
    edges.top.geometry.contiguousStrongOrFullLineRuns = [
      run(9, 10),
      run(10, 11)
    ];
  }

  return {
    type: "shadow-outer-line-center-geometry-diagnostics",
    version: 1,
    status: "complete",
    providers: [{
      id: "provider-a",
      description: "Synthetic provider",
      status: "available",
      geometryObservations: [{
        providerId: "provider-a",
        regionId: "region-a",
        status: "completed",
        observation: {
          type: "outer-line-center-geometry-observation",
          version: 1,
          coordinateSystem: {
            space: "analysis-region-local",
            localToBinaryImage: {
              offsetX: 2,
              offsetY: 3,
              scaleX: 1,
              scaleY: 1
            }
          },
          edges,
          provenance: {
            source: "geometry-fixture",
            providerId: "provider-a",
            regionId: "region-a"
          }
        }
      }]
    }]
  };
}

function createEdge(edge, accepted, available) {
  const geometry = {
    contiguousStrongOrFullLineRuns: available.includes("runs")
      ? [run(accepted - 1, accepted)]
      : [],
    maximumProjectionPlateaus: available.includes("plateau")
      ? [plateau(accepted - 0.5, accepted + 0.5)]
      : [],
    projectionWeightedCentroid: available.includes("centroid")
      ? { position: accepted + 0.25 }
      : null,
    firstStrongOrFullContinuityPosition: available.includes("first")
      ? { position: accepted - 1 }
      : null,
    lastStrongOrFullContinuityPosition: available.includes("last")
      ? { position: accepted + 1 }
      : null
  };
  return {
    edge,
    status: "available",
    acceptedCenterInParentBinaryImage: available.includes("accepted")
      ? accepted
      : null,
    geometry,
    provenance: { source: "geometry-edge", edge }
  };
}

function run(start, end) {
  return {
    start: { position: start },
    end: { position: end },
    thickness: end - start + 1,
    midpoint: { position: start + ((end - start) / 2) }
  };
}

function plateau(start, end) {
  return {
    start: { position: start },
    end: { position: end },
    width: end - start + 1,
    midpoint: { position: start + ((end - start) / 2) }
  };
}

function collectKeys(value, result = []) {
  if (!value || typeof value !== "object") {
    return result;
  }
  Object.entries(value).forEach(([key, child]) => {
    result.push(key);
    collectKeys(child, result);
  });
  return result;
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
