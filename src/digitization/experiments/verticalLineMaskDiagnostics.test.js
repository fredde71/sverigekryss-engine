import { createVerticalProjection } from "../analysis/Projection";
import { createVerticalLineMaskProjectionComparison } from "./verticalLineMaskDiagnostics";

test("createVerticalLineMaskProjectionComparison suppresses short details while preserving long vertical structures", () => {
  const binaryImage = createBinaryImageFromDarkPixels({
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
  });
  const comparison = createVerticalLineMaskProjectionComparison({
    binaryImage,
    rawVerticalProjection: createVerticalProjection(binaryImage)
  });

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
});

test("createVerticalLineMaskProjectionComparison preserves long near-vertical structures", () => {
  const binaryImage = createBinaryImageFromDarkPixels({
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
  });
  const comparison = createVerticalLineMaskProjectionComparison({
    binaryImage,
    rawVerticalProjection: createVerticalProjection(binaryImage)
  });

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

function createBinaryImageFromDarkPixels({
  width,
  height,
  darkPixels
}) {
  const data = new Uint8Array(width * height);
  const darkPixelKeys = new Set(darkPixels.map(([x, y]) => `${x}:${y}`));

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (darkPixelKeys.has(`${x}:${y}`)) {
        data[(y * width) + x] = 1;
      }
    }
  }

  return {
    width,
    height,
    data
  };
}
