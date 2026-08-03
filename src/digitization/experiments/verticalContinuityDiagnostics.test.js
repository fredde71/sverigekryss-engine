import { createVerticalProjection } from "../analysis/Projection";
import {
  createVerticalContinuityEvidence,
  createVerticalContinuityProjectionComparison
} from "./verticalContinuityDiagnostics";

const LOCAL_OPTIONS = {
  windowHeight: 9,
  horizontalRadius: 1,
  minContinuityRatio: 0.8
};

test("preserves a perfect vertical line and suppresses short noise", () => {
  const binaryImage = createBinaryImageFromDarkPixels({
    width: 9,
    height: 21,
    darkPixels: [
      ...createVerticalPixels(2, 0, 20),
      [6, 8],
      [6, 9],
      [6, 10],
      [8, 4]
    ]
  });
  const comparison = createVerticalContinuityProjectionComparison({
    binaryImage,
    rawVerticalProjection: createVerticalProjection(binaryImage),
    options: LOCAL_OPTIONS
  });

  expect(comparison).toEqual(expect.objectContaining({
    type: "vertical-continuity-projection-comparison",
    axis: "vertical",
    preprocessing: {
      method: "local-vertical-continuity",
      windowHeight: 9,
      horizontalRadius: 1,
      minContinuityRatio: 0.8,
      sourcePixelCount: 25,
      evidencePixelCount: 63,
      evidencePixelRatio: 63 / (9 * 21)
    },
    raw: expect.any(Object),
    scores: expect.any(Object),
    mask: expect.any(Object)
  }));
  expect(findPeak(comparison.mask, 2).strength).toBe(21);
  expect(findPeak(comparison.mask, 6).strength).toBe(0);
  expect(comparison.visualizations).toEqual([
    {
      id: "vertical-projection",
      title: "Vertical Projection",
      type: "vertical-projection",
      data: {
        axis: "vertical",
        axisLength: 21,
        length: 9,
        series: [
          {
            id: "raw",
            title: "Raw",
            values: Array.from(createVerticalProjection(binaryImage))
          },
          {
            id: "scores",
            title: "Continuity scores",
            values: expect.any(Array)
          },
          {
            id: "mask",
            title: "Continuity mask",
            values: expect.any(Array)
          }
        ]
      }
    }
  ]);
  expect(comparison.visualizations[0].data.series[1].values).toHaveLength(9);
  expect(comparison.visualizations[0].data.series[2].values).toHaveLength(9);
});

test("combines horizontally jittered line evidence without lowering 80 percent coverage", () => {
  const darkPixels = Array.from({ length: 20 }, (_, y) => [y % 2 === 0 ? 3 : 4, y]);
  const binaryImage = createBinaryImageFromDarkPixels({
    width: 8,
    height: 20,
    darkPixels
  });
  const rawProjection = createVerticalProjection(binaryImage);
  const evidence = createVerticalContinuityEvidence(binaryImage, LOCAL_OPTIONS);
  const maskProjection = createVerticalProjection(evidence.mask);

  expect(rawProjection[3]).toBe(10);
  expect(rawProjection[4]).toBe(10);
  expect(rawProjection[3]).toBeLessThan(20 * 0.8);
  expect(maskProjection[3]).toBe(20);
  expect(maskProjection[4]).toBe(20);
});

test("fills isolated one-row holes with local continuity evidence", () => {
  const binaryImage = createBinaryImageFromDarkPixels({
    width: 7,
    height: 21,
    darkPixels: createVerticalPixels(3, 0, 20)
      .filter(([, y]) => y !== 7 && y !== 14)
  });
  const evidence = createVerticalContinuityEvidence(binaryImage, LOCAL_OPTIONS);

  expect(binaryImage.data[(7 * 7) + 3]).toBe(0);
  expect(binaryImage.data[(14 * 7) + 3]).toBe(0);
  expect(evidence.mask.data[(7 * 7) + 3]).toBe(1);
  expect(evidence.mask.data[(14 * 7) + 3]).toBe(1);
});

test("does not bridge a gap that exceeds local continuity tolerance", () => {
  const binaryImage = createBinaryImageFromDarkPixels({
    width: 7,
    height: 21,
    darkPixels: createVerticalPixels(3, 0, 20)
      .filter(([, y]) => y < 7 || y > 9)
  });
  const evidence = createVerticalContinuityEvidence(binaryImage, LOCAL_OPTIONS);

  expect(evidence.scores[(8 * 7) + 3]).toBeCloseTo(6 / 9);
  expect(evidence.mask.data[(8 * 7) + 3]).toBe(0);
});

test("rejects disconnected fragments despite their large total vertical span", () => {
  const binaryImage = createBinaryImageFromDarkPixels({
    width: 7,
    height: 21,
    darkPixels: [
      ...createVerticalPixels(3, 0, 2),
      ...createVerticalPixels(3, 18, 20)
    ]
  });
  const evidence = createVerticalContinuityEvidence(binaryImage, LOCAL_OPTIONS);

  expect(createVerticalProjection(evidence.mask)[3]).toBe(0);
});

test("keeps a line but suppresses publisher-like clutter attached to it", () => {
  const binaryImage = createBinaryImageFromDarkPixels({
    width: 9,
    height: 21,
    darkPixels: [
      ...createVerticalPixels(3, 0, 20),
      ...createHorizontalPixels(5, 4, 7),
      ...createHorizontalPixels(15, 4, 7)
    ]
  });
  const evidence = createVerticalContinuityEvidence(binaryImage, LOCAL_OPTIONS);
  const maskProjection = createVerticalProjection(evidence.mask);

  expect(maskProjection[3]).toBe(21);
  expect(maskProjection[6]).toBe(0);
  expect(maskProjection[7]).toBe(0);
});

test("documents a tall text stem as a local-continuity false positive", () => {
  const binaryImage = createBinaryImageFromDarkPixels({
    width: 9,
    height: 21,
    darkPixels: createVerticalPixels(6, 4, 16)
  });
  const evidence = createVerticalContinuityEvidence(binaryImage, LOCAL_OPTIONS);

  expect(evidence.mask.data[(10 * 9) + 6]).toBe(1);
  expect(createVerticalProjection(evidence.mask)[6]).toBeGreaterThan(0);
});

test("documents merging when parallel lines are closer than the horizontal neighborhoods", () => {
  const binaryImage = createBinaryImageFromDarkPixels({
    width: 7,
    height: 21,
    darkPixels: [
      ...createVerticalPixels(2, 0, 20),
      ...createVerticalPixels(4, 0, 20)
    ]
  });
  const evidence = createVerticalContinuityEvidence(binaryImage, LOCAL_OPTIONS);
  const maskProjection = createVerticalProjection(evidence.mask);

  expect(Array.from(maskProjection.slice(1, 6))).toEqual([21, 21, 21, 21, 21]);
});

test("scores an image-edge line equivalently to an interior line", () => {
  const binaryImage = createBinaryImageFromDarkPixels({
    width: 9,
    height: 21,
    darkPixels: [
      ...createVerticalPixels(0, 0, 20),
      ...createVerticalPixels(5, 0, 20)
    ]
  });
  const evidence = createVerticalContinuityEvidence(binaryImage, LOCAL_OPTIONS);
  const maskProjection = createVerticalProjection(evidence.mask);

  expect(maskProjection[0]).toBe(21);
  expect(maskProjection[5]).toBe(21);
  expect(evidence.scoreProjection[0]).toBe(evidence.scoreProjection[5]);
});

test("is deterministic and does not mutate the BinaryImage input", () => {
  const binaryImage = createBinaryImageFromDarkPixels({
    width: 8,
    height: 13,
    darkPixels: [
      ...createVerticalPixels(2, 0, 12),
      [6, 3],
      [5, 8]
    ]
  });
  const sourceSnapshot = new Uint8Array(binaryImage.data);

  const first = createVerticalContinuityEvidence(binaryImage, LOCAL_OPTIONS);
  const second = createVerticalContinuityEvidence(binaryImage, LOCAL_OPTIONS);

  expect(binaryImage.data).toEqual(sourceSnapshot);
  expect(first.scores).toEqual(second.scores);
  expect(first.mask.data).toEqual(second.mask.data);
  expect(first.scoreProjection).toEqual(second.scoreProjection);
  expect(first.parameters).toEqual(second.parameters);
  expect(first.statistics).toEqual(second.statistics);
});

function findPeak(profile, position) {
  return profile.topPeaks.find(peak => peak.position === position);
}

function createVerticalPixels(x, startY, endY) {
  return Array.from({ length: endY - startY + 1 }, (_, offset) => [x, startY + offset]);
}

function createHorizontalPixels(y, startX, endX) {
  return Array.from({ length: endX - startX + 1 }, (_, offset) => [startX + offset, y]);
}

function createBinaryImageFromDarkPixels({
  width,
  height,
  darkPixels
}) {
  const data = new Uint8Array(width * height);

  for (const [x, y] of darkPixels) {
    data[(y * width) + x] = 1;
  }

  return {
    width,
    height,
    data
  };
}
