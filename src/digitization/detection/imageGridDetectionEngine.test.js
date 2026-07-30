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
    diagnostics: expect.arrayContaining([
      {
        type: "candidate-counts",
        axis: "horizontal",
        acceptedCount: 3,
        rejectedCount: 2,
        totalCount: 5
      },
      {
        type: "candidate-counts",
        axis: "vertical",
        acceptedCount: 3,
        rejectedCount: 2,
        totalCount: 5
      },
      {
        type: "spacing-consistency",
        axis: "horizontal",
        status: "measured",
        consistency: 1,
        min: 2,
        max: 2,
        average: 2
      },
      {
        type: "spacing-consistency",
        axis: "vertical",
        status: "measured",
        consistency: 1,
        min: 2,
        max: 2,
        average: 2
      },
      {
        type: "pre-rejection-bounds",
        bounds: {
          top: 0,
          left: 0,
          width: 4,
          height: 4
        }
      },
      {
        type: "rejection-reasons",
        reasons: []
      },
      {
        type: "acceptance-status",
        accepted: true
      }
    ])
  });
  expect(result.suggestions).toHaveLength(1);
  expect(result.suggestions[0].diagnostics).toEqual(result.gridDetection.diagnostics);
  expect(result.suggestions[0]).toMatchObject({
    sourceId: "grid-source",
    confidence: "detected",
    grid: {
      rows: 2,
      cols: 2
    }
  });
});

test("detectGridFromImageSource normalizes suggestion geometry to documentSize", async () => {
  const result = await detectGridFromImageSource({
    source: {
      id: "large-upload-source"
    },
    options: {
      documentSize: {
        width: 5,
        height: 20
      }
    },
    readImageData: jest.fn(async () => createRgbaImage({
      width: 10,
      height: 10,
      darkRows: [2, 4, 8],
      darkCols: [1, 5, 9]
    }))
  });

  expect(result.gridDetection.geometry).toEqual({
    bounds: {
      top: 4,
      left: 0.5,
      width: 4,
      height: 12
    },
    horizontalLines: [4, 8, 16],
    verticalLines: [0.5, 2.5, 4.5],
    rows: 2,
    cols: 2
  });
  expect(result.suggestions[0].grid).toEqual(result.gridDetection.geometry);
});

test("detectGridFromImageSource reports vertical projection profile before candidate filtering", async () => {
  const result = await detectGridFromImageSource({
    source: {
      id: "vertical-projection-source"
    },
    readImageData: jest.fn(async () => createRgbaImageFromDarkPixels({
      width: 6,
      height: 4,
      darkPixels: [
        [0, 0],
        [1, 0],
        [1, 1],
        [3, 0],
        [3, 1],
        [3, 2],
        [4, 0]
      ]
    }))
  });
  const projectionProfile = result.diagnostics.find(diagnostic => (
    diagnostic.type === "vertical-projection-profile"
  ));

  expect(projectionProfile).toEqual({
    type: "vertical-projection-profile",
    axis: "vertical",
    length: 6,
    maxStrength: 3,
    meanStrength: 7 / 6,
    medianStrength: 1,
    topPeaks: [
      { position: 3, strength: 3 },
      { position: 1, strength: 2 },
      { position: 0, strength: 1 },
      { position: 4, strength: 1 },
      { position: 2, strength: 0 },
      { position: 5, strength: 0 }
    ],
    runCount: 2,
    topRuns: [
      {
        start: 3,
        end: 4,
        position: 3.5,
        length: 2,
        maxStrength: 3,
        meanStrength: 2,
        maxCoverage: 3 / 4,
        meanCoverage: 2 / 4
      },
      {
        start: 0,
        end: 1,
        position: 0.5,
        length: 2,
        maxStrength: 2,
        meanStrength: 1.5,
        maxCoverage: 2 / 4,
        meanCoverage: 1.5 / 4
      }
    ]
  });
});

test("detectGridFromImageSource reports vertical-line mask projection comparison without changing raw candidate diagnostics", async () => {
  const result = await detectGridFromImageSource({
    source: {
      id: "vertical-line-mask-source"
    },
    readImageData: jest.fn(async () => createRgbaImageFromDarkPixels({
      width: 8,
      height: 8,
      darkPixels: [
        [2, 0],
        [2, 1],
        [2, 2],
        [2, 3],
        [2, 4],
        [2, 5],
        [2, 6],
        [2, 7],
        [5, 1],
        [5, 2],
        [6, 5]
      ]
    }))
  });
  const comparison = result.diagnostics.find(diagnostic => (
    diagnostic.type === "vertical-line-mask-projection-comparison"
  ));

  expect(comparison).toEqual({
    type: "vertical-line-mask-projection-comparison",
    axis: "vertical",
    preprocessing: {
      maskType: "vertical-line",
      minVerticalSpan: 5,
      sourcePixelCount: 11,
      retainedPixelCount: 8,
      retainedPixelRatio: 8 / 11,
      componentCount: 3,
      retainedComponentCount: 1
    },
    raw: expect.objectContaining({
      length: 8,
      maxStrength: 8,
      meanStrength: 11 / 8,
      medianStrength: 0,
      runCount: 2,
      topPeaks: expect.arrayContaining([
        { position: 2, strength: 8 },
        { position: 5, strength: 2 },
        { position: 6, strength: 1 }
      ]),
      topRuns: expect.arrayContaining([
        expect.objectContaining({
          start: 2,
          end: 2,
          maxStrength: 8,
          maxCoverage: 1
        }),
        expect.objectContaining({
          start: 5,
          end: 6,
          maxStrength: 2,
          maxCoverage: 2 / 8
        })
      ])
    }),
    mask: expect.objectContaining({
      length: 8,
      maxStrength: 8,
      meanStrength: 1,
      medianStrength: 0,
      runCount: 1,
      topPeaks: expect.arrayContaining([
        { position: 2, strength: 8 },
        { position: 5, strength: 0 },
        { position: 6, strength: 0 }
      ]),
      topRuns: [
        {
          start: 2,
          end: 2,
          position: 2,
          length: 1,
          maxStrength: 8,
          meanStrength: 8,
          maxCoverage: 1,
          meanCoverage: 1
        }
      ]
    })
  });
  expect(result.diagnostics).toEqual(expect.arrayContaining([
    {
      type: "candidate-counts",
      axis: "vertical",
      acceptedCount: 1,
      rejectedCount: 1,
      totalCount: 2
    }
  ]));
});

test("detectGridFromImageSource preserves long near-vertical structures in the diagnostic mask", async () => {
  const result = await detectGridFromImageSource({
    source: {
      id: "near-vertical-mask-source"
    },
    readImageData: jest.fn(async () => createRgbaImageFromDarkPixels({
      width: 6,
      height: 6,
      darkPixels: [
        [1, 0],
        [1, 1],
        [2, 2],
        [2, 3],
        [3, 4],
        [3, 5],
        [5, 0]
      ]
    }))
  });
  const comparison = result.diagnostics.find(diagnostic => (
    diagnostic.type === "vertical-line-mask-projection-comparison"
  ));

  expect(comparison.preprocessing).toEqual({
    maskType: "vertical-line",
    minVerticalSpan: 4,
    sourcePixelCount: 7,
    retainedPixelCount: 6,
    retainedPixelRatio: 6 / 7,
    componentCount: 2,
    retainedComponentCount: 1
  });
  expect(comparison.mask).toEqual(expect.objectContaining({
    maxStrength: 2,
    meanStrength: 1,
    runCount: 1,
    topPeaks: expect.arrayContaining([
      { position: 1, strength: 2 },
      { position: 2, strength: 2 },
      { position: 3, strength: 2 },
      { position: 5, strength: 0 }
    ])
  }));
});

test("detectGridFromImageSource reports candidate counts, spacing, bounds and rejection reasons", async () => {
  const result = await detectGridFromImageSource({
    source: {
      id: "publisher-diagnostics-source"
    },
    readImageData: jest.fn(async () => createPublisherDiagnosticImage())
  });

  expect(result.gridDetection.geometry).toBeNull();
  expect(result.suggestions).toEqual([]);
  expect(result.diagnostics).toEqual(expect.arrayContaining([
    {
      type: "candidate-counts",
      axis: "horizontal",
      acceptedCount: 1,
      rejectedCount: 1,
      totalCount: 2
    },
    {
      type: "candidate-counts",
      axis: "vertical",
      acceptedCount: 2,
      rejectedCount: 2,
      totalCount: 4
    },
    {
      type: "spacing-consistency",
      axis: "horizontal",
      status: "insufficient-candidates"
    },
    {
      type: "spacing-consistency",
      axis: "vertical",
      status: "measured",
      consistency: 1,
      min: 2,
      max: 2,
      average: 2
    },
    {
      type: "pre-rejection-bounds",
      bounds: {
        top: 0,
        left: 0,
        width: 2,
        height: 0
      }
    },
    {
      type: "rejection-reason",
      code: "insufficient-candidates",
      axis: "horizontal",
      candidateCount: 1,
      minimumCount: 2
    },
    {
      type: "acceptance-status",
      accepted: false
    }
  ]));
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
    diagnostics: expect.arrayContaining([
      {
        type: "candidate-counts",
        axis: "horizontal",
        acceptedCount: 0,
        rejectedCount: 0,
        totalCount: 0
      },
      {
        type: "candidate-counts",
        axis: "vertical",
        acceptedCount: 0,
        rejectedCount: 0,
        totalCount: 0
      },
      {
        type: "spacing-consistency",
        axis: "horizontal",
        status: "insufficient-candidates"
      },
      {
        type: "spacing-consistency",
        axis: "vertical",
        status: "insufficient-candidates"
      },
      {
        type: "pre-rejection-bounds",
        bounds: null
      },
      {
        type: "rejection-reason",
        code: "insufficient-candidates",
        axis: "horizontal",
        candidateCount: 0,
        minimumCount: 2
      },
      {
        type: "rejection-reason",
        code: "insufficient-candidates",
        axis: "vertical",
        candidateCount: 0,
        minimumCount: 2
      },
      {
        type: "acceptance-status",
        accepted: false
      }
    ])
  });
  expect(result.suggestions).toEqual([]);
  expect(result.diagnostics).toEqual(result.gridDetection.diagnostics);
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
  darkCols = [],
  weakRows = [],
  weakCols = []
}) {
  const data = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = ((y * width) + x) * 4;
      const isDark = darkRows.includes(y) || darkCols.includes(x);
      const isWeak = weakRows.includes(y) || weakCols.includes(x);
      const value = isDark || isWeak ? 0 : 255;
      const alpha = isWeak && !isDark ? 128 : 255;

      data[offset] = value;
      data[offset + 1] = value;
      data[offset + 2] = value;
      data[offset + 3] = alpha;
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

function createRgbaImageFromDarkPixels({
  width,
  height,
  darkPixels
}) {
  const data = new Uint8ClampedArray(width * height * 4);
  const darkPixelKeys = new Set(darkPixels.map(([x, y]) => `${x}:${y}`));

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = ((y * width) + x) * 4;
      const isDark = darkPixelKeys.has(`${x}:${y}`);
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

function createPublisherDiagnosticImage() {
  const width = 5;
  const height = 5;
  const data = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = ((y * width) + x) * 4;
      const isAcceptedHorizontal = y === 0;
      const isAcceptedVertical = x === 0 || x === 2;
      const isRejectedHorizontal = y === 3 && x === 4;
      const isRejectedVertical = x === 4 && y === 1;
      const isDark = isAcceptedHorizontal
        || isAcceptedVertical
        || isRejectedHorizontal
        || isRejectedVertical;
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
