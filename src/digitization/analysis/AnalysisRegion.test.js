import fs from "fs";
import { createDocumentAnalysis } from "./DocumentAnalysis";
import {
  createCompatibilityAnalysisRegion,
  mapAnalysisRegionGeometryToBinaryImage,
  mapAnalysisRegionPointToBinaryImage,
  mapBinaryImagePointToAnalysisRegion
} from "./AnalysisRegion";

test("creates a deterministic full-BinaryImage compatibility region", () => {
  const documentAnalysis = createDocumentAnalysis({
    imageData: createImageData(4, 3)
  });
  const first = createCompatibilityAnalysisRegion(documentAnalysis);
  const second = createCompatibilityAnalysisRegion(documentAnalysis);

  expect(first).toEqual(second);
  expect(first).toMatchObject({
    type: "analysis-region",
    version: 1,
    id: "compatibility-full-binary-image",
    status: "measured",
    regionType: "compatibility",
    bounds: {
      top: 0,
      left: 0,
      width: 4,
      height: 3
    },
    coordinateRelationship: {
      type: "identity",
      localToBinaryImage: {
        offsetX: 0,
        offsetY: 0,
        scaleX: 1,
        scaleY: 1
      },
      binaryImageToLocal: {
        offsetX: 0,
        offsetY: 0,
        scaleX: 1,
        scaleY: 1
      }
    }
  });
  expect(first.binaryImage).toBe(documentAnalysis.binaryImage);
  expect(first.binaryImage.data).toBe(documentAnalysis.binaryImage.data);
  expect(new Uint8Array(first.binaryImage.data)).toEqual(
    new Uint8Array(documentAnalysis.binaryImage.data)
  );
});

test("publishes deterministic compatibility diagnostics without production diagnostics", () => {
  const region = createCompatibilityAnalysisRegion(createDocumentAnalysis({
    imageData: createImageData(2, 5)
  }));

  expect(region.diagnostics).toEqual([
    {
      type: "analysis-region",
      version: 1,
      status: "measured",
      regionId: "compatibility-full-binary-image",
      regionType: "compatibility",
      bounds: { top: 0, left: 0, width: 2, height: 5 },
      coordinateRelationship: region.coordinateRelationship
    }
  ]);
});

test("keeps local and BinaryImage coordinate mapping identical", () => {
  const region = createCompatibilityAnalysisRegion(createDocumentAnalysis({
    imageData: createImageData(8, 6)
  }));
  const point = { x: 3.5, y: 4 };

  expect(mapAnalysisRegionPointToBinaryImage(region, point)).toEqual(point);
  expect(mapBinaryImagePointToAnalysisRegion(region, point)).toEqual(point);
  expect(mapBinaryImagePointToAnalysisRegion(
    region,
    mapAnalysisRegionPointToBinaryImage(region, point)
  )).toEqual(point);
});

test("maps a translated region geometry back to BinaryImage coordinates", () => {
  const region = {
    ...createCompatibilityAnalysisRegion(createDocumentAnalysis({
      imageData: createImageData(8, 12)
    })),
    id: "translated-region",
    regionType: "production-analysis-region",
    coordinateRelationship: {
      type: "translation",
      localToBinaryImage: {
        offsetX: 2,
        offsetY: 5,
        scaleX: 1,
        scaleY: 1
      },
      binaryImageToLocal: {
        offsetX: -2,
        offsetY: -5,
        scaleX: 1,
        scaleY: 1
      }
    }
  };
  const localGeometry = {
    bounds: { top: 0, left: 1, width: 4, height: 6 },
    horizontalLines: [0, 3, 6],
    verticalLines: [1, 3, 5],
    rows: 2,
    cols: 2
  };

  expect(mapAnalysisRegionPointToBinaryImage(region, { x: 1.5, y: 2 }))
    .toEqual({ x: 3.5, y: 7 });
  expect(mapBinaryImagePointToAnalysisRegion(region, { x: 3.5, y: 7 }))
    .toEqual({ x: 1.5, y: 2 });
  expect(mapAnalysisRegionGeometryToBinaryImage(region, localGeometry)).toEqual({
    bounds: { top: 5, left: 3, width: 4, height: 6 },
    horizontalLines: [5, 8, 11],
    verticalLines: [3, 5, 7],
    rows: 2,
    cols: 2
  });
});

test("introduces no discovery, crop, grid or candidate responsibility", () => {
  const source = fs.readFileSync(require.resolve("./AnalysisRegion"), "utf8");

  expect(source).not.toMatch(/createHorizontalProjection|createVerticalProjection/);
  expect(source).not.toMatch(/findLineCandidates|buildGridGeometry/);
  expect(source).not.toMatch(/crop|discover|threshold/i);
});

test("requires an existing measured DocumentAnalysis", () => {
  expect(() => createCompatibilityAnalysisRegion()).toThrow(
    "Measured DocumentAnalysis is required"
  );
});

function createImageData(width, height) {
  const data = new Uint8ClampedArray(width * height * 4);
  data.fill(255);

  for (let index = 3; index < data.length; index += 4) {
    data[index] = 255;
  }

  return { width, height, data };
}
