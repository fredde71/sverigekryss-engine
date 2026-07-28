import { detectGridFromImageSource } from "./detection/imageGridDetectionEngine";

test("digitization pipeline preserves immutable detection flow into a suggestion", async () => {
  const source = {
    id: "integration-source",
    kind: "mock-image"
  };
  const imageData = createRgbaImage({
    width: 5,
    height: 5,
    darkRows: [0, 2, 4],
    darkCols: [0, 2, 4]
  });
  const originalPixels = Array.from(imageData.data);
  const readImageData = jest.fn(async () => imageData);

  const result = await detectGridFromImageSource({
    source,
    options: {
      threshold: 128
    },
    readImageData
  });

  expect(readImageData).toHaveBeenCalledTimes(1);
  expect(readImageData).toHaveBeenCalledWith(source);
  expect(Array.from(imageData.data)).toEqual(originalPixels);

  expect(Object.isFrozen(result.context)).toBe(true);
  expect(result.context.imageData.data instanceof Uint8ClampedArray).toBe(true);
  expect(result.context.binaryImage.data instanceof Uint8Array).toBe(true);
  expect(result.context.projections.horizontal instanceof Uint32Array).toBe(true);
  expect(result.context.projections.vertical instanceof Uint32Array).toBe(true);

  expect(result.context.gridGeometry).toEqual({
    bounds: {
      top: 0,
      left: 0,
      width: 4,
      height: 4
    },
    horizontalLines: [0, 2, 4],
    verticalLines: [0, 2, 4],
    rows: 2,
    cols: 2
  });
  expect(result.gridDetection).toBe(result.context.gridDetection);
  expect(result.gridDetection).toEqual({
    geometry: result.context.gridGeometry,
    confidence: "detected",
    diagnostics: []
  });
  expect(Object.isFrozen(result.gridDetection)).toBe(true);
  expect(Object.isFrozen(result.gridDetection.geometry)).toBe(true);
  expect(Object.isFrozen(result.gridDetection.geometry.bounds)).toBe(true);
  expect(Object.isFrozen(result.gridDetection.diagnostics)).toBe(true);

  expect(result.suggestions).toHaveLength(1);
  expect(result.suggestions[0]).toEqual({
    sourceId: "integration-source",
    grid: result.gridDetection.geometry,
    confidence: "detected",
    diagnostics: []
  });
  expect(Object.isFrozen(result.suggestions[0])).toBe(true);
  expect(Object.isFrozen(result.suggestions[0].grid)).toBe(true);
  expect(Object.isFrozen(result.suggestions[0].grid.bounds)).toBe(true);
  expect(Object.isFrozen(result.suggestions[0].diagnostics)).toBe(true);

  const exposedImagePixels = result.context.imageData.data;
  const exposedBinaryPixels = result.context.binaryImage.data;

  exposedImagePixels.fill(255);
  exposedBinaryPixels.fill(0);

  expect(result.context.imageData.data[0]).toBe(0);
  expect(result.context.binaryImage.data[0]).toBe(1);
  expect(result.suggestions[0].grid.rows).toBe(result.gridDetection.geometry.rows);
  expect(result.suggestions[0].grid.cols).toBe(result.gridDetection.geometry.cols);
  expect(result.suggestions[0].confidence).toBe(result.gridDetection.confidence);
  expect(result.suggestions[0].diagnostics).toEqual(result.gridDetection.diagnostics);
});

test("digitization pipeline preserves missing-grid reasons without UI or filesystem input", async () => {
  const readImageData = jest.fn(async () => createRgbaImage({
    width: 5,
    height: 5
  }));

  const result = await detectGridFromImageSource({
    source: {
      id: "blank-integration-source"
    },
    readImageData
  });

  expect(readImageData).toHaveBeenCalledTimes(1);
  expect(result.context.gridDetection).toBe(result.gridDetection);
  expect(result.gridDetection).toEqual({
    geometry: null,
    confidence: "missing-grid-geometry",
    diagnostics: ["Grid geometry was not detected"]
  });
  expect(result.diagnostics).toEqual(result.gridDetection.diagnostics);
  expect(result.suggestions).toEqual([]);
  expect(Object.isFrozen(result.context)).toBe(true);
  expect(Object.isFrozen(result.gridDetection)).toBe(true);
  expect(Object.isFrozen(result.gridDetection.diagnostics)).toBe(true);
});

function createRgbaImage({
  width,
  height,
  darkRows = [],
  darkCols = []
}) {
  const data = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = ((y * width) + x) * 4;
      const isDark = darkRows.includes(y) || darkCols.includes(x);
      const value = isDark ? 0 : 255;

      data[offset] = value;
      data[offset + 1] = value;
      data[offset + 2] = value;
      data[offset + 3] = 255;
    }
  }

  return {
    width,
    height,
    data
  };
}
