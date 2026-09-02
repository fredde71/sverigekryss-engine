import fs from "fs";
import path from "path";
import {
  createGridLatticeFactoredBoundsEvidence
} from "./GridLatticeFactoredBoundsEvidence";

test("projects production-compatible outer geometry into factored axis bounds", () => {
  const result = createGridLatticeFactoredBoundsEvidence(createInput());
  const region = result.providers[0].regions[0];

  expect(result).toMatchObject({
    type: "grid-lattice-reconstruction-bounds-evidence",
    version: 1,
    status: "available",
    providerCount: 1,
    boundsCandidateCount: 1
  });
  expect(region.axisBounds.horizontal).toMatchObject([{
    axis: "horizontal",
    start: 10,
    end: 110,
    span: 100
  }]);
  expect(region.axisBounds.vertical).toMatchObject([{
    axis: "vertical",
    start: 20,
    end: 220,
    span: 200
  }]);
  expect(region.rectangularCombinationSpace).toMatchObject({
    representation: "cartesian-product-by-reference",
    exactCombinationCount: 1,
    materializedCombinationCount: 0
  });
});

test("preserves ambiguous edge alternatives as independent factored axes", () => {
  const input = createInput();
  input.providers[0].regions[0].observation.edges.top.geometry
    .projectionWeightedCentroid = { position: 10.25 };
  input.providers[0].regions[0].observation.edges.left.geometry
    .projectionWeightedCentroid = { position: 20.5 };

  const result = createGridLatticeFactoredBoundsEvidence(input);
  const region = result.providers[0].regions[0];

  expect(region.status).toBe("ambiguous");
  expect(region.axisBounds.horizontal).toHaveLength(2);
  expect(region.axisBounds.vertical).toHaveLength(2);
  expect(region.rectangularCombinationSpace).toMatchObject({
    horizontalAxisBoundsIds: region.axisBounds.horizontal.map(value => value.id),
    verticalAxisBoundsIds: region.axisBounds.vertical.map(value => value.id),
    exactCombinationCount: 4,
    materializedCombinationCount: 0
  });
  expect(region.combinationInventory).toMatchObject({
    validBoundsCandidateCount: 4,
    representation: "factored-axis-product"
  });
});

test("preserves coordinate provenance, transforms and candidate envelope separately", () => {
  const input = createInput();
  const result = createGridLatticeFactoredBoundsEvidence(input);
  const region = result.providers[0].regions[0];

  expect(region.coordinateSystem).toEqual(input.coordinateSystem);
  expect(region.sourceCoordinateSystem).toEqual(
    input.providers[0].regions[0].observation.coordinateSystem
  );
  expect(region.sourceAcceptedCandidateEnvelope).toEqual({
    top: 12,
    left: 22,
    width: 196,
    height: 96
  });
  expect(region.axisBounds.horizontal[0].provenance).toMatchObject({
    source: "production-outer-line-geometry",
    establishment: "unconfirmed-observational-axis-envelope",
    sourceObservationProvenance: {
      source: "production-outer-line-observation"
    }
  });
  expect(region.axisBounds.horizontal[0].start).toBe(10);
  expect(region.axisBounds.horizontal[0].end).toBe(110);
});

test("keeps unavailable outer geometry explicitly unavailable", () => {
  const input = createInput();
  input.providers[0].regions[0] = {
    providerId: "production-provider",
    regionId: "production-region",
    status: "unavailable",
    reason: "outer-line-geometry-unavailable",
    observation: null,
    sourceAcceptedCandidateEnvelope: {
      top: 12,
      left: 22,
      width: 196,
      height: 96
    }
  };

  const result = createGridLatticeFactoredBoundsEvidence(input);
  const region = result.providers[0].regions[0];

  expect(result.status).toBe("unavailable");
  expect(region.status).toBe("unavailable");
  expect(region.axisBounds).toEqual({ horizontal: [], vertical: [] });
  expect(region.sourceAcceptedCandidateEnvelope).toEqual({
    top: 12,
    left: 22,
    width: 196,
    height: 96
  });
  expect(region.reasons).toEqual(["outer-line-geometry-unavailable"]);
});

test("is deterministic, immutable, non-mutating and source-neutral", () => {
  const input = createInput();
  const before = JSON.stringify(input);
  const first = createGridLatticeFactoredBoundsEvidence(input);
  const second = createGridLatticeFactoredBoundsEvidence(input);
  const source = fs.readFileSync(
    path.join(
      path.dirname(require.resolve("./GridLatticeFactoredBoundsEvidence")),
      "GridLatticeFactoredBoundsEvidence.js"
    ),
    "utf8"
  );

  expect(second).toEqual(first);
  expect(JSON.stringify(input)).toBe(before);
  expect(Object.isFrozen(first)).toBe(true);
  expect(Object.isFrozen(first.providers[0].regions[0].axisBounds)).toBe(true);
  expect(source).not.toMatch(
    /shadow|dataset|experimentId|GroundTruth|validation|report/i
  );
});

function createInput() {
  const coordinateSystem = {
    space: "rendered-binary-image-pixels",
    unit: "pixel",
    origin: "top-left",
    xDirection: "right",
    yDirection: "down",
    linePosition: "visual-line-center",
    binaryImageToDocument: { scaleX: 0.5, scaleY: 0.5 }
  };
  return {
    source: {
      type: "production-outer-line-geometry",
      version: 1,
      status: "available"
    },
    sourceId: "production-outer-line-geometry",
    coordinateSystem,
    providers: [{
      id: "production-provider",
      description: "Production outer-line observations",
      status: "available",
      reason: null,
      regions: [{
        providerId: "production-provider",
        regionId: "production-region",
        status: "completed",
        sourceAcceptedCandidateEnvelope: {
          top: 12,
          left: 22,
          width: 196,
          height: 96
        },
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
          edges: {
            top: createEdge("top", 10),
            bottom: createEdge("bottom", 110),
            left: createEdge("left", 20),
            right: createEdge("right", 220)
          },
          provenance: { source: "production-outer-line-observation" }
        }
      }]
    }]
  };
}

function createEdge(edge, acceptedCenter) {
  return {
    edge,
    status: "available",
    acceptedCenterInParentBinaryImage: acceptedCenter,
    geometry: {
      contiguousStrongOrFullLineRuns: [],
      maximumProjectionPlateaus: [],
      projectionWeightedCentroid: null,
      firstStrongOrFullContinuityPosition: null,
      lastStrongOrFullContinuityPosition: null
    },
    provenance: { source: "production-edge-observation", edge }
  };
}
