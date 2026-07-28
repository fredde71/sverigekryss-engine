import { detectGridFromImageSource } from "./imageGridDetectionEngine";

test("detectGridFromImageSource detects grid geometry from a small RGBA image", async () => {
  const source = { id: "grid-source" };
  const imageData = createRgbaImage({
    width: 5,
    height: 5,
    darkRows: [0, 2, 4],
    darkCols: [0, 2, 4]
  });
  const result = await detectGridFromImageSource({
    source,
    readImageData: jest.fn(async () => imageData)
  });

  expect(result.gridDetection).toMatchObject({
    confidence: "detected",
    geometry: {
      bounds: {
        top: 0,
        left: 0,
        width: 4,
        height: 4
      },
      rows: 2,
      cols: 2,
      horizontalLines: [0, 2, 4],
      verticalLines: [0, 2, 4]
    },
    diagnostics: []
  });
  expect(result.suggestions).toHaveLength(1);
  expect(result.suggestions[0]).toMatchObject({
    sourceId: "grid-source",
    confidence: "detected",
    grid: {
      rows: 2,
      cols: 2
    }
  });
});

test("detectGridFromImageSource returns diagnostics and no suggestions when grid is missing", async () => {
  const result = await detectGridFromImageSource({
    source: { id: "blank-source" },
    readImageData: jest.fn(async () => createRgbaImage({
      width: 5,
      height: 5
    }))
  });

  expect(result.gridDetection).toEqual({
    geometry: null,
    confidence: "missing-grid-geometry",
    diagnostics: ["Grid geometry was not detected"]
  });
  expect(result.suggestions).toEqual([]);
  expect(result.diagnostics).toEqual(["Grid geometry was not detected"]);
});

test("transparent dark pixels are composited over white and do not form lines", async () => {
  const result = await detectGridFromImageSource({
    source: { id: "transparent-source" },
    readImageData: jest.fn(async () => createTransparentDarkImage({
      width: 5,
      height: 5
    }))
  });

  expect(result.gridDetection.geometry).toBeNull();
  expect(result.suggestions).toEqual([]);
});

test("detectGridFromImageSource supports async readers and reads image data exactly once", async () => {
  const readImageData = jest.fn(source => Promise.resolve(createRgbaImage({
    width: source.width,
    height: source.height,
    darkRows: [0, 2, 4],
    darkCols: [0, 2, 4]
  })));

  await detectGridFromImageSource({
    source: {
      id: "async-source",
      width: 5,
      height: 5
    },
    readImageData
  });

  expect(readImageData).toHaveBeenCalledTimes(1);
  expect(readImageData).toHaveBeenCalledWith({
    id: "async-source",
    width: 5,
    height: 5
  });
});

test("detectGridFromImageSource is deterministic for the same image data", async () => {
  const source = { id: "deterministic-source" };
  const readImageData = jest.fn(async () => createRgbaImage({
    width: 5,
    height: 5,
    darkRows: [0, 2, 4],
    darkCols: [0, 2, 4]
  }));

  const first = await detectGridFromImageSource({
    source,
    readImageData
  });
  const second = await detectGridFromImageSource({
    source,
    readImageData
  });

  expect(first.gridDetection).toEqual(second.gridDetection);
  expect(first.suggestions).toEqual(second.suggestions);
});

test("detectGridFromImageSource treats input pixel data as read-only", async () => {
  const imageData = createRgbaImage({
    width: 5,
    height: 5,
    darkRows: [0, 2, 4],
    darkCols: [0, 2, 4]
  });
  const originalPixels = Array.from(imageData.data);

  await detectGridFromImageSource({
    source: { id: "immutable-input-source" },
    readImageData: jest.fn(async () => imageData)
  });

  expect(Array.from(imageData.data)).toEqual(originalPixels);
});

test("returned AnalysisContext exposes defensive pixel copies", async () => {
  const result = await detectGridFromImageSource({
    source: { id: "context-copy-source" },
    readImageData: jest.fn(async () => createRgbaImage({
      width: 5,
      height: 5,
      darkRows: [0, 2, 4],
      darkCols: [0, 2, 4]
    }))
  });

  const imagePixels = result.context.imageData.data;
  const binaryPixels = result.context.binaryImage.data;

  imagePixels.fill(255);
  binaryPixels.fill(0);

  expect(result.context.imageData.data[0]).toBe(0);
  expect(result.context.binaryImage.data[0]).toBe(1);
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

function createTransparentDarkImage({
  width,
  height
}) {
  const data = new Uint8ClampedArray(width * height * 4);

  for (let i = 0; i < width * height; i++) {
    const offset = i * 4;

    data[offset] = 0;
    data[offset + 1] = 0;
    data[offset + 2] = 0;
    data[offset + 3] = 0;
  }

  return {
    width,
    height,
    data
  };
}
